import { AppError } from "@clanmind/shared";

/** §43 */
export interface Attachment {
  id: string;
  group_id: string;
  project_id: string | null;
  owner_user_id: string;
  object_ref: string;
  object_storage: "LOCAL_REFERENCE" | "R2";
  mime_type: string;
  byte_size: number;
  checksum: string | null;
  original_name: string;
  status: string;
  created_at: string;
  deleted_at: string | null;
}

export interface ObjectStoragePort {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

export interface AttachmentRepository {
  insert(input: Omit<Attachment, "created_at" | "deleted_at">): Promise<Attachment>;
  findById(id: string): Promise<Attachment | null>;
  softDelete(id: string): Promise<void>;
  linkToMessage(messageId: string, attachmentId: string): Promise<void>;
  listByMessage(messageId: string): Promise<Attachment[]>;
}

/** §83 object key pattern — server-generated, never client-supplied. */
export function objectKey(input: {
  group_id: string;
  project_id: string | null;
  object_id: string;
  version: number;
}): string {
  if (input.project_id) {
    return `groups/${input.group_id}/projects/${input.project_id}/objects/${input.object_id}/${input.version}`;
  }
  // Group-level files (no project context) stay inside the Group namespace
  // without inventing a fake project segment.
  return `groups/${input.group_id}/objects/${input.object_id}/${input.version}`;
}

/** §81 magic-byte sniffing for common types. */
export function sniffMime(bytes: Uint8Array): string | null {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  if (startsWith([0x25, 0x50, 0x44, 0x46])) return "application/pdf"; // %PDF
  if (startsWith([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x47, 0x49, 0x46, 0x38])) return "image/gif"; // GIF8
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57)
    return "image/webp"; // RIFF....WEBP
  if (startsWith([0x50, 0x4b, 0x03, 0x04])) return "application/zip";
  return null;
}

const BLOCKED_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "sh", "bash", "ps1",
  "dll", "so", "dylib", "jar", "app", "deb", "rpm",
]);

/**
 * §81 file security: never allow arbitrary executable uploads to be trusted;
 * validate size, extension, and sniffed type; checksum everything. Files are
 * never executed (§81); extraction pipelines come with I7.
 */
export async function validateUpload(input: {
  declared_mime: string;
  original_name: string;
  bytes: Uint8Array;
  max_bytes: number;
  attachments_per_message_max: number;
  current_attachment_count: number;
}): Promise<{ mime_type: string; checksum: string }> {
  const ext = input.original_name.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new AppError("VALIDATION_FAILED", "Executable file types are not allowed.");
  }
  if (input.bytes.byteLength === 0) {
    throw new AppError("VALIDATION_FAILED", "Empty file.");
  }
  if (input.bytes.byteLength > input.max_bytes) {
    throw new AppError("VALIDATION_FAILED", "File exceeds the size limit.");
  }
  if (input.current_attachment_count >= input.attachments_per_message_max) {
    throw new AppError("VALIDATION_FAILED", "Too many attachments for one message.");
  }
  const sniffed = sniffMime(input.bytes);
  if (sniffed && sniffed !== input.declared_mime) {
    throw new AppError("VALIDATION_FAILED", "File content does not match its declared type.");
  }
  return { mime_type: sniffed ?? input.declared_mime, checksum: await sha256Hex(input.bytes) };
}

/** Real SHA-256 (§81: checksum every upload) via WebCrypto. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer so the digest is independent of the
  // caller's view offset/length semantics.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * §84 short-lived signed URLs: HMAC-tokenized access granted only after
 * backend authorization. The token binds attachment id + expiry and is
 * meaningless after the window (§178: 15 minutes default).
 */
export interface SignedUrlCodec {
  sign(input: { attachment_id: string; expires_at: number }): Promise<string>;
  verify(token: string, attachmentId: string, now: number): Promise<boolean>;
}

export function createHmacSignedUrlCodec(secret: string): SignedUrlCodec {
  const key = () =>
    crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  return {
    async sign(input) {
      const payload = `${input.attachment_id}.${input.expires_at}`;
      const sig = await crypto.subtle.sign(
        "HMAC",
        await key(),
        new TextEncoder().encode(payload),
      );
      const sigHex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return `${input.expires_at}.${sigHex}`;
    },
    async verify(token, attachmentId, now) {
      const [expRaw, sigHex] = token.split(".");
      if (!expRaw || !sigHex) return false;
      const exp = Number(expRaw);
      if (!Number.isFinite(exp) || exp <= now) return false;
      const payload = `${attachmentId}.${expRaw}`;
      const expected = await crypto.subtle.sign(
        "HMAC",
        await key(),
        new TextEncoder().encode(payload),
      );
      const expectedHex = Array.from(new Uint8Array(expected))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return expectedHex === sigHex;
    },
  };
}

/** §43/§83 upload + storage routing. */
export class AttachmentService {
  constructor(
    private readonly attachments: AttachmentRepository,
    private readonly storage: ObjectStoragePort,
  ) {}

  async upload(input: {
    group_id: string;
    project_id: string | null;
    owner_user_id: string;
    original_name: string;
    declared_mime: string;
    bytes: Uint8Array;
    max_bytes: number;
    attachments_per_message_max: number;
    current_attachment_count: number;
  }): Promise<Attachment> {
    const checked = await validateUpload({
      declared_mime: input.declared_mime,
      original_name: input.original_name,
      bytes: input.bytes,
      max_bytes: input.max_bytes,
      attachments_per_message_max: input.attachments_per_message_max,
      current_attachment_count: input.current_attachment_count,
    });
    const id = crypto.randomUUID();
    const key = objectKey({
      group_id: input.group_id,
      project_id: input.project_id,
      object_id: id,
      version: 1,
    });
    await this.storage.put(key, input.bytes, checked.mime_type);
    return this.attachments.insert({
      id,
      group_id: input.group_id,
      project_id: input.project_id,
      owner_user_id: input.owner_user_id,
      object_ref: key,
      object_storage: "R2",
      mime_type: checked.mime_type,
      byte_size: input.bytes.byteLength,
      checksum: checked.checksum,
      original_name: input.original_name,
      status: "SYNCED",
    });
  }

  async linkToMessage(messageId: string, attachmentId: string): Promise<void> {
    await this.attachments.linkToMessage(messageId, attachmentId);
  }

  async listByMessage(messageId: string): Promise<Attachment[]> {
    return this.attachments.listByMessage(messageId);
  }

  async requireReadable(
    attachmentId: string,
    userId: string,
    authorize: (groupId: string, userId: string) => Promise<boolean>,
  ): Promise<Attachment> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment || attachment.deleted_at) {
      throw new AppError("NOT_FOUND", "Attachment not found.");
    }
    const allowed = await authorize(attachment.group_id, userId);
    if (!allowed) throw new AppError("FORBIDDEN", "You cannot access this file.");
    return attachment;
  }

  async readObject(
    attachmentId: string,
  ): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const attachment = await this.attachments.findById(attachmentId);
    if (!attachment || attachment.deleted_at) return null;
    return this.storage.get(attachment.object_ref);
  }
}

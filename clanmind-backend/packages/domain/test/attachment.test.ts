import { describe, expect, it } from "vitest";
import {
  AttachmentService,
  createHmacSignedUrlCodec,
  objectKey,
  sniffMime,
  validateUpload,
  type Attachment,
  type AttachmentRepository,
  type ObjectStoragePort,
} from "../src/index";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

function storage(): ObjectStoragePort & { stored: Map<string, Uint8Array> } {
  const stored = new Map<string, Uint8Array>();
  return {
    stored,
    async put(key, bytes) {
      stored.set(key, bytes);
    },
    async get(key) {
      const bytes = stored.get(key);
      return bytes ? { bytes, contentType: "application/octet-stream" } : null;
    },
  };
}

function repo() {
  const rows: Attachment[] = [];
  const r: AttachmentRepository = {
    async insert(input) {
      const row: Attachment = { ...input, created_at: new Date().toISOString(), deleted_at: null };
      rows.push(row);
      return row;
    },
    async findById(id) {
      return rows.find((a) => a.id === id) ?? null;
    },
    async softDelete(id) {
      const row = rows.find((a) => a.id === id);
      if (row) row.deleted_at = new Date().toISOString();
    },
    async linkToMessage() {},
    async listByMessage() {
      return [];
    },
  };
  return { rows, r };
}

describe("§81 upload validation", () => {
  const base = {
    original_name: "photo.png",
    declared_mime: "image/png",
    bytes: PNG_BYTES,
    max_bytes: 25 * 1024 * 1024,
    attachments_per_message_max: 10,
    current_attachment_count: 0,
  };

  it("accepts a genuine PNG with a real SHA-256 checksum (§81)", async () => {
    const result = await validateUpload(base);
    expect(result.mime_type).toBe("image/png");
    // 64 hex chars = real SHA-256, not the legacy stand-in hash.
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects executables by extension", async () => {
    await expect(
      validateUpload({ ...base, original_name: "tool.exe", declared_mime: "application/x-msdownload" }),
    ).rejects.toThrowError();
  });

  it("rejects a declared type that contradicts sniffed content", async () => {
    await expect(
      validateUpload({ ...base, declared_mime: "application/pdf" }),
    ).rejects.toThrowError();
  });

  it("rejects oversized files (§178)", async () => {
    await expect(validateUpload({ ...base, max_bytes: 4 })).rejects.toThrowError();
  });

  it("sniffs magic bytes for common formats", () => {
    expect(sniffMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 1]))).toBe("application/pdf");
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("§83 object keys", () => {
  it("uses the spec pattern with server-generated ids", () => {
    const key = objectKey({
      group_id: "g1",
      project_id: "p1",
      object_id: "o1",
      version: 1,
    });
    expect(key).toBe("groups/g1/projects/p1/objects/o1/1");
  });

  it("keeps group-level files inside the Group namespace without a fake project segment", () => {
    const key = objectKey({
      group_id: "g1",
      project_id: null,
      object_id: "o1",
      version: 1,
    });
    expect(key).toBe("groups/g1/objects/o1/1");
    expect(key).not.toContain("none");
  });
});

describe("§84 signed URLs", () => {
  const codec = createHmacSignedUrlCodec("url-signing-secret");
  const NOW = 1_000_000;

  it("round-trips a valid token", async () => {
    const token = await codec.sign({ attachment_id: "a1", expires_at: NOW + 900_000 });
    expect(await codec.verify(token, "a1", NOW)).toBe(true);
  });

  it("rejects expired tokens (§178: 15-minute lifetime)", async () => {
    const token = await codec.sign({ attachment_id: "a1", expires_at: NOW + 100 });
    expect(await codec.verify(token, "a1", NOW + 200)).toBe(false);
  });

  it("rejects tokens minted for another attachment", async () => {
    const token = await codec.sign({ attachment_id: "a1", expires_at: NOW + 900_000 });
    expect(await codec.verify(token, "a2", NOW)).toBe(false);
  });
});

describe("§43 upload flow", () => {
  it("stores bytes under the spec key and records metadata", async () => {
    const s = storage();
    const { rows, r } = repo();
    const svc = new AttachmentService(r, s);
    const attachment = await svc.upload({
      group_id: "g1",
      project_id: null,
      owner_user_id: "u1",
      original_name: "chart.png",
      declared_mime: "image/png",
      bytes: PNG_BYTES,
      max_bytes: 1000,
      attachments_per_message_max: 10,
      current_attachment_count: 0,
    });
    expect(attachment.status).toBe("SYNCED");
    expect(attachment.object_storage).toBe("R2");
    expect(attachment.object_ref).toMatch(/^groups\/g1\/objects\/[^/]+\/1$/);
    expect(s.stored.get(attachment.object_ref)).toEqual(PNG_BYTES);
    expect(rows).toHaveLength(1);
  });
});

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Attachment,
  AttachmentRepository,
  ObjectStoragePort,
} from "@clanmind/domain";
import type { Env } from "../env";

/** R2-backed object storage (§83). */
export class R2ObjectStorage implements ObjectStoragePort {
  constructor(private readonly env: Env) {}

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.env.SHARED_OBJECTS.put(key, bytes.slice().buffer as ArrayBuffer, {
      httpMetadata: { contentType },
    });
  }

  async get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const object = await this.env.SHARED_OBJECTS.get(key);
    if (!object) return null;
    const buffer = await object.arrayBuffer();
    return {
      bytes: new Uint8Array(buffer),
      contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }
}

/** Supabase implementation of the §43 attachment contract. */
export class SupabaseAttachmentRepository implements AttachmentRepository {
  constructor(private readonly db: SupabaseClient) {}

  async insert(input: Omit<Attachment, "created_at" | "deleted_at">): Promise<Attachment> {
    const { data, error } = await this.db
      .from("attachments")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Attachment;
  }

  async findById(id: string): Promise<Attachment | null> {
    const { data, error } = await this.db
      .from("attachments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return (data as Attachment | null) ?? null;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.db
      .from("attachments")
      .update({ deleted_at: new Date().toISOString(), status: "DELETED" })
      .eq("id", id);
    if (error) throw error;
  }

  async linkToMessage(messageId: string, attachmentId: string): Promise<void> {
    const { error } = await this.db
      .from("message_attachments")
      .insert({ message_id: messageId, attachment_id: attachmentId });
    if (error && error.code !== "23505") throw error;
  }

  async listByMessage(messageId: string): Promise<Attachment[]> {
    const { data, error } = await this.db
      .from("message_attachments")
      .select("attachments(*)")
      .eq("message_id", messageId);
    if (error) throw error;
    return ((data ?? []) as unknown as { attachments: Attachment }[])
      .map((row) => row.attachments)
      .filter((a): a is Attachment => a !== null);
  }
}

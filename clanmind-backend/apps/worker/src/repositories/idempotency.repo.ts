import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdempotencyRepository, StoredOperation } from "@clanmind/domain";

/** Supabase implementation of the §19 idempotency store. */
export class SupabaseIdempotencyRepository implements IdempotencyRepository {
  constructor(private readonly db: SupabaseClient) {}

  async find(actorId: string, operationId: string): Promise<StoredOperation | null> {
    const { data, error } = await this.db
      .from("idempotency_operations")
      .select("*")
      .eq("actor_id", actorId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) throw error;
    return (data as StoredOperation | null) ?? null;
  }

  async insert(input: {
    operation_id: string;
    actor_id: string;
    request_hash: string;
  }): Promise<StoredOperation> {
    const { data, error } = await this.db
      .from("idempotency_operations")
      .upsert(input, { onConflict: "actor_id,operation_id", ignoreDuplicates: true })
      .select()
      .maybeSingle();
    if (error) throw error;
    if (data) return data as StoredOperation;
    const existing = await this.db
      .from("idempotency_operations")
      .select("*")
      .eq("actor_id", input.actor_id)
      .eq("operation_id", input.operation_id)
      .maybeSingle();
    if (existing.error) throw existing.error;
    return existing.data as StoredOperation;
  }

  async recordResult(input: {
    operation_id: string;
    actor_id: string;
    result_status: number;
    result_body: unknown;
    result_reference: string | null;
  }): Promise<void> {
    const { error } = await this.db
      .from("idempotency_operations")
      .update({
        result_status: input.result_status,
        result_body: input.result_body,
        result_reference: input.result_reference,
      })
      .eq("actor_id", input.actor_id)
      .eq("operation_id", input.operation_id);
    if (error) throw error;
  }

  async deleteOlderThan(cutoff: string): Promise<void> {
    const { error } = await this.db
      .from("idempotency_operations")
      .delete()
      .lt("created_at", cutoff);
    if (error) throw error;
  }
}

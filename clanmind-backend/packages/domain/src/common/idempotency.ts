import { AppError } from "@clanmind/shared";

/**
 * §19 idempotency. Every state-changing client request accepts an
 * Idempotency-Key / client_operation_id; the same operation submitted twice
 * must produce one logical operation. The stored request hash detects a key
 * reused with a different payload (a client bug), which is a conflict.
 */
export interface StoredOperation {
  operation_id: string;
  actor_id: string;
  request_hash: string;
  result_status: number | null;
  result_body: unknown | null;
  result_reference: string | null;
  created_at: string;
}

export interface IdempotencyRepository {
  find(actorId: string, operationId: string): Promise<StoredOperation | null>;
  insert(input: {
    operation_id: string;
    actor_id: string;
    request_hash: string;
  }): Promise<StoredOperation>;
  recordResult(input: {
    operation_id: string;
    actor_id: string;
    result_status: number;
    result_body: unknown;
    result_reference: string | null;
  }): Promise<void>;
  deleteOlderThan(cutoff: string): Promise<void>;
}

export class IdempotencyService {
  constructor(private readonly repo: IdempotencyRepository) {}

  /**
   * Returns the replayed stored result when the operation was already
   * processed, or null when this is a first submission. Reusing a key with a
   * different payload is a conflict (§19).
   */
  async check(
    actorId: string,
    operationId: string,
    requestHash: string,
  ): Promise<{ replay: StoredOperation } | { first: StoredOperation } | null> {
    // No idempotency key → the caller opted out (non-retryable request).
    if (!operationId) return null;
    const existing = await this.repo.find(actorId, operationId);
    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new AppError(
          "CONFLICT",
          "This idempotency key was already used with a different request.",
        );
      }
      return { replay: existing };
    }
    return { first: await this.repo.insert({ operation_id: operationId, actor_id: actorId, request_hash: requestHash }) };
  }

  async record(input: {
    operation_id: string;
    actor_id: string;
    result_status: number;
    result_body: unknown;
    result_reference: string | null;
  }): Promise<void> {
    await this.repo.recordResult(input);
  }
}

/** Stable hash of method + path + body for replay comparison. */
export async function hashRequest(
  method: string,
  path: string,
  body: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${method}\n${path}\n${body}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

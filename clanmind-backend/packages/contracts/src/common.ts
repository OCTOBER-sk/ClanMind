import { z } from "zod";

/**
 * Shared wire-level shapes: §156 cursor pagination query params and §19
 * idempotency identity.
 */

export const paginationQuerySchema = z.object({
  before: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** §19: every state-changing client request carries one of these. */
export const idempotencySchema = z.object({
  idempotency_key: z.string().min(8).max(128),
});
export type Idempotency = z.infer<typeof idempotencySchema>;

/** §165 protocol/client version metadata returned to clients. */
export const clientVersionMetadataSchema = z.object({
  minimum_client_version: z.string(),
  recommended_client_version: z.string(),
  protocol_version: z.number().int().positive(),
});
export type ClientVersionMetadata = z.infer<typeof clientVersionMetadataSchema>;

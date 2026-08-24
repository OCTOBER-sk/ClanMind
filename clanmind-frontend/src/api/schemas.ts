/**
 * Wire contracts (zod) mirroring the backend payloads — runtime-validated at
 * the boundary per BE §152 ("never trust TypeScript types alone").
 *
 * Tolerance policy: objects use `.passthrough()` so unknown fields survive;
 * enum-ish columns parse as plain strings so UNKNOWN backend values flow into
 * generalized Unsupported-state UI instead of crashing (FE §200 pattern).
 * Canonical unions in `src/types/index.ts` remain the render-time vocabulary.
 */

import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

export const IdSchema = z.string().min(1);
export const IsoDateSchema = z.string().min(1);

export const ErrorEnvelopeSchema = z
  .object({
    error: z.object({
      code: z.string(),
      message: z.string().optional(),
      request_id: z.string().optional(),
    }),
  })
  .passthrough();

/** BE §94 quota contract. */
export const QuotaErrorDetailsSchema = z
  .object({
    code: z.literal('APPLICATION_AI_QUOTA_EXHAUSTED').optional(),
    can_continue_with_byok: z.boolean().optional(),
  })
  .passthrough();

// ─── Identity / profile (BE §6, §23) ────────────────────────────────────────

/**
 * BE §23 profile row — the real column is `email_snapshot` (email is a
 * snapshot at provisioning, not a live join). `email` stays optional so
 * demo fixtures and future backfills both parse.
 */
export const ProfileSchema = z
  .object({
    id: IdSchema,
    email: z.string().nullish(),
    email_snapshot: z.string().nullish(),
    display_name: z.string(),
    avatar_object_id: z.string().nullable().optional(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema.optional(),
    last_seen_at: IsoDateSchema.nullable().optional(),
  })
  .passthrough();

// ─── Groups / members / projects (BE §7/§24–§28) ────────────────────────────

export const GroupSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    description: z.string().nullish(),
    status: z.string(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema,
  })
  .passthrough();

export const GroupMemberSchema = z
  .object({
    group_id: IdSchema,
    user_id: IdSchema,
    role: z.string(),
    joined_at: IsoDateSchema,
    removed_at: z.string().nullish(),
    group_display_name: z.string().nullish(),
  })
  .passthrough();

export const ProjectSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    name: z.string(),
    description: z.string().nullish(),
    goal: z.string().nullish(),
    project_type: z.string().nullish(),
    status: z.string(),
    progress: z.number().nullish(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema,
    archived_at: z.string().nullish(),
  })
  .passthrough();

// ─── Messages (BE §11/§39) ──────────────────────────────────────────────────

/**
 * BE §43 `attachments` wire row — the exact shape the Worker returns from
 * POST /groups/:groupId/attachments (status "SYNCED" on insert today; the
 * §127 index axis rides separately once the backend exposes it).
 */
export const AttachmentRowSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    project_id: z.string().nullish(),
    owner_user_id: IdSchema,
    object_ref: z.string(),
    object_storage: z.string(),
    mime_type: z.string(),
    byte_size: z.number().int().nonnegative(),
    checksum: z.string().nullish(),
    original_name: z.string(),
    status: z.string(),
    created_at: IsoDateSchema,
    deleted_at: z.string().nullish(),
  })
  .passthrough();

export type AttachmentRow = z.infer<typeof AttachmentRowSchema>;

export const ReactionSchema = z
  .object({
    emoji: z.string(),
    count: z.number(),
    user_ids: z.array(z.string()),
  })
  .passthrough();

export const MessageSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    project_id: z.string().nullish(),
    sender_type: z.string(),
    sender_user_id: z.string().nullish(),
    visibility: z.string(),
    body: z.string(),
    body_format: z.string().default('markdown'),
    reply_to_id: z.string().nullish(),
    client_message_id: z.string(),
    server_sequence: z.number(),
    created_at: IsoDateSchema,
    edited_at: z.string().nullish(),
    deleted_at: z.string().nullish(),
  })
  .passthrough();

/** Cursor pagination (BE §156/§105): `?before=<cursor>&limit=50` → Page<Message>. */
export const MessagePageSchema = z
  .object({
    items: z.array(MessageSchema),
    next_cursor: z.string().nullable(),
  })
  .passthrough();

// ─── AI runs (BE §52/§57A) ──────────────────────────────────────────────────

export const AiToolCallSchema = z
  .object({
    id: IdSchema,
    ai_run_id: IdSchema,
    tool_name: z.string(),
    status: z.string(),
    input_json: z.unknown().optional(),
    output_json: z.unknown().optional(),
    started_at: IsoDateSchema,
    completed_at: z.string().nullish(),
  })
  .passthrough();

export const AiRunSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    project_id: z.string().nullish(),
    mode: z.string(),
    status: z.string(),
    model_used: z.string().optional(),
    is_fallback: z.boolean().optional(),
    failure_code: z.string().nullish(),
    created_at: IsoDateSchema,
    completed_at: z.string().nullish(),
  })
  .passthrough();

// ─── Approvals (BE §78A) ────────────────────────────────────────────────────

export const AiActionSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    action_kind: z.string(),
    risk_level: z.string(),
    status: z.string(),
    payload: z.unknown(),
    payload_hash: z.string(),
    payload_version: z.number(),
    requires_approval: z.boolean(),
    expires_at: z.string().nullish(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema.optional(),
  })
  .passthrough();

// ─── GitHub connection + actions (BE §77/§78/§113) ──────────────────────────

export const GithubConnectionSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    installation_id: z.number().nullable(),
    owner_login: z.string().nullish(),
    repo_name: z.string().nullish(),
    repo_full_name: z.string().nullish(),
    default_branch: z.string().nullish(),
    permission_mode: z.string(),
    connected_at: z.string().nullish(),
    disconnected_at: z.string().nullish(),
  })
  .passthrough();

export const GithubStatusResponseSchema = z
  .object({
    connected: z.boolean(),
    connection: GithubConnectionSchema.nullable(),
  })
  .passthrough();

/**
 * github_actions row + ai_actions(status, risk_level) join (BE §78/§78A.2).
 * The real backend does NOT include payload_hash/version/kind here — the
 * schema mirrors that honestly; approval envelopes come from the propose
 * response and the `github.action.proposed` fan-out instead.
 */
export const GithubActionItemSchema = z
  .object({
    id: IdSchema,
    ai_action_id: IdSchema,
    group_id: IdSchema,
    project_id: z.string().nullish(),
    action_type: z.string(),
    branch_name: z.string().nullish(),
    target_sha: z.string().nullish(),
    pr_number: z.number().nullish(),
    preview_json: z.unknown().nullish(),
    created_at: IsoDateSchema,
    completed_at: z.string().nullish(),
    status: z.string(),
    risk_level: z.string(),
  })
  .passthrough();

export const GithubActionListSchema = z
  .object({ items: z.array(GithubActionItemSchema).nullish() })
  .passthrough();

export const ApproveGithubActionResponseSchema = z
  .object({
    executed: z.boolean(),
    reason: z.string().optional(),
    action: AiActionSchema.nullish(),
  })
  .passthrough();

// ─── AI provider config (BE §31/§32/§63–§64) ────────────────────────────────

/** Sanitized §63.1 row — credential material never appears (key_last4 only). */
export const AiProviderConfigSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    kind: z.string(),
    provider: z.string(),
    credential_ref: z.string().nullable(),
    key_last4: z.string().nullable(),
    enabled: z.boolean(),
    created_at: IsoDateSchema,
  })
  .passthrough();

export const AiModelRouteSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    provider_config_id: IdSchema,
    role: z.string(),
    model_id: z.string(),
    priority: z.number(),
    enabled: z.boolean(),
    created_at: IsoDateSchema.optional(),
  })
  .passthrough();

export const AiConfigResponseSchema = z
  .object({
    configs: z.array(AiProviderConfigSchema),
    routes: z.array(AiModelRouteSchema),
  })
  .passthrough();

export const ModelDescriptorSchema = z
  .object({
    model_id: z.string(),
    display_name: z.string(),
    context_window: z.number().nullable(),
  })
  .passthrough();

/** POST /groups/:id/ai/providers/validate → {config(sanitized), models}. */
export const ValidateProviderResponseSchema = z
  .object({
    config: AiProviderConfigSchema,
    models: z.array(ModelDescriptorSchema).nullish(),
  })
  .passthrough();

// ─── Tasks / Decisions / Memory (BE §47/§48/§35/§36) ────────────────────────

/** BE §48 tasks row — CAS field `version`, no group column. */
export const TaskSchema = z
  .object({
    id: IdSchema,
    project_id: IdSchema,
    title: z.string(),
    description: z.string().nullish(),
    owner_user_id: z.string().nullish(),
    status: z.string(),
    priority: z.string(),
    due_at: z.string().nullish(),
    version: z.number().int(),
    created_by_user_id: z.string().nullish(),
    created_by_ai_id: z.string().nullish(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema,
    completed_at: z.string().nullish(),
  })
  .passthrough();

export const TaskListSchema = z
  .object({ items: z.array(TaskSchema).nullish() })
  .passthrough();

/** BE §47 decisions row — CAS field `version` drives §110 approve/reject. */
export const DecisionSchema = z
  .object({
    id: IdSchema,
    project_id: IdSchema,
    title: z.string(),
    context: z.string().nullish(),
    options: z.unknown().optional(),
    selected_option: z.unknown().optional(),
    rationale: z.string().nullish(),
    status: z.string(),
    version: z.number().int(),
    proposed_by: z.string().nullish(),
    approved_by: z.string().nullish(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema,
    approved_at: z.string().nullish(),
  })
  .passthrough();

export const DecisionListSchema = z
  .object({ items: z.array(DecisionSchema).nullish() })
  .passthrough();

/** BE §35 memories row — typed memory system, scope-tagged. */
export const MemoryEntrySchema = z
  .object({
    id: IdSchema,
    scope_type: z.string(),
    group_id: IdSchema,
    project_id: z.string().nullish(),
    user_id: z.string().nullish(),
    memory_type: z.string(),
    content: z.string(),
    normalized_content: z.string().nullish(),
    confidence: z.number(),
    importance: z.number(),
    source_type: z.string(),
    source_id: z.string().nullish(),
    status: z.string(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema,
    last_used_at: z.string().nullish(),
    archived_at: z.string().nullish(),
  })
  .passthrough();

export const MemoryListSchema = z
  .object({ items: z.array(MemoryEntrySchema).nullish() })
  .passthrough();

/** BE §36 memory_candidates row. */
export const MemoryCandidateSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema,
    project_id: z.string().nullish(),
    user_id: z.string().nullish(),
    source_message_id: z.string().nullish(),
    candidate_type: z.string(),
    content: z.string(),
    confidence: z.number(),
    recommended_scope: z.string(),
    status: z.string(),
    created_at: IsoDateSchema,
  })
  .passthrough();

export const MemoryCandidateListSchema = z
  .object({ items: z.array(MemoryCandidateSchema).nullish() })
  .passthrough();

export const MeetingCandidateSchema = z
  .object({
    id: IdSchema,
    meeting_session_id: IdSchema,
    candidate_type: z.string(),
    content: z.unknown(),
    confidence: z.number(),
    status: z.string(),
    promoted_to_type: z.string().nullish(),
    promoted_to_id: z.string().nullish(),
    created_at: IsoDateSchema,
  })
  .passthrough();

// ─── Notifications (BE §95A) ────────────────────────────────────────────────

export const NotificationSchema = z
  .object({
    id: IdSchema,
    recipient_user_id: IdSchema,
    group_id: IdSchema,
    category: z.string(),
    subject_type: z.string(),
    subject_id: IdSchema,
    title: z.string(),
    body: z.string().nullish(),
    delivery_state: z.string(),
    read_at: z.string().nullish(),
    created_at: IsoDateSchema,
  })
  .passthrough();

// ─── Protocol / flags (BE §165/§166) ────────────────────────────────────────

export const VersionMetaSchema = z
  .object({
    minimum_client_version: z.string(),
    recommended_client_version: z.string(),
    protocol_version: z.number(),
  })
  .passthrough();

export const FeatureFlagsSchema = z
  .object({
    meeting_mode: z.boolean().catch(false),
    proactive_ai: z.boolean().catch(false),
    github_write: z.boolean().catch(false),
    github_merge: z.boolean().catch(false),
    custom_skills: z.boolean().catch(false),
    deep_research: z.boolean().catch(false),
    offline_sync_v2: z.boolean().catch(false),
    interactive_artifacts: z.boolean().catch(false),
  })
  .passthrough();

// ─── Artifacts (BE §44–§46, §109) ────────────────────────────────────────────

/**
 * BE §44 version row. `content_ref` points into object storage on the real
 * backend (D15); when a response carries inline `content` the FE renders it,
 * otherwise the row is still usable for metadata (version menus, compare).
 */
export const ArtifactVersionRowSchema = z
  .object({
    id: IdSchema,
    artifact_id: IdSchema,
    version_number: z.number(),
    content_type: z.string().nullish(),
    content_ref: z.string().nullish(),
    checksum: z.string().nullish(),
    created_by_user_id: z.string().nullish(),
    created_by_ai_id: z.string().nullish(),
    parent_version_id: z.string().nullish(),
    created_at: IsoDateSchema,
    /** Inline content extension (demo parity / future backend surface). */
    content: z.string().nullish(),
    change_summary: z.string().nullish(),
  })
  .passthrough();

/** BE §44 artifact row + current-version join. */
export const ArtifactRowSchema = z
  .object({
    id: IdSchema,
    group_id: IdSchema.nullish(),
    project_id: IdSchema.nullish(),
    name: z.string().nullish(),
    title: z.string().nullish(),
    artifact_type: z.string(),
    status: z.string().nullish(),
    pinned: z.boolean().nullish(),
    current_version_id: z.string().nullish(),
    current_version: z.number().nullish(),
    created_by_user_id: z.string().nullish(),
    created_by_ai_id: z.string().nullish(),
    deleted_at: z.string().nullish(),
    created_at: IsoDateSchema,
    updated_at: IsoDateSchema,
    versions: z.array(ArtifactVersionRowSchema).nullish(),
  })
  .passthrough();

export const ArtifactListSchema = z
  .object({ items: z.array(ArtifactRowSchema).nullish() })
  .passthrough();

/**
 * ClanMind Canonical Types & Wire Contracts
 * Derived directly from ClanMind Frontend & Backend Master Implementation Specifications
 */

// ==========================================
// CANONICAL ENUMS (§7.1, §10, §11, §45, §47, §48, §51, §52, §57A, §78A, §95A, §164A, §165A, §189)
// ==========================================

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
export type GroupStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETING' | 'DELETED';

export type ProjectType =
  | 'software'
  | 'iot'
  | 'startup'
  | 'research'
  | 'college'
  | 'school'
  | 'personal'
  | 'firmware'
  | 'hardware'
  | 'other';

export type RightPanelMode =
  | 'closed'
  | 'artifact'
  | 'thread'
  | 'research'
  | 'context'
  | 'diff'
  | 'approval';

export type ProjectStatus = 'active' | 'archived';

export type SenderType = 'USER' | 'AI' | 'SYSTEM';
export type MessageVisibility = 'GROUP' | 'PRIVATE_PAIR' | 'PRIVATE_AI';

export type DecisionStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ArtifactType =
  | 'DOCUMENT'
  | 'MARKDOWN'
  | 'DIAGRAM'
  | 'FLOWCHART'
  | 'ARCHITECTURE'
  | 'GRAPH'
  | 'CHART'
  | 'TIMELINE'
  | 'MINDMAP'
  | 'DECISION_TREE'
  | 'TABLE'
  | 'RESEARCH'
  | 'IMAGE'
  | 'INTERACTIVE'
  | 'CODE'
  | 'HTML'
  | 'GIT_DIFF'
  | 'OTHER';

export type AiMode = 'ASSIST' | 'FACILITATE' | 'ACT';

export type AiRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_TOOL'
  | 'STREAMING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type AiToolCallStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DENIED';

export type RiskLevel = 'READ_ONLY' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AiActionStatus =
  | 'PROPOSED'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'EXPIRED';

export type MemoryScope = 'GROUP' | 'PROJECT' | 'USER_PRIVATE';
export type MemoryCandidateStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MERGED' | 'EXPIRED';

/** §124A.1 — mirrors BE `meeting_candidates.candidate_type` (§50A). */
export type MeetingCandidateType =
  | 'DECISION'
  | 'TASK'
  | 'OPEN_QUESTION'
  | 'CONTRADICTION'
  | 'RESEARCH_NEED'
  | 'MILESTONE_CHANGE';

/** §124A.2 — mirrors BE `meeting_candidates.status` (§50A). */
export type MeetingCandidateStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'MERGED' | 'EXPIRED';

export type NotificationCategory =
  | 'MENTION'
  | 'PRIVATE_MESSAGE'
  | 'AI_RESPONSE'
  | 'AI_ACTION_APPROVAL'
  | 'TASK_ASSIGNMENT'
  | 'DECISION_APPROVAL'
  | 'ARTIFACT_READY'
  | 'GITHUB_EVENT'
  | 'MEETING_SUMMARY'
  | 'PROACTIVE_AI'
  | 'SYSTEM';

export type NotificationDeliveryState =
  | 'PENDING'
  | 'DELIVERED_REALTIME'
  | 'DELIVERED_EMAIL'
  | 'SUPPRESSED_BY_PREFERENCE'
  | 'FAILED';

export type FileSyncState =
  | 'LOCAL_ONLY'
  | 'QUEUED'
  | 'UPLOADING'
  | 'SYNCED'
  | 'REMOTE_CHANGED'
  | 'LOCAL_CHANGED'
  | 'CONFLICT'
  | 'DELETED'
  | 'RESTORABLE';

export type FileIndexState = 'INDEXING' | 'READY' | 'FAILED' | 'STALE' | 'DELETED';

export type SyncOperationStatus = 'PENDING' | 'APPLIED' | 'REJECTED' | 'CONFLICT';
export type SyncConflictType = 'version_mismatch' | 'concurrent_edit' | 'deleted_upstream';
export type SyncResolutionStrategy = 'server_wins' | 'client_wins' | 'merged' | 'manual';

/**
 * BE §20A `sync_operations.operation_type` — dotted write identities. The
 * column is free-form text on the wire; these are the canonical values the
 * offline queue produces today (§186A.2 "every offline-capable write").
 */
export type SyncOperationType = 'message.create' | 'task.update';

export type PresenceState = 'ONLINE' | 'IDLE' | 'AWAY' | 'OFFLINE';

export type MainNavSection =
  | 'chat'
  | 'overview'
  | 'garage'
  | 'team'
  | 'tasks'
  | 'decisions'
  | 'context'
  | 'memory'
  | 'github'
  | 'settings'
  | 'activity';

export type SyncStateStatus = 'connected' | 'reconnecting' | 'offline' | 'syncing';


export type GitHubPermissionMode = 'READ_ONLY' | 'READ_WRITE';
export type GitHubConnectionStatus =
  | 'NOT_CONNECTED'
  | 'CONNECTING'
  | 'READ_ONLY'
  | 'READ_WRITE'
  | 'NEEDS_REAUTH'
  | 'DISCONNECTED';

/**
 * BE §77 `github_connections` row. The backend never returns credential
 * material; the FE renders connection metadata only.
 */
export interface GithubConnection {
  id: string;
  group_id: string;
  installation_id: number | null;
  owner_login: string | null;
  repo_name: string | null;
  repo_full_name: string | null;
  default_branch: string | null;
  permission_mode: GitHubPermissionMode;
  connected_at: string | null;
  disconnected_at: string | null;
}

/** GET /groups/:groupId/github/status response (handlers/github.ts). */
export interface GithubStatusResponse {
  connected: boolean;
  connection: GithubConnection | null;
}

/** BE §78 `action_type` vocabulary. */
export type GithubActionType = 'create_branch' | 'apply_patch' | 'create_pr' | 'merge_pr';

/**
 * One row of GET /projects/:projectId/github/actions — a `github_actions`
 * row with `status`/`risk_level` joined through ai_actions (BE §78/§78A.2).
 * NOTE: the real backend join exposes only status+risk_level; payload_hash,
 * payload_version, action_kind and payload are NOT on this row (recorded
 * gap in INTEGRATION_NOTES) — approval cards render only for envelopes the
 * client actually holds (§164A.2), never for partial rows.
 */
export interface GithubActionItem {
  /** github_actions row id — the ai_action id rides `ai_action_id`. */
  id: string;
  ai_action_id: string;
  group_id: string;
  project_id: string | null;
  action_type: GithubActionType | string;
  branch_name: string | null;
  target_sha: string | null;
  pr_number: number | null;
  preview_json: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
  /** Joined from ai_actions (§78A.2). */
  status: string;
  risk_level: string;
}

/** POST /projects/:projectId/github/actions → 202 {action, github_action}. */
export interface ProposeGithubActionResponse {
  action: AiAction;
  github_action: GithubActionItem;
}

/** POST /github/actions/:id/approve response — execution is transparent (§79). */
export interface ApproveGithubActionResponse {
  executed: boolean;
  reason?: string;
  action?: AiAction;
}

// ─── AI provider configuration (BE §31/§32/§63–§64) ─────────────────────────

export interface ModelDescriptor {
  model_id: string;
  display_name: string;
  context_window: number | null;
}

/**
 * Sanitized §63.1 provider config — metadata only, NEVER credential
 * material. `key_last4` is the only key-derived field that ever reaches
 * the client (`sk-…9F2A` style display).
 */
export interface AiProviderConfig {
  id: string;
  group_id: string;
  kind: 'APPLICATION' | 'BYOK';
  provider: string;
  /** §64bis: optional custom OpenAI-compatible base URL (local/custom gateways). */
  base_url?: string | null;
  credential_ref: string | null;
  key_last4: string | null;
  enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

/** BE §32 model route — one PRIMARY + up to three fallbacks. */
export type AiRouteRole = 'PRIMARY' | 'FALLBACK_1' | 'FALLBACK_2' | 'FALLBACK_3';

export interface AiModelRoute {
  id: string;
  group_id: string;
  provider_config_id: string;
  role: AiRouteRole;
  model_id: string;
  priority: number;
  enabled: boolean;
  created_at?: string;
}

/** GET /groups/:groupId/ai/config → sanitized configs + route slots. */
export interface AiConfigResponse {
  configs: AiProviderConfig[];
  routes: AiModelRoute[];
}

/**
 * BE §30 `ai_agents` row — the Group AI identity/personality configuration.
 * Reached through the settings agent surface; no REST route exists on the
 * real Worker yet (demo-parity only — INTEGRATION_NOTES D26).
 */
export interface AiAgentConfig {
  group_id: string;
  /** §129 admin-configurable identity name (default "Odin"). */
  name: string;
  avatar_object_id: string | null;
  tone: string | null;
  /** §168 personality preset + optional custom instructions. */
  personality_config: {
    preset: 'balanced' | 'direct' | 'creative' | 'analytical' | 'custom';
    custom_instructions?: string;
  };
  /**
   * BE §30 mode_policy jsonb — carries the §150 proactivity level and the
   * §169 capability toggles (client vocabulary mirrors FE spec ids).
   */
  mode_policy: {
    proactivity?: 'off' | 'low' | 'balanced' | 'high';
    permissions?: Record<
      | 'read_shared_files'
      | 'create_artifacts'
      | 'edit_project_objects'
      | 'use_web'
      | 'read_github'
      | 'modify_github'
      | 'create_pr'
      | 'merge_pr',
      boolean
    >;
  };
  updated_at?: string;
}

/** BE §27 `group_invites` row as returned by GET /groups/:id/invites. */
export interface GroupInvite {
  id: string;
  group_id: string;
  created_by: string;
  email: string | null;
  role: GroupRole;
  expires_at: string;
  max_uses: number | null;
  uses_count: number;
  revoked_at: string | null;
  created_at: string;
}

/**
 * POST /groups/:id/invites → 201 { invite, token } — the raw token is shown
 * ONCE to the inviting admin (BE §8.2); list responses never contain it.
 */
export interface InviteCreated {
  invite: GroupInvite;
  token: string;
}

/**
 * BE §92 quota counters — the Usage section reads exactly these counter
 * names. No real Worker route exists yet (demo-parity; D26).
 */
export interface UsageSnapshot {
  group_id: string;
  counters: {
    ai_requests: number;
    input_tokens: number;
    output_tokens: number;
    estimated_cost: number;
    research_calls: number;
    research_sources: number;
    artifact_generations: number;
    tool_calls: number;
    github_actions: number;
    shared_storage_bytes: number;
  };
  period_start: string;
}

// ==========================================
// DOMAIN ENTITIES & INTERFACES
// ==========================================

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export type MessageAttachment = Attachment;

export interface TypingIndicator {
  user_id: string;
  user_name: string;
  started_at: string;
}

export interface GroupMember {
  user_id: string;
  group_id: string;
  role: GroupRole;
  nickname?: string;
  user: User;
  joined_at: string;
  created_at?: string;
  updated_at?: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  status: GroupStatus;
  ai_name: string;
  ai_avatar_url?: string;
  ai_proactivity: 'off' | 'low' | 'balanced' | 'high';
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  group_id: string;
  name: string;
  goal?: string;
  description?: string;
  project_type: ProjectType;
  status: ProjectStatus;
  pulse_progress: number; // 0..100
  current_focus?: string;
  blocked_reason?: string;
  next_step?: string;
  created_at: string;
  updated_at: string;
}

/**
 * §48 — composer chip upload lifecycle. Orthogonal to the nine-value
 * FileSyncState transfer axis (§212): a chip is `uploaded` while its file may
 * still be INDEXING for AI context (§127, "Preparing for Odin…").
 */
export type AttachmentUploadState =
  | 'selected'
  | 'uploading'
  | 'uploaded'
  | 'failed'
  | 'cancelled';

export interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  /** Small local thumbnail source for images (§49); absent for other files. */
  file_url?: string;
  sync_state: FileSyncState;
  /** §127/§212 index axis — meaningful once the bytes have transferred. */
  index_state?: FileIndexState;
  upload_progress?: number; // 0..100
  /** §48 lifecycle driver for the composer chip rendering. */
  upload_state: AttachmentUploadState;
  /** BE §43 row id once the server has stored the object. */
  server_attachment_id?: string;
  /** §51 — failures stay visible with Retry/Remove; never silently dropped. */
  error_message?: string;
  /**
   * Runtime-only source handle so §51 Retry can re-upload without re-picking.
   * Deliberately not serializable and never sent anywhere by itself.
   */
  file?: File;
}

export interface Reaction {
  emoji: string;
  count: number;
  user_ids: string[];
}

export interface Message {
  id: string;
  client_message_id?: string;
  group_id: string;
  project_id?: string; // Optional context scoping
  sender_type: SenderType;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  body: string;
  visibility: MessageVisibility;
  recipient_id?: string;
  reply_to_message_id?: string;
  reply_to_preview?: string;
  thread_count?: number;
  pinned: boolean;
  edited: boolean;
  deleted: boolean;
  attachments: Attachment[];
  reactions: Reaction[];
  ai_run_id?: string;
  is_pending?: boolean;
  is_failed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiToolCall {
  id: string;
  run_id: string;
  tool_name: string;
  status: AiToolCallStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  started_at: string;
  completed_at?: string;
}

export interface AiSourceCitation {
  id: string;
  title: string;
  domain: string;
  url: string;
  snippet?: string;
  retrieved_at: string;
}

export interface AiRun {
  id: string;
  group_id: string;
  project_id?: string;
  status: AiRunStatus;
  mode: AiMode;
  prompt: string;
  model_used?: string;
  is_fallback?: boolean;
  is_byok?: boolean;
  tool_calls: AiToolCall[];
  sources: AiSourceCitation[];
  created_artifacts: string[]; // artifact IDs
  error_code?: string;
  error_message?: string;
  can_continue_with_byok?: boolean;
  created_at: string;
  completed_at?: string;
}

export interface ArtifactVersion {
  id?: string;
  artifact_id?: string;
  version_number: number;
  content: string; // Markdown, JSON, SVG, Code, etc.
  created_by_id?: string;
  created_by_name: string;
  ai_run_id?: string;
  summary?: string;
  change_summary?: string;
  created_at: string;
}

// ─── Structured artifact content schemas (BE §74 — stable domain schemas,
//     NEVER DOM/AI-emitted markup; the client renders them) ──────────────────

/** One diagram node as emitted by the backend artifact engine. */
export interface DiagramNodeSpec {
  id: string;
  label: string;
  /** Free-form domain kind from the backend registry (BE §45) — never a DOM hint. */
  kind?: string;
}

/** One directed edge; `label` is optional relationship text. */
export interface DiagramEdgeSpec {
  id?: string;
  source: string;
  target: string;
  label?: string;
}

/** BE §74 example payload shape for DIAGRAM-family artifacts. */
export interface DiagramContent {
  nodes: DiagramNodeSpec[];
  edges: DiagramEdgeSpec[];
}

/** CHART artifacts — typed series data, rendered by recharts on the client. */
export interface ChartSeriesSpec {
  key: string;
  label?: string;
  /** CSS color for the series; tokens preferred at the render site. */
  color?: string;
}

export interface ChartContent {
  chart_type: 'bar' | 'line' | 'area' | 'pie';
  title?: string;
  /** Data-row field used for the x axis / pie labels. */
  x_key: string;
  series: ChartSeriesSpec[];
  data: Array<Record<string, unknown>>;
}

export interface Artifact {
  id: string;
  group_id: string;
  project_id?: string;
  title: string;
  artifact_type: ArtifactType;
  current_version: number;
  versions: ArtifactVersion[];
  pinned: boolean;
  used_as_context: boolean;
  created_by_id?: string;
  created_at: string;
  updated_at: string;
  deleted?: boolean;
}

/**
 * BE §48 `tasks` row (exact column set; §21.2 optimistic concurrency via
 * `version`). There is no group_id — a Task lives inside one Project.
 */
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  owner_user_id?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at?: string | null;
  version: number;
  created_by_user_id?: string | null;
  created_by_ai_id?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  /**
   * §119 card anatomy renders "related decision". NOT a §48 column — the
   * real backend has no task→decision link today, so this rides only when
   * some surface provides it (demo dataset exercises the rendering). Live
   * rows never fabricate it.
   */
  related_decision_id?: string;
}

/**
 * BE §47 `decisions` row (exact column set; CAS on `version` for §110
 * approve/reject).
 */
export interface Decision {
  id: string;
  project_id: string;
  title: string;
  context?: string | null;
  options?: unknown;
  selected_option?: unknown;
  rationale?: string | null;
  status: DecisionStatus;
  version: number;
  proposed_by?: string | null;
  approved_by?: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  /**
   * §120 card shows "Sources". The §47 table has no sources column, so this
   * is a tolerated extension rendered only when present (demo fixtures
   * exercise it); live rows render an honest absence instead of inventing
   * citations.
   */
  sources?: string[];
}

/** BE §36 `memory_candidates` row. */
export interface MemoryCandidate {
  id: string;
  group_id: string;
  project_id?: string | null;
  user_id?: string | null;
  source_message_id?: string | null;
  candidate_type: string;
  content: string;
  confidence: number;
  recommended_scope: MemoryScope;
  status: MemoryCandidateStatus;
  created_at: string;
}

/**
 * BE §50 `meeting_sessions` row — the wire contract is authoritative; the
 * §123 header timer and the paused state (§213 matrix) are CLIENT-derived
 * presentations (the server enum is only ACTIVE|ENDED).
 */
export interface MeetingSession {
  id: string;
  group_id: string;
  project_id: string | null;
  started_by: string;
  started_at: string;
  ended_at: string | null;
  status: 'ACTIVE' | 'ENDED';
  summary_artifact_id: string | null;
}

/**
 * BE §50A `meeting_candidates` row. `content` is the jsonb payload the
 * detector produced (title/description/context keys are what the promote
 * callback reads); `promoted_to_type` is lowercase 'decision'|'task'.
 */
export interface MeetingCandidate {
  id: string;
  meeting_session_id: string;
  candidate_type: MeetingCandidateType;
  content: Record<string, unknown>;
  confidence: number;
  source_message_id: string | null;
  status: MeetingCandidateStatus;
  promoted_to_type: string | null;
  promoted_to_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

/**
 * BE §35 `memories` row. `memory_type` is free text server-side; the FE
 * §116 card vocabulary (DECISION/CONSTRAINT/CONVENTION/PREFERENCE/FINDING/
 * LESSON) is the render-time set and unknown values render as a generic
 * typed badge (generalized UI policy, never a crash).
 */
export interface MemoryEntry {
  id: string;
  scope_type: MemoryScope;
  group_id: string;
  project_id?: string | null;
  user_id?: string | null;
  memory_type: string;
  content: string;
  normalized_content?: string | null;
  confidence: number;
  importance: number;
  source_type: string;
  source_id?: string | null;
  status: 'ACTIVE' | 'ARCHIVED' | 'SUPERSEDED';
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
  archived_at?: string | null;
}

/** FE §116 card-type vocabulary for memory badges. */
export const MEMORY_CARD_TYPES = [
  'DECISION',
  'CONSTRAINT',
  'CONVENTION',
  'PREFERENCE',
  'FINDING',
  'LESSON',
] as const;
export type MemoryCardType = (typeof MEMORY_CARD_TYPES)[number];

export interface AiAction {
  id: string;
  group_id: string;
  project_id?: string;
  action_kind: string; // e.g. "MODIFY_GITHUB_FILES", "BULK_DELETE_ARTIFACTS", "REASSIGN_TASKS"
  risk_level: RiskLevel;
  status: AiActionStatus;
  payload: Record<string, unknown>;
  payload_hash: string;
  payload_version: number;
  requested_by_run_id?: string;
  requested_by_user_id?: string;
  rejected_by_user_id?: string;
  rejected_by_name?: string;
  created_at: string;
  expires_at?: string;
}

/**
 * Canonical notification = BE §95A row + the derived §193 deep link.
 * `read_at` is the server truth for read state (§277: mark read only when
 * actually viewed); `target_route` is derived client-side from
 * (subject_type, subject_id) at map time and is NOT a wire field.
 */
export interface NotificationItem {
  id: string;
  group_id: string;
  project_id: string | null;
  recipient_user_id: string;
  category: NotificationCategory;
  subject_type: string;
  subject_id: string;
  title: string;
  body: string | null;
  /** §95A verbatim — PENDING / DELIVERED_REALTIME / DELIVERED_EMAIL / SUPPRESSED_BY_PREFERENCE / FAILED */
  delivery_state: NotificationDeliveryState;
  read_at: string | null;
  created_at: string;
  /** Derived §193/§247 deep link (message/artifact/task/decision/meeting). */
  target_route: string;
}

export type Notification = NotificationItem;

/** BE §98A activity_events row (GET /groups/:groupId/activity). */
export interface ActivityEvent {
  id: string;
  group_id: string;
  project_id: string | null;
  actor_type: 'USER' | 'AI' | 'SYSTEM' | string;
  actor_user_id: string | null;
  actor_ai_id: string | null;
  activity_type: string;
  /** Pre-rendered server-side at write time; rendered verbatim (§98A). */
  summary: string;
  subject_type: string;
  subject_id: string;
  visibility: 'GROUP' | 'PROJECT' | string;
  occurred_at: string;
}

export interface ServerFeatureFlags {
  meeting_mode: boolean;
  proactive_ai: boolean;
  github_write: boolean;
  github_merge: boolean;
  custom_skills: boolean;
  deep_research: boolean;
  offline_sync_v2: boolean;
  interactive_artifacts: boolean;
}

export interface SyncCheckpoint {
  device_id: string;
  group_id: string;
  last_server_sequence: number;
  last_synced_at: string;
}

/**
 * Local mirror of a BE §20A `sync_operations` row (§186A.2). The client
 * persists these durably per account and replays them in creation order on
 * reconnect, ALWAYS reusing the identical `client_operation_id` (§19
 * idempotency — minting a new id would turn a retry into a duplicate write).
 */
export interface SyncOperation {
  id: string;
  /** §19/§20A — the idempotency identity, stable across every retry. */
  client_operation_id: string;
  group_id: string;
  /** BE §20A — dotted write identity ('message.create', 'task.update', …). */
  operation_type: SyncOperationType | (string & {});
  entity_type: string;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  status: SyncOperationStatus;
  /** BE §20A — id of the resulting row (message/task/…) once applied. */
  result_reference?: string | null;
  error_message?: string;
  created_at: string;
}

/**
 * Local mirror of a BE §20A `sync_conflicts` row. `conflict_type` drives the
 * §186A.3 card copy; resolution writes back through the SAME row (§186A.4).
 */
export interface SyncConflict {
  id: string;
  group_id: string;
  entity_type: string;
  entity_id: string;
  conflict_type: SyncConflictType;
  local_payload: Record<string, unknown>;
  server_payload: Record<string, unknown>;
  resolution_strategy?: SyncResolutionStrategy;
  resolved_by?: string;
  resolved_at?: string;
  /** The queued operation this conflict blocks (replays after resolution). */
  sync_operation_id?: string;
  created_at?: string;
}

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

export type MeetingCandidateType =
  | 'DECISION'
  | 'TASK'
  | 'OPEN_QUESTION'
  | 'CONTRADICTION'
  | 'RESEARCH_NEED'
  | 'MILESTONE_CHANGE';

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

export interface Task {
  id: string;
  group_id: string;
  project_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  source_message_id?: string;
  related_decision_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Decision {
  id: string;
  decision_number: number;
  group_id: string;
  project_id: string;
  title: string;
  status: DecisionStatus;
  context?: string;
  options?: string[];
  reason?: string;
  sources?: string[];
  approved_by_id?: string;
  approved_by_name?: string;
  source_message_id?: string;
  created_at: string;
  updated_at: string;
}

export interface MeetingCandidate {
  id: string;
  meeting_id: string;
  group_id: string;
  project_id: string;
  candidate_type: MeetingCandidateType;
  status: MemoryCandidateStatus;
  content: string;
  metadata?: Record<string, unknown>;
  promoted_to_type?: 'DECISION' | 'TASK';
  promoted_to_id?: string;
  created_at: string;
}

export interface MeetingSession {
  id: string;
  group_id: string;
  project_id: string;
  started_at: string;
  ended_at?: string;
  is_active: boolean;
  is_paused: boolean;
  elapsed_seconds: number;
  live_notes: string[];
  candidates: MeetingCandidate[];
}

export interface MemoryEntry {
  id: string;
  group_id: string;
  project_id?: string;
  scope: MemoryScope;
  entry_type: 'DECISION' | 'CONSTRAINT' | 'CONVENTION' | 'PREFERENCE' | 'FINDING' | 'LESSON' | 'FACT';
  title: string;
  content: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

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

export interface NotificationItem {
  id: string;
  group_id: string;
  category: NotificationCategory;
  delivery_state: NotificationDeliveryState;
  title: string;
  body: string;
  target_route: string; // Deep link route
  is_read: boolean;
  created_at: string;
}

export type Notification = NotificationItem;

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

export interface SyncOperation {
  id: string;
  client_operation_id: string;
  group_id: string;
  entity_type: string;
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: Record<string, unknown>;
  status: SyncOperationStatus;
  error_message?: string;
  created_at: string;
}

export interface SyncConflict {
  id: string;
  group_id: string;
  entity_type: string;
  entity_id: string;
  conflict_type: SyncConflictType;
  client_payload: Record<string, unknown>;
  server_payload: Record<string, unknown>;
  resolution_strategy?: SyncResolutionStrategy;
  resolved_by?: string;
  resolved_at?: string;
}

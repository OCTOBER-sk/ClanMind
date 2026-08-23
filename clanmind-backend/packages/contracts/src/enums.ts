import { z } from "zod";

/**
 * Canonical enum values, verbatim from the specification. These are the
 * single source of truth for every table CHECK constraint, service type, and
 * wire contract in the codebase.
 */

// §7.1 group roles
export const GroupRole = z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]);
export type GroupRole = z.infer<typeof GroupRole>;

// §24 group status
export const GroupStatus = z.enum(["ACTIVE", "ARCHIVED", "DELETING", "DELETED"]);
export type GroupStatus = z.infer<typeof GroupStatus>;

// §10.1 project types (metadata, not a limitation)
export const ProjectType = z.enum([
  "software",
  "iot",
  "startup",
  "research",
  "college",
  "school",
  "personal",
  "other",
]);
export type ProjectType = z.infer<typeof ProjectType>;

// §10 / §28 project status
export const ProjectStatus = z.enum(["active", "archived"]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

// §11.1 message sender types and visibility
export const SenderType = z.enum(["USER", "AI", "SYSTEM"]);
export type SenderType = z.infer<typeof SenderType>;

export const MessageVisibility = z.enum(["GROUP", "PRIVATE_PAIR", "PRIVATE_AI"]);
export type MessageVisibility = z.infer<typeof MessageVisibility>;

// §47 decision status
export const DecisionStatus = z.enum(["PROPOSED", "APPROVED", "REJECTED", "SUPERSEDED"]);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

// §48 task fields
export const TaskStatus = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
export type TaskStatus = z.infer<typeof TaskStatus>;
export const TaskPriority = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

// §45 artifact types
export const ArtifactType = z.enum([
  "DOCUMENT",
  "MARKDOWN",
  "DIAGRAM",
  "FLOWCHART",
  "ARCHITECTURE",
  "GRAPH",
  "CHART",
  "TIMELINE",
  "MINDMAP",
  "DECISION_TREE",
  "TABLE",
  "RESEARCH",
  "IMAGE",
  "INTERACTIVE",
  "CODE",
  "HTML",
  "OTHER",
]);
export type ArtifactType = z.infer<typeof ArtifactType>;

// §51 AI modes
export const AiMode = z.enum(["ASSIST", "FACILITATE", "ACT"]);
export type AiMode = z.infer<typeof AiMode>;

// §52 ai_runs.status
export const AiRunStatus = z.enum([
  "QUEUED",
  "RUNNING",
  "WAITING_TOOL",
  "STREAMING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type AiRunStatus = z.infer<typeof AiRunStatus>;

// §57A ai_tool_calls.status
export const AiToolCallStatus = z.enum([
  "PENDING",
  "APPROVED",
  "EXECUTING",
  "SUCCEEDED",
  "FAILED",
  "DENIED",
]);
export type AiToolCallStatus = z.infer<typeof AiToolCallStatus>;

// §56 tool risk levels == §78A risk levels == §2.6 risk table
export const RiskLevel = z.enum(["READ_ONLY", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

// §78A ai_actions.status
export const AiActionStatus = z.enum([
  "PROPOSED",
  "WAITING_APPROVAL",
  "APPROVED",
  "EXECUTING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED",
  "EXPIRED",
]);
export type AiActionStatus = z.infer<typeof AiActionStatus>;

// §35 memory scopes / §36 candidate states
export const MemoryScope = z.enum(["GROUP", "PROJECT", "USER_PRIVATE"]);
export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryCandidateStatus = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "MERGED",
  "EXPIRED",
]);
export type MemoryCandidateStatus = z.infer<typeof MemoryCandidateStatus>;

// §50A meeting candidate types/status
export const MeetingCandidateType = z.enum([
  "DECISION",
  "TASK",
  "OPEN_QUESTION",
  "CONTRADICTION",
  "RESEARCH_NEED",
  "MILESTONE_CHANGE",
]);
export type MeetingCandidateType = z.infer<typeof MeetingCandidateType>;

// §95/§95A notification categories and delivery states
export const NotificationCategory = z.enum([
  "MENTION",
  "PRIVATE_MESSAGE",
  "AI_RESPONSE",
  "AI_ACTION_APPROVAL",
  "TASK_ASSIGNMENT",
  "DECISION_APPROVAL",
  "ARTIFACT_READY",
  "GITHUB_EVENT",
  "MEETING_SUMMARY",
  "PROACTIVE_AI",
  "SYSTEM",
]);
export type NotificationCategory = z.infer<typeof NotificationCategory>;

export const NotificationDeliveryState = z.enum([
  "PENDING",
  "DELIVERED_REALTIME",
  "DELIVERED_EMAIL",
  "SUPPRESSED_BY_PREFERENCE",
  "FAILED",
]);
export type NotificationDeliveryState = z.infer<typeof NotificationDeliveryState>;

// §4.3 shared file synchronization states (nine values)
export const FileSyncState = z.enum([
  "LOCAL_ONLY",
  "QUEUED",
  "UPLOADING",
  "SYNCED",
  "REMOTE_CHANGED",
  "LOCAL_CHANGED",
  "CONFLICT",
  "DELETED",
  "RESTORABLE",
]);
export type FileSyncState = z.infer<typeof FileSyncState>;

// §127 file index states (orthogonal to sync state)
export const FileIndexState = z.enum(["INDEXING", "READY", "FAILED", "STALE", "DELETED"]);
export type FileIndexState = z.infer<typeof FileIndexState>;

// §20A sync_operations.status / conflict types / resolution strategies
export const SyncOperationStatus = z.enum(["PENDING", "APPLIED", "REJECTED", "CONFLICT"]);
export type SyncOperationStatus = z.infer<typeof SyncOperationStatus>;

export const SyncConflictType = z.enum([
  "version_mismatch",
  "concurrent_edit",
  "deleted_upstream",
]);
export type SyncConflictType = z.infer<typeof SyncConflictType>;

export const SyncResolutionStrategy = z.enum([
  "server_wins",
  "client_wins",
  "merged",
  "manual",
]);
export type SyncResolutionStrategy = z.infer<typeof SyncResolutionStrategy>;

// §40 private conversation types
export const PrivateConversationType = z.enum(["HUMAN_PAIR", "AI"]);
export type PrivateConversationType = z.infer<typeof PrivateConversationType>;

// §43 attachment object storage
export const ObjectStorage = z.enum(["LOCAL_REFERENCE", "R2"]);
export type ObjectStorage = z.infer<typeof ObjectStorage>;

// §31 provider config kinds / §32 route roles
export const ProviderConfigKind = z.enum(["APPLICATION", "BYOK"]);
export type ProviderConfigKind = z.infer<typeof ProviderConfigKind>;

export const ModelRouteRole = z.enum(["PRIMARY", "FALLBACK_1", "FALLBACK_2", "FALLBACK_3"]);
export type ModelRouteRole = z.infer<typeof ModelRouteRole>;

// §77 GitHub connection permission modes
export const GitHubPermissionMode = z.enum(["READ_ONLY", "READ_WRITE"]);
export type GitHubPermissionMode = z.infer<typeof GitHubPermissionMode>;

// §96 presence states
export const PresenceState = z.enum(["ONLINE", "IDLE", "AWAY", "OFFLINE"]);
export type PresenceState = z.infer<typeof PresenceState>;

// §119 deep research job statuses
export const ResearchJobStatus = z.enum([
  "QUEUED",
  "RUNNING",
  "SEARCHING",
  "SYNTHESIZING",
  "VALIDATING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type ResearchJobStatus = z.infer<typeof ResearchJobStatus>;

// §158A background job statuses
export const BackgroundJobStatus = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
]);
export type BackgroundJobStatus = z.infer<typeof BackgroundJobStatus>;

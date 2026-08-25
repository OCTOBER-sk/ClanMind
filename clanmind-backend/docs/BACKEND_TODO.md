# ClanMind Backend — Master TODO (derived from the Master Implementation Specification)

> Source of truth: `ClanMind Backend — Master Implementation Specification.md` (repo root, 6,171 lines).
> Every item below is a **claim about runtime behavior under real requests**, not paperwork. Each must be
> verifiable in code and by test. Section references (`§N`) point into the spec.
> Grading scale for the audit that consumes this list: PASS / PARTIAL / FAIL / NOT-IMPLEMENTED.

---

## 1. Foundations & Conventions

- [ ] §3.2 Modular monolith in a single deployable; no business logic inside route handlers — handlers parse/validate, call exactly one application service method, translate result to a response. Domain rules live in service layer (§182–§186).
- [ ] §5 Repository structure: `apps/worker` + `packages/{domain,contracts,db,auth,ai-core,ai-providers,tools,skills,memory,github,search,sync,security,shared}` + `supabase/{migrations,seed,functions}` + `tests/*`. Vendor SDKs behind adapters only (§183).
- [ ] §103/§149 All application REST APIs versioned under `/api/v1`; WS envelope carries `protocol_version`; unsupported old clients get explicit update-required handling, not silent breakage.
- [ ] §102 Stable machine-readable error contract: `{ error: { code, message, request_id } }`. Never expose stack traces, raw SQL, provider secrets, or internal credentials in any error path (including 500s).
- [ ] §19 Every state-changing client request accepts `Idempotency-Key` header and/or `client_operation_id`; replay of same operation produces one logical operation. Idempotency record stores operation_id, actor_id, request_hash, result_reference, created_at.
- [ ] §156 Cursor-based pagination (`before=<cursor>&limit=50`) for messages/activity/garage lists — no offset page params on large tables (§155).
- [ ] §101 Correlation IDs on every request: `request_id`, `trace_id`, `user_id`, `group_id`, nullable `project_id`, `ai_run_id`, `operation_id`; logs are structured JSON carrying them.
- [ ] §122 Transaction boundary rule: user message create = one transaction {insert message, insert mentions, insert attachment links, insert outbox event}. Broadcast/notifications/memory/search indexing happen async AFTER commit. No AI work inside DB transactions (§195 #14).
- [ ] §123 Outbox table `outbox_events` exists per spec columns (id, event_type, aggregate_type, aggregate_id, payload jsonb, status, created_at, processed_at, retry_count default 0) and prevents "DB committed but broadcast lost".

## 2. Auth & Profiles

- [ ] §6.1 Supabase Auth is the credential authority (email/password, token lifecycle, reset flow). No custom password hashing, no duplicate `password_hash` column anywhere (§181 Correction 1).
- [ ] §6.2/§23.1 `profiles`: id → auth.users(id), email_snapshot, display_name NOT NULL, avatar_object_id nullable, created_at, updated_at, last_seen_at nullable. No raw credentials in app schema.
- [ ] §6.3 Global profile separate from Group-local identity; nickname mapping belongs to viewer+group+target, never global to target.
- [ ] `GET /api/v1/me`, `PATCH /api/v1/me`: authenticated profile read/update; PATCH cannot mutate auth-owned fields (email/password).

## 3. Groups, Members, Roles

- [ ] §24 `groups`: id, name, description, avatar_object_id, owner_user_id→profiles, status ∈ ACTIVE/ARCHIVED/DELETING/DELETED, timestamps, deleted_at.
- [ ] §25 `group_members` PK (group_id,user_id); role, joined_at, removed_at, group_display_name, group_avatar_object_id. Soft-remove via removed_at; removed member loses access immediately (§185 #11), including holders of previously-valid tokens (§187 stale-token test).
- [ ] §7.1 Roles OWNER/ADMIN/MEMBER/GUEST with capability matrix:
  - Owner: full control, transfer ownership, remove admins, delete group, configure AI, manage secrets/GitHub/members, restore/permanently-delete eligible content.
  - Admin: invite, remove members, most group settings, configure AI, approve actions subject to policy, manage files/artifacts/tasks/decisions.
  - Member: chat, private chat, use AI, create project work, react, low-risk content.
  - Guest: restricted access, no admin privileges.
- [ ] §7.2 Only Owner creates/removes Admins; Admin cannot promote another Admin; ownership transfer explicit + audited.
- [ ] §185 #1/#2 Exactly one Owner at all times; Owner always a member; transfer-ownership atomically swaps roles in one transaction.
- [ ] `GET/POST /api/v1/groups`, `GET/PATCH/DELETE /api/v1/groups/:groupId`: list shows only active memberships; DELETE = Stage-1 soft delete only, never synchronous data destruction.
- [ ] Members endpoints: `GET .../members`, `PATCH .../members/:userId` (role change enforces hierarchy), `DELETE .../members/:userId` (sets removed_at, immediate revocation), `POST .../transfer-ownership`.

## 4. Invitations & Joining

- [ ] §8 Only Owner/Admin invite. Existing account → notification → accept → join; no account → link → signup → accept → join.
- [ ] §8.2 Share-link token non-guessable random; DB stores only `token_hash`; group IDs/sequential values never the security mechanism.
- [ ] §27 `group_invites`: id, group_id, created_by, email?, role, token_hash, expires_at, max_uses?, uses_count default 0, revoked_at, created_at.
- [ ] Acceptance validates not-expired/not-revoked/under-max_uses atomically (no race past max_uses); joins with role_on_accept; increments uses_count.
- [ ] Endpoints: `POST .../invites`, `GET .../invites`, `POST /api/v1/invites/:token/accept`, `POST .../invites/:inviteId/revoke`.
- [ ] §178 Invite lifetime default 7 days, config-driven; brute-force protected by IP/device rate limits (§91).

## 5. Group Deletion Lifecycle

- [ ] §9 Three stages: soft delete → recovery window (Owner restores; 30-day default per §178) → permanent deletion confirmed by Owner.
- [ ] Permanent deletion asynchronous job (§158): shared metadata, messages, artifacts, owned file copies, AI config, memory, GitHub metadata, audit per retention policy. Never synchronous in one HTTP request.
- [ ] §185 #10 Archived/deleted Group rejects normal writes with proper error codes.

## 6. Projects & Project Instructions

- [ ] §28 `projects`: id, group_id, name, description, goal, project_type (flexible metadata: software/iot/startup/research/college/school/personal/other), status default 'active', progress numeric(5,2), created_by, timestamps, archived_at.
- [ ] §29 `project_instructions`: id, project_id, instruction_text, priority int default 100, enabled default true, created_by, timestamps. Instructions NOT stuffed into projects.context.
- [ ] Endpoints: `GET/POST /groups/:groupId/projects`, `GET/PATCH /projects/:projectId`, `POST /projects/:projectId/archive`, `POST /projects/:projectId/restore`.
- [ ] §10.3 Archive reversible; archived projects readable, excluded from default active-context selection, restorable by authorized users.
- [ ] §178 Projects-per-group limit: 20 active non-archived (archived don't count), config-driven.
- [ ] §185 #4/#5 Project belongs to exactly one Group; cross-group IDs rejected by authorization chain (§86).

## 7. Messages

- [ ] §39 `messages` exact shape: sender_type USER/AI/SYSTEM, visibility GROUP/PRIVATE_PAIR/PRIVATE_AI, body_format default 'markdown', reply_to_id, client_message_id, server_sequence bigint, edited_at, deleted_at, UNIQUE(group_id, client_message_id). Indexes: (group_id,server_sequence), (group_id,created_at), (project_id,created_at), (sender_user_id,created_at).
- [ ] POST /api/v1/groups/:groupId/messages: authenticate → verify active membership (§86 chain) → resolve private/public scope server-side (client can never set a trusted `private=true` flag, §11.2) → assign server_sequence from authoritative counter → insert message transactionally with mentions + attachment links + outbox event (§122) → broadcast message.created after commit.
- [ ] Duplicate client_message_id within same group returns the original message (idempotent), never a duplicate row.
- [ ] §11.2 PRIVATE_PAIR readable only by conversation participants; PRIVATE_AI only by requesting member + group AI. Enforced in backend queries AND RLS (§87A), never by visibility flag alone.
- [ ] §12.1/§39A Edit: write pre-edit body into `message_revisions` (previous_body, previous_body_format, editor ids, edited_at) BEFORE updating messages.body + edited_at; revision read authorization identical to message read authorization.
- [ ] §12.2 Delete: soft delete tombstone only; replies/decisions/tasks/audit references preserved; "Message deleted" rendering; sender-or-authorized-role policy enforced.
- [ ] §39B Pins: `message_pins` PK (group_id,message_id), pinned_by/at, unpinned_at, partial index (group_id,project_id) where unpinned_at is null. Pin of private message inherits its visibility scope — private message can never appear in Group-visible pin list. Emits message.pinned/unpinned.

- [ ] §41 Reactions: `message_reactions` PK (message_id,user_id,emoji); add/remove emits message.reaction.added/removed; reactions on private messages visible only to participants.
- [ ] §14.1 Mentions resolved server-side to internal IDs (never rendered usernames); `message_mentions(message_id, mentioned_user_id, mentioned_ai_id, created_at)` populated on send; MENTION notification respects preferences.
- [ ] §43 Attachments: `attachments` (object_ref, object_storage LOCAL_REFERENCE/R2, mime_type, byte_size, checksum, original_name, status, deleted_at) + `message_attachments` PK (message_id,attachment_id); links created transactionally with the message.
- [ ] §40 Private conversations: `private_conversations(id, group_id, type HUMAN_PAIR/AI, created_by, ai_agent_id?, created_at)` + `private_conversation_members(conversation_id,user_id)`; private messages reference conversation id; ACL via membership rows (Correction 3).

- [ ] `/private @username` → HUMAN_PAIR between exactly sender+recipient; `/private @Odin` → member's PRIVATE_AI conversation with group's single AI. No unauthorized third user ever added (§185 #7).
- [ ] §14.2 Slash commands parsed server-side after syntax validation: /ask /private /meeting /research /memory /project; backend authoritative.
- [ ] GET messages list supports filters (project scope, sender, date range, threads) and returns only visibility-authorized rows; deleted messages returned as tombstones.
- [ ] §178 Message body ≤ 8,000 chars; ≤10 attachments/message; 30 msgs/min/user rate limit — all config-driven, enforced server-side.

## 8. Message Search

- [ ] §13 Search supports full-text, project scope, group scope, sender filter, date range, mention filter, attachment-presence filter, AI-messages filter.
- [ ] Private search only within authorized private scope; every search query applies ACL filtering BEFORE execution (never post-filter); indexes inherit source privacy boundary (§125 visibility_scope on docs, §126 order).

## 9. Realtime (Durable Object rooms)

- [ ] §15.2 One DO room per Group; Postgres stays canonical state; DO is coordination/fan-out only (Correction 2 — DO storage is not the durable DB).
- [ ] §16 Connect lifecycle: authenticate token → validate Group membership → determine allowed scopes → accept WS → client `room.subscribe` → server `connection.ready` ack → presence updated. Non-members rejected at handshake.
- [ ] Disconnect: temporary away/offline with grace period + debounced presence broadcast; dropped socket ≠ immediate leave event.
- [ ] §17 Envelope on every server event: protocol_version, event_id (evt_…), event_type, sequence, group_id, project_id?, actor_id, visibility, occurred_at, payload, request_id.
- [ ] §17.1 Per-group monotonic sequence; gap detection triggers sync.from_sequence recovery; WS delivery never treated as persistence guarantee.

- [ ] §18 Event taxonomy implemented per domain: group.* (created/updated/deleted/owner.transferred/member.invited/joined/removed/role.changed), presence.*, message.* (created/edited/deleted/reaction.added/reaction.removed/pinned/unpinned), ai.* (requested/run.started/status.updated/tool.started/tool.progress/tool.completed/response.delta/response.completed/response.failed/action.proposed/action.approved/action.rejected), artifact.*, decision.*, task.*, memory.*, github.*, meeting.*, sync.*.
- [ ] §114 WS protocol: client→server (connection.hello, room.subscribe, message.send/edit/delete/react, typing.start/stop, presence.update, ai.run/cancel, artifact.interaction, meeting.start/end, sync.ack/request); server→client (connection.ready, message.created/updated/deleted, reaction.updated, presence.updated, typing.updated, ai.started/status/tool/delta/completed/failed, artifact.event, approval.requested, task.updated, decision.updated, github.updated, meeting.event, sync.events/sync.conflict, error). Runtime schema validation on frames (§152).

- [ ] §157 Room does not serve infinite history; reconnect fetches history batch from Postgres/API and resumes from sequence.
- [ ] Visibility-aware fan-out: GROUP events to all members; PRIVATE_PAIR only to participants; PRIVATE_AI only to owning member. Non-participant subscriber never receives the frame.

## 10. Presence & Typing

- [ ] §96 Presence ephemeral in DO memory with heartbeat; debounced broadcasts; heartbeats NOT persisted to Postgres. States ONLINE/IDLE/AWAY/OFFLINE.
- [ ] §97 Viewing presence ("viewing artifact X/project Y") transient only, never persisted historically.

## 11. Sync Protocol (offline reconciliation)

- [ ] §20A `sync_checkpoints(device_id,user_id,group_id,last_server_sequence,last_synced_at, PK(device_id,group_id))`.
- [ ] §20A `sync_operations(id, device_id, user_id, group_id, client_operation_id, operation_type, payload jsonb, client_created_at, server_received_at?, status PENDING/APPLIED/REJECTED/CONFLICT, result_reference?, UNIQUE(device_id,client_operation_id))` + index (group_id,status). Shares identity scheme with §19 idempotency.
- [ ] §20A `sync_conflicts(id, sync_operation_id→sync_operations, conflict_type version_mismatch/concurrent_edit/deleted_upstream, local_payload, server_payload, resolution_strategy server_wins/client_wins/merged/manual, resolved_by?, resolved_at?, created_at)`.
- [ ] §20.2 Reconnect flow: AUTH → HANDSHAKE → client checkpoint → server returns missing events since last_server_sequence → client applies → pushes pending ops → server validates/applies idempotently → ACKs/conflicts → SYNCED.

- [ ] §21.1 Messages: cloud ordering wins; offline messages get server receive timestamp + server sequence; client clocks never reorder existing messages.
- [ ] §21.2 Structured objects (tasks/decisions/settings) optimistic concurrency: update carries expected version; mismatch ⇒ HTTP 409 CONFLICT + sync_conflicts row.
- [ ] §21.3 Artifact versions immutable; concurrent edits create new versions; text artifacts optional safe three-way merge else conflict version; binary artifacts always separate versions, never silent overwrite.
- [ ] WS sync.request/sync.events/sync.conflict + sync.ack wired to these tables; sync.client.connected/reconciled/conflict.detected/resolved events emitted.

## 12. Outbox Consumers & Background Jobs

- [ ] §124 Independent consumers for outbox events: realtime broadcaster, notification worker, memory worker, search indexer, activity builder, usage meter, audit processor, GitHub sync. Each independently testable.

- [ ] §158A `background_jobs` exact shape: job_type (memory.extraction, file.indexing, research.deep, artifact.generate, notification.deliver, github.webhook.process, cleanup, deletion, usage.aggregate, memory.stale_review), source_event_id?, idempotency_key, payload jsonb, status QUEUED/RUNNING/SUCCEEDED/FAILED_RETRYABLE/FAILED_PERMANENT, retry_count default 0, max_retries default 5, next_attempt_at?, last_error?, timestamps, UNIQUE(job_type,idempotency_key), index(status,next_attempt_at).
- [ ] §159 Duplicate enqueue = insert-conflict no-op; re-execution logically idempotent.
- [ ] §121 Retry classification: TRANSIENT limited retries w/ exponential backoff+jitter; RATE_LIMITED delayed; AUTH/PERMISSION/INVALID_REQUEST never retried; CONFLICT reconciles; PROVIDER_UNAVAILABLE falls back if configured.
- [ ] §160 Dead-letter: after max retries → FAILED_PERMANENT retaining job id/error category/event reference/retry count; queryable for admin diagnostics; never silently deleted.

- [ ] §158 Chat writes never block on these jobs (async only).
- [ ] §98A Activity builder writes `activity_events` per spec columns (actor_type USER/AI/SYSTEM, pre-rendered `summary` frozen at write time using group-local display resolution, subject_type, subject_id, visibility GROUP/PROJECT only). NO row ever written for PRIVATE_PAIR/PRIVATE_AI events. Indexes (group_id,occurred_at desc) + partial (project_id,occurred_at desc).
- [ ] §118 Long-running artifact generation is a queued job (job → worker → progress events → persist version → broadcast complete), never one held-open HTTP request.
- [ ] §119 Deep research is a job with statuses QUEUED/RUNNING/SEARCHING/SYNTHESIZING/VALIDATING/COMPLETED/FAILED/CANCELLED.
- [ ] §120 Cancellation supported for AI runs, deep research, artifact generation, GitHub action pre-execution, safe sync ops; propagated to provider/tool requests where supported.

## 13. Notifications

- [ ] §95A `notifications` per spec: recipient_user_id, group_id, project_id?, category ∈ MENTION/PRIVATE_MESSAGE/AI_RESPONSE/AI_ACTION_APPROVAL/TASK_ASSIGNMENT/DECISION_APPROVAL/ARTIFACT_READY/GITHUB_EVENT/MEETING_SUMMARY/PROACTIVE_AI/SYSTEM, subject_type, subject_id, title, body?, delivery_state PENDING/DELIVERED_REALTIME/DELIVERED_EMAIL/SUPPRESSED_BY_PREFERENCE/FAILED, read_at?, created_at + both spec indexes (recipient+created_at desc; recipient+read_at partial where unread).
- [ ] §95A `notification_preferences(user_id,group_id,category,in_app_enabled default true,email_enabled default false, PK(user_id,group_id,category))`.
- [ ] Exactly ONE notification row per recipient per semantic event; delivery_state updated in place, never new row per attempt.
- [ ] PRIVATE_MESSAGE/AI_RESPONSE notifications for PRIVATE_AI conversations target only the single owning member — write path re-applies message-read authorization before insert.

- [ ] §143 Delivery pipeline: resolve recipients → check preference → check online state → realtime deliver if online → else queue desktop/email per config; suppressed by preference with SUPPRESSED_BY_PREFERENCE.
- [ ] §144 Email only for: invite, account recovery, critical approval (if configured), offline mention/private message (if configured), system/security. Never per-chat-message email.

## 14. AI Agent Identity & Config

- [ ] §30 `ai_agents(id, group_id UNIQUE, name default 'Odin', avatar_object_id?, language?, tone?, personality_config jsonb default '{}', mode_policy jsonb default '{}', timestamps)`. Extensibility not coupled to uniqueness assumption (§2.6).
- [ ] §31 `ai_provider_configs(id, group_id, kind APPLICATION/BYOK, provider, credential_ref nullable — secret store reference never raw key, enabled default true, created_by, timestamps)`. No API keys in ordinary columns (§195 #6).

- [ ] §32 `ai_model_routes(id, group_id, provider_config_id, role PRIMARY/FALLBACK_1/FALLBACK_2/FALLBACK_3, model_id, priority, enabled default true, created_at)`. Only one PRIMARY; at most three fallbacks.
- [ ] §63 BYOK configured by Group admins (provider, key, optional endpoint, models); backend VALIDATES key before storing config active. §63.1 Never returns raw key after storage — store secret_ref/provider/key_last4/status/timestamps. §63.2 Envelope encryption, key outside DB, decrypt only in isolated server execution; no client-side-only encryption.
- [ ] §64 BYOK model discovery: validate key → query provider model listing → normalize descriptors → show selectable → admin chooses primary/fallback. If provider lacks listing, maintained metadata + explicit model input.
- [ ] §65 Application AI controlled by ClanMind infra; group never configures application provider keys; sees selected model + usage/quota status.

- [ ] §107 AI config endpoints admin-only: `GET/PATCH /groups/:groupId/ai/config`, `POST /groups/:groupId/ai/providers/validate`, `POST /groups/:groupId/ai/providers/:id/models`. Never return secret content.
- [ ] §132 Group AI settings stored as structured config (Identity, Provider, Models, Fallbacks, Web Research, Skills, Permissions, Proactivity, Quotas), not one arbitrary blob.

## 15. Model Router & Provider Adapters

- [ ] §61 Router selects by: group AI config → primary → fallback chain → current quota → request capability → provider health → error class. Only one PRIMARY; ≤3 fallbacks (§32).
- [ ] §61 Fallback ONLY for retryable failures (provider unavailable, transient 5xx, network timeout, configured rate limit, model temporarily unavailable). NO silent fallback for invalid API key, invalid request schema, user permission denial, unsupported tool, safety refusal, malformed request.

- [ ] §62 `ModelProviderAdapter` interface (validateCredentials, listModels, generate → AsyncIterable<ModelEvent>, optional estimateUsage); providers OpenAI/Anthropic/Google/OpenRouter/others behind adapters; no single-vendor coupling.

## 16. Context Engine

- [ ] §54 Resolves all 16 inputs: system instructions, Odin identity, group rules, project instructions, user profile/preferences, relevant group memory, project memory, user-private memory only if private context, decisions, tasks, artifact summaries, files, recent conversation, referenced messages, enabled skills, available tools — then applies token budget.
- [ ] §60 Prompt assembly order: SYSTEM SAFETY → ODIN IDENTITY → GROUP POLICY → PROJECT POLICY → USER PREFERENCES → TASK/SKILL INSTRUCTIONS → CONTEXT → TOOLS → USER REQUEST. User-uploaded skill files can NEVER override platform safety/security rules.

- [ ] §54A.1 Fixed slices always included in full (system safety/platform policy, Odin identity, group policy, active project instructions, resolved skill instructions); competitive slices (group memory, project memory, user-private memory private-context-only, decisions, tasks, artifact summaries, file context, recent conversation, referenced messages) compete for the remainder under a 32,000-token default budget (§178).
- [ ] §54A.2 Ranking formula: score = 0.35·relevance + 0.25·importance + 0.20·recency + 0.20·confidence; per-slice sort desc; greedy inclusion until slice allocation or overall budget exhausted.
- [ ] §54A.3 Explicit-reference override: explicitly referenced objects force-included ahead of ranking and don't consume competitive budget from their category.
- [ ] §54A.4 Dedup of candidates resolving to same fact; every included item carries provenance metadata (source_type, source_id, retrieved_at/created_at) machine-readable for context_sources.

- [ ] §54A.5 Privacy filtering BEFORE ranking on EVERY competitive slice — never rank across unfiltered corpus then filter top results (§126 order for all slices).
- [ ] §55 Public AI request allowed: public group messages, active project context, shared group/project memory, shared files/artifacts, public decisions/tasks. NOT allowed: private human/AI conversations, private member memory, secrets, raw provider keys.
- [ ] §55 Private AI request allowed: current private conversation, public context only if explicitly relevant + policy allows, user's private memory, shared project context only when user explicitly invokes it. Never silently inject private knowledge into public responses.

## 17. Privacy Crossing Matrix (§55A) — every row needs an automated negative test

- [ ] PRIVATE_PAIR content → public Group AI context: NEVER.
- [ ] PRIVATE_PAIR → group/project memory: never automatically; only explicit user "promote to shared".
- [ ] PRIVATE_AI of User A → public Group AI context: NEVER.
- [ ] PRIVATE_AI of User A → private AI context of User B: NEVER.
- [ ] User-private memory A → public Group AI context: NEVER.
- [ ] User-private memory A → private AI context of User B: NEVER.
- [ ] User-private memory A → own private AI context: Allowed.
- [ ] Group memory → public + any private AI context: Allowed. Project memory → public context when project active: Allowed.
- [ ] Secrets/raw provider keys/GitHub installation tokens → ANY AI context: NEVER (§88). Tool output containing apparent credentials → AI context without sanitization: NEVER — sanitize first.

## 18. AI Orchestration Loop

- [ ] §52 `ai_runs(id, group_id, project_id?, requester_user_id, ai_agent_id, mode, visibility, provider_config_id, model_id, status QUEUED/RUNNING/WAITING_TOOL/STREAMING/COMPLETED/FAILED/CANCELLED, input_message_id?, started_at, completed_at?, failure_code?, usage_json?)`.
- [ ] §53 `ai_run_steps(id, ai_run_id, step_number, step_type, tool_name?, status, input_json?, output_json?, started_at, completed_at?)` — orchestration trace without exposing private model reasoning.
- [ ] §57A `ai_tool_calls(id, ai_run_id→ai_runs, ai_run_step_id?→ai_run_steps, tool_name, tool_version, risk_level, input_json, output_json?, status PENDING/APPROVED/EXECUTING/SUCCEEDED/FAILED/DENIED, requires_approval, ai_action_id? when requires_approval, started_at, completed_at?, error_code?)` + indexes (ai_run_id), (tool_name,status). HIGH/CRITICAL calls cannot pass PENDING until the joined action reaches APPROVED.

- [ ] §115 Exact lifecycle implemented in order: receive → authenticate → authorize group membership → resolve private/public scope → resolve active project → parse mention/command → create ai_run → check group AI config → check quota → resolve context → resolve skills → resolve tools → construct model request → call provider → tool loop (validate tool, check permission, classify risk, request approval if required else execute, return result) → continue loop if needed → stream response → persist final AI message → persist citations → persist artifact/action references → emit completed event → enqueue memory extraction → increment usage → audit sensitive actions.
- [ ] §116 Tool loop hard limits (configurable): max tool calls/run (default 8), max run duration (120s soft / 300s hard cancel per §178), max total tool time (60s), max external requests, max file reads, max GitHub operations, max research depth. LLM can never recurse forever.

- [ ] §106 AI endpoints: `POST /api/v1/groups/:groupId/ai/runs`, `GET /api/v1/ai/runs/:runId`, `POST /api/v1/ai/runs/:runId/cancel`. Streaming primary path is WebSocket; SSE only special cases.
- [ ] §130 Cost controls BEFORE run: estimate context size, tool budget, model cost, check quota. If over policy: truncate context, switch cheaper model if configured, ask user confirmation for expensive task, or reject cleanly. Deep research can never bypass group quotas.
- [ ] §170 Completed AI response exposes metadata (model, provider, tools_used, search_used, source_count, context_sources sanitized, run_id, artifact_ids, action_ids, usage estimate) — never internal secrets.

## 19. Tools & Skills

- [ ] §56 Tool registry machine-readable metadata: tool_name, version, description, input_schema, output_schema, risk_level, requires_approval, allowed_modes, allowed_roles, allowed_scopes, timeout, retry_policy, audit_policy. Example github.create_branch: HIGH, requires_approval, modes [ACT], roles [OWNER,ADMIN].
- [ ] §57 Skill vs tool distinction preserved (skill = instruction/workflow bundle; tool = executable capability; skill may invoke multiple tools).
- [ ] §58 Built-in skills seeded: web_research, deep_research, brainstorming, project_planning, decision_analysis, task_decomposition, artifact_diagram, artifact_document, artifact_data_visualization, file_analysis, github_analysis, github_change_planning, meeting_facilitation.

- [ ] §34 `skills(id, slug UNIQUE, name, version, description, definition jsonb, built_in default true)`; `group_skills(group_id,skill_id,enabled,config jsonb '{}', PK both)`; `project_skills(project_id,skill_id,enabled,config, PK both)`.
- [ ] §59 Custom skills uploadable by admins; skill object contains name/description/instructions/tool_allowlist/risk_policy/input_schema/output_schema/version/enabled/scope (GROUP or PROJECT); system instructions always higher priority.

## 20. Approval Engine (generic ai_actions)

- [ ] §78A `ai_actions` exact shape: id, group_id, project_id?, ai_run_id?→ai_runs, initiated_by_user_id?, action_kind ('github.create_pr', 'artifact.bulk_delete', 'task.bulk_create', …), risk_level READ_ONLY/LOW/MEDIUM/HIGH/CRITICAL, payload jsonb, payload_hash sha256 of canonicalized payload recomputed on every mutation, payload_version default 1, status PROPOSED/WAITING_APPROVAL/APPROVED/EXECUTING/SUCCEEDED/FAILED/REJECTED/EXPIRED, requires_approval, timestamps, expires_at? + indexes (group_id,status), (ai_run_id).

- [ ] §78A `ai_action_approvals(id, action_id→ai_actions, approved_by, approver_role, approved_payload_hash (the hash actually shown/approved), approved_payload_version, approved_at, execution_result?, executed_at?)` + index (action_id).
- [ ] §78A.1 Integrity binding: before executing any action verify current ai_actions.payload_hash == approvals.approved_payload_hash AND payload_version == approved_payload_version; on mismatch refuse execution and transition action to EXPIRED requiring fresh proposal + fresh approval. A client-sent `approved=true` boolean is NEVER sufficient (Correction 5).
- [ ] §2.6 Risk policy enforced by the POLICY ENGINE not the model: READ_ONLY no approval; LOW no; LOW/MEDIUM usually no depending on action; MEDIUM yes where user-visible impact meaningful; HIGH yes; CRITICAL explicit authorized approval.
- [ ] §117 Actions requiring approval survive client disconnects (persisted ai_actions queue); resumable/retryable only subject to hash re-verification.

## 21. GitHub Integration

- [ ] §76 GitHub App least-privilege; public repo URL = read/discovery only, NEVER write (Correction 6). One Group = one connected repository initially; tables extensible to many.
- [ ] §77 `github_connections(id, group_id UNIQUE, installation_id?, owner_login?, repo_name?, repo_full_name?, default_branch?, permission_mode READ_ONLY/READ_WRITE, connected_at?, disconnected_at?)`.
- [ ] §78 `github_actions(id, ai_action_id NOT NULL→ai_actions, group_id, project_id?, action_type create_branch/apply_patch/create_pr/merge_pr, branch_name?, target_sha?, preview_json?, created_at, completed_at?)` + index (ai_action_id). NO own status/approved_by/approved_at/risk/payload columns — status via join to ai_actions (§78A.2).

- [ ] §79 Safe workflow: analyze → propose → preview → authorized approval → create branch → apply patch → run checks if configured → commit → create PR → sync PR status → authorized approval → merge. Natural-language "permission" in a chat message NEVER merges; approval must map to backend action record.
- [ ] §139 AI never writes directly to default branch (main/master protected) — AI branch + PR only, unless explicit future policy.
- [ ] §140 Before approval: generate/fetch diff (changed files, additions/deletions, branch, base SHA, target SHA, action summary); approval UI references exact action payload.
- [ ] §141 Merge requires: explicit user click, authorized role, current PR state, current base/head SHA, action not expired, no unexpected payload mutation.

- [ ] §142 Disconnect: invalidate cached installation metadata, disable action execution, retain historical references, never auto-delete audit/history.
- [ ] §80 Webhooks `POST /api/v1/webhooks/github`: verify signature → dedupe event ID → authorize connected installation → map event to Group → persist (github_webhook_events) → emit normalized event → update UI state. Handles installation/repo/PR/push/check/workflow changes.
- [ ] §113 GitHub endpoints: connect/status/disconnect; `GET/POST /projects/:projectId/github/actions`; approve/reject at `/api/v1/github/actions/:actionId/{approve,reject}` — approve/reject must go through ApprovalEngine hash-binding.
- [ ] §138 AI may propose folder/file creation/modification incl. code; generation ≠ execution; write/commit/PR/merge remain separate controlled actions.

## 22. Research

- [ ] §67 `SearchProvider` interface; adapters Tavily/Exa (+optional Brave); backend chooses primary, falls back, meters usage, normalizes results.
- [ ] §33 `search_provider_configs(id, group_id, provider TAVILY/EXA/BRAVE/…, credential_ref?, enabled, priority, created_at)`.
- [ ] §66 Web research: Odin may auto-decide current info needed but responses DISCLOSE web tool use; normalized output (query, provider, sources[] title/url/snippet/retrieved_at/domain/citation_id); citations come from tool responses — never model-invented.
- [ ] §69 Citation integrity tracked: citation_id, source_url, retrieved_at, source_title, source_excerpt_or_reference, claim_mapping; model references citation_ids only.
- [ ] §68 Deep research pipeline: query → plan → search batch → collect → filter → extract → synthesize → cross-check → answer → citation validation → project impact. Output: executive answer/key findings/evidence/sources/conflicts/project implications/recommended next action. Job-based with §119 statuses.

- [ ] §178 Deep research depth limits: 6 search batches, 25 sources considered, 8 cited — config-driven.

## 23. Artifacts (Garage)

- [ ] §44 `artifacts(id, project_id, name, artifact_type, created_by_user_id?, created_by_ai_id?, status, pinned default false, current_version_id?, timestamps, deleted_at?)`; `artifact_versions(id, artifact_id, version_number, content_type, content_ref, checksum?, creator ids, parent_version_id?, created_at, UNIQUE(artifact_id,version_number))`.
- [ ] §46 `artifact_links(artifact_id, target_type, target_id, relation)` supporting artifact→task/decision/file/message/github_action.
- [ ] §45 Artifact type registry (DOCUMENT/MARKDOWN/DIAGRAM/FLOWCHART/ARCHITECTURE/GRAPH/CHART/TIMELINE/MINDMAP/DECISION_TREE/TABLE/RESEARCH/IMAGE/INTERACTIVE/CODE/HTML/OTHER); backend owns lifecycle + stable domain schemas; AI never emits DOM instructions (§74).

- [ ] §75 Live artifact streaming events: artifact.created, node.created, node.updated, edge.created, render_state.updated, completed — with preserved logical ordering/sequence.
- [ ] §109 Artifact endpoints: list/create per project; get; new version; restore version; pin; delete (soft); share. Version restore emits artifact.version.restored.
- [ ] §178 Size rules: text artifact ≤500 KB/version (above → treat as file); binary ≤10 MB stored in R2 via content_ref pointer — binary content never inline in Postgres.

## 24. Decisions & Tasks

- [ ] §47 `decisions(id, project_id, title, context?, options jsonb?, selected_option jsonb?, rationale?, status PROPOSED/APPROVED/REJECTED/SUPERSEDED, proposed_by?, approved_by?, timestamps, approved_at?)`. Approved decisions become high-priority project memory candidates (§134).

- [ ] §110 Decision endpoints: list/create per project, get, approve, reject — approval emits decision.approved and triggers memory candidate.
- [ ] §48 `tasks(id, project_id, title, description?, owner_user_id?, status, priority, due_at?, creator ids, timestamps, completed_at?)`; `task_dependencies(task_id, depends_on_task_id, PK both)`.
- [ ] §111 Task endpoints: list/create per project, get, patch (optimistic concurrency 409 on version mismatch §21.2), complete. Task events: created/updated/assigned/completed/cancelled; TASK_ASSIGNMENT notifications.
- [ ] §49 `project_snapshots(id, project_id, name, summary?, creator ids, snapshot_payload jsonb, created_at)` capturing summary/decisions/tasks/artifact versions/git ref/AI summary/unresolved questions.

## 25. Meetings

- [ ] §50 `meeting_sessions(id, group_id, project_id?, started_by, started_at, ended_at?, status, summary_artifact_id?)`; Odin runs FACILITATE mode during active session; detectors for decisions/action items/disagreements/unresolved questions/research needs/milestones.
- [ ] §50A `meeting_candidates(id, meeting_session_id→meeting_sessions, candidate_type DECISION/TASK/OPEN_QUESTION/CONTRADICTION/RESEARCH_NEED/MILESTONE_CHANGE, content jsonb, confidence numeric(4,3), source_message_id?, status PENDING/ACCEPTED/REJECTED/MERGED/EXPIRED, promoted_to_type?, promoted_to_id?, created_at, resolved_at?)` + index (meeting_session_id,status). Pipeline: Detected → Candidate → Approved/Accepted → Persisted (never auto-commit to project state).
- [ ] §50A `meeting_summaries(id, meeting_session_id UNIQUE→meeting_sessions, summary_text, decisions_json/tasks_json/open_questions_json/research_needed_json/risks_json/next_steps_json default '[]', generated_at, confirmed_by?, confirmed_at?)`. Summary never claims a decision without a corresponding ACCEPTED candidate or approved decision row.

- [ ] §112 Meeting endpoints: `POST /projects/:projectId/meetings`, `GET /meetings/:meetingId`, `POST /meetings/:meetingId/end`; realtime meeting events over Group WS (§72 AI speaks only when asked/high-value ambiguity/explicitly enabled facilitation).
- [ ] §73 Human confirmation determines which summary objects become permanent.

## 26. Memory

- [ ] §35 `memories(id, scope_type GROUP/PROJECT/USER_PRIVATE, group_id, project_id?, user_id?, memory_type, content, normalized_content?, confidence numeric(4,3), importance numeric(4,3), source_type, source_id?, status, timestamps, last_used_at?, archived_at?)`. Typed memory system; scopes never collapsed (§195 #4).

- [ ] §36 `memory_candidates(id, group_id, project_id?, user_id?, source_message_id?, candidate_type, content, confidence numeric(4,3), recommended_scope, status PENDING/ACCEPTED/REJECTED/MERGED/EXPIRED, created_at)`.
- [ ] §37 Auto-store only: stable team conventions, confirmed constraints, approved decisions, enduring goals, explicit preferences, repeated corrections. Never auto-store: chatter, moods, jokes, secrets/passwords/API keys, short-lived scheduling, private human/AI conversations (Correction 9 — memory is curated).
- [ ] §38 Retrieval pipeline: scope filter → semantic relevance → recency → importance → confidence → dedup → token budget; ranking order: explicitly referenced > project decision > active constraint > recent relevant > group convention > older general.
- [ ] §134 Decision approved → memory candidate → high-confidence → project memory; decision superseded → memory.status = ARCHIVED (no stale influence).

- [ ] §135 Contradiction detection: new-vs-old conflict creates a memory conflict record; resolve by asking team / inferring new scope / marking old superseded. Decisions outrank casual statements.
- [ ] §136 Scope precedence: explicit current instruction > approved decision > active project instruction > project memory > group convention > private user preference (only in allowed private scope) > old general memory.
- [ ] §137 Secrets in memory: never store API keys/tokens/passwords/private credentials/GitHub installation tokens; extractor detecting probable secret rejects candidate, audits internally, never feeds it back into prompts.
- [ ] §108 Memory endpoints: group/project memory lists, candidates list, accept/reject candidate, patch/delete memory — USER_PRIVATE endpoints enforce user ownership (a user can only touch own private memory).

- [ ] §185 #12 Private memory cannot become shared memory without explicit promotion.

## 27. Proactivity

- [ ] §70 Proactive AI only: low-frequency, high-confidence, high-value signals (unresolved contradiction, repeated disagreement, missing requirement, blocked task, stale project state). Never timer-driven empty messages. Controls: cooldown, relevance score, minimum confidence, per-group limit.
- [ ] §71 `ai_proactive_suggestions(id, group_id, project_id?, reason_code, summary, confidence numeric(4,3), status, created_at, shown_at?, acted_at?)`; PROACTIVE_AI notification category.

## 28. Storage & Files

- [ ] §83 R2 only for shared attachments/artifacts/large exports/backups — never primary relational store. Object key pattern `groups/{group_id}/projects/{project_id}/objects/{object_id}/{version}`; client-provided arbitrary bucket keys never trusted.
- [ ] §84 Private objects via short-lived signed URLs (default 15 min, §178) issued only after backend authorization; no permanent public URLs for private content.
- [ ] §81 Upload security: MIME sniffing, size limit (25 MB default), extension validation, checksum, metadata, optional malware scan, safe isolated content extraction. Never execute uploads; PDFs/docs/images → extract text safely → pass only extracted content to AI.
- [ ] §82 Local filesystem client-owned/untrusted/not auto-uploaded; cloud-side processing requires explicit user selection → upload copy → process → delete per retention.

- [ ] §4.3 Shared file sync states: LOCAL_ONLY/QUEUED/UPLOADING/SYNCED/REMOTE_CHANGED/LOCAL_CHANGED/CONFLICT/DELETED/RESTORABLE.
- [ ] §127 File indexing pipeline: upload → metadata validation → scan → extraction → chunking → embedding/index → ready_for_context; states INDEXING/READY/FAILED/STALE/DELETED.
- [ ] §128 Freshness tracking: source_version, indexed_version, indexed_at; source changes ⇒ STALE; AI retrieval never treats stale content as current.
- [ ] §129 AI file permissions: shared-with-group / shared-with-project / private-to-user / AI-context-enabled distinction supported.

## 29. Quotas & Usage

- [ ] §92 Group-metered counters: ai_requests, input_tokens, output_tokens, estimated_cost, research_calls, research_sources, artifact_generations, tool_calls, github_actions, shared_storage_bytes — centralized ledger, not scattered counters.

- [ ] §93 `usage_events(id, group_id, user_id?, category, provider?, model?, quantity numeric, unit, estimated_cost?, created_at)` supporting daily/monthly/per-user/per-provider rollups.
- [ ] §94 Exhaustion behavior: in-flight run completes; new requests return `APPLICATION_AI_QUOTA_EXHAUSTED` with can_continue_with_byok flag; BYOK continues if configured; no silent cloud billing.
- [ ] §176 Storage quotas: shared_bytes, optional local_bytes telemetry, artifact_count, file_count; local-only files never charged to group.
- [ ] §178 ALL limits config-driven (quota_states/config table/env), never hard-coded: body 8,000 chars; attachment 25 MB & ≤10/msg; context 32k tokens; run 120s soft/300s hard; 8 tool calls/run; 60s total tool time; research 6 batches/25 sources/8 cited; artifact 500 KB text / 10 MB binary; 25 members; 20 active projects; 30 msgs/min/user; 10 AI req/min/group; 20 GH actions/hr/group; invite 7d; signed URL 15min; recovery 30d.

- [ ] §131 Admin usage view data: today, last_7_days, current_period, application_ai_usage, byok_usage, search_usage, artifact_usage, github_usage, storage; BYOK cost unavailable ⇒ show requests/tokens + mark estimate unavailable.

## 30. Rate Limiting

- [ ] §91 Per-account: login attempts, invite attempts, message rate. Per-group: msgs/min, AI req/min, research calls, uploads, artifact generation, GitHub actions. Per-IP/device: unauthenticated endpoints, auth abuse, invite brute force.

## 31. Authorization & RLS

- [ ] §86 Chain on EVERY request: authenticated → resource exists → belongs to Group → user member → role allowed → object-level permission → privacy scope allowed → execute. Never trust client group_id/role/project_id/file path/approval flags.

- [ ] §186 Centralized authz helpers (requireAuthenticatedUser, requireGroupMember, requireGroupRole, requireProjectAccess, requirePrivateConversationAccess, requireArtifactEditPermission, requireActionApprovalPermission, requireGitHubWritePermission); no duplicated per-route authz logic.
- [ ] §87A RLS enabled with concrete policies: `is_group_member()` security definer function (removed_at IS NULL check); groups select=member / update=owner-admin; messages select policies split PER VISIBILITY (GROUP member-only; PRIVATE_PAIR participant; PRIVATE_AI participant) — no catch-all using(true); memories GROUP/PROJECT = group member, USER_PRIVATE user_id = auth.uid() only.
- [ ] §87 RLS protects direct Supabase access as defense-in-depth; business-rule writes go through service layer privileged connection.
- [ ] §187 Cross-scope leakage tests exist AND pass: A→Group B data; A→B private chat; public AI run → private memory; Project A AI run → Project B files; guest → admin action; removed member stale token; revoked signed URL. All must fail closed.

## 32. AI Security & Injection Defense

- [ ] §88 AI never receives: raw provider keys, GitHub installation secrets, auth refresh tokens, internal encryption keys, hidden system secrets. Secret-looking tool output sanitized before model injection; tool outputs labeled untrusted external content.
- [ ] §89 Prompt-injection policy: external content is data not authority; retrieved instructions never override system/group/project policy; tool outputs carry source metadata; webpages can't redefine tool policy. Defenses TESTED (§151 AI tests, §180 checklist).

## 33. Audit

- [ ] §99 Audit log append-only from application perspective; records sensitive actions: role changes, owner transfer, secret configuration, GitHub connection, action approval, group deletion, permanent deletion, private scope changes, provider changes.
- [ ] §169 Every externally meaningful AI action records: who requested, which run/model/tool/tool payload/risk/approval-required/who approved/exact approved payload/result/timestamp.

## 34. Observability & Ops

- [ ] §100 Metrics: API (latency, error rate, route, status, request id), realtime (connections, reconnects, dropped events, sync gaps), AI (provider/model latency, tokens, fallback frequency, tool duration, failure rate), GitHub (API errors, webhook processing, action duration), sync (pending ops, conflict rate, reconciliation latency).
- [ ] §161 Health endpoints `GET /health`, `/health/ready`, `/health/live`; readiness checks DB + required config; optional provider down never fails health.
- [ ] §162 Separate env configs (local/staging/prod); no production secrets in local dev; config groups: Supabase, Cloudflare, R2, JWT/auth, AI providers, GitHub App, search providers, secret encryption, logging. No committed .env.
- [ ] §165 Client version metadata endpoint: minimum/recommended_client_version + protocol_version; incompatible client ⇒ CLIENT_UPDATE_REQUIRED.

- [ ] §166 Server-controlled feature flags: meeting_mode, proactive_ai, github_write, github_merge, custom_skills, deep_research, offline_sync_v2, interactive_artifacts.
- [ ] §145 Backups: DB backup plan, object lifecycle/versioning, migration replayability, restore TESTING (no untested "backup exists" claims).
- [ ] §146 Retention defaults: shared content while group exists; soft-deleted through recovery window; permanent deletion async; operational logs minimal; AI run traces avoid indefinite raw prompt/context storage.
- [ ] §167 DR documented: RTO/RPO targets, DB restore, object restore, secret recovery, key rotation, GitHub reconnection.
- [ ] §168 Key rotation supported for BYOK encryption keys, application provider keys, GitHub App credentials, search keys — without manual historical row rewrites.

## 35. Schema & Migrations

- [ ] §150 Versioned migrations: reversible where practical, no destructive migration without data migration, staging-tested, seed separate from migrations, production schema version tracked.
- [ ] All spec tables exist with exact columns/constraints/indexes: profiles, groups, group_members, member_nicknames (§26 PK group/viewer/target), group_invites, projects, project_instructions, ai_agents, ai_provider_configs, ai_model_routes, search_provider_configs, skills, group_skills, project_skills, memories, memory_candidates, messages, message_revisions, message_pins, private_conversations, private_conversation_members, message_reactions, message_mentions, attachments, message_attachments, artifacts, artifact_versions, artifact_links, decisions, tasks, task_dependencies, project_snapshots, meeting_sessions, meeting_candidates, meeting_summaries, ai_runs, ai_run_steps, ai_tool_calls, ai_proactive_suggestions, github_connections, github_actions, ai_actions, ai_action_approvals, notifications, notification_preferences, activity_events, usage_events, outbox_events, background_jobs, sync_checkpoints, sync_operations, sync_conflicts.
- [ ] §26 `member_nicknames(group_id, viewer_user_id, target_user_id, nickname, timestamps, PK all three)` — viewer-scoped only; resolution order viewer nickname → group display name → global name (§175); nickname never canonical identity.

## 36. REST Surface

- [ ] §104 Groups/projects endpoints per spec list; §105 messages: `POST /groups/:groupId/messages`, `PATCH /messages/:messageId`, `DELETE /messages/:messageId`, `GET /groups/:groupId/messages`, `GET /groups/:groupId/messages/search`; server persistence is canonical (client optimistic insertion never canonical).
- [ ] §108 memory, §109 artifacts, §110 decisions, §111 tasks, §112 meetings, §113 github, §106 AI runs, §107 AI config endpoints all present under `/api/v1` with correct authz per role matrix.

- [ ] §152 Runtime schema validation (Zod or equivalent) for REST requests/responses, WS events, AI tool schemas, artifact schemas, sync operations. TypeScript types alone never trusted for external payloads.

## 37. Testing Requirements

- [ ] §151 Unit: permission rules, risk classification, memory scoring, provider fallback, message/command parsing, sync conflict logic.
- [ ] §151 Integration: Postgres/Supabase, DO room, provider adapters, GitHub integration, search providers.

- [ ] §151 Security: cross-group access, private-message leakage, memory scope leakage, signed URL abuse, secret exposure, forged approvals, invalid GitHub action, invite brute force, stale authorization.
- [ ] §151 Realtime: reconnect, sequence gap, duplicate operation, offline sync, simultaneous edits. AI: tool selection, approval enforcement, prompt-injection defense, citation integrity, fallback behavior, memory privacy.
- [ ] §153 AI evaluation suite of real scenarios incl.: research question, decision change, private AI request, stale memory, GitHub proposal, malicious webpage injection, unauthorized approver, duplicated offline message.

## 38. Architecture & Invariants

- [ ] §182 Domain service interfaces implemented (GroupService … JobRunner); GitHubService depends on ApprovalEngine (never own approval binding).
- [ ] §183 Dependency direction: handlers → application services → domain services → repositories/adapters → infrastructure; vendor SDKs behind adapters.
- [ ] §185 All 12 domain invariants enforced (single owner; owner is member; AI per group; project/artifact single-parent; no cross-group decision; private conversation membership closed; disabled GitHub connection blocks execution; approval cannot execute mutated payload; archived/deleted group rejects writes; removal = immediate access loss; private memory needs explicit promotion).
- [ ] §195 Agent rules respected in code review: no raw keys in DB columns, no unapproved high-risk model actions, no web-content policy override, DO not sole truth, idempotency for offline writes, cross-group/private isolation tests shipped, etc.

## 39. Frontend Contract Data (§179)

- [ ] Chat: streaming, mentions, reactions, threading, private scope, edit/delete, attachments.
- [ ] Live artifacts: creation, progressive events, versions, restore, pin. Garage: listings, filters, metadata, versioning, relationship links.
- [ ] Meetings: session state, facilitator events, candidate decisions/tasks, final summary.
- [ ] Project Pulse: goal/progress data, blockers, next milestone, AI insight (§172 "ask the project" queries decisions/project memory/relevant messages/linked artifacts/research and returns cited internal source references).

## 40. Definition of Done spot-checks (§196)

- [ ] Generic ai_actions/ai_action_approvals payload-hash binding enforced; github_actions joins through it.
- [ ] RLS exists for groups/messages/memories minimum with direct-access leakage tests.
- [ ] activity_events, notifications, sync tables, background_jobs populated by REAL outbox consumers, not stubs.
- [ ] Context Engine privacy-filter-before-ranking on every competitive slice.
- [ ] Every Privacy Crossing Matrix row has an automated negative test.

---

*End of master TODO. Audit verdicts (PASS/PARTIAL/FAIL/NOT-IMPLEMENTED) will be recorded per item in docs/BACKEND_AUDIT2_REPORT.md.*


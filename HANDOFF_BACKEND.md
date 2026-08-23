# ClanMind Backend — Continuation Handoff

> **For:** next engineering agent (Ox Alpha on VPS / opencode)
> **Date:** 2026-08-23 · **State:** remediation ~60% complete

## 0. Ground rules

1. **Source of truth**: `../ClanMind Backend — Master Implementation Specification.md`
   (§1–§197). Every change traces to a section. Key refs: §104–§113 REST,
   §114 WS protocol, §55A privacy matrix, §78A approvals, §87A RLS, §178
   limits, §181 corrections, §195 prohibitions.
2. **Do NOT trust** `docs/backend-self-review.md` — it marked dead code ✅.
3. Verify loop after every batch:
   `pnpm -r install && pnpm --filter @clanmind/domain --filter @clanmind/worker typecheck`
   then `... test`. Goal: full `pnpm -r typecheck && pnpm -r test` green
   (baseline was 234/234) plus NEW meaningful tests.
4. Style: strict TS ES2022; Hono handlers thin; logic in packages/domain;
   Supabase adapters in apps/worker/src/repositories; Vitest in */test/.

## 1. Audit verdict (what was broken)

CRITICAL: (C1) `message_mentions` table missing → mention sends crashed.
(C2) search `include_private=true` leaked ALL private messages group-wide
(RLS inert: everything runs on service-role key). (C3) 43 REST endpoints
missing (§106–§113); AI/approval/GitHub domain code existed but unwired.
(C4) WS: 10/16 client commands unhandled; no message.edited/deleted events;
protocol gate hardcoded `<1`.

HIGH/MEDIUM also found+fixed or pending (see §3/§4): fake SHA-256 checksum;
rate limiter unwired; presence race + silent offline + no heartbeat; deletion
purge = 2 tables; webhook unrouted + memory-only dedupe; memory.extraction
job orphaned; PRIVATE_AI notifications dropped; activity AI actor → SYSTEM;
orchestrator discarded ranked context from prompt; Anthropic generate wrong
endpoint; fallback contamination; fail-open error classify; sanitizer shallow;
no action TTL/sweeper; FK/unique gaps; RLS gaps (revisions/private-graph/
tool-calls/audit); "none" R2 key segment; inert attachment cap.

## 2. COMPLETED (files touched)

Migration `supabase/migrations/20260823000101_audit_remediations.sql` (NEW,
idempotent): message_mentions table+RLS; FK ai_tool_calls.ai_action_id;
provider_config_id NOT NULL; unique(group_id,role) routes; message_pins
visibility col+backfill+policies; message_revisions RLS; private_conversation*
RLS; ai_tool_calls RLS; audit_events lockdown; RPC create_message_with_mentions
recreated WITH sender_ai_id.

Security: search-notification-activity.repo.ts include_private now enforces
conversation-membership `.or(...)` (C2 FIXED). attachment.service.ts real
async SHA-256 (validateUpload now async), objectKey without "none",
listByMessage added. handlers/attachments.ts real attachment counting +
linkToMessage; download re-checks membership post-token. engagement.repo.ts
listOpen filters visibility=GROUP. orchestrator sanitizeToolOutput recursive.
classifyProviderError(null)→NON_RETRYABLE. Fallback loop rewritten:
per-attempt buffer; mid-stream failure after deltas streamed ⇒ FAILED run.

Realtime: room-core gateProtocolVersion(v,min=1); presence generation counter
(reconnect cancels debounce); drainOfflineTransitions(); sweepStalePresence().
group-room.ts MIN_PROTOCOL_VERSION env gate; 90s stale sweep broadcasting
presence.offline; close-drain broadcasts presence.offline after 30s debounce.

Domain upgrades (approval-engine.ts): ActionRepository.expireStale?;
DEFAULT_ACTION_TTL_MS=24h default expiry in propose(); expireStaleActions();
WebhookProcessor optional 3rd ctor arg isDuplicate for durable dedupe
(in-memory fallback kept for old tests).

NEW repos: repositories/ai-runtime.repo.ts (AiRun w/ PRIMARY-route resolution,
ToolCallLedger, ActionRepository+expireStale, ProviderConfig, ModelRoute upsert
onConflict group_id+role, EnvelopeSecretStore AES-GCM key=SHA-256(master)
ref=`enc1:<ivB64>:<ctB64>`, Usage w/ quota_states override, Proactive);
repositories/project-intel.repo.ts (Artifact immutable versions+links,
Decision CAS version+status+supersedeOthers, Task CAS, Meeting full,
Memory+Candidates scoped search); repositories/github.repo.ts (connections
findByGroup/findByInstallation/connect-upsert/disconnect-§142;
WebhookEventStore.beginDelivery insert-on-conflict dedupe).

Wiring: services.ts AppServices += db, limits, outbox, memory(MemoryService),
githubConnections, webhookEvents. env.ts += optional secrets BYOK_ENCRYPTION_KEY,
APPLICATION_AI_API_KEY, TAVILY_API_KEY, EXA_API_KEY, GITHUB_WEBHOOK_SECRET,
GITHUB_APP_PRIVATE_KEY, GITHUB_APP_ID; var MIN_PROTOCOL_VERSION. message.repo
createWithMentions passes sender_type/sender_ai_id. deletion.repo purge now
covers full §9 footprint (~30 GROUP_DIRECT tables ordered children→parents;
PROJECT_SCOPED=["projects"] relying on ON DELETE CASCADE).

AI composition: apps/worker/src/ai/runtime.ts buildAiRuntime(deps) — full
AiOrchestrator ctor wiring (adapter resolver maps provider→OpenAI-compat base
URLs incl anthropic/google/openrouter; BYOK secret decrypt vs APPLICATION_AI_
API_KEY; router.resolveChain; UsageService 2000/30d defaults; ledger;
approvalGate publishes ai.action.proposed outbox event and returns
WAITING_APPROVAL; executors web.search(Tavily/Exa)+task.create+decision.propose+
artifact.create wired to services + outbox task.created/decision.proposed/
artifact.created; messageSink via atomic RPC sender_type=AI; decisions service
with §134 approved-decision→memory hook; artifacts service with §178 limits);
ToolRegistry 4 tools per §2.6 risk table; expireStaleActions();
buildContextCandidates() = MemoryService.retrieveForContext + recent GROUP-only
transcript, privacyAuthorizes BEFORE scoring (§54A.5), keyword relevance +
exp(-ageDays/14) recency. apps/worker/src/ai/index.ts getAiRuntime(env,services)
WeakMap-memoized + enforceRateLimit(key,max,windowMs) fixed-window limiter
throwing {code:RATE_LIMITED,status:429,retry_after_seconds}.

Worker package.json deps += @clanmind/ai-providers, @clanmind/search.

Tests updated for intentional changes: domain/test/attachment.test.ts (async
awaits; checksum /^[0-9a-f]{64}$/; objectKey group-level case);
domain/test/ai-config.test.ts (null→NON_RETRYABLE). worker/test/utils.ts
AppServices fakes PARTIALLY added (see task A).

## 3. REMAINING TASKS (execute in order)

### A. Finish test/utils.ts compile (FIRST — unblocks typecheck)
utils.ts references `parseLimits("{}")` and `new MemoryService(memRepo,candRepo)`
but the IMPORTS were not yet added to its import block. Add `parseLimits` to
the existing `@clanmind/shared` import and `MemoryService` to the
`@clanmind/domain` import. Also consider exporting `outboxEvents` array from
the harness return for new tests. Then run worker typecheck until clean.

### B. Five handler files + mount in app.ts
All under apps/worker/src/handlers/. Use zod body validation like existing
handlers. getAiRuntime from ../ai. requireMember returns {group, member(role)};
requireRole(g,u,[roles]) for admin gates.

1. **ai.ts (§106)** POST /api/v1/groups/:groupId/ai/runs — requireMember;
   enforceRateLimit(`ai:${groupId}`, limits.ai_requests_per_minute_per_group,
   60_000); byokConfigured = any config kind BYOK enabled (query via db);
   rt.orchestrator.startRun({group_id, requester_user_id, project_id|null,
   mode|ASSIST, visibility|GROUP, input_message_id|null,
   private_conversation_id|null, byokConfigured}) [throws AppError
   APPLICATION_AI_QUOTA_EXHAUSTED carrying status/body]; candidates =
   rt.buildContextCandidates({...query}); result = orchestrator.executeRun({
   run, requester_role: member.role, userRequest: body.message,
   contextCandidates:{candidates, explicitReferences:[]}, requestedToolCalls:
   body.tool_calls ?? []}); return result (truncated=true ⇒ WAITING_APPROVAL).
   GET /api/v1/ai/runs/:runId (member of run.group_id). POST
   /api/v1/ai/runs/:runId/cancel (requester or OWNER/ADMIN).
2. **ai-config.ts (§107)** OWNER/ADMIN. GET config → configs sanitized +
   routes list. PATCH config {routes:[{provider_config_id, role, model_id}]} →
   router.validateRoutes then routeRepo.insert per entry (upsert). POST
   providers/validate {provider, api_key} → providers.validateAndStore →
   {config: sanitized, models}. POST providers/:id/models → load config,
   decrypt secret, OpenAICompatibleAdapter.listModels.
3. **memory.ts (§108)** GET /groups/:g/memory; GET /projects/:p/memory;
   GET /groups/:g/memory/candidates; POST /memory/:candidateId/accept (member
   of candidate.group_id; service enforces USER_PRIVATE owner rule);
   POST .../reject; PATCH /memory/:memoryId {content?,importance?,confidence?}
   and DELETE — allow OWNER/ADMIN, or owner when scope USER_PRIVATE.
4. **intel.ts (§109–§112)** authorize each project via
   services.projects.get(projectId, userId) (403s outsiders).
   Artifacts: GET/POST /projects/:projectId/artifacts; GET
   /artifacts/:id (+versions list via repo.findVersion pattern or add
   listVersions repo method); POST /artifacts/:id/versions {content_type,
   content}; POST restore {version_number}; POST pin {pinned}; DELETE;
   POST share → token = signedUrls.sign({attachment_id: artifact.id, exp}) +
   url /api/v1/artifacts/:id/content?token=..&expires_at=..; add GET content
   route verifying token (reuse codec.verify(token, artifact.id)) returning
   current version text content_ref. Decisions: GET/POST
   /projects/:projectId/decisions; GET /decisions/:id; POST approve|reject
   {expected_version} (approve path triggers supersede + memory promotion
   inside DecisionService). Tasks: GET/POST tasks; PATCH /tasks/:taskId
   {expected_version, patch}; POST complete {expected_version}; extra POST
   /tasks/:taskId/dependencies {depends_on_task_id} (cycle-checked).
   Meetings: POST /projects/:projectId/meetings; GET /meetings/:id (+list
   candidates); POST end {summary_text}; extras POST /meetings/:id/candidates
   (detect) and POST /meetings/:id/candidates/:cid/accept {promote:'task'|
   'decision'} using MeetingService.acceptCandidate promote callback into
   runtime.tasks.create / decisions.propose. Meetings need
   SupabaseMeetingRepository — instantiate inline from services.db (or add to
   AiRuntime).
5. **github.ts (§113 + webhook)** connect/disconnect/status on
   /groups/:g/github/* (OWNER/ADMIN for mutations; publish outbox
   github.connected/disconnected). GET /projects/:p/github/actions → join
   github_actions×ai_actions (engine.githubActionWithStatus helper exists).
   POST actions {action_type create_branch|apply_patch|create_pr, branch_name,
   base_sha, head_sha, changed_files[]} → connection lookup;
   assertBranchSafety({branch_name, default_branch}); preview=buildDiffPreview;
   enforceRateLimit(`gh:${groupId}`, limits.github_actions_per_hour_per_group,
   3_600_000); engine.approve-gate propose(action_kind:`github.${type}`,
   risk HIGH, requires_approval true, payload incl preview); INSERT
   github_actions{ai_action_id, action_type, branch_name, target_sha:head_sha,
   preview_json}; outbox github.action.proposed. POST
   /api/v1/github/actions/:actionId/approve {displayed_payload_hash,
   displayed_payload_version} + reject — role OWNER/ADMIN (engine double-
   checks HIGH risk). After approve: engine.beginExecution(action) then if no
   GitHub creds configured leave APPROVED and respond {executed:false,
   reason:"github_credentials_not_configured"} (transparent), else execute
   branch/patch via API (stretch). Webhook POST /api/v1/webhooks/github: raw
   text body required; secret = env.GITHUB_WEBHOOK_SECRET else 503;
   verifyWebhookSignature(raw, x-hub-signature-256, secret); delivery =
   headers x-github-delivery/x-github-event + parsed json;
   webhookEvents.beginDelivery durable dedupe; resolveGroupId =
   connections.findByInstallation(installation_id); persist payload row
   group_id; outbox github.webhook.received. Mount all five routers in app.ts.

### C. Rate limit wiring
messages.ts POST → enforceRateLimit(`msg:${user.user_id}`, limits.
messages_per_minute_per_user, 60_000) before create (limits already parsed in
handler via c.env).

### D. MessageService outbox events + WS completion
1. domain messages/message.service.ts: inject optional EventOutbox; edit()
   publishes message.edited, softDelete() message.deleted (payload: message_id,
   visibility, private_conversation_id, project_id, group_id) so the outbox
   broadcaster fans them out; update utils.ts construction arg.
2. group-room.ts DO handles remaining §114 client types by building its own
   repos from env (pattern: handleConnect builds db client): message.send →
   SupabaseMessageRepository(env db).createWithMentions + reply frame with the
   persisted message (outbox event flows back through broadcaster); edit/delete
   similar (record revision; softDelete); react → engagement repos upsert/
   delete + broadcastSystem reaction.updated-style envelope (spec name
   reaction.updated); sync.ack → ack frame only; meeting.start/end → build
   SupabaseMeetingRepository + MeetingService, persist session, broadcast
   meeting.started/ended; artifact.interaction → echo as artifact.event
   broadcast. ai.run/ai.cancel over WS: EITHER wire buildAiRuntime inside DO
   (deps from env; membership via direct query) OR respond explicit error
   frame code NOT_AVAILABLE_ON_WS directing clients to REST — document which
   you chose in AUDIT_REPORT (REST is spec-canonical persistence path §105).

### E. Background jobs + consumers
services.ts buildBackgroundRuntime: register JobHandler job_type
"memory.extraction" → payload {run_id, group_id, visibility}: load run +
final AI message (client_message_id=`ai_run_${run_id}` via messageRepo.findById?
use db query on client_message_id) + preceding user message body; call
services.memory.proposeFromRun({group_id, project_id: run.project_id,
user_id: run.requester_user_id, visibility, content: assistant answer slice
≤500 chars, confidence: 0.6}). apps/worker/src/index.ts scheduled: after
drainOutbox/runDueJobs also await getAiRuntime(env,services).
expireStaleActions(). consumers.ts fixes: NotificationWorkerConsumer — remove
blanket `if (isPrivate) return` gating ai.response.completed; PRIVATE_AI
AI_RESPONSE must notify ONLY row.actor_id (requester) per §95A.
ActivityBuilderConsumer — actor_type 'AI' + actor_ai_id=row.actor_id when
aggregate_type==='ai_run' (or payload.sender_type==='AI'), else USER;
summaries may take an injected displayNameResolver (group_members.group_display_name
else profiles.display_name) — wire from services if cheap, else document gap.

### F. Search-index freshness check (VERIFY)
migration 20260822000115 created messages.search_vector + GIN. Confirm a
trigger keeps it fresh on INSERT/UPDATE; if absent, append trigger to
remediation migration (or new one) — §125 requires index inherit source data.

### G. Fix vacuous tests + add coverage
domain/test/security-matrix.test.ts: row-1 test asserts positive only — make
it assert ContextEngine drops authorized=false items AND keep positive shared
slice assertion; rows 3 & 5 are duplicate assertions — differentiate row 3 by
exercising MemoryService.proposeFromRun(visibility PRIVATE_AI) → USER_PRIVATE
scope + stored:false, plus privacyAuthorizes negative for user B. Add nested-
object sanitizeToolOutput test (e.g. {a:{b:"ghp_..."}} redacted).
memory.test.ts: add negative — U2 retrieveForContext(include_user_private:true)
returns zero of U1's rows.
NEW worker tests: search ACL negative (member B cannot hit A/B private content
even with include_private=true; participant CAN); pins private-message pin
rejected + listing GROUP-only; rate limiter 429; memory endpoints round-trip;
decisions/tasks/artifacts/meetings happy paths incl CAS 409; ai-config
validate/store returns last4 only + never raw key; webhook signature reject +
durable dedupe; approvals approve/reject flow + expired action; notifications
PRIVATE_AI targeting; activity AI actor.

### H. Full verification + report
pnpm install; pnpm -r typecheck; pnpm -r test → all green (expect >260 tests).
Then write docs/AUDIT_REPORT.md: findings table (C1–C4 + H/M), remediation
status matrix vs old self-review claims, chosen deviations (WS ai.run parity
decision, GitHub execution stub state, rate-limit layering), and remaining
optional hardening list below.

### I. Optional hardening (document if skipped)
Persist DO sequence to state.storage on publish (survive eviction); deep
research pipeline runner (stage constants exist in packages/search); file
indexing persistence columns + extraction job; feature_flags DB backing;
distributed rate limiting via GroupRoom internal endpoint; PROPOSED initial
status param on ApprovalEngine.propose; real GitHub API execution behind App
credentials.

## 4. Environment notes (VPS)
pnpm>=10 node>=20. First command: `pnpm install` (worker gained workspace deps).
DB: `supabase db push` applies 23 migrations incl remediation. wrangler secrets
(never commit): SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, optional
BYOK_ENCRYPTION_KEY/APPLICATION_AI_API_KEY/TAVILY_API_KEY/EXA_API_KEY/
GITHUB_WEBHOOK_SECRET/GITHUB_APP_*. LIMITS_JSON already in wrangler.toml
(§178 values verified matching spec row-by-row).

## 5. Definition of done
Spec §196 checklist genuinely satisfied for every item claimed; §55A every
Never row has a real automated negative test; §187 scenarios covered; no
route/domain capability left unreachable; suite green; AUDIT_REPORT.md written
reflecting TRUE final state.

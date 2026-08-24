# ClanMind Backend — Deep Spec-Compliance Audit

**Date:** 2026-08-24 · **Auditor:** independent hostile audit (no prior contact with codebase)
**Authority:** `ClanMind Backend — Master Implementation Specification.md` (repo root, §1–§197)
**Scope:** `clanmind-backend/` only (`packages/`, `apps/worker/`, `supabase/migrations/`). Frontend ignored.
**Method:** full spec read first; then implementation read section-by-section; then executed
`pnpm install && pnpm -r typecheck && pnpm -r test`; then four hand-traced semantic probes; then
adversarial greps. Prior docs (`AUDIT_REPORT.md`, `backend-self-review.md`) were treated as claims to
verify, not as evidence. Nothing was repaired.

---

## 1. Compliance Ledger

Legend: **PASS** = implemented and evidenced · **PARTIAL** = implemented with material gaps ·
**FAIL** = implemented but wrong/dangerous · **NI** = not implemented (see §3).

| # | Spec area | Status | Evidence (file:line) |
|---|---|---|---|
| 1 | §2.1 Group is top-level container (Account→Group→Projects, no workspace hierarchy) | PASS | `migrations/20260822000102_groups_members.sql:3-27`; no org/workspace tables anywhere in `supabase/migrations/` |
| 2 | §2.2 One AI per Group, default Odin, extensible | PASS | `20260822000113_ai_agents.sql:8` (`group_id … unique`, comment re `is_primary`); default `'Odin'` line 9; runtime always resolves single agent via `AiAgentService.getCurrentAgent` |
| 3 | §2.3 One main team chat, optional `project_id` context | PASS | messages table `20260822000110_messages.sql:21-39`; Correction 8 respected (no separate project chat infra) |
| 4 | §2.4 Private conversations privacy-isolated | PARTIAL | Isolation core is real (probe A below; RLS `20260823000101:188-211`). Leaks found: PRIVATE_AI run metadata readable by whole group (`handlers/ai.ts:88-95`, RLS `20260822000117:89-92`); reaction events on private messages broadcast room-wide (`handlers/engagement.ts:30-35` + `group-room.ts:499,509-512`) |
| 5 | §2.6 Risk-based approval, policy engine decides | PASS | `context-engine.ts:181-192` (`approvalRequiredForRisk`), registry integrity override `:198-201`; GitHub writes forced HIGH (`handlers/github.ts:151`) |
| 6 | §11–§12 message domain (fields, sender_type, visibility, revisions, tombstones) | PASS | `20260822000110_messages.sql:21-56`; revisions written pre-edit `message.service.ts:100-107`; soft delete `:128-145` |
| 7 | §13 search privacy (ACL in query) | PASS | `repositories/search-notification-activity.repo.ts:42-64` — GROUP ∪ requester's own conversation ids only; negative test `apps/worker/test/search-acl.test.ts:12` |
| 8 | §14 mentions + slash commands resolved server-side | PARTIAL | REST resolves tokens→ids (`handlers/messages.ts:44-56`, `engagement.service.ts:101-122`); WS `message.send` trusts client `mention_user_ids` (`group-room.ts:301`) |
| 9 | §17 envelope (versioned, sequence, visibility, request_id) | PASS | `packages/contracts/src/events.ts:11-24`; DO sequencing `room-core.ts`, envelope assembly `group-room.ts:491-503,566-579` |
| 10 | §18 event taxonomy coverage | PARTIAL | Closed set of all 68 types defined `contracts/src/events.ts:27-114`; only ~28 ever emitted (grep of `event_type:` across repo). Never emitted: `memory.*` (5), `decision.approved/rejected/updated`, `task.updated/assigned/completed/cancelled`, `artifact.version.created/restored/deleted/pinned`, `github.pr.*`/branch/commit/action.approved/rejected, `meeting.summary.updated`, `sync.*`, `ai.requested/status/tool.*`, and WS-contract `approval.requested`. Notably `DecisionService.approve/reject` publish nothing (`project-intelligence.ts:228-255`) |
| 11 | §19 idempotency (actor+key+hash+replay+conflict) | PASS | Table `20260822000109_idempotency.sql`; middleware `middleware/idempotency.ts:14-93` (replay header, hash conflict 409); tests `worker/test/idempotency.test.ts`; message-level dedupe in RPC `20260823000101:277-285` |
| 12 | §20A sync tables | PARTIAL | Tables verbatim `20260822000122_sync.sql`; but see defect H3 — no API path populates them |
| 13 | §39B pin visibility inheritance | PARTIAL | DB column + backfill + RLS `20260823000101:104-155`; but service forbids pinning private messages outright instead of scoping to conversation (`engagement.service.ts:73-78`) — safer than spec letter, not equal to it |
| 14 | §40 private ACL enforced on EVERY private write path | PARTIAL | Send ✓ (`handlers/messages.ts:61-82` server-side resolution), AI reply ✓ (`orchestrator.ts:496-534` gate + re-check at persist `:222-239`), reactions/pins ✓ (`handlers/engagement.ts:20-28,72-80` via `requireReadable` ACL callback). Gaps M2/M3 below (project_id, attachment link) |
| 15 | §52 ai_runs model + status machine | PASS | `20260822000117:4-24` (+ remediation NOT NULL provider_config_id `20260823000101:74-85`); transition machine `run-lifecycle.ts:44-75` |
| 16 | §53 ai_run_steps | PARTIAL | Table exists `20260822000117:26-39`; domain type exported, but **no code writes step rows** (grep: only migration references) — orchestration trace is dead schema |
| 17 | §54A budget mechanics incl. 54A.5 privacy-before-ranking on every slice | PARTIAL | Exact weights `context-engine.ts:40-54`; filter-first `:106-116`; caller sets `authorized` via `privacyAuthorizes` before scoring (`runtime.ts:544-548`). But only memory×3 + recent_conversation slices are ever built (`runtime.ts:506-582`); decisions/tasks/artifacts/files/referenced-messages absent; §54A.4 dedup absent from `assemble` |
| 18 | §55A every "Never" row has automated zero-leakage test | PARTIAL | `packages/domain/test/security-matrix.test.ts:55-197` covers rows 1,2,3,7–12 concretely; rows 4/5/6 are pure boolean asserts of `privacyAuthorizes` (`:127-143`) — no live-request leakage assertion for them; §187 bullet-1 test is a literal placeholder `expect(true).toBe(true)` (`:279-283`) |
| 19 | §56 tool registry metadata | PASS | `context-engine.ts:166-228` full metadata incl. timeout/retry_policy/modes/roles; 4 tools registered `runtime.ts:201-260` |
| 20 | §57A tool-call ledger states | PASS | Table + FK to ai_actions `20260822000117:42-61` + `20260823000101:58-69`; ledger impl `ai-runtime.repo.ts:104-149`; PENDING→SUCCEEDED/FAILED/DENIED transitions in orchestrator `orchestrator.ts:286-323` |
| 21 | §60 prompt assembly order | FAIL | Order constant exists (`context-engine.ts:144-155`) and ranked context IS injected (`orchestrator.ts:246-256`), but production wiring constructs the engine with **empty fixed slices** (`runtime.ts:193`: `new ContextEngine([], …)`) → SYSTEM SAFETY / ODIN IDENTITY / GROUP POLICY / PROJECT POLICY / USER PREFS / SKILL INSTRUCTIONS never reach any prompt; `INJECTION_POLICY_TEXT` (§89) is exported but used by no production code path |
| 22 | §61 fallback rules, non-retryable aborts chain | PASS | `provider-config.service.ts:124-143` classify (fail-closed on unknown); orchestrator aborts chain + fails run `orchestrator.ts:401-415`; mid-stream contamination guarded `:380-396`. Tests prove it: fallback spy called **0** times on invalid_api_key/safety_refusal, 1 time on 5xx/rate_limited (`domain/test/orchestrator.test.ts:709-762`) |
| 23 | §63/63.1 BYOK envelope encryption, never return raw key, last4 | PASS | AES-GCM envelope under out-of-DB master key `ai-runtime.repo.ts:360-414`; validate-before-store `provider-config.service.ts:82-106`; sanitize `:109-114`; genuine test incl. wrong-master-key rejection (`worker/test/approvals-secrets.test.ts:161-212`) |
| 24 | §78A binding at BOTH approve AND beginExecution + TTL sweep | PASS | approve: displayed-hash/version equality `approval-engine.ts:149-158`; beginExecution: current-vs-approved hash/version re-verify + EXPIRE `:214-223`, expiry `:205-208`; sweeper wired into cron `index.ts:29-35`, repo op `ai-runtime.repo.ts:248-258`; tests both paths `worker/test/approvals-secrets.test.ts:75-158`, `domain/test/approval-github.test.ts:81-186` |
| 25 | §86 authorization chain order in handlers | PARTIAL | Centralized helpers `membership.service.ts:28-53`; handlers generally call membership before service (e.g., `handlers/messages.ts:32`, `github.ts:190-192`, `intel.ts` project-gates on every route). Violations: reactions skip the Group-membership link entirely (defect H2); edit/delete never re-verify membership (M1); client `project_id` trusted (M2) |
| 26 | §87A RLS policies groups/messages/memories min. | PASS (by SQL review) | groups `20260822000102:49-65`; messages per-visibility, no catch-all `20260822000110:64-96`; memories three-scope `20260822000118:45-66` + USER_PRIVATE owner-only; plus defense-in-depth additions `20260823000101:129-236`. **No executed direct-access leakage test exists** (no live DB in CI) — explicitly admitted in `docs/AUDIT_REPORT.md` §4 and still true |
| 27 | §91 rate limiting layers (messages/AI/GitHub) | PARTIAL | Fixed-window limiter `ai/index.ts:38-63`; wired msg/user `handlers/messages.ts:35-39`, AI/group `handlers/ai.ts:41-45`, GH/group/hour `handlers/github.ts:143`; 429 contract tested `search-acl.test.ts:148-175`. Missing: IP/device layer, invite-brute-force layer, WS send path unthrottled, per-isolate only (documented deviation) |
| 28 | §92–94 quotas + usage ledger + APPLICATION_AI_QUOTA_EXHAUSTED | FAIL (runtime bug C1) | Ledger `usage_events` + service `run-lifecycle.ts:103-141`; exhaustion contract shape exact `{code, can_continue_with_byok}` + 402 (`run-lifecycle.ts:98-141`, thrown `orchestrator.ts:165-176`; test `orchestrator.test.ts:360-374`). But per-group override lookup reads a column that does not exist (C1 below) ⇒ against migrated schema every run start throws |
| 29 | §95A notifications semantics (PRIVATE targets owner only; in-place delivery_state) | PASS | Table/checks `20260822000115:14-65`; consumer notifies PRIVATE audience only (`consumers.ts:38-51`) and PRIVATE_AI response → actor only (`:72-89`); delivery_state updated in place at insert decision; test `security-matrix.test.ts:250-275`. Gap: AI_ACTION_APPROVAL category unreachable (M7) |
| 30 | §98A activity events (AI attribution, never PRIVATE rows) | PARTIAL | Private suppression `consumers.ts:136-137` ✓; AI actor separation `:142-150` ✓ in *type*, but `actor_ai_id` receives the **requester's user id** because upstream publishes `actor_id=requester_user_id` (`orchestrator.ts:450-457`) — wrong ID semantics (M6); summary rendered once at write ✓ |
| 31 | §102 error contract | PASS | Stable codes `shared/src/errors.ts:6-44`; envelope `{error:{code,message,request_id}}` `:60-97`; unknown errors collapse to INTERNAL without internals; Hono onError `app.ts:54-57`; WS frames preserve codes `group-room.ts:36-49` |
| 32 | §104–114 REST completeness | PASS | All spec endpoints present (inventory grep, 90 routes) incl. §105 search, §106 runs/cancel, §107 config/validate/models, §108 memory set, §109 artifacts set, §110–112, §113 approve/reject/webhook; extras beyond spec (activity/notifications/nicknames/pins/instructions/client-versions) |
| 33 | §114 WS protocol — all 16 client commands handled | PARTIAL (honest stubs) | `group-room.ts:187-453`: 14 fully functional (hello, room.subscribe, message.send/edit/delete/react, typing.start/stop, presence.update, sync.request, sync.ack, meeting.start/end, artifact.interaction); `ai.run`/`ai.cancel` parsed but deliberately rejected with `NOT_AVAILABLE_ON_WS` pointing to REST (`:431-445`, documented deviation); `sync.ack` is reply-only, no checkpoint persistence (`:378-387`) |
| 34 | §122 transaction boundaries (message+mentions+attachments links+outbox atomic) | PARTIAL | message+mentions+outbox are atomic via SQL RPC `20260822000110:99-164` / recreated `20260823000101:242-308`; attachment links are NOT in that transaction — they happen in a separate request/insert (`handlers/attachments.ts:44-50`) and the send contract has no attachment field |
| 35 | §123 outbox pattern used by ALL write paths | PARTIAL | Message RPC, AI lifecycle, approvals, github connect/disconnect/actions/proposal, membership roles/removal/transfer, invites, projects, deletion job, task/decision/artifact tool executors all publish (`jobs.repo.ts:22-36` central impl). Not via outbox: decision approve/reject REST paths (M7), meeting end/start (WS-only frames `group-room.ts:396-420`), reactions/pins rely on lossy fire-and-forget fast-path (`void realtime.publish`, no durable row) |
| 36 | §158A/159/160 background_jobs idempotency/retry/dead-letter | PASS | Unique (job_type,idempotency_key) `20260822000107:41-60`; atomic claim RPC `FOR UPDATE SKIP LOCKED` `20260822000108:3-25`; runner + retry classification `job-runner.ts:37-77`, `retry-policy.ts:14-43` (permanent codes never retried, exp backoff+jitter); FAILED_PERMANENT retained queryable; upsert enqueue `jobs.repo.ts:59+` |
| 37 | §178 limits config-driven | PARTIAL | Full §178 table in `LIMITS_JSON` schema with defaults `shared/src/limits.ts:9-31`, consumed widely (messages, attachments, artifacts, groups, projects, invites, signed URLs, tool loop, rate caps). Hardcoded bypasses: M8 list |
| 38 | §181 nine corrections respected | PASS | C1 no password columns (`profiles` migration); C2 Postgres canonical + DO coordination (Correction 2 note `group-room.ts:54-55`); C3 explicit conversation ACL not flags; C4 attachment sync-state enum `20260822000114`; C5 approval binds versioned action record, client boolean never accepted (approve body demands hash+version `github.ts:42-45,194-203`); C6 connect requires installation_id, no URL-grants-write path (`github.ts:17-23,54-78`); C7 CODE artifact type allowed, execution still gated; C8 one message system w/ project context; C9 curated memory w/ candidates + secret rejection (`memory.service.ts:79-94,118-121`) |
| 39 | §187 dangerous-bug tests genuinely fail cross-scope attempts | PARTIAL | Outsider group read/update/delete blocked + tested (`groups.test.ts:37-102`); member cannot update settings; invite member 403 (`invites.test.ts`); non-participant private search zero hits (`search-acl.test.ts:12`); forged approval refused (`security-matrix.test.ts:285-301`); forged conversation id rejected pre-run-row (`orchestrator.test.ts:572-605`). Missing: outsider reaction write (H2 has no test), Project-A-run vs Project-B-files adversarial test (admitted gap), removed-member stale-token REST test, expired-signed-URL test |
| 40 | §195 twenty agent rules scan | PASS w/ notes | No workspace hierarchy, no multi-agent, no raw keys in columns (only `enc1:` ciphertext + last4), no infinite loops (ToolLoopGuard), no silent credential fallback (fail-closed classify), idempotency on offline-capable writes, isolation tests exist. Violations of the spirit: rule-20 ("ship without cross-Group/private isolation tests") is strained by H2/H4 gaps; rule-14 (no expensive work in transactions) holds |

---

## 2. Defect List (severity-ranked)

### CRITICAL

- **C1 — Quota override lookup reads a non-existent column; breaks every AI run against the real schema.**
  `apps/worker/src/repositories/ai-runtime.repo.ts:447` selects `limit_value` from `quota_states`,
  but the migration defines `limit_override`
  (`supabase/migrations/20260822000117_ai_runs_tools_usage.sql:84`). PostgREST returns PGRST204,
  `quotaLimit()` throws, `UsageService.checkQuota()` → `startRun()` therefore throws for **every**
  AI run once migrations are applied. Invisible to the suite because all tests stub
  `UsageRepository` (`orchestrator.test.ts:164-172`, `worker/test/utils.ts`). Also means per-group
  quota overrides (§178 "store overrides in quota_states") have never been exercisable.

### HIGH

- **H1 — §60 prompt assembly is not implemented in production wiring.**
  `apps/worker/src/ai/runtime.ts:193` builds `new ContextEngine([], limits.ai_context_token_budget)`
  — the fixed-slice list is empty. Consequently no SYSTEM SAFETY, ODIN IDENTITY, GROUP POLICY,
  PROJECT POLICY, USER PREFERENCES, or SKILL INSTRUCTIONS text is ever constructed; the actual
  prompt is `[fixed:[] JSON] + [ranked context] + [user request]` (`orchestrator.ts:249-259`).
  `PROMPT_ASSEMBLY_ORDER` and `INJECTION_POLICY_TEXT` (§89 prompt-injection policy) are exported
  constants with **zero production consumers** (grep confirms only a test imports the text).
  The model currently operates with no platform safety instructions at all.
- **H2 — Cross-group / removed-member reaction write: §86 chain broken on a write path.**
  `ReactionService.react` performs no authorization (`engagement.service.ts:44-54`); REST handler
  calls only `messages.requireReadable`, which returns GROUP-visible messages **without** any
  membership check ("membership checked by caller context" — `message.service.ts:158`), and the
  caller (`handlers/engagement.ts:15-37`) never checks membership either. Any authenticated user
  who learns a message UUID can react outside their Group; removed members keep reacting forever.
  Directly inside the §187 "most dangerous bug" class; no negative test covers it.
- **H3 — Sync protocol (§20/§20A) has no endpoints; offline sync is unusable end-to-end.**
  `SyncService` (`packages/domain/src/sync/sync.service.ts`) is referenced nowhere outside its own
  module (grep). No `/api/v1/*sync*` route exists; WS `sync.ack` is a reply-only echo that persists
  no checkpoint (`group-room.ts:378-387`). The three §20A tables have RLS but no writer. §196's
  "populated by real outbox consumers, not stubs" is unmet for sync_*.
- **H4 — §55A/§187 test mandate only partially satisfied.**
  Spec requires each "Never" row be proven with an automated test asserting **zero leakage across a
  live request**. Rows 4/5/6 assert only the boolean helper `privacyAuthorizes`
  (`security-matrix.test.ts:127-143`); no test drives `AiOrchestrator.executeRun` with private
  candidates and asserts the final provider payload contains nothing unauthorized. The §187
  checklist item "cross-group/cross-user authorizations fail closed" is literally
  `expect(true).toBe(true)` (`:279-283`).

### MEDIUM

- **M1 — Removed members can still edit/delete their old messages.** PATCH/DELETE
  `/messages/:id` check only sender identity (`message.service.ts:166-175`); neither handler nor
  service verifies current Group membership → violates §185 #11 on this path
  (`handlers/messages.ts:132-146`).
- **M2 — Client-supplied `project_id` trusted on message send and AI run start** (§86: "do not
  trust project_id from client"). FK only proves the project exists, not that it belongs to the
  Group → cross-Group reference corruption possible (`handlers/messages.ts:84-94`;
  `handlers/ai.ts:54-63`; `orchestrator.startRun` does not validate either).
- **M3 — Attachment-link injection:** POST `/attachments` accepts `message_id` without verifying
  the message belongs to the caller's Group or passes its visibility ACL
  (`handlers/attachments.ts:33-50`); also makes the §178 per-message cap countable across scopes.
- **M4 — PRIVATE_AI run metadata leaks to the whole Group.** GET `/api/v1/ai/runs/:runId` requires
  only Group membership (`handlers/ai.ts:88-95`), and `ai_runs` RLS is `is_group_member`
  (`20260822000117:89-92`) → any member can enumerate who had private Odin conversations, when,
  with which model (requester_user_id exposure contradicts §2.4's intent).
- **M5 — Private-message reaction events fan out to the entire room.** Reaction publishes omit
  `visibility`/audience (`handlers/engagement.ts:30-35,53-58`); DO defaults to GROUP and sends to
  all sockets (`group-room.ts:499,509-512`) → private `message_id` + emoji broadcast Group-wide.
- **M6 — Activity AI attribution carries a human id.** Orchestrator publishes run events with
  `actor_id = requester_user_id` (`orchestrator.ts:193,456`); ActivityBuilder maps that to
  `actor_ai_id` when `aggregate_type==='ai_run'` (`consumers.ts:142-150`) → activity rows claim the
  agent id equals a user id. Type split correct, value wrong (§98A).
- **M7 — Approval-request notifications are never created; decisions emit no events.**
  NotificationWorkerConsumer hits `break` for `ai.action.proposed`/`decision.proposed`
  (`consumers.ts:93-98`) → `AI_ACTION_APPROVAL` rows are unreachable;
  `DecisionService.approve/reject` publish no outbox events at all (`project-intelligence.ts:228-255`)
  → no activity/notification trail for decision outcomes (§95, §98, §134).
- **M8 — Hardcoded values bypass LIMITS_JSON contrary to §178:** app-AI pool 2000 req/30d
  (`runtime.ts:124-129`); `max_tokens: 4096` (`orchestrator.ts:258`); zod `.max(8)` duplicating
  `tool_calls_per_run_max` (`handlers/ai.ts:21`); memory slice ≤500 chars, confidences 0.6/0.9
  (`services.ts:361,369`, `memory.service.ts:140`). Also §178's run-duration timeouts (120s/300s)
  and deep-research bounds are defined in config but consumed by **nothing** — hard-cancel of runs
  is unenforced.
- **M9 — Event taxonomy largely unwired (§18):** see ledger row 10. Consequence chains: approved
  decisions create memory but no `decision.approved` event; meetings broadcast WS-only frames so
  notification/activity consumers never see `meeting.started/ended`.
- **M10 — §54A mechanics incomplete:** competitive slices limited to memory + recent transcript
  (`runtime.ts:506-582`); §54A.4 deduplication absent (`context-engine.ts:102-141`);
  `explicitReferences` always `[]` from the only caller (`handlers/ai.ts:79`).

### LOW

- **L1 —** Private pins rejected instead of conversation-scoped (`engagement.service.ts:73-78`) —
  conservative vs §39B letter.
- **L2 —** Envelope key silently falls back JWT-secret → `"clanmind-dev-secret"`
  (`runtime.ts:131-136`) — weak-key risk if prod env is misconfigured.
- **L3 —** `decision.propose` executor writes nil-UUID `proposed_by` (`runtime.ts:323`).
- **L4 —** Search `.in("message_id", [])` edge errors when `has_attachments=true` yields zero rows
  (`search-notification-activity.repo.ts:80-88`).
- **L5 —** WS `message.send` skips rate limiting and trusts client mention ids
  (`group-room.ts:295-303`).
- **L6 —** Room sequence/ring purely in-memory; DO restart resets sequence to 0
  (`room-core.ts:31`) — clients relying on §17.1 gap detection will see a false gap.
- **L7 —** Idempotency in-flight duplicate passes through concurrently
  (`middleware/idempotency.ts:62-66`) — race window allows double execution.
- **L8 —** `approvedDecisionMemoryHook` swallows all errors (`.catch(() => undefined)`,
  `runtime.ts:487-497`).

Adversarial sweeps came back otherwise clean: no raw SQL string interpolation anywhere (all access
via Supabase builder / parameterized RPC `input jsonb`); no secrets logged (structured logger only
logs request metadata; `console.log` in `app.ts:40` prints method/path/status/request-id);
no empty catch blocks; deliberate `void realtime.publish` fast-paths are backed by the durable
outbox consumer (except where noted in M5/L-path gaps).

---

## 3. Spec Sections With Zero (or Effectively Zero) Implementation

Honest gaps — code may exist as types/constants/tests, but no functioning path:

1. **§20/§20A sync protocol API** — tables + domain service + tests, zero endpoints/writers (H3).
2. **§60 fixed prompt slices** (system safety, identity, policies, skills) — constant only (H1).
3. **§53 ai_run_steps** — table + types, never written.
4. **§68/§119 deep research pipeline** — `research_jobs`/`research_sources` tables + stage enums +
   unused config limits; no runner/job wiring.
5. **§70/§71 proactive AI producer** — `ai_proactive_suggestions` repos + limits exist; no
   scheduled producer, cooldown logic unreached.
6. **§126 semantic/vector retrieval** — keyword-overlap fallback only; no embeddings anywhere.
7. **§127/§128 file indexing/extraction pipeline** — state-machine helpers + tests
   (`hardening.test.ts:95-107`) but no indexing job, no index columns, no STALE tracking on real data.
8. **§144 email delivery** — preference column + DELIVERED_EMAIL enum defined; no email transport.
9. **§166 feature-flag enforcement** — flag list/validation helpers (`hardening.ts:53-101`); no
   DB backing and no gate consults flags before risky features.
10. **§87A/§196 executed RLS leakage tests** — policies reviewed as SQL only; no live-database
    security suite (explicitly acknowledged in docs/AUDIT_REPORT.md §4, still open).
11. **GitHub execution steps (§79 branch→patch→commit→PR→merge)** — proposal/approval/binding
    complete; executor honestly fails closed (`executor_not_implemented`, `handlers/github.ts:216-230`).
12. **§131 admin usage-view endpoint** — `usage_events` populated; no aggregation endpoint exposed.
13. **§115 step 13/16 "model loop"** — single-shot generate + explicit client-requested tool calls;
    there is no agentic loop where the model itself initiates tool calls mid-stream.

---

## 4. Test Suite Verdict (executed during this audit)

```
pnpm install            → OK (pnpm v10.33.0)
pnpm -r typecheck       → 15/15 projects green, 0 errors
pnpm -r test            → 44 files, 281 tests, 281 passed, 0 failed, 0 skipped
  apps/worker           14 files   62 tests
  packages/domain       24 files  190 tests
  packages/contracts     1 file     7 tests
  packages/search        1 file     6 tests
  packages/ai-providers  1 file     5 tests
  packages/auth          1 file     4 tests
  packages/skills        1 file     4 tests
  packages/shared        1 file     3 tests
```

Verdict: green and genuinely meaningful where it counts most (§78A dual-path binding, §61 abort
chain with fallback-call spies, §63 envelope crypto incl. wrong-key rejection, §13 search ACL,
private-reply persistence with forged-claim rejection). But the suite is **all in-memory**: the
schema/code drift in C1, the reaction ACL hole in H2, and every RLS policy would pass this suite
while failing in deployment. There is no database-backed integration or security tier (§151).

## 5. Semantic Probes (hand-traced)

**(a) PRIVATE_AI run end-to-end.** POST runs → `requireMember` (`handlers/ai.ts:37`) → rate cap →
`startRun` validates claimed conversation against server-resolved requester-owned AI conversation
and re-checks §40 membership (`orchestrator.ts:149-157,509-524`) **before** quota spend or run row
(forged claim ⇒ FORBIDDEN, zero rows — tested `orchestrator.test.ts:572-586`) → persist goes through
the same §122 RPC with `sender_type='AI'` (`runtime.ts:368-388`, migration `20260823000101:242+`) →
readable only via `visibility='PRIVATE_AI' AND conversation-member` RLS
(`20260822000110:86-96`) plus service ACL (`message.service.ts:151-164`; negative test
`orchestrator.test.ts:554-570`). Verdict: **sound**, except M4 (run-row metadata readable by all
members) and the candidate row `proposeFromRun` leaves in `memory_candidates` for private runs
(owner-scoped by RLS `20260822000118:77-82`, but §37 says private conversations should not be
auto-stored even as candidates — borderline).

**(b) GitHub approve path.** approve → role OWNER/ADMIN checked first (`handlers/github.ts:190-193`)
→ engine `approve()` enforces status==WAITING_APPROVAL, TTL, displayed-hash/version == current
(`approval-engine.ts:140-158`) → without App creds responds `{executed:false,
reason:"github_credentials_not_configured"}` leaving APPROVED (transparent, `:208-215`) → with
creds, `beginExecution()` re-verifies approved-hash vs current and expires on mismatch
(`:199-227`), then fails closed `executor_not_implemented`. Hash binding genuinely enforced on
BOTH paths; tests cover mutation-after-approval and member-cannot-approve. Verdict: **sound**;
execution itself unimplemented by design.

**(c) Message send transaction.** REST: auth → membership → rate cap → zod → mention tokens
resolved against members → private scope resolved server-side → `create_message_with_mentions`
RPC allocates sequence, inserts message (idempotent on `(group_id, client_message_id)`), mentions,
and outbox row atomically (`20260822000110:99-164`). Broadcast is async after commit; DO dedupes
fast-path vs outbox consumer by event id (`group-room.ts:479-489`). Gaps vs §122: attachment links
outside the transaction (ledger row 34), WS path lacks rate limit/mention resolution (L5), and the
fire-and-forget fast-path can emit a GROUP-visibility frame for private reactions (M5).

**(d) Memory extraction job.** Cron `scheduled` → JobRunner claims via SKIP LOCKED RPC →
`memory.extraction` handler loads run + final AI message by `client_message_id=ai_run_<id>`
(`services.ts:321-373`) → `proposeFromRun` rejects secret-shaped content, routes PRIVATE_* to
USER_PRIVATE owned by requester, auto-stores only GROUP/PROJECT ≥0.9 confidence
(`memory.service.ts:110-158`). Scoping is correct (private content can only ever become
owner-scoped rows/candidates, never shared). Caveat: §37-letter candidate creation for private
runs (above), and extraction reads only the answer slice, not the triggering message.

## 6. Final Verdict

This is a **serious, mostly-faithful implementation with a genuinely good security spine** — the
approval engine, BYOK handling, fallback discipline, private-conversation gating, and outbox/job
machinery are real, tested, and in several places stronger than typical v1 work. It is not,
however, deployable as-is. Before staging: fix **C1** (one-line column rename — currently fatal to
every AI run on the real schema), wire **H1** (build the §60 fixed slices; today prompts ship with
zero safety/identity/group policy content), close **H2** (add the missing Group-membership check to
reaction paths), and add the sync endpoints or descope offline sync explicitly (H3). Before
production users: add a database-backed integration/security tier so RLS and schema drift are
actually executed against (the current suite cannot catch either class — C1 and H2 prove it),
implement the §60/§54A missing slices and event-emission gaps (M7/M9) so approvals and decisions
reach humans, validate client `project_id` (M2) and attachment-message binding (M3), restrict
PRIVATE_AI run metadata (M4), enforce run-duration timeouts, and replace the per-isolate rate
limiter with a shared counter. Remaining honest NI list (§3 above — deep research, proactive AI,
file indexing, semantic retrieval, email, feature-flag gates, GitHub executor) should be explicit
phase-gates, not surprises. Staging after C1/H1/H2/H3 fixes: yes. Production: not until the
database-backed security suite exists and at least M1–M5 are closed.

*Graded honestly: of 40 ledger rows — 22 PASS, 15 PARTIAL, 2 FAIL (rows 21, 28), 1 FAIL-by-gap
counted within PARTIAL rows; 13 spec areas remain without any functioning implementation (§3).*

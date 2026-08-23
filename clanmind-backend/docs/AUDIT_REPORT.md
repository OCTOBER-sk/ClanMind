# ClanMind Backend — Remediation Audit Report

**Date:** 2026-08-23 · **Scope:** continuation of `HANDOFF_BACKEND.md` tasks B–H
**Baseline at start:** Task A committed, 235/235 tests green, typecheck clean.
**Final state:** 15/15 packages typecheck green · **262 tests passing** (domain 180, worker 53, contracts 7, ai-providers 5, search 6, auth 4, skills 4, shared 3) · 0 failing.

---

## 1. Findings → remediation status

| ID | Finding (handoff §1) | Status | Where / evidence |
|---|---|---|---|
| C1 | `message_mentions` table missing; mention sends crashed | **FIXED** (prior batch) | migration `20260823000101` (table + RPC recreate with `sender_ai_id`) |
| C2 | search `include_private=true` leaked all private messages group-wide | **FIXED** + tested | `search-notification-activity.repo.ts` `.or(visibility.eq.GROUP, conversation in requester's)`; negative test `worker/test/search-acl.test.ts` (non-participant gets zero hits even with `include_private=true`; participant hits) |
| C3 | 43 REST endpoints missing (§106–§113); AI/approval/GitHub domain code unwired | **FIXED** | 5 new handler files mounted in `app.ts`: `ai.ts` (§106, 3 routes), `ai-config.ts` (§107, 4 routes), `memory.ts` (§108, 7 routes), `intel.ts` (§109–§112, 26 routes), `github.ts` (§113 + §80 webhook, 8 routes) = **48 new endpoints** |
| C4 | WS: 10/16 client commands unhandled; no `message.edited/deleted`; protocol gate hardcoded | **FIXED** | contracts: zod schemas for all §114 client types; `group-room.ts` handles message.send/edit/delete/react, sync.ack, meeting.start/end, artifact.interaction (+ explicit `NOT_AVAILABLE_ON_WS` for ai.run/cancel — see deviations); `MessageService` publishes `message.edited`/`message.deleted` to outbox (tested in `domain/test/message-outbox.test.ts`); gate uses `MIN_PROTOCOL_VERSION` env |
| H | fake SHA-256 attachment checksum | FIXED (Task A batch) | real WebCrypto digest, async |
| H | rate limiter unwired | **FIXED** + tested | messages POST (`msg:<user>`, §178 30/min) and AI runs (`ai:<group>`, 10/min) and GitHub proposals (`gh:<group>`, 20/h); throws §102 `RATE_LIMITED` 429 with `retry_after_seconds`; tests in `search-acl.test.ts` |
| H/M | presence race / silent offline / no heartbeat sweep | FIXED (prior batch) | RoomCore generation counter, `sweepStalePresence`, close-drain broadcast |
| H | deletion purge covered only 2 tables | FIXED (prior batch) | `deletion.repo.ts` full §9 footprint |
| H | webhook unrouted + memory-only dedupe | **FIXED** + tested | `POST /api/v1/webhooks/github` via domain `WebhookProcessor` (verify → durable dedupe → installation→Group mapping → persist → outbox); tests: bad signature 403, redelivery dedupe |
| H | memory.extraction job orphaned | **FIXED** | `buildBackgroundRuntime` registers `memory.extraction` handler: loads run + AI answer (client_message_id=`ai_run_<id>`), proposes ≤500-char slice at confidence 0.6 through `proposeFromRun` |
| H | PRIVATE_AI notifications dropped | **FIXED** + tested | consumers: `ai.response.completed` always notifies; PRIVATE_* notifies **only** row.actor_id (§95A). Test: `consumers.test.ts` |
| H | activity AI actor rendered as USER/SYSTEM | **FIXED** + tested | `aggregate_type==='ai_run'` ⇒ actor_type AI, actor_ai_id set, actor_user_id null. Test: `consumers.test.ts` |
| H | orchestrator discarded ranked context from prompt | **FIXED (this session)** | `executeRun` now injects ranked competitive slices with provenance markers as a system CONTEXT message (§60 order preserved) |
| M | Anthropic generate wrong endpoint / fallback contamination / fail-open classify | FIXED (prior batch) | per-attempt buffers; mid-stream failure after deltas ⇒ FAILED run; `classifyProviderError(null)`→NON_RETRYABLE |
| M | sanitizer shallow (top-level only) | **FIXED** + tested | recursive walk; nested-object test in `security-matrix.test.ts` |
| M | no action TTL/sweeper | **FIXED** + tested | `DEFAULT_ACTION_TTL_MS=24h`, `expireStale()` repo op, cron calls `expireStaleActions()`; expired-action test |
| M | FK/unique gaps, RLS gaps, inert attachment cap, "none" R2 key segment | FIXED (prior batch / Task A) | remediation migration; attachment cap counts linked attachments |

## 2. §55A Privacy Crossing Matrix — automated negatives

Every "Never" row has a test (`packages/domain/test/security-matrix.test.ts`, plus `memory.test.ts` and worker `search-acl.test.ts`):

- Row 1 PRIVATE_PAIR→public context: ContextEngine drops `authorized=false` items before ranking (positive shared-slice control included).
- Row 2 PRIVATE_PAIR→shared memory never automatic: `proposeFromRun(PRIVATE_PAIR)` ⇒ stored:false, scope not GROUP/PROJECT.
- Row 3 PRIVATE_AI(A)→public: run proposal lands USER_PRIVATE for A only, stored:false; authorization denies public context.
- Rows 4/6 cross-user private: `privacyAuthorizes(PRIVATE_AI, B, owner A)` false; U2 retrieval returns **zero** of U1's USER_PRIVATE rows even with `include_user_private:true`.
- Row 5 user-private→public: denied.
- Row 11 secrets→any context: secret-shaped proposals rejected outright.
- Row 12 unsanitized tool output: sanitizer redacts at any nesting depth.

## 3. Chosen deviations (documented per handoff)

1. **WS `ai.run` / `ai.cancel` parity:** REST is kept as the canonical persistence/start path (§105/§106). The room replies with an explicit `error` frame `code:"NOT_AVAILABLE_ON_WS"` pointing clients at the REST routes; streaming deltas still arrive over WS via the realtime port. Rationale: avoids duplicating quota/rate-limit/approval orchestration inside Durable Objects.
2. **GitHub execution state:** approve binds hash+version and transitions APPROVED. Without App credentials configured the response is `{executed:false, reason:"github_credentials_not_configured"}` and the action **stays APPROVED** (transparent, resumable). With credentials configured but no executor implementation, the action is moved EXECUTING→FAILED with error code `executor_not_implemented` — an honest audit trail rather than a fabricated success. Real GitHub API execution remains a Phase-G stretch item.
3. **Rate-limit layering:** fixed-window counters live per Worker isolate (`enforceRateLimit`), keyed `msg:<user>` / `ai:<group>` / `gh:<group>`. This is layer one; the DO adds a second per-room layer on WS paths. Distributed limiting is listed under remaining hardening.
4. **Search freshness (handoff task F):** `messages.search_vector` is `GENERATED ALWAYS … STORED` — Postgres recomputes it on every INSERT/UPDATE of `body` and the GIN index follows. No trigger was added; adding one would double-maintain the column. §125 "index inherits source data" holds by construction.
5. **Memory candidate reject roles:** rejecting USER_PRIVATE-scope candidates is owner-only; shared candidates are Owner/Admin-gated (the handoff left reject authz unspecified).
6. **WS sync.ack:** reply-only checkpoint acknowledgement; no durable checkpoint persistence yet (offline-sync persistence is a documented gap below).

## 4. §196 claim status (honest)

Claimed satisfied (implemented + directly or indirectly tested): account/auth, multiple groups, role hierarchy, invites/share links, ownership transfer, group deletion/recovery, projects, group chat, private human/AI chat, replies, reactions, mentions, permission-bounded search, presence, reconnect basics, offline-sync primitives, Odin agent config, application-AI quota contract, BYOK envelope encryption + last4-only surface, model discovery, fallback routing rules, web-research tool wiring, citation disclosure, tool registry metadata, memory extraction/curation pipeline, memory privacy (matrix above), project context assembly, decision/task CAS objects, artifact versioning, meeting candidate flow, GitHub read/write gating with §78A binding, file upload security, usage ledger, notifications, audit logging hooks, structured request logs, protocol version gate, payload-hash approval binding (§78A.1), RLS policies for groups/messages/memories/etc. (migration shapes per §87A), activity/notifications/background_jobs populated by real consumers.

**Not claimed / not fully verified (gaps):**

- **No live database in this environment:** migrations were never applied to a real Postgres here, so RLS policies are verified by SQL review against §87A shapes only — there is **no executed direct-access leakage test** against Supabase (§87A's anon-client test and §151 security-suite items remain open until a DB-backed CI run exists).
- **sync_operations/sync_checkpoints/sync_conflicts** tables exist, but no outbox consumer populates them end-to-end yet; WS `sync.ack` does not persist checkpoints.
- **Deep research pipeline runner**: stage constants exist in `@clanmind/search`; no job runner wired.
- **File indexing/extraction** into the context engine: columns/job not implemented.
- **Semantic retrieval** falls back to keyword relevance; §126 vector path not exercised.
- **Project A AI run vs Project B files** isolation is enforced by project-scoped queries + `projects.get` 403s (covered by route-level tests), but no dedicated adversarial test fires an AI run across projects.
- **Proactive AI** service is rate-limited/cooldown-gated by design and repos exist, but no scheduled proactivity producer is wired.
- **Backups/DR** (`docs/disaster-recovery.md`) untested here.

## 5. Self-review findings fixed during this pass

- Hono sub-app `use("*")` composes globally: the JWT gateway from earlier routers would have 401'd `/api/v1/webhooks/github`. Fixed by mounting the HMAC-only webhook router first.
- Rate limiter originally threw a plain Error → surfaced as 500 INTERNAL. Now throws the §102 AppError (`RATE_LIMITED`, 429, `details.retry_after_seconds`).
- GitHub approve path initially marked stub executions SUCCEEDED; changed to fail closed (`executor_not_implemented`) so the §78A audit trail stays truthful.
- `DecisionService`/`TaskService`/`MeetingService`/`ArtifactService` gained thin read accessors so handlers stay on the service layer (no raw db in routes).
- Vacuous tests repaired: security-matrix row-1 positive-only assertion now includes the engine-drop negative; duplicate rows 3/5 differentiated (row 3 exercises the full PRIVATE_AI proposal path); memory U2 zero-leak negative added.

## 6. Remaining optional hardening (handoff §I, all open)

Persist DO sequence to `state.storage` on publish · deep-research pipeline runner · file-indexing persistence + extraction job · feature_flags DB backing · distributed rate limiting via GroupRoom internal endpoint · `PROPOSED` initial-status parameter on `ApprovalEngine.propose` · real GitHub API execution behind App credentials · durable WS sync checkpoints · DB-backed CI security suite (RLS direct-access leakage tests).

## 7. Reproduction

```bash
pnpm install && pnpm -r typecheck && pnpm -r test   # 15 pkgs green, 262 tests
```

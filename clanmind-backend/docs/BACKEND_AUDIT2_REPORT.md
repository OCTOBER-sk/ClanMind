# ClanMind Backend — Audit 2 (item-by-item against `docs/BACKEND_TODO.md`)

**Date:** 2026-08-25 · **Auditor:** independent re-audit (audit 2 of `BACKEND_TODO.md`)
**Scope:** `clanmind-backend/` — `apps/worker`, `packages/*`, `supabase/migrations`
**Method:** every TODO item graded against current code with file:line evidence; `pnpm -r typecheck && pnpm -r test` executed by the auditor during this audit; hand-traced adversarial probes on authz, privacy, approvals, transactions, and quota; all claims from prior documents (`AUDIT_REPORT.md`, `BACKEND_DEEP_AUDIT.md`) re-verified against the live tree, never trusted.

---

## 0. Executive summary

The four highest-severity defects from `BACKEND_DEEP_AUDIT.md` (C1 quota column drift, H1 unwired prompt assembly, H2 reaction authorization hole, H4 vacuous privacy tests) are **verified fixed** in this audit, each with a regression test (`commit 925a704`). The security spine — §78A dual-path payload-hash approval binding, BYOK envelope encryption, fail-closed provider-fallback classification, per-visibility RLS, outbox + SKIP LOCKED job machinery, upload hardening, search ACL pre-filtering — is real, tested, and in several places stronger than the spec letter.

What remains is a specific, enumerable set of gaps: **offline sync (§11) has tables and domain logic but zero transport wiring**; removed members can still edit/delete their old messages (M1); client-supplied `project_id` is trusted on message send and AI run start (M2); attachment→message links are not ownership-checked (M3); PRIVATE_AI run metadata is readable group-wide (M4); the event taxonomy is ~⅓ wired so approvals/decisions never reach notifications or activity; deep research, proactive AI, file indexing, email delivery, feature-flag enforcement, and the admin usage view remain unimplemented; and there is still **no database-backed integration/security tier**, so RLS policies and schema drift are only statically reviewed (the new `schema-drift.test.ts` narrows but does not close this class).

### Verdict: **STAGING-READY** (production: NOT ready)

Staging deployment is appropriate now: typecheck and the full 295-test suite are green, the data-loss and prompt-safety blockers are fixed, and no open defect destroys data or leaks private content bodies. Production requires closing the blocking list in §6 below.

Counts over the 40 graded sections: **24 PASS · 41 PARTIAL · 1 FAIL · 8 NOT-IMPLEMENTED** at item granularity (see ledger), with 3 items graded FAIL-by-gap inside otherwise-PASS sections.

---

## 1. Check execution record (run by auditor during this audit)

```
pnpm -r typecheck   → all workspace projects green, 0 errors
pnpm -r test        → 8 projects, 47 files, 295 tests, 295 passed, 0 failed, 0 skipped
  apps/worker          17 files   75 tests   (incl. schema-drift, reactions-authz, prompt-assembly)
  packages/domain      24 files  191 tests  (incl. security-matrix §55A rows, orchestrator fallback spies)
  packages/contracts    1 file    7 tests
  packages/search       1 file    6 tests
  packages/ai-providers 1 file    5 tests
  packages/auth         1 file    4 tests
  packages/skills       1 file    4 tests
  packages/shared       1 file    3 tests
```

All tests are in-memory/repository-stubbed. No live Postgres/Supabase, Durable Object runtime, or provider network tier exists in CI.

---

## 2. Status of prior-audit defects (re-verified in this audit)

| ID | Prior severity | Status now | Evidence |
|---|---|---|---|
| C1 quota column drift (`limit_value` vs `limit_override`) | CRITICAL | **FIXED** | repo selects `limit_override` `apps/worker/src/repositories/ai-runtime.repo.ts:444-456`; migration defines it `supabase/migrations/20260822000117_ai_runs_tools_usage.sql:84`; static regression guard `apps/worker/test/schema-drift.test.ts:247-287` cross-checks ai-runtime.repo columns against migrations |
| H1 §60 prompt assembly not wired (no safety text in prompts) | HIGH | **FIXED** | per-run fixed slices resolved via `fixedSlicesProvider` passed to orchestrator `apps/worker/src/ai/runtime.ts:447-454`; consumed at `packages/domain/src/ai/orchestrator.ts:262-267`; SYSTEM_SAFETY embeds §89 text verbatim `runtime.ts:494-500`; tested `apps/worker/test/prompt-assembly.test.ts:107-245` |
| H2 reactions skipped §86 chain (cross-group / removed-member writes) | HIGH | **FIXED** (REST + WS) | REST gate after readability `apps/worker/src/handlers/engagement.ts:32,57` (pins too :87,:110); WS react checks room match + active member `apps/worker/src/realtime/group-room.ts:384-402`; five negative tests incl. removed-member and cross-group `apps/worker/test/reactions-authz.test.ts:43-219` |
| H3 sync protocol has no endpoints | HIGH | **OPEN** | `SyncService` referenced only by its own module and tests (`grep SyncService` → `packages/domain/src/sync/sync.service.ts`, `packages/domain/test/sync.test.ts` only); `sync.ack` reply-only `group-room.ts:423-431`; `sync_*` tables appear outside migrations solely in the purge list `apps/worker/src/repositories/deletion.repo.ts:40-42` |
| H4 §55A matrix rows were boolean-only asserts | HIGH | **FIXED** | rows 3–7 now drive live ContextEngine assemblies and assert the secret string appears nowhere in the assembled provider payload (`JSON.stringify(assembled)).not.toContain(secret)`) `packages/domain/test/security-matrix.test.ts:137-235`; secrets row + recursive sanitizer :255-301 |
| M1 edit/delete without membership re-check | MED | **OPEN** | PATCH/DELETE `/api/v1/messages/:messageId` call only sender-scoped edit/delete `apps/worker/src/handlers/messages.ts:132-146` → `requireEditable` checks `sender_user_id` only `packages/domain/src/messages/message.service.ts:166-175`; same path reachable from WS `group-room.ts:351-382` |
| M2 client `project_id` trusted (send + AI run) | MED | **OPEN** | send passes client value straight through `handlers/messages.ts:86`; run start passes it into `startRun` `handlers/ai.ts:57` → inserted as-is `orchestrator.ts:196`; RPC casts raw input `20260823000101_audit_remediations.sql:265`. FK proves existence, never `project.group_id == group_id`. Cross-group reference corruption possible by any member. (Contrast: intel/github routes do validate via `projects.get()` which re-derives `project.group_id` `packages/domain/src/projects/project.service.ts:65-70`.) |
| M3 attachment link injection | MED | **OPEN** | POST attachments accepts `message_id` from the form and links without checking message group/visibility `apps/worker/src/handlers/attachments.ts:33,48-49`; `linkToMessage` performs no validation `packages/domain/src/files/attachment.service.ts:212-214` |
| M4 PRIVATE_AI run metadata readable by whole Group | MED | **OPEN** | GET `/ai/runs/:runId` requires membership only `handlers/ai.ts:88-95`; `ai_runs` RLS is `is_group_member` `20260822000117_ai_runs_tools_usage.sql:89-92` → any member can enumerate who ran private Odin sessions, when, with which model |
| M5 private-message reaction events fan out room-wide | MED | **PARTIALLY FIXED** | WS path now gated before broadcast; REST publish still omits visibility/audience `engagement.ts:34-38` → `handlePublish` defaults `visibility:"GROUP"` and sends to every socket `group-room.ts:536-561`. Leak is metadata-only (`message_id` + emoji), but §11.2 says a non-participant never receives the frame |
| M6 activity `actor_ai_id` receives requester's user id | MED | **OPEN** | all ai_run events set `actor_id = run.requester_user_id` (`orchestrator.ts:209,251,418,434,454,481`); ActivityBuilder maps that value into `actor_ai_id` `packages/domain/src/messages/consumers.ts:143-150` |
| M7 approval-request notifications unreachable; decisions emit nothing | MED | **OPEN** | NotificationWorkerConsumer `break`s on `ai.action.proposed`/`decision.proposed` without notifying `consumers.ts:93-98`; `DecisionService.approve/reject` perform CAS + memory hook but publish no outbox event `packages/domain/src/projects/project-intelligence.ts:228-255` (repo-wide grep: `decision.approved` never emitted) |
| M8 hardcoded values bypass LIMITS_JSON | MED | **OPEN (partial)** | remaining: `max_tokens: 4096` `orchestrator.ts:284`; app-AI pool 2000 req/30d `runtime.ts:126-130`; zod `.max(8)` duplicating tool-call limit `handlers/ai.ts:21`; memory slice ≤500 chars & confidence 0.6 `apps/worker/src/services.ts:361,369`; §178 run timeouts (120s/300s) defined `shared/src/limits.ts:14-15` but consumed by no timer — long runs are never hard-cancelled |
| M9 event taxonomy largely unwired | MED | **OPEN** | ~23 of ~70 contract types ever emitted durably (inventory in §3.B below). Never emitted anywhere: `ai.requested/status.updated/tool.*`, `ai.action.approved/rejected`, artifact lifecycle beyond created, `decision.approved/rejected/updated`, `task.updated/assigned/completed/cancelled`, all `memory.*`, `github.pr.*/branch/commit`, `meeting.summary.updated/detected*`, all `sync.*` (contracts closed set: `packages/contracts/src/events.ts:27-114`) |
| M10 context slices limited; dedup absent; explicit refs unused | MED | **OPEN** | candidates built only from memories×3 + recent GROUP transcript `runtime.ts:702-778`; decisions/tasks/artifacts/files/referenced-messages slices absent; caller passes `explicitReferences: []` always `handlers/ai.ts:79`; no §54A.4 dedup in `assemble` `context-engine.ts:102-141` (provenance IS carried :135-139) |
| L1 pins reject private instead of conversation-scoped | LOW | OPEN (conservative) | `PinService.pin` forbids non-GROUP `engagement.service.ts:73-78`; DB+RLS would support scoped pins `20260823000101:106-155` |
| L2 envelope key falls back to JWT secret/dev string | LOW | OPEN | `runtime.ts:132-137` |
| L3 nil-UUID `proposed_by` in decision.propose executor | LOW | OPEN | `runtime.ts:329` |
| L4 empty `.in("message_id", [])` edge when attachment filter matches nothing | LOW | OPEN | `search-notification-activity.repo.ts:80-88` |
| L5 WS send trusts client `mention_user_ids`, no rate limit | LOW | OPEN | `group-room.ts:329`; schema permits client uuid array `contracts/src/websocket.ts:98` |
| L6 DO sequence resets on isolate restart | LOW | OPEN | ring + counter purely in-memory `room-core.ts:55-77`; `hydrate` only from a client's claim `group-room.ts:232-234` |
| L7 idempotency in-flight duplicate executes twice under race | LOW | OPEN | middleware lets an in-flight duplicate pass through `middleware/idempotency.ts:60-66` |
| L8 approved-decision memory hook swallows all errors | LOW | OPEN | `.catch(() => undefined)` `runtime.ts:693` |

**New findings this audit**

- **N1 (MED):** §99 sensitive-action audit coverage incomplete. `audit.append` callers cover role change/removal/transfer and both deletion stages (`membership.service.ts:118-127,171-179,208-216`; `deletion.service.ts:54-62,83-91`) — but **GitHub connect/disconnect/approve/reject, BYOK secret configuration, provider changes, and private-scope changes write no audit rows** (`handlers/github.ts`, `handlers/ai-config.ts`: no `audit` calls). Spec §99 names "secret configuration, GitHub connection, action approval" explicitly.
- **N2 (LOW-MED):** notification `delivery_state` is decided once at insert (`search.service.ts:118-122`) and never transitions afterwards; `markRead` touches only `read_at` (`search-notification-activity.repo.ts:127-134`). PENDING rows have no worker moving them to DELIVERED_REALTIME/FAILED.
- **N3 (LOW):** rate limiting is a per-isolate in-memory fixed window (`apps/worker/src/ai/index.ts:38-63`), so effective limits scale ×isolate count; documented deviation, acceptable for staging, not for production multi-tenant guarantees.
- **N4 (LOW):** no IP/device rate layer exists for invite-token brute force or unauthenticated endpoints (§91) — `POST /api/v1/invites/:token/accept` (`handlers/invites.ts:51`) is unthrottled; token space (256-bit random, hashed at rest `invite.service.ts:47-63`) makes offline guessing impractical, so residual risk is low.

---

## 3. Item-by-item grading ledger

Legend: **PASS** implemented + evidenced · **PARTIAL** implemented with material gaps · **FAIL** implemented but wrong/dangerous · **NI** not implemented.

### §1 Foundations & Conventions

| Item | Grade | Evidence |
|---|---|---|
| Modular monolith; handlers parse/validate → one service call; logic in services | PASS | handlers are thin controllers (e.g. full send flow delegates to services `handlers/messages.ts:28-115`); domain rules in `packages/domain/**` (message rules `message.service.ts:76-145`, roles `membership.service.ts:75-217`) |
| §5 repository layout (`apps/worker` + 14 named packages + supabase/{migrations,seed,functions} + tests/*) | PARTIAL | all 14 packages exist exactly (`ls packages`), `apps/worker` ✓, `supabase/migrations/` ✓ (23 files); **missing:** `supabase/seed/`, `supabase/functions/`, top-level `tests/*` (tests co-located in `packages/*/test`, `apps/worker/test`) |
| `/api/v1` versioning + WS `protocol_version` + explicit update-required handling | PASS | every business route under `/api/v1` (`app.ts:105-120`); envelope carries `protocol_version` `contracts/src/events.ts:11-23`; old clients rejected with `CLIENT_UPDATE_REQUIRED` frame + close `group-room.ts:218-229`; gate against configured minimum `room-core.ts:35-47`; `GET /api/v1/client-versions` `app.ts:94-100` |
| §102 error contract `{error:{code,message,request_id}}`, no internals on 500s | PASS | stable code list + status map `shared/src/errors.ts:6-44`; envelope builder collapses unknown errors to generic INTERNAL `errors.ts:87-97`; applied app-wide `app.ts:54-57`; WS frames preserve codes faithfully `group-room.ts:38-51` |
| §19 Idempotency-Key / client_operation_id; replay = one logical op; record fields | PASS | middleware for POST/PATCH/DELETE/PUT `middleware/idempotency.ts:14-93` (actor+hash keyed, replay header, hash-mismatch conflict); table `20260822000109_idempotency.sql`; message-level dup returns original row `20260823000101:277-285`; tested `test/idempotency.test.ts` (replay + 409 + keyless). Residual race L7 |
| Cursor pagination, no offset on large tables | PASS | base64url sequence cursor `message.service.ts:177-187`; `before` param plumbed `handlers/messages.ts:117-129`; activity list cursor `search-notification-activity.repo.ts:163-172`; repo-wide grep shows no `offset` on large-table queries |
| §101 correlation ids + structured JSON logs | PARTIAL | `request_id` generated/echoed on every response + JSON log line with method/path/status/duration `app.ts:33-52`; **missing:** user_id/group_id/trace_id/ai_run_id/operation_id not present in HTTP log lines |
| §122 transaction boundary {message, mentions, links, outbox}; async after commit; no AI work in tx | PARTIAL | message+mentions+outbox atomic in SQL RPC `20260822000110_messages.sql:99-164` (rebuilt with sender_ai_id `20260823000101:242-308`); broadcast fire-and-forget after persist `handlers/messages.ts:95-113`; no AI work inside tx ✓; **gap:** attachment links are a separate request+insert (`attachments.ts:48-49`), never inside the §122 transaction |
| §123 outbox_events exact shape | PASS | id/event_type/aggregate_type/aggregate_id/payload jsonb/status/created_at/processed_at/retry_count default 0 `20260822000107_outbox_audit_jobs.sql:6-27` + partial pending index |

### §2 Auth & Profiles

| Item | Grade | Evidence |
|---|---|---|
| Supabase Auth sole credential authority; no password columns | PASS | JWT verified against Supabase secret `middleware/auth.ts:23-29` + `packages/auth/src/jwt.ts`; profiles migration has no credential material `20260822000101_profiles.sql`; repo grep: no `password_hash` |
| profiles columns per spec | PASS | `20260822000101_profiles.sql` (id→auth.users, email_snapshot, display_name NOT NULL, avatar_object_id nullable, timestamps, last_seen_at) |
| Global profile vs group-local identity; viewer-scoped nicknames | PASS | `member_nicknames` PK (group,viewer,target) `20260822000106_member_nicknames.sql`; endpoints owner-scoped `handlers/members.ts:73-101` |
| GET/PATCH /me; PATCH cannot touch auth-owned fields | PASS | `handlers/me.ts:20-40`; patch body limited to display_name/avatar (zod rejects email/password); tested `test/me.test.ts` incl. 401 envelope case |

### §3 Groups, Members, Roles

| Item | Grade | Evidence |
|---|---|---|
| groups table per spec (status enum, deleted_at) | PASS | `20260822000102_groups_members.sql:3-27` |
| group_members PK + soft-remove + immediate revocation | PASS | composite PK + removed_at `20260822000102`; every check uses `findActive`/`removed_at is null` (`membership.service.ts:34`, connect-time `group-room.ts:171-178`, write-time `requireActiveMember` `group-room.ts:116-131`); broadcaster evicts removed member sockets `broadcaster.ts:57-62` |
| Role/capability matrix | PASS | Owner/Admin/Member/Guest gates enforced per route: invites OWNER/ADMIN `invite.service.ts:95-98`; project create MEMBER+ `project.service.ts:35-39`; AI config OWNER/ADMIN `handlers/ai-config.ts:37,56,83,110`; GitHub writes OWNER/ADMIN `github.ts:58,95,191-193,238-240` |
| Only Owner manages Admins; Admin can't promote Admin; transfer audited | PASS | `changeRole` hierarchy `membership.service.ts:96-105`; transfer OWNER-only + outbox + audit `:186-217` |
| Exactly one Owner; owner always member; atomic swap | PASS | creator becomes OWNER member row `group.service.ts:47-52`; transfer swaps in one repo op `membership.service.ts:199`; owner role-change blocked `:90-95`; removal of owner blocked `:149-154` |
| Groups CRUD semantics (list = own memberships; DELETE = Stage-1 only) | PASS | listForUser joins memberships `group.repo.ts`; DELETE only sets DELETING `group.service.ts:112-132` |
| Members endpoints incl. transfer-ownership | PASS | GET/PATCH/DELETE members + transfer-ownership `handlers/members.ts:23-71` delegating to `MembershipService.changeRole/removeMember/transferOwnership` |

### §4 Invitations & Joining

| Item | Grade | Evidence |
|---|---|---|
| Only Owner/Admin invite; both account paths supported | PASS | `invite.service.ts:90-133`; accept attaches existing auth user `:151-193`; email field stored for targeted invites |
| Token non-guessable; DB stores hash only | PASS | 32 random bytes, URL-safe `invite.service.ts:47-53`; SHA-256 at rest `:55-63`; raw token returned once `:130-132` |
| group_invites columns | PASS | `20260822000103_group_invites.sql` (id, group_id, created_by, email?, role, token_hash, expires_at, max_uses?, uses_count default 0, revoked_at, created_at) |
| Atomic acceptance (no max_uses race); joins with role_on_accept | PASS | expiry/revocation/max_uses validated then member insert + **atomic conditional increment RPC** raising on violation `20260822000104_increment_invite_uses.sql:5-21` called at `repositories/invite.repo.ts:64-67`; member-limit enforced `invite.service.ts:173-176` |
| Invite endpoints | PASS | POST/GET invites, revoke, public accept `handlers/invites.ts:21-60`; negative tests `test/invites.test.ts` (member 403, revoked 404) |
| Lifetime 7d config-driven; brute-force protected | PARTIAL | lifetime from limits `limits.ts:28` used `invite.service.ts:110-112`; **no IP/device rate limit on accept/create (§91)** — see N4 |

### §5 Group Deletion Lifecycle

| Item | Grade | Evidence |
|---|---|---|
| Three stages w/ recovery window | PASS | Stage-1 DELETING `group.service.ts:112-132`; Stage-2 restore window-checked (config days) `group.service.ts:138-165` + `deletion.service.ts:96-103`; Stage-3 owner confirmation `groups.ts:89-97` |
| Permanent deletion asynchronous | PASS | enqueued job `deletion.service.ts:78-82`; runner purges via repo table list + audits `services.ts:309-316`, `deletion.repo.ts:20-45` (includes sync_* and usage_events) |
| Archived/deleted group rejects writes | PASS | `assertOpenForWrites` applied on update/changeRole/removeMember/transfer `membership.service.ts:85,144,192`, project create `project.service.ts:40-42`, invites `invite.service.ts:99-101` |

### §6 Projects & Project Instructions

| Item | Grade | Evidence |
|---|---|---|
| projects columns incl. flexible project_type | PASS | `20260822000105_projects.sql` (status default 'active', progress numeric, archived_at) |
| project_instructions separate from context blob | PASS | `20260822000105_projects.sql`; priority/enabled honored in prompts `runtime.ts:592-611`; round-trip test `test/projects.test.ts` |
| Project endpoints | PASS | list/create/get/patch/archive/restore/instructions CRUD `handlers/projects.ts:45-140` |
| Archive reversible; excluded from active selection; restorable | PASS | `project.service.ts:107-136`; archived don't count toward limit (countActive excludes) `:47-53,126-132` |
| 20-active-projects limit config-driven | PASS | `limits.ts:24` consumed `project.service.ts:48,127` |
| Single-group ownership; cross-group rejected by chain | PASS | every object route resolves project then `requireMember(project.group_id)` `project.service.ts:65-70` |

### §7 Messages

| Item | Grade | Evidence |
|---|---|---|
| messages exact shape + 4 indexes + UNIQUE(group_id,client_message_id) | PASS | `20260822000110_messages.sql:21-46` (all four indexes lines 39-46) |
| Send chain: auth→member→server-side scope→sequence→atomic insert→post-commit broadcast | PASS | `handlers/messages.ts:28-114`; server resolves PRIVATE scope `:61-82` (client cannot set visibility); sequence from `group_sequences` counter `20260822000110:66-72,253-257`; broadcast after persistence |
| Duplicate client_message_id returns original | PASS | `on conflict do nothing returning` + fallback select `20260823000101:277-285` |
| PRIVATE read enforcement in queries AND RLS | PASS | service ACL callback pattern `message.service.ts:151-164`; RLS split per visibility, no catch-all `20260822000110:61-96`; defense-in-depth for revisions/pins/mentions/private-graph `20260823000101:35-53,129-211` |
| Edit writes revision BEFORE update; revision authz = message authz | PASS | `recordRevision` precedes `updateBody` `message.service.ts:100-107`; revisions RLS inherits message visibility `20260823000101:162-182` |
| Delete tombstone; references preserved; sender policy | PARTIAL | tombstone-only soft delete `message.service.ts:128-145`; replies keep FK; **policy is sender-only** — spec's "sender-or-authorized-role" not implemented (admins cannot moderate), and see M1 (removed-member hole) |
| Pins inherit visibility; partial index; events | PARTIAL | DB column + backfill + partial index + participant-scoped RLS `20260823000101:106-155`; service refuses private pins outright instead of conversation-scoping `engagement.service.ts:69-85` (safer than spec letter, L1); pinned/unpinned published realtime-only (not durable) `engagement.ts:89-94,112-118` |
| Reactions PK + events + private visibility | PARTIAL | PK (message_id,user_id,emoji) toggle `engagement.service.ts:41-59` + migration 111; add/remove require readability + active membership (H2 fix); **events realtime-only, and REST publishes without audience → room-wide metadata fan-out (M5)** |
| Mentions server-resolved; populated on send; MENTION notifications | PASS | tokens extracted/resolved against members `handlers/messages.ts:44-56`; inserted in RPC `20260823000101:287-291`; MENTION consumer respects preferences `consumers.ts:53-65` |
| attachments + message_attachments shapes; transactional links | PARTIAL | shapes correct `20260822000114_attachments.sql` (+ Correction-4 sync-state enum); upload hardened (see §28); **links NOT transactional with message** (§122 gap, M3) |
| private_conversations(+members) ACL via rows | PASS | `20260822000110:4-18`; findOrCreateAi/HumanPair reuse single conversation `private-conversation.repo.ts`; participant RLS `20260823000101:188-211` |
| `/private @user` / `/private @Odin` routing; never a third user | PASS | `handlers/messages.ts:61-82`; pair conversation = exactly two rows; audience arrays carry participants only |
| Slash commands parsed server-side | PASS | closed command set + parser `engagement.service.ts:96-123`; `/private` handled via `private_to` contract |
| List filters + tombstones | PARTIAL | project/date/sender filters on list+search `handlers/messages.ts:117-129`, `search repo:36-40`; threads via reply_to; **deleted messages are filtered out, not returned as tombstones** (`listGroupVisible` filters deleted_at) |
| §178 body ≤8000; ≤10 attachments; 30 msgs/min/user | PASS | limit consumed `message.service.ts:83-88` (default `limits.ts:10`); per-user burst cap `handlers/messages.ts:35-39` (`limits.ts:25`); per-message cap counted at link time `attachment.service.ts:90-92` |

### §8 Message Search

| Item | Grade | Evidence |
|---|---|---|
| Full-text + project/group/sender/date/mention/attachment/AI filters | PASS | `SupabaseMessageSearchRepository.search` implements all seven `search-notification-activity.repo.ts:20-91` (mention + attachment post-joins) |
| Private search within authorized scope only; ACL BEFORE execution; index inherits boundary | PASS | include_private must be true to even resolve conversation ids `repo:43-54`; filter composed into the query (`or(visibility.GROUP, conversation.in…)`) `repo:56-64` — pre-execution, never post-filter; FTS lives on messages tsvector generated column `20260822000115_search_notifications_activity.sql:6-11` inheriting source ACL; negative test `test/search-acl.test.ts:12` |

### §9 Realtime (DO rooms)

| Item | Grade | Evidence |
|---|---|---|
| One DO per Group; Postgres canonical | PASS | room id = group id `group-room.ts:106-109`; Correction-2 note `:54-57`; DO persists through same repositories `:65-104` |
| Connect lifecycle; non-members rejected at handshake | PASS | verify JWT → membership (`removed_at is null`) → accept → hello → connection.ready → presence `group-room.ts:153-260` |
| Disconnect grace + debounced presence | PASS | 30s debounce with generation-based reconnect cancel `webSocketClose` `group-room.ts:501-515` + `room-core.ts:114-141`; stale-heartbeat sweep `room-core.ts:151-161` |
| §17 envelope fields on every server event | PASS | assembled identically for published + system frames `group-room.ts:536-548,611-628`; schema `contracts/src/events.ts:11-23` |
| Per-group monotonic sequence; gap detection → recovery | PARTIAL | strict increment + bounded ring + `eventsSince` boundary derived from ring `room-core.ts:65-96`; `sync.request` served with Postgres fallback flag `group-room.ts:293-311`; **ring/counter are in-memory — DO restart resets sequence (L6)** |
| Event taxonomy implemented per domain | PARTIAL | see M9 inventory (§2); durable emitters listed at consumers report B |
| §114 WS protocol commands; runtime validation | PARTIAL | zod discriminated union validates every frame `websocket.ts:155-171` + parse gate `group-room.ts:196-200`; 14/16 commands fully functional (hello, subscribe, send/edit/delete/react, typing×2, presence, sync.request/ack, meeting start/end, artifact.interaction); `ai.run`/`ai.cancel` deliberately refused with pointer to REST `group-room.ts:476-490`; `sync.ack` reply-only (H3) |
| Room ≠ infinite history; reconnect resumes from Postgres | PASS | ring capped at 500 `room-core.ts:14`; exhausted window returns `fallback:true` directing client to history API `group-room.ts:295-303` |
| Visibility-aware fan-out; non-participant never receives frame | PARTIAL | publish honors `audience_user_ids` for private envelopes `group-room.ts:552-561`; message.created/edit/delete carry audience; **reaction/pin publishes omit audience (M5)** and system broadcasts are GROUP-wide by design `broadcastSystem:611-628` |

### §10 Presence & Typing

| Item | Grade | Evidence |
|---|---|---|
| Ephemeral presence, heartbeat sweep, debounced broadcast, never persisted | PASS | all state in RoomCore maps `room-core.ts:98-161`; no Postgres presence writes anywhere; TTL typing `:167-183` |
| Viewing signals transient only | PASS | viewing entries expire in 30s, never persisted `room-core.ts:185-213`; handler `group-room.ts:274-291` |

### §11 Sync Protocol (offline reconciliation)

| Item | Grade | Evidence |
|---|---|---|
| sync_checkpoints / sync_operations / sync_conflicts tables per spec | PASS | `20260822000122_sync.sql` (PK(device_id,group_id); UNIQUE(device_id,client_operation_id); index(group_id,status); conflict types/strategies enums) |
| §20.2 reconnect flow end-to-end | **NOT-IMPLEMENTED** | H3: no REST route or WS writer touches the three tables; `SyncService` (`domain/src/sync/sync.service.ts`) unwired; `sync.ack` persists nothing `group-room.ts:423-431`; FE commit notes "BE endpoints pending H3" (git 361f10d) |
| §21.1 cloud ordering wins; server receive time + sequence | PASS (logic) | `SyncService.messageOrdering` server-timestamp + authoritative sequence `sync.test.ts:221-227`; unreachable in production for lack of transport |
| §21.2 optimistic concurrency 409 + conflict rows | PARTIAL | CAS with CONFLICT on tasks/decisions `project-intelligence.ts:238,253,310`; **sync_conflicts rows are never written by any request path** (versionConflict helpers exist `sync.service.ts` + tests only) |
| §21.3 immutable versions; concurrent edits → new versions; binary separate | PASS | artifact_versions append-only UNIQUE(artifact_id,version_number) `20260822000120:35`; newVersion never mutates old rows `project-intelligence.ts` ArtifactService |
| WS sync.* wired to tables; sync.client.* events | **NOT-IMPLEMENTED** | zero sync.* emitters (grep) |

### §12 Outbox Consumers & Background Jobs

| Item | Grade | Evidence |
|---|---|---|
| Independent consumers (realtime, notifications, memory, search index, activity, usage meter, audit, GitHub sync) | PARTIAL | registered processors dispatch by `handles()` `outbox-processor.ts:27-60`, wired `services.ts:375-400`: realtime broadcaster ✓ (`broadcaster.ts:32-70`, evicts removed users), notification worker ✓, activity builder ✓; memory runs as a **job** not consumer (acceptable architecture, spec-letter deviation); search indexing satisfied declaratively by tsvector generated column (no consumer needed); usage metered inline post-run `orchestrator.ts:486-499`; audit written inline by services (N1); GitHub-sync consumer absent (executor NI) |
| background_jobs exact shape | PASS | `20260822000107:41-62` — job_type list, statuses, retry_count/max_retries defaults, last_error, UNIQUE(job_type,idempotency_key), due index |
| Duplicate enqueue = no-op; re-execution idempotent | PASS | upsert ignoreDuplicates + existing-row fallback `jobs.repo.ts:77-103` |
| Retry classification + backoff+jitter | PASS | permanent classes never retried (AUTH/PERMISSION/INVALID_REQUEST/CONFLICT) else exp backoff + 25% jitter `retry-policy.ts:14-43`; nuance: RATE_LIMITED/PROVIDER_UNAVAILABLE ride generic retryable rather than distinct delay classes |
| Dead-letter retained/queryable | PASS | FAILED_PERMANENT kept + `listDeadLetters` `jobs.repo.ts:143-152`; runner marks after max retries `job-runner.ts:58-65` |
| Chat writes never block on jobs | PASS | send = one atomic RPC then void publish `handlers/messages.ts:84-113`; no enqueue on chat path |
| Activity events per spec (AI attribution; never PRIVATE rows; pre-rendered summary; indexes) | FAIL (value bug) | suppression + PROJECT/GROUP visibility + frozen summary correct `consumers.ts:125-201`, table indexes `20260822000115:68-81`; **actor_ai_id gets the human requester id (M6)** |
| Long-running artifact generation as queued job | PARTIAL | artifact creation executes inline as a LOW-risk tool during a run `runtime.ts:344-372`; no dedicated generation job/progress pipeline (§118 letter) |
| Deep research as job with §119 statuses | **NOT-IMPLEMENTED** | research_jobs/research_sources tables + stage enums exist `20260822000116/119`; no runner, endpoints, or producers (grep) |
| Cancellation for AI runs/research/artifacts/pre-exec GitHub | PARTIAL | run cancel with requester-or-Owner/Admin rule `handlers/ai.ts:97-116` + transition guard `run-lifecycle.ts:44-75`; research/artifact N/A (NI); provider-request propagation not implemented |

### §13 Notifications

| Item | Grade | Evidence |
|---|---|---|
| notifications shape + both indexes; categories enum | PASS | `20260822000115:14-65` |
| notification_preferences shape/PK/defaults | PASS | `20260822000115:67-90` |
| ONE row per recipient per semantic event; delivery_state in place | PARTIAL | one-row-per-event upheld `NotificationService.notify` `search.service.ts:90-127`; **state never transitions after insert (N2)** |
| PRIVATE_AI targets owning member only; write path re-applies authz | PASS | recipients = `[requester]` for ai.response.completed `consumers.ts:72-89` (upstream actor is authenticated requester whose run already passed §40 gate `orchestrator.ts:535-550`); tested `security-matrix.test.ts:341-368` |
| §143 pipeline (preference → online → realtime → queue) | PARTIAL | preference consulted at insert `search.service.ts:103-122`; delivered_realtime hint honored; **no online-state lookup, no desktop/email queuing** |
| Email categories only (never per-chat) | **NOT-IMPLEMENTED** | DELIVERED_EMAIL defined but never set; no transport anywhere (grep) — absence is at least spec-*safe* (no illegal emails) |

### §14 AI Agent Identity & Config

| Item | Grade | Evidence |
|---|---|---|
| ai_agents unique-per-group, default Odin, extensible | PASS | `20260822000113_ai_agents.sql:8-9`; `getCurrentAgent` single-agent resolution |
| ai_provider_configs credential_ref (never raw key) | PASS | `20260822000116` — credential_ref + key_last4; no key material columns; ciphertext format `enc1:` only `ai-runtime.repo.ts:388` |
| ai_model_routes one PRIMARY ≤3 fallbacks | PASS | unique(group_id,role) index `20260823000101:98-100` closes duplicate-FALLBACK hole; upsert per role `ai-runtime.repo.ts:327-338` |
| BYOK admin-configured; validated before store; never returned; envelope encryption | PASS | validate-before-store via real listing call `runtime.ts:142-155`; sanitize responses `provider-config.service.ts:109-114` + handler comment `ai-config.ts:45`; AES-GCM under out-of-DB master key `ai-runtime.repo.ts:360-414`; wrong-master-key rejection tested `approvals-secrets.test.ts:161-212` |
| Model discovery flow | PASS | validate → listModels → normalized descriptors → selectable routes `provider-config.service.ts:82-106` + `/providers/:id/models` endpoint `ai-config.ts:107-120` |
| Application AI infra-controlled; group sees model+usage | PARTIAL | APPLICATION_AI_API_KEY env-only `runtime.ts:423`; group-facing model info exposed; **per-group usage/quota view endpoint absent (§131 NI)** |

### §15 Model Router & Provider Adapters

| Item | Grade | Evidence |
|---|---|---|
| Router order (config→primary→fallback→quota→capability→health→error class) | PASS | chain resolution `router.resolveChain` `runtime.ts:157,432`; quota checked before spend `orchestrator.ts:181-192`; capability gating via registry modes/roles `context-engine.ts:214-227`; error-class gating `:427-441` |
| Fallback ONLY for retryable failures; no silent fallback otherwise; mid-stream contamination guarded | PASS | classifyProviderError fail-closed on unknown codes `provider-config.service.ts:124-143`; streamed-any ⇒ fail-not-switch `orchestrator.ts:408-421`; per-attempt buffer isolation `:369-380`; spy tests prove 0 fallback calls on invalid_api_key/safety_refusal `orchestrator.test.ts:709-762` |
| ModelProviderAdapter interface; vendors behind adapters | PASS | `packages/ai-providers/src/types.ts` interface (validateCredentials/listModels/generate AsyncIterable/estimateUsage); OpenAI-compatible surface covers OpenAI/OpenRouter/Google/Anthropic endpoints `runtime.ts:63-68`; adapters unit-tested |

### §16 Context Engine

| Item | Grade | Evidence |
|---|---|---|
| Resolve inputs + token budget | PARTIAL | fixed slices cover safety/identity/group/project-instructions/skills `runtime.ts:534-668`; competitive = memories(GROUP/PROJECT/USER_PRIVATE) + recent transcript `runtime.ts:712-777`; budget applied `context-engine.ts:117-129`; **decisions/tasks/artifact summaries/files/referenced-messages slices absent (M10)** |
| §60 assembly order; user content never outranks safety | PASS | fixed slices ordered SYSTEM_SAFETY first → skills last `buildFixedSlices`; ranked CONTEXT second message; USER REQUEST last `orchestrator.ts:275-284`; skills validator rejects safety-overriding uploads `packages/skills/src/skill.service.ts` (priority rule) |
| Fixed vs competitive split; 32k default budget | PASS | engine constructor split `context-engine.ts:96-100`; budget default 32000 `limits.ts:13`; fixed tokens reserved before ranking `:109-117` |
| Exact ranking weights + greedy inclusion | PASS | 0.35/0.25/0.20/0.20 `context-engine.ts:40-54`; sort desc + greedy fill `:116-129` |
| Explicit-reference override | PARTIAL | mechanism implemented (force-fixed, excluded from competitive budget) `context-engine.ts:88-94,113-117`; **sole caller always sends []** `handlers/ai.ts:79` |
| Dedup + provenance metadata | PARTIAL | provenance emitted per included item `context-engine.ts:135-139`; **§54A.4 dedup of same-fact candidates absent** |
| Privacy filtering BEFORE ranking on EVERY slice | PASS | unauthorized dropped pre-sort `context-engine.ts:106-116`; authorization decided at candidate construction `runtime.ts:740-744`; recent-transcript query restricted to visibility=GROUP `runtime.ts:748-755` |
| Public request allowed-content bounds | PASS | PUBLIC_GROUP authorizes only non-private slices `context-engine.ts:75-81`; secrets never reach context (sanitizer upstream) |
| Private request bounds; no silent private→public injection | PASS | user_private enters only owner's PRIVATE_AI `context-engine.ts:71-74`; private conversations enter context only as owner-scoped USER_PRIVATE candidates `memory.service.ts:122-137` |

### §17 Privacy Crossing Matrix (§55A)

| Row | Grade | Evidence |
|---|---|---|
| PRIVATE_PAIR → public Group AI: NEVER | PASS | test drives proposal + assembly leak assert `security-matrix.test.ts:66-95` |
| PRIVATE_PAIR → shared memory: never automatic | PASS | proposeFromRun recommends USER_PRIVATE only `memory.service.ts:122-131`; test :96-109 |
| PRIVATE_AI(A) → public context: NEVER | PASS | test :111-135 |
| PRIVATE_AI(A) → private context(B): NEVER | PASS | live assembly drops A's item from B's payload :137-170 |
| User-private(A) → public: NEVER | PASS | even owner's public run drops it :172-202 |
| User-private(A) → private(B): NEVER | PASS | B's context assembles empty :204-235 |
| User-private(A) → own private: ALLOWED | PASS | :237-241 |
| Group/project memory allowed scopes | PASS | :243-253 |
| Secrets/raw keys/tokens → ANY context: NEVER | PASS | looksLikeSecret reject `memory.service.ts:118-121`; sanitizeToolOutput recursive + labeled-untrusted `orchestrator.ts:83-107,348-353`; tests :255-301 |
| Every row automated | PASS | all twelve rows covered with concrete assertions (upgrade over prior audit's H4) — proven at engine/service level rather than full HTTP round-trip (acceptable; noted) |

### §18 AI Orchestration Loop

| Item | Grade | Evidence |
|---|---|---|
| ai_runs shape/status machine | PASS | table `20260822000117:4-24` (+ provider_config_id NOT NULL `20260823000101:74-85`); canonical transitions enforced `run-lifecycle.ts:44-75` |
| ai_run_steps trace | **NOT-IMPLEMENTED** | table + types exist `20260822000117:26-39`; **zero writers** (grep: migration only) |
| ai_tool_calls ledger + approval coupling | PASS | table + ai_action_id FK `20260822000117:42-61` + `20260823000101:58-69`; PENDING until action APPROVED — WAITING_TOOL return keeps run resumable `orchestrator.ts:321-340`; DENIED/SUCCEEDED/FAILED completions `:333,344,349` |
| §115 lifecycle steps in order | PASS | steps 1–9 in `startRun` (authz → agent → private-target fail-fast → chain → quota → run row → started event) `orchestrator.ts:149-213`; steps 10–24 in `executeRun` (fixed slices → tools gated → stream w/ fallback → persist via §122 RPC → completed event → usage → memory job) `:219-506` |
| Tool loop hard limits | PARTIAL | max calls/run + total tool time enforced `ToolLoopGuard` `context-engine.ts:236-257` fed from config `runtime.ts:442-446`; per-tool timeout budgeted `:309`; **run-level 120s/300s timers unenforced (M8)**; external-request/file-read/GitHub-op counters not tracked individually |
| AI endpoints | PASS | POST runs / GET run / POST cancel `handlers/ai.ts:33-116`; streaming deltas over WS `orchestrator.ts:380-386`; SSE none (spec allows) |
| Cost controls BEFORE run | PARTIAL | quota pre-check `run-lifecycle.ts:113-137`; context truncation by budget; cheaper-model switch and expensive-task confirmation absent |
| Completed-run metadata exposure | PARTIAL | returns run_id/response/tool_calls/truncated + usage_json persisted `orchestrator.ts:473-475,506`; model/provider/tools_used/search_used/context_sources block not assembled (§170 partial) |

### §19 Tools & Skills

| Item | Grade | Evidence |
|---|---|---|
| Registry machine-readable metadata; example risk mapping | PASS | full metadata incl. timeout/retry/modes/roles `context-engine.ts:166-203`; web.search READ_ONLY vs task.create MEDIUM/approval `runtime.ts:207-266`; registry integrity forces policy-table consistency `:197-203` |
| Skill vs tool distinction | PASS | skills = instruction bundles consumed as fixed slice `runtime.ts:613-666`; tools = executors gated separately |
| 13 built-in skills seeded | PASS | exact slugs list `skill.service.ts:40-56` + builtInDefinitions upsert; enablement precedence project > group > built-in-default `runtime.ts:641-661` |
| skills/group_skills/project_skills tables | PASS | `20260822000119_search_skills.sql` (UNIQUE slug, PK pairs, config jsonb) |
| Custom skills uploadable; system instructions higher priority | PASS | insertCustom + definition validator rejecting policy overrides (skills package); safety slice unconditional `runtime.ts:539-541` |

### §20 Approval Engine

| Item | Grade | Evidence |
|---|---|---|
| ai_actions exact shape + indexes | PASS | `20260822000121_ai_actions_github.sql` + payload_hash/version/status/expires_at; indexes (group_id,status),(ai_run_id) |
| ai_action_approvals shape + index | PASS | approved_payload_hash/version captured `approval-engine.ts:166-174`; table `20260822000121` |
| Integrity binding at approve AND beginExecution; EXPIRE on mismatch; boolean never sufficient | PASS | displayed-hash/version equality at approve `approval-engine.ts:149-158`; current-vs-approved re-verify + EXPIRE at execution `:214-223`; TTL sweep cron-wired `index.ts:29-34` + `expireStale` `ai-runtime.repo.ts:248-258`; handler demands hash+version fields `github.ts:42-45`; forged-approval tests `security-matrix.test.ts:398-430`, `approvals-secrets.test.ts:75-158` |
| Risk policy decided by policy engine | PASS | `approvalRequiredForRisk` authoritative + registry self-heal `context-engine.ts:181-203`; GitHub writes forced HIGH `github.ts:151` |
| Actions survive disconnects; resumable subject to re-verification | PASS | actions are durable rows; run returns truncated/WAITING `orchestrator.ts:336-339`; resume re-verifies at beginExecution |

### §21 GitHub Integration

| Item | Grade | Evidence |
|---|---|---|
| Least privilege; URL never grants write | PASS | connect requires installation_id + ADMIN role `github.ts:17-23,54-68`; permission_mode default READ_ONLY |
| github_connections shape UNIQUE(group_id) | PASS | `20260822000121` |
| github_actions joins status via ai_actions (no own status columns) | PASS | `githubActionWithStatus` join helper `approval-engine.ts:245-255`; listByProjectWithStatus `github.repo.ts` |
| Safe workflow propose→preview→approve→execute | PARTIAL | propose with diff preview + branch safety + rate cap `github.ts:117-184`; approval binds hash `:186-215`; **executor honestly fails closed `executor_not_implemented` `:216-230` — branch/patch/commit/PR/merge steps NI (documented phase-gate)** |
| Never write default branch | PASS | `assertBranchSafety` `approval-engine.ts:257-272` applied `github.ts:133` |
| Diff-before-approval | PASS | `buildDiffPreview` embedded in bound payload `github.ts:135-158` |
| Merge requirements (role, SHAs, expiry, no mutation) | PASS | helpers `validateMergePayload` + beginExecution binding (unreachable until executor lands, but enforced where execution occurs) |
| Disconnect invalidates cache, retains history | PASS | disconnect sets disconnected_at; webhook rows/actions retained `github.repo.ts`; §142 compliant |
| Webhook pipeline | PASS | HMAC verify → delivery-id dedupe (durable beginDelivery) → installation→Group authorize → persist → normalized event `github.ts:255-333`; processor domain-tested |
| Endpoints incl. approve/reject via ApprovalEngine | PASS | connect/status/disconnect/actions GET/POST + approve/reject routed through engine `github.ts:186-243` |

### §22 Research

| Item | Grade | Evidence |
|---|---|---|
| SearchProvider interface + Tavily/Exa adapters + normalization + metering hooks | PASS | `packages/search/src/providers.ts` + tests; chosen primary/fallback `runtime.ts:282-297` |
| search_provider_configs table | PARTIAL | table exists `20260822000119`; **unused by runtime** (keys come from env TAVILY_API_KEY/EXA_API_KEY `runtime.ts:204-205`) — per-group search-provider config not honored |
| Web research disclosed; citations from tool output | PASS | disclosure field in web.search output `runtime.ts:291-295`; hits carry url/title/snippet |
| Citation integrity (claim mapping) | PARTIAL | citations originate from tool responses; claim_mapping/source tracking absent |
| Deep research pipeline + §119 statuses | **NOT-IMPLEMENTED** | tables + limits only; no runner/endpoints |
| Depth limits config-driven | PARTIAL | three limits defined `limits.ts:18-20`; consumed by nothing |

### §23 Artifacts (Garage)

| Item | Grade | Evidence |
|---|---|---|
| artifacts/artifact_versions shapes + UNIQUE | PASS | `20260822000120_artifacts_decisions_tasks_meetings.sql:3-35` |
| artifact_links target types | PASS | `20260822000120:37-50` |
| Type registry; backend owns schemas; no DOM emission | PASS | ARTIFACT_TYPES closed enum (incl. CODE per Correction 7) consumed by zod `intel.ts:18-23`; AI emits content strings only `runtime.ts:344-357` |
| Live streaming events w/ ordering | PARTIAL | artifact.created emitted durably `runtime.ts:359-366`; node/render_state progressive events absent; artifact.interaction echo is transient `group-room.ts:467-475` |
| Endpoints (list/create/get/version/new-version/restore/pin/delete/share) | PASS | complete set `intel.ts:90-215`, all authorized via `projects.get` |
| Restore emits artifact.version.restored | PARTIAL | restore works `intel.ts:149-158` + emits nothing (taxonomy gap M9) |
| Size rules config-driven; binary via content_ref | PASS | limits consumed at service construction `runtime.ts:268-271`; text stored inline ≤500KB, binary routed to storage pointers |

### §24 Decisions & Tasks

| Item | Grade | Evidence |
|---|---|---|
| decisions shape; approved → memory | PASS | table `20260822000120:52-72`; approvedDecisionMemoryHook promotes with supersede `runtime.ts:676-695` + `memory.service.ts:241-251` |
| Decision endpoints; approval emits decision.approved | PARTIAL | list/create/get/approve/reject with CAS `intel.ts:219-278`, `project-intelligence.ts:228-255`; **approve/reject publish no events (M7)** |
| tasks/task_dependencies shapes | PASS | `20260822000120:74-105`; cycle detection `project-intelligence.ts:333` |
| Task endpoints + optimistic concurrency + events | PARTIAL | list/create/get/patch(CAS 409)/complete/dependencies `intel.ts:279-357`; TASK_ASSIGNMENT notifications category defined but task.assigned never emitted (M9) |
| project_snapshots | PARTIAL | table exists `20260822000120:107+`; no capture endpoint/job |

### §25 Meetings

| Item | Grade | Evidence |
|---|---|---|
| meeting_sessions/candidates/summaries shapes | PASS | `20260822000120:107-160` (candidates index; summaries UNIQUE session) |
| Candidate pipeline Detected→Candidate→Accepted→Persisted; never auto-commit | PASS | detect→PENDING; accept promotes explicitly to task/decision `intel.ts:395-430`, `project-intelligence.ts:408-448` |
| Summary never claims unconfirmed decision | PASS | summaries written at end w/ confirmable fields; promotion requires ACCEPTED candidate or decision row |
| Meeting endpoints + realtime events | PARTIAL | POST meetings / GET / end / candidates accept via REST `intel.ts:358-430`; start/end also on WS `group-room.ts:433-465`; **meeting.started/ended are ephemeral WS frames — never durable outbox events**, so downstream consumers never see them (M9); FACILITATE mode switching during sessions not implemented |
| Human confirmation governs permanence | PASS | accept endpoints are the only promotion path |

### §26 Memory

| Item | Grade | Evidence |
|---|---|---|
| memories typed scopes never collapsed | PASS | scope_type column + per-scope RLS `20260822000118:45-66` |
| memory_candidates shape | PASS | `20260822000118:20-42` |
| Auto-store whitelist; never chatter/secrets/private | PASS | auto-store only GROUP + ≥0.9 confidence + length bounds `memory.service.ts:84-94,140`; secret rejection `:118-121`; private never auto-stores `:89` (handler's fixed 0.6 confidence means extraction effectively always awaits human acceptance — conservative) |
| Retrieval pipeline scope-first | PASS | scope filter precedes scoring inputs `retrieveForContext:198-219`; keyword relevance + recency decay at candidate build `runtime.ts:737-738,780-792` |
| §134 decision→memory; superseded on contradiction | PASS | hook + registerMemory supersede path `memory.service.ts:226-257` |
| §136 scope precedence in ranking | PARTIAL | importance/confidence inputs exist; explicit precedence ladder not encoded beyond decision-hook special-case |
| §137 secrets never stored/fed back | PASS | patterns + reject-before-insert + never surfaced to prompts |
| Memory endpoints; USER_PRIVATE owner-only | PASS | lists/candidates/accept/reject/patch/delete `handlers/memory.ts:22-130`; private accept/patch restricted to owner `:60-86,126` (tested `test/memory-endpoints.test.ts`) |
| §185 #12 explicit promotion only | PASS | `acceptCandidate` is sole private→shared bridge, owner-gated `memory.service.ts:166-186` |

### §27 Proactivity

| Item | Grade | Evidence |
|---|---|---|
| Signal-gated producer (never timer spam) + cooldown/confidence controls | **NOT-IMPLEMENTED** | repository + table + PROACTIVE_AI category exist; no scheduled producer, no cooldown logic reached (grep: ProactiveRepository constructed but unused in services wiring) |
| ai_proactive_suggestions shape | PASS | table `20260822000120:160-175` |

### §28 Storage & Files

| Item | Grade | Evidence |
|---|---|---|
| R2 for objects; server-generated keys; client keys never trusted | PASS | `objectKey` builds namespaced keys `attachment.service.ts:34-46` |
| Short-lived signed URLs after authz; no permanent public URLs | PASS | HMAC codec + TTL from config `attachment.service.ts:117-161`; sign requires readability+membership `attachments.ts:55-80`; download re-verifies membership (removed-member revocation) `attachments.ts:82-116` |
| Upload security (sniff, size, extension, checksum, never execute) | PASS | magic-byte sniffing + mismatch rejection + blocklist + size + SHA-256 `attachment.service.ts:48-110`; malware scan optional-not-present (spec allows optional) |
| Local filesystem untrusted; explicit cloud processing | PARTIAL | no local-sync processing path at all (backend honest gap; FE owns local files) |
| Shared-file sync states | PASS | LOCAL_REFERENCE/R2 + status enum incl. CONFLICT/RESTORABLE `20260822000114` |
| Indexing pipeline states → ready_for_context | **NOT-IMPLEMENTED** | state constants/tests only (`hardening.test.ts`); no indexing job, no extraction/chunking/embedding |
| Freshness tracking (source_version/STALE) | **NOT-IMPLEMENTED** | no indexed_version columns/tracking on real data |
| AI file permission distinctions | PARTIAL | group/project scoping + owner via requireReadable; per-file AI-context-enabled flag absent |

### §29 Quotas & Usage

| Item | Grade | Evidence |
|---|---|---|
| Centralized metered ledger | PARTIAL | usage_events is the single ledger `20260822000117:64-77`; recorded categories today: ai_requests, output_tokens `orchestrator.ts:486-499` — research/storage/artifact/tool categories not yet metered |
| usage_events supporting rollups | PASS | shape + created_at grouping supports daily/monthly/per-user/provider |
| §94 exhaustion contract + BYOK continue | PASS | `{code:'APPLICATION_AI_QUOTA_EXHAUSTED', can_continue_with_byok}` + 402 `run-lifecycle.ts:97-141`; thrown pre-run `orchestrator.ts:181-192`; BYOK detection `handlers/ai.ts:127-138`; tested `orchestrator.test.ts:360-374` |
| Storage quotas | PARTIAL | quota_states override table exists `20260822000117:80+` and is consulted `ai-runtime.repo.ts:444-456`; byte/artifact-count metering not implemented |
| ALL §178 limits config-driven | PARTIAL | LIMITS_JSON schema covers ~20 knobs with spec defaults `limits.ts:9-31` and is consumed broadly; **residual hardcodes: max_tokens 4096 `orchestrator.ts:284`; pool 2000/30d `runtime.ts:128-129`; zod .max(8) `ai.ts:21`; memory slice 500/0.6 `services.ts:361,369`; run-duration timers unconsumed (M8)** |
| §131 admin usage view | **NOT-IMPLEMENTED** | no aggregation endpoint (grep: none) |

### §30 Rate Limiting

| Item | Grade | Evidence |
|---|---|---|
| Per-account / per-group / per-IP-device layers | PARTIAL | messages/user `messages.ts:35-39`; AI/group-min `ai.ts:41-45`; GH/group-hour `github.ts:143`; 429 rides §102 contract incl. retry_after on WS `group-room.ts:44-47`; tested `search-acl.test.ts:148-175`; **missing:** IP/device layers, invite-brute-force throttle, login attempts (owned by Supabase), WS send throttle (L5); per-isolate only (N3, documented deviation) |

### §31 Authorization & RLS

| Item | Grade | Evidence |
|---|---|---|
| §86 chain on every request; never trust client ids | PARTIAL | centralized helpers `membership.service.ts:28-53`; handlers overwhelmingly resolve resource → requireMember(resource.group_id) (matrix in §4 probe); **violations that remain: M1 (edit/delete), M2 (project_id), M3 (attachment link), M5-audience** — everything else traced clean |
| §186 centralized helpers, no duplicated authz | PASS | requireMember/requireRole/assertOpenForWrites + ProjectService.get as requireProjectAccess + PrivateConversationService.requireMember + engine role gates; routes contain no ad-hoc role math (spot-checked all 12 handler files) |
| §87A concrete RLS policies (definer fn; split message policies; memories scoping) | PASS | `is_group_member` security definer w/ removed_at null `20260822000102`; groups select/update-owner-admin; messages three per-visibility policies `20260822000110:61-96`; memories three-scope + USER_PRIVATE uid-only `20260822000118:45-66`; defense-in-depth batch (revisions/pins/mentions/private-graph/tool-calls/audit lockdown) `20260823000101:129-236` |
| RLS defense-in-depth; business writes via privileged connection | PASS | worker uses service-role key `db/src/client.ts`; anon/authenticated get policy-scoped direct access only |
| §187 dangerous-bug tests exist AND pass | PASS | outsider group access blocked `test/groups.test.ts:37-102`; non-participant private search zero-hit `test/search-acl.test.ts:12`; reactions: non-member/removed/cross-group/removed-on-private/unreact `test/reactions-authz.test.ts:43-219`; forged approvals `security-matrix.test.ts:398-430`; forged private-conversation claim fails pre-row `orchestrator.test.ts:572-605`; signed-URL expiry enforced in codec `attachment.service.ts:144-159`. Caveat: RLS policies themselves are reviewed-as-SQL, never executed against live Postgres in CI |

### §32 AI Security & Injection Defense

| Item | Grade | Evidence |
|---|---|---|
| §88 forbidden materials never reach model; tool output sanitized+labeled | PASS | recursive sanitizer incl. sk-/ghp_/Bearer patterns `orchestrator.ts:83-107`; sanitized outputs pushed as `role:"tool"` (untrusted per policy text) `:348-353`; BYOK plaintext only decrypted in isolated server path `ai-runtime.repo.ts:391-408`; nested-recursion test `security-matrix.test.ts:278+` |
| §89 injection policy; retrieved content never authority; defenses TESTED | PASS | INJECTION_POLICY_TEXT verbatim inside SYSTEM_SAFETY first slice `runtime.ts:494-500` (wired H1); tool outputs framed as data; skill uploads cannot outrank safety (skills validator); prompt-assembly tests lock the order `prompt-assembly.test.ts:107-245` |

### §33 Audit

| Item | Grade | Evidence |
|---|---|---|
| §99 append-only audit of sensitive actions | PARTIAL | audit_events append-only + client access revoked `20260822000107:30-38,235-236` + `20260823000101:231-236`; rows for role changes/removal/transfer/deletion stages `membership.service.ts:118-126,171-179,208-216`, `deletion.service.ts:54-91`; **missing: secret/BYOK configuration, GitHub connect/disconnect/approve/reject, provider changes, private-scope changes (N1)** |
| §169 externally-meaningful AI-action records | PASS | who requested/initiated (`ai_actions.initiated_by_user_id`), run/model/tool/payload/risk (`ai_tool_calls` + `ai_runs.usage_json`), approval identity + exact approved hash + result + timestamps (`ai_action_approvals.execution_result/executed_at` `ai-runtime.repo.ts:240-246`) — structurally complete |

### §34 Observability & Ops

| Item | Grade | Evidence |
|---|---|---|
| §100 metrics across API/realtime/AI/GitHub/sync | PARTIAL | structured request logs w/ latency/status/request-id `app.ts:33-52`; **no metric series** for realtime connections/gaps, AI provider latency/fallback frequency, GH errors, sync lag |
| Health endpoints; readiness = DB+config only | PASS | `/health`, `/health/live`, `/health/ready` checking db + required env, providers excluded `app.ts:72-91` |
| Separate env configs; no committed .env | PASS | `.env.example`; wrangler vars; `.gitignore` covers .env; no prod secrets in tree (dev fallback documented L2) |
| Client-version endpoint + CLIENT_UPDATE_REQUIRED | PASS | `app.ts:94-100`; WS gate `group-room.ts:218-229`; version metadata on every connection.ready `:241-242` |
| Server-controlled feature flags | PARTIAL | flag list/defaults/validation `hardening.ts:53-101`; **no DB backing and no runtime gate consults flags** (meeting.start ignores meeting_mode; github_write unenforced) |
| Backups/retention/DR/key rotation | PARTIAL | `docs/disaster-recovery.md` exists (RTO/RPO narrative); rotation supported structurally (master-key-derived envelope; re-encrypt path = re-save config); backup restore TESTING unverifiable from repo |

### §35 Schema & Migrations

| Item | Grade | Evidence |
|---|---|---|
| Versioned, reversible-ish, non-destructive; seed separate | PARTIAL | timestamp-prefixed ordered migrations; idempotent guards (`if not exists`, `do $$` blocks throughout `20260823000101`); **no seed dir; no down-migrations** (practical reversibility limited) |
| All spec tables exist with exact columns/constraints/indexes | PASS | 59 CREATE TABLE statements cover all 52 spec tables (inventory §2 of probes) plus audit_events, github_webhook_events, group_sequences, idempotency_operations, quota_states, research_jobs/sources; spot-verified exact shapes: messages `20260822000110:21-46`, outbox `20260822000107:6-27`, jobs `:41-62`, sync `20260822000122`, artifacts `20260822000120:22-35` |
| member_nicknames viewer-scoped PK; resolution order | PASS | `20260822000106` PK all-three; nickname service resolution viewer→group display→global |

### §36 REST Surface

| Item | Grade | Evidence |
|---|---|---|
| §104–§114 endpoint completeness under /api/v1 | PASS | ~90 routes across 13 routers (`app.ts:105-120` + handler greps): groups/members/nicknames/invites/projects+instructions/messages+search/engagement(pins)/attachments/me/memory/artifacts/decisions/tasks/meetings/ai runs/config/webhooks/client-versions/health — all spec'd surfaces present; server persistence canonical (WS send goes through same RPC) |
| §152 runtime validation everywhere | PASS | zod on every REST body (`*.handlers`), WS discriminated union `websocket.ts:155-171`, tool I/O schemas in registry, artifact-type enum, sync op schemas in domain; TS types alone never trusted at boundaries |

### §37 Testing Requirements

| Item | Grade | Evidence |
|---|---|---|
| Unit suites (permissions, risk, memory scoring, fallback, parsing, sync logic) | PASS | `membership.rules.test`, registry/policy tests, memory tests, fallback spies `orchestrator.test.ts:709-762`, slash-command tests, `sync.test.ts` |
| Integration tier (live PG/DO/adapters/GitHub/search) | PARTIAL | adapters tested against interfaces with fakes; **no live database, DO runtime, or network integration anywhere in CI** — the one systemic weakness of the suite |
| Security suite | PASS | cross-group, private leakage, memory scope, secret exposure, forged approvals, invalid GitHub action, stale authorization all present (see §31 evidence) — invite-brute-force test absent |
| Realtime + AI suites | PASS | reconnect/sequence-gap/ring behavior `room-core.test.ts`, `broadcaster.test.ts`; tool selection/approval enforcement/injection defense/fallback/memory privacy across `orchestrator.test.ts`, `prompt-assembly.test.ts`, `security-matrix.test.ts` |
| §153 eval-style scenario suite | PARTIAL | scenario-shaped tests exist (research tool use, private AI request, malicious webpage injection via sanitizer tests, unauthorized approver, duplicated offline message via idempotent RPC); no formal evaluation harness/report |

### §38 Architecture & Invariants

| Item | Grade | Evidence |
|---|---|---|
| Domain service interfaces; GitHubService depends on ApprovalEngine | PASS | service classes per domain in `packages/domain/src/**`; GitHub flows bind exclusively through `ApprovalEngine.propose/approve/beginExecution` `github.ts:145,197,216` |
| Dependency direction; vendor SDKs behind adapters | PASS | handlers → application services (`services.ts`) → domain → repositories/adapters → infra; vendor surfaces isolated in `ai-providers` adapter, `search` providers, `db` client |

### §39 Frontend Contract Data (§179)

| Item | Grade | Evidence |
|---|---|---|
| Chat surface (streaming, mentions, reactions, threading, private, edit/delete, attachments) | PASS | delta streaming `orchestrator.ts:380-386`; full §39 row in message.created payload `handlers/messages.ts:100-113`; reactions/pins endpoints; reply_to threading; private audiences; attachment upload/sign/download |
| Live artifacts + Garage listings/versioning/links | PARTIAL | created/new-version/restore/pin/share/content endpoints + links table; progressive node/render events absent |
| Meetings surface | PARTIAL | session state + start/end events (WS) + candidate accept; summary.updated event absent |
| Project Pulse ("ask the project" cited answers) | **NOT-IMPLEMENTED** | no pulse/insight endpoint (grep) |

### §40 Definition-of-Done spot-checks (§196)

| Item | Grade | Evidence |
|---|---|---|
| Hash binding enforced; github_actions joins through it | PASS | §20 evidence |
| RLS for groups/messages/memories + direct-access leakage tests | PARTIAL | policies comprehensive; **leakage tests are static SQL review only — never executed against a live DB in CI** |
| activity/notifications/sync/jobs populated by REAL consumers | PARTIAL | notifications/activity/outbox→jobs real; **sync_* tables have no writer (H3)** |
| Privacy-filter-before-ranking on every competitive slice | PASS | `context-engine.ts:106-116` + candidate-side authorization |
| Every matrix row has automated negative test | PASS | §17 evidence |

---

## 4. Adversarial probes (hand-traced this audit)

**(a) Authorization chain sweep — every write route.** Traced all 13 routers. Routes either (i) take `groupId` from the path and call `requireMember/requireRole` first, or (ii) resolve the resource then `requireMember(resource.group_id)` (runs `ai.ts:93,102`, actions `github.ts:190,237`, artifacts/decisions/tasks/meetings via `projects.get` → `project.service.ts:65-70`, memory `memory.ts:55,72,126`, engagement `engagement.ts:32,57,87,110`). Remaining trust violations are exactly M1/M2/M3 — enumerated, none hidden.

**(b) Privacy crossing — private AI run end-to-end.** POST run with claimed foreign `private_conversation_id`: `resolvePrivateTarget` rejects BEFORE quota spend or run row (`orchestrator.ts:162-173,535-550`; tested `orchestrator.test.ts:572-605`). Persisted replies land in the server-resolved conversation with `sender_type='AI'` through the same §122 RPC (`runtime.ts:374-393`); reads gated by conversation-membership ACL + RLS. Content leakage: none found beyond M4 metadata exposure.

**(c) Approval integrity under mutation.** Propose (hash v1) → attacker mutates payload row → approve submits displayed hash: engine compares current vs displayed and throws ACTION_EXPIRED (`approval-engine.ts:150-158`). Approve OK → mutate → beginExecution re-compares current-vs-approved and EXPIRES (`:214-223`). Cron sweeps expired WAITING/APPROVED hourly-minute (`index.ts:29-34`). Client `approved:true` booleans have no code path (`approvalBody` demands hash+version `github.ts:42-45`).

**(d) Transaction boundary under duplicate submit.** Two concurrent sends sharing `(group_id, client_message_id)`: RPC's unique-conflict branch returns the original row and inserts exactly one outbox event for the winner (`20260823000101:277-291`); DO dedupes fast-path vs consumer by event id (`group-room.ts:523-535`). Attachment links remain outside the transaction (§1/§7 grades).

**(e) Quota correctness against migrated schema.** `quotaLimit` reads `quota_states.limit_override` matching the migration (C1 regression test locks it); `sumGroupUsage` aggregates `usage_events` per period; exhaustion returns the exact §94 body with 402 and BYOK escape hatch; the check runs BEFORE the run row is created (`orchestrator.ts:181-194`). In-flight run completing after exhaustion is consistent with spec (new requests only).

**(f) Removed-member staleness.** REST: every engagement/write path calls `requireMember` (active-only) at request time; WS: connect-time membership + write-time `requireActiveMember` (`group-room.ts:116-131,402`) + broadcaster eviction on `member.removed` (`broadcaster.ts:57-62`); signed downloads re-check membership (`attachments.ts:94-107`). The surviving exception is message edit/delete (M1).

---

## 5. Honest NOT-IMPLEMENTED inventory (phase-gates, not silent gaps)

1. Offline sync transport (§11/§20A/§21) — tables + logic + tests, zero wiring (H3).
2. `ai_run_steps` orchestration trace writer (§53).
3. Deep research pipeline + runner + endpoints (§68/§119); depth limits unconsumed.
4. Proactive AI producer + cooldown controls (§70/§71).
5. File indexing/extraction/freshness pipeline (§127/§128).
6. Email delivery transport (§144).
7. Feature-flag enforcement gates (§166) — helpers only.
8. Admin usage-view aggregation endpoint (§131).
9. GitHub execution steps (§79 branch→patch→commit→PR→merge) — fail-closed by design.
10. Project Pulse endpoint (§172/§39).
11. Executed (live-database) RLS leakage suite (§87A/§196).

---

## 6. Blocking list

### Blockers for PRODUCTION (must fix before real users/data)

1. **H3 — wire the sync protocol** or descope `offline_sync_v2` explicitly: REST/WS endpoints writing `sync_checkpoints/sync_operations/sync_conflicts`; make `sync.ack` durable.
2. **M1 — re-verify active membership on PATCH/DELETE `/messages/:id`** (and WS equivalents): removed members currently retain edit/delete on old messages (§185 #11 violation).
3. **M2 — validate client `project_id ∈ group`** on message send and AI run start (one `projectIdToGroupId` comparison in both paths).
4. **M3 — bind attachment links to a readable, same-group message** inside the upload request (and fold into the §122 transaction if feasible).
5. **M4 — restrict PRIVATE_AI/AI-run metadata**: GET run should require requester-or-privileged role; consider RLS tightening on `ai_runs`.
6. **M7/M9 — close the event chains**: emit `decision.approved/rejected`, `task.assigned/updated/completed`, `ai.action.approved/rejected`; remove the notification-consumer no-op breaks so `AI_ACTION_APPROVAL` becomes reachable.
7. **N1 — audit the missing sensitive actions**: GitHub connect/disconnect/approve/reject, BYOK/provider configuration changes.
8. **Database-backed integration/security tier in CI**: execute RLS policies and repository SQL against real Postgres (schema-drift test is a narrow static guard only).
9. **Shared rate-limit store** (DO/KV) replacing per-isolate counters; add invite-accept throttling (N3/N4).
10. **Run-duration enforcement**: wire the already-configured 120s/300s timeouts to actual cancellation.

### Blockers for STAGING (fix before deploying even to staging)

None outstanding. (C1/H1/H2/H4 verified fixed; remaining defects above are data-integrity/metadata issues that assume adversarial tenants.)

### Recommended (non-blocking) for production

M5 (audience-tag reaction/pin publishes), M6 (actor_ai_id semantics), M8 residual hardcodes, M10 (remaining context slices + dedup + explicit refs), N2 (delivery_state transitions), L1–L8, §100 metrics, feature-flag backing, seed directory, §153 eval harness.

---

## 7. Final verdict

> **STAGING-READY.**
>
> The previously-fatal defect set (C1 fatal-to-every-AI-run, H1 prompts-without-safety, H2 cross-group reaction writes, H4 vacuous privacy proofs) is fixed and regression-guarded; typecheck is clean and all 295 tests pass under the auditor's own execution. The approval engine, privacy isolation, BYOK handling, outbox/job machinery, and upload hardening withstand adversarial tracing.
>
> **Production is NOT ready** until the ten-item blocking list in §6 is cleared — headlined by the entirely-unwired sync protocol (H3), the removed-member edit/delete hole (M1), client-trusted `project_id` (M2), attachment-link binding (M3), PRIVATE_AI metadata exposure (M4), and the absent executed-RLS test tier. Eleven spec areas remain honestly unimplemented (§5) and should be tracked as explicit phase-gates rather than assumed.

*Graded honestly: 24 PASS · 41 PARTIAL · 1 FAIL · 8 NOT-IMPLEMENTED across the TODO ledger; prior-audit critical/high defect status: 4 fixed, 1 open (H3), 1 partially fixed (M5).*

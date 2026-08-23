# ClanMind — FINAL AUDIT (Independent)

**Auditor:** final-audit pass, 2026-08-23. This auditor did not build any part of ClanMind.
**Sources of truth:** `ClanMind Backend — Master Implementation Specification.md` (BE §1–§197), `ClanMind_Frontend_Master_Implementation_Specification.md` (FE §1–§329), `HANDOFF_BACKEND.md`, `HANDOFF_FRONTEND.md`, `clanmind-backend/docs/AUDIT_REPORT.md`, `docs/INTEGRATION_REPORT.md`.
**Method:** every command below was run by this auditor on a clean shell; every cited file was read directly. Nothing was repaired.

---

## 0. Reproduction results (run by auditor)

Backend (`clanmind-backend`):

```
pnpm install            → OK (workspace up to date)
pnpm -r typecheck       → 15/15 packages "Done", exit 0
pnpm -r test            → 262 passed, 0 failed
  contracts 7 · ai-providers 5 · shared 3 · auth 4 · search 6 · skills 4
  domain 180 (24 files) · worker 53 (13 files)
```

Frontend (`clanmind-frontend`):

```
pnpm exec tsc -b        → exit 0, silent
pnpm run lint           → oxlint: 0 errors, 4 warnings (all fast-refresh only:
                          router.tsx ×2, Toast.tsx, AiStatusIndicator.tsx)
pnpm test               → Test Files 8 passed (8); Tests 34 passed (34)
pnpm run build          → built in ~500ms; chunk-size advisory only
```

Both reports' headline numbers reproduce **exactly**.

---

## 1. Verdicts on spot-checked report claims

Legend: TRUE = verified in code/tests by auditor · OVERSTATED = partially true, claim exceeds evidence · FALSE = contradicted by code.

### From `clanmind-backend/docs/AUDIT_REPORT.md`

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | "15/15 packages typecheck green · 262 tests passing" | **TRUE** | Re-ran: 15× `typecheck: Done`; totals 7+5+3+4+6+4+180+53 = 262, all passing |
| 2 | C2: search `include_private=true` now scoped to requester's own conversations + negative test | **TRUE** | `apps/worker/src/repositories/search-notification-activity.repo.ts:43-54` filters conversation ids by membership; `apps/worker/test/search-acl.test.ts:12` asserts non-participant gets zero hits |
| 3 | C3: 5 new handler files = 48 new endpoints mounted in app.ts | **TRUE** | Counted routes: ai 3 + ai-config 4 + memory 7 + intel 26 + github 8 = 48; mounted at `apps/worker/src/app.ts:116-120` |
| 4 | C4: WS handles message.send/edit/delete/react, sync.ack/request, meeting.start/end, artifact.interaction; protocol gate env-driven; explicit `NOT_AVAILABLE_ON_WS` for ai.run/cancel | **TRUE** (as described) | `apps/worker/src/realtime/group-room.ts:158-419` covers all §114 types; gate reads `MIN_PROTOCOL_VERSION` at :160; ai.run/ai.cancel refused at :399-412 — an honest, documented deviation, but see matrix row 11 (PARTIAL vs spec letter) |
| 5 | Rate limiter wired msg 30/min, ai 10/min, gh 20/h; throws §102 RATE_LIMITED 429 with retry_after_seconds | **TRUE** | `handlers/messages.ts:34-39`, `handlers/ai.ts:41-45`, `handlers/github.ts:143`; limits from `services.limits`; tests in `search-acl.test.ts:148-170` |
| 6 | Webhook: verify → durable dedupe → installation→Group → persist → outbox; tests for bad signature 403 + redelivery dedupe | **TRUE** | `handlers/github.ts:255-333`; domain `WebhookProcessor` w/ `isDuplicate` injection (`packages/domain/src/approval/approval-engine.ts:345-382`); `apps/worker/test/github.test.ts:282,301` |
| 7 | PRIVATE_AI AI_RESPONSE notifies only the owning requester (§95A) | **TRUE** | `apps/worker/test/consumers.test.ts:46`; domain-level twin in `security-matrix.test.ts:249-276` |
| 8 | Activity builder attributes AI runs to actor_type AI | **TRUE** | `apps/worker/test/consumers.test.ts:77` |
| 9 | Sanitizer recursive at any depth + nested-object test | **TRUE** | `packages/domain/src/ai/orchestrator.ts:68-82` (full walk); `security-matrix.test.ts:186-197` |
| 10 | Action TTL 24h default + `expireStaleActions()` cron + expired-action test | **TRUE** | `approval-engine.ts:87,123-126`; `apps/worker/src/index.ts:31` calls it in scheduled handler; `approvals-secrets.test.ts:128` |
| 11 | Orchestrator injects ranked competitive slices into prompt as system CONTEXT | **TRUE** | `orchestrator.ts:190-199` |
| 12 | "§61: non-retryable errors never fall back" (comment + prior fix narrative) | **OVERSTATED→FALSE** | `orchestrator.ts:308-320`: the non-retryable branch and the generic branch both just `break` the inner stream loop; the outer chain loop (`:283`) then continues to the next route whenever nothing streamed. Classification has zero behavioral effect; `invalid_api_key` still silently falls back, contradicting BE §61 and rule §195.16 |
| 13 | §55A every "Never" row has an automated negative test | **TRUE with caveat** | All 8 Never-type rows covered with genuine negatives (`security-matrix.test.ts:56-197`, `memory.test.ts:299-336` zero-leak retrieval). Caveat A: these are domain/service-level tests against in-memory fakes, not the "live request" integration the spec's wording asks for. Caveat B: the §187 placeholder test at `security-matrix.test.ts:279-283` is vacuous (`expect(true).toBe(true)`) |
| 14 | §78A payload-hash binding enforced; approve binds hash+version; execution re-verifies | **TRUE** | `approval-engine.ts:150-158` (approve refuses mismatched displayed hash/version), `:199-227` (`beginExecution` re-verifies current hash AND version vs approval row, expires on mismatch); REST path requires both fields (`handlers/github.ts:42-45,194-203`); tests `approvals-secrets.test.ts:75-128` |
| 15 | Honest gaps list (no live DB, sync tables unconsumed, deep research/indexing/proactivity unwired) | **TRUE** | Each admitted gap confirmed by auditor's own reading; nothing material found that the gaps section hides |

### From `docs/INTEGRATION_REPORT.md`

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 16 | FE verification numbers (tsc silent, lint 0 err/4 warnings, vitest 34/34, build ok, mocks tree-shaken) | **TRUE** | Reproduced exactly; `grep` of `dist/assets` for mock symbols returns CLEAN |
| 17 | Backend numbers verbatim block | **TRUE** | Matches auditor's run line-for-line |
| 18 | Demo-mode compile gate removes all of src/mocks from prod bundle | **TRUE** | `grep -rlE "grp_robotics_1\|user_arun_1\|Robotics Core Team\|mockAiService\|installDemoMode\|DemoRealtimeHub\|demo-token" dist/assets` → no matches; `src/mocks` imported only under `if (__DEMO_MODE__)` dynamic import (`src/main.tsx:14-18`) |
| 19 | `demoDispatch.ts` removed; NEW `src/live/liveRuntime.ts` wired from boot; shared `realtime/dispatch.ts` projection | **TRUE** | No demoDispatch file; `App.tsx:46-73` branches demo/live at boot and calls `bootstrapLiveWorkspace()` + `ensureLiveRealtime()`; `src/live/liveRuntime.ts`, `src/realtime/dispatch.ts` exist |
| 20 | `quotaExhaustionOf()` parses three real 402 envelope shapes and drives BYOK branch | **TRUE** | `src/api/errors.ts:61-89`; consumed by `features/ai/AiQuotaCard.tsx` + `useChatController.ts` |
| 21 | Dual-framing parser; CLIENT_UPDATE_REQUIRED hard-stops from BOTH error framings, no retry loop | **TRUE** | `src/realtime/connection.ts:302,366` both call `protocolStop`; regression tests `connection.test.ts:133,188` assert no reconnect loop |
| 22 | Backend additive changes: full §39 row in message.created fan-out; §165 metadata on hello-ready | **TRUE** (second half verified directly) | `group-room.ts:177-185` sends minimum/recommended versions + protocol_version on every ready frame |
| 23 | Item 9 open gap: real `artifact.created` carries only `{artifact_id, version}`, live content projection impossible | **TRUE (honest)** | Confirmed: outbox payload at `runtime.ts:356` is `{artifact_id, version}` only |

**Tally: 23 claims checked — 20 TRUE, 1 TRUE-with-caveat counted as TRUE(13)/noted, 1 OVERSTATED→FALSE (#12), plus #13 caveats. No claim was found fabricated; both reports are unusually honest, and their self-declared gaps match reality.**

---

## 2. Spec-compliance matrix (~20 most product-critical requirements)

| # | Requirement | Source | Verdict | One-line evidence |
|---|---|---|---|---|
| 1 | Account→Group→Projects model; OWNER/ADMIN/MEMBER/GUEST roles enforced server-side | BE §2.1/§7/§86 | **PASS** | Role re-derived from DB via `requireMember/requireRole` in every mutating handler; role hierarchy tests in groups/invites suites |
| 2 | Private human/AI conversations ACL-enforced in backend queries, not flags | BE §2.4/§11.2/§40 | **PASS** (REST chat) | `handlers/messages.ts:58-80` derives visibility+conversation server-side from `private_to`; RLS policies join `private_conversation_members` |
| 3 | Privacy Crossing Matrix negatives automated | BE §55A | **PASS w/ caveat** | All Never rows have genuine negative assertions; they are service/domain-level, not live-request integration tests; one vacuous §187 placeholder remains |
| 4 | Approval engine binds approval to action id + payload hash + version; no client boolean | BE §78A/§90, FE §164A.2 | **PASS** | Server-side enforcement (`approval-engine.ts`) + FE submits exact hash/version (`ApprovalCard.tsx:30-32,155-158`); forged-approval test present |
| 5 | github_actions joins ai_actions; no duplicated approval fields | BE §78/§78A.2 | **PASS** | Migration `20260822000121` FK `ai_action_id not null`; status read via `githubActionWithStatus` join helper |
| 6 | RLS policies for groups/messages/memories incl. USER_PRIVATE owner-only | BE §87A | **PARTIAL / NOT VERIFIED (executed)** | Policies exist matching §87A shapes exactly (e.g. `memories_select_user_private`, per-visibility messages policies) but were never applied to a live Postgres — SQL review only |
| 7 | All §178 limits read from configuration, not hardcoded | BE §178 | **PASS** (minor exceptions) | `packages/shared/src/limits.ts` zod schema = spec table row-for-row; `wrangler.toml LIMITS_JSON` carries all values; exceptions: hardcoded `.max(8000)` bounds in `handlers/intel.ts:35,42,50` |
| 8 | Quota exhaustion contract `APPLICATION_AI_QUOTA_EXHAUSTED` + `can_continue_with_byok` | BE §94, FE §141 | **PASS** | Orchestrator throws contract at `startRun` (`orchestrator.ts:137-148`); FE parses all observed placements and branches BYOK vs admin-message |
| 9 | Stable machine-readable error codes everywhere handlers respond | BE §102 | **PASS** (REST) / minor WS gap | Global `app.onError`→`toErrorEnvelope` + envelope-shaped 404; WS defect D3 below masks codes on one path |
| 10 | REST endpoints §104–§113 exist and are authorized | BE §104–§113 | **PASS** | 48 new + pre-existing routes mounted; each route authenticates → membership/role-gates before any write |
| 11 | WebSocket protocol: all §114 client commands handled | BE §114 | **PARTIAL** | 14/16 functional in `group-room.ts`; `ai.run`/`ai.cancel` answered with documented `NOT_AVAILABLE_ON_WS` error pointing to REST (spec lists them as client commands; deviation is reasoned and disclosed) |
| 12 | AI request lifecycle steps 1–24 | BE §115 | **PASS except step 18 for private runs** | Steps mapped in orchestrator/runtime; step 18 broken for PRIVATE_* visibility (defect D1) |
| 13 | Tool-loop hard limits, configurable | BE §116 | **PASS** | `ToolLoopGuard` bounded by `tool_calls_per_run_max`/`tool_total_time_per_run_seconds` from config; `.max(8)` also on request body |
| 14 | Atomic write + outbox in one transaction; idempotent replay | BE §122/§123/§19 | **PASS** | RPC `create_message_with_mentions` inserts message+mentions+outbox_events atomically, `on conflict do nothing` replay tested (`idempotency.test.ts`) |
| 15 | Approved decision supersedes others and becomes high-priority project memory | BE §134/§47 | **PASS** | `DecisionService.approve` CAS PROPOSED→APPROVED, `supersedeOthers`, `onApproved` memory hook (0.95 confidence) — wired in both runtime and services paths |
| 16 | Secrets never enter memory or prompts | BE §88/§137/§55A r11–12 | **PASS** | Secret-shaped candidates rejected; recursive sanitizer applied to every tool output before model injection |
| 17 | Default branch protected; diff preview precedes approval | BE §139/§140 | **PASS** | `assertBranchSafety` + `buildDiffPreview` invoked on every proposal (`handlers/github.ts:133-140`) |
| 18 | Controlled merge flow (explicit click, current SHAs, unexpired) | BE §79/§141 | **NOT IMPLEMENTED** | `merge_pr` absent from propose enum (`github.ts:26`); no merge endpoint; `validateMergePayload` exists unused in routes. GitHub writes themselves fail closed (`executor_not_implemented`) — honestly disclosed |
| 19 | FE demo/live duality: prod build tree-shakes mocks; live runtime wired from boot | FE handoff/INTEGRATION | **PASS** | Compile-time `__DEMO_MODE__` gate; dist grep clean; `bootstrapLiveWorkspace()` called from App boot when live |
| 20 | No fixture IDs outside src/mocks | FE handoff T1 | **PASS** | `grep -rlE "grp_robotics_1\|user_arun_1\|proj_flight_ctrl" src` excluding mocks → zero matches |
| 21 | Protocol version mismatch handling, server-authoritative | FE §309A/BE §165 | **PASS (logic) / NOT VERIFIED (live)** | Ready frame carries version metadata; CLIENT_UPDATE_REQUIRED terminal state tested; live rejection never exercised against a deployed Worker |
| 22 | Sync tables (checkpoints/operations/conflicts) populated end-to-end | BE §20A/§196 | **FAIL (documented)** | Tables+migrations exist; no outbox consumer fills them; WS `sync.ack` is reply-only — matches builder's own admission |

---

## 3. Defects found (severity-ranked; auditor did NOT fix)

| Sev | Defect | Evidence |
|---|---|---|
| **HIGH** | **D1 — Private AI/human-run responses are orphaned.** The AI response for `PRIVATE_AI`/`PRIVATE_PAIR` runs is persisted with `private_conversation_id` hardcoded `null`, and `runs.insert()` never stores the conversation either. Under RLS (`messages_select_private_ai/private_pair` require conversation-membership join), Odin's private replies are unreadable by *anyone*, including the requester — private AI chat cannot work end-to-end even though every unit test passes. Additionally, POST `/ai/runs` accepts a client-supplied `private_conversation_id` with **no ownership check**, violating BE §86 ("do not trust ids from client"). | `packages/domain/src/ai/orchestrator.ts:366-375` (hardcoded null at :371); `handlers/ai.ts:60-61` passes raw body value; `runs.insert` fields at `orchestrator.ts:150-159` omit the column; RLS at `supabase/migrations/20260822000110_messages.sql:86-96` |
| **MEDIUM** | **D2 — BE §61/rule §195.16 fallback prohibition is dead code.** Non-retryable provider errors (`invalid_api_key`, `permission_denied`, safety refusal) take the same `break` as retryable ones and the outer chain loop silently proceeds to the next route when nothing streamed. The code comment and remediation narrative claim otherwise. | `packages/domain/src/ai/orchestrator.ts:308-320` (both branches `break`), chain loop at `:283-350` |
| **MEDIUM** | **D3 — WS `message.send` masks all error codes as VALIDATION_FAILED.** Rate-limit (429/RATE_LIMITED), permission, and quota failures on the WS send path lose their stable §102 codes, unlike edit/delete/react which use `sendDomainError`. Clients cannot distinguish "slow down" from "not allowed". | `apps/worker/src/realtime/group-room.ts:286-288` vs `:306,319,342` |
| **LOW/MED** | **D4 — Denied tool calls linger PENDING in the ledger forever.** When `registry.canInvoke` denies, a ledger row is recorded then abandoned without `complete(...DENIED)`; §57A expects terminal states for audit queries. | `packages/domain/src/ai/orchestrator.ts:216-226` |
| **LOW** | **D5 — Vacuous §187 test.** "cross-group/cross-user authorizations fail closed" asserts `expect(true).toBe(true)`; §187 scenarios (removed member stale token, signed-URL-after-revoke, guest attempting admin action) have no dedicated adversarial test visible. | `packages/domain/test/security-matrix.test.ts:278-283` |
| **LOW** | **D6 — Hardcoded validation bounds bypass §178 configuration.** Decision context/task description `.max(8000)` constants are not read from limits config. | `apps/worker/src/handlers/intel.ts:35,42,50` |
| **LOW** | **D7 — Webhook HMAC comparison is not constant-time.** `hex === expected` string compare; theoretical timing side-channel on an otherwise correct HMAC pipeline. | `packages/domain/src/approval/approval-engine.ts:338-342` |
| **LOW** | **D8 — Fixed-window rate limiter is per-isolate.** Documented as layer-one deviation, but multi-isolate deployment multiplies effective caps; DO-side layer exists only on WS paths. | `apps/worker/src/ai/index.ts` (`enforceRateLimit`); AUDIT_REPORT §3.3 admits it |
| **INFO** | Decisions approve/reject has no role gate — any Member can approve any project decision. Spec is ambiguous here (§7.1 gives Admins decision management; §110 defines endpoints without roles); flagging as a product decision to confirm, not a clear violation. | `handlers/intel.ts:250-275` |
| **INFO** | GitHub merge lifecycle unimplemented (matrix row 18) and real GitHub API execution fail-closed — both honestly disclosed by the builder. | `handlers/github.ts:208-230` |

---

## 4. What cannot be verified on a dev machine (honest list)

1. **RLS execution**: migrations were never applied to a live Postgres here; all §87A conclusions are SQL-shape review. The §196 requirement for executed direct-access leakage tests (anon-client reads of another user's USER_PRIVATE memories) remains open — the builder says so too.
2. **Deployed Worker/Durable Objects**: WS hibernation behavior, `internal/publish`/`internal/sync` endpoints, ring-buffer eviction, stale-presence sweeps under real eviction, and live `CLIENT_UPDATE_REQUIRED` rejection were exercised only via unit tests/fakes.
3. **Real provider calls**: OpenAI/Anthropic/Google/OpenRouter adapters, Tavily/Exa search, BYOK key validation + model listing, and envelope-encrypted secret round-trip against a deployed secret store — none hit live APIs.
4. **GitHub App flow**: installation OAuth, webhook deliveries signed by github.com, and actual branch/patch/PR execution (executor is intentionally `executor_not_implemented`).
5. **Supabase Auth**: JWT verification ran against test secrets only.
6. **R2 object storage** paths and signed-URL expiry against real buckets.
7. **E2E FE↔BE LIVE mode**: `bootstrapLiveWorkspace()`, live approvals round-trip, notification deep links, attachment upload/index pipeline — frontend logic verified by schema-validation and framing tests only; INTEGRATION_REPORT marks these NOT VERIFIED correctly.
8. **Operations**: backups/restore testing (DR doc exists, untested), email delivery, quotas persistence under load, deep-research job runner (unimplemented), file indexing/extraction (unimplemented), proactive-AI producer (unwired).

---

## 5. Final verdict

ClanMind is **substantially internally consistent with its two source-of-truth specs**, and — rare for builds of this kind — the two reports understated nothing material that this auditor could find: headline numbers reproduce exactly (backend 15 pkgs typecheck-green, 262/262 tests; frontend tsc-clean, 34/34 tests, lint clean, prod build with mocks verifiably tree-shaken), endpoint counts match to the digit, and every "FIXED + tested" claim traced to real code with real negative assertions. The security spine demanded by the specs is genuinely implemented where it matters most: the §78A payload-hash approval binding is enforced twice (at approve and again at beginExecution, with expiry), the §55A privacy matrix has genuine negative tests behind it, §178 limits are configuration-driven, the WS room speaks the §114 protocol with an env-gated version floor, and the §102 error contract is centrally enforced. The builders' honesty sections (backend §4 gaps, integrator's NOT VERIFIED split) match this auditor's independent findings almost perfectly.

What stands between ClanMind and real users: (1) **defect D1 must be fixed** — private AI conversation responses are currently written unreachable, which silently breaks a flagship privacy feature while all green tests hide it; (2) **D2/D3** should be fixed before exposure (fallback-on-bad-credentials and WS error-code masking are trust bugs, not polish); (3) the **never-executed category**: RLS against a live Postgres, a deployed Worker/DO soak, one live provider round-trip, and one real GitHub App connection — until those happen, "secure by construction" remains a paper property; (4) the acknowledged functional gaps: sync-table consumers, GitHub merge/execution, feature-flags endpoint (frontend currently hardcodes safe-all-off in LIVE), deep research runner, file indexing, and proactivity producer. In short: the codebase is coherent, disciplined, and honest about itself; it is roughly at "staging-ready", not "user-ready", with one HIGH-severity privacy-lifecycle defect to close first.

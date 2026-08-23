Agent: zeus - Backend remediation Task E+F+G of H (handoff HANDOFF_BACKEND.md sections 3.E, 3.F, 3.G)
Repo workdir: clanmind-backend/. Sources: HANDOFF_BACKEND.md sections 3.E, 3.F, 3.G; spec sections 134 (approved decision to memory), 95A (notifications PRIVATE_AI targeting), 98A (activity AI actor), 125 (search index trigger).

CONTEXT: Tasks A-E prior steps done. services.ts has buildBackgroundRuntime registering JobHandlers. consumers.ts contains NotificationWorkerConsumer and ActivityBuilderConsumer. MemoryService.proposeFromRun exists in domain.

DELIVERABLES:
1. Task E background jobs: register JobHandler job_type memory.extraction in buildBackgroundRuntime - payload {run_id, group_id, visibility}: load run + final AI message (query messages by client_message_id = concat ai_run_ + run_id) + preceding user message body; call services.memory.proposeFromRun({group_id, project_id: run.project_id, user_id: run.requester_user_id, visibility, content: assistant answer slice max 500 chars, confidence: 0.6}). In apps/worker/src/index.ts scheduled handler: after drainOutbox/runDueJobs also await getAiRuntime(env,services).expireStaleActions(). consumers.ts fixes: NotificationWorkerConsumer - remove blanket isPrivate return gating ai.response.completed; PRIVATE_AI AI_RESPONSE must notify ONLY row.actor_id per spec 95A. ActivityBuilderConsumer - actor_type AI + actor_ai_id=row.actor_id when aggregate_type is ai_run or payload.sender_type is AI, else USER.
2. Task F search-index freshness VERIFY: migration 20260822000115 added messages.search_vector + GIN index. Inspect whether an INSERT/UPDATE trigger keeps search_vector fresh; if absent append trigger creation to supabase/migrations/20260823000101_audit_remediations.sql (idempotent style) or a new migration file. Report what you found either way.
3. Task G vacuous test fixes + coverage:
   - packages/domain test security-matrix.test.ts: row-1 test must ALSO assert ContextEngine drops authorized=false items (keep positive shared-slice assertion); differentiate row 3 by exercising MemoryService.proposeFromRun(visibility PRIVATE_AI) expecting USER_PRIVATE scope + stored:false plus privacyAuthorizes negative for user B; add nested-object sanitizeToolOutput test ({a:{b:ghp_...}} redacted).
   - memory.test.ts: add negative - U2 retrieveForContext(include_user_private true) returns zero of U1 rows.
   - NEW worker tests: search ACL negative (member B cannot hit A/B private content even include_private=true; participant CAN), pins private-message pin rejected + listing GROUP-only, rate limiter 429 (skip if B1/B3 already covered it - check first, do not duplicate), notifications PRIVATE_AI targeting, activity AI actor.

RULES: no new deps; keep all existing tests green; every new negative test must genuinely assert rejection/empty result not just positive path. pnpm -r typecheck && pnpm -r test until green.

FINAL SELF-REVIEW: git diff review, scope check, commands green, report files changed + full test count breakdown + answer explicitly: did migration 115 have a freshness trigger yes/no and what you did.

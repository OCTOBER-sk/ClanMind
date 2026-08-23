Agent: zeus - Backend remediation Task B1 of H (handoff HANDOFF_BACKEND.md section 3.B items 1-2)
Repo workdir: clanmind-backend/. Sources: HANDOFF_BACKEND.md (at repo root, one level up from clanmind-backend/) sections 3.B.1 and 3.B.2 are your detailed instructions; spec sections 106 (AI endpoints) and 107 (AI config) in "ClanMind Backend - Master Implementation Specification.md" at repo root.

CONTEXT: Typecheck and tests are fully green (task A done). The runtime wiring exists: apps/worker/src/ai/index.ts exports getAiRuntime(env, services) and enforceRateLimit(key, max, windowMs); repositories/ai-runtime.repo.ts exposes AiRun repo, ProviderConfig, ModelRoute, EnvelopeSecretStore, Usage. Existing handlers in apps/worker/src/handlers/ show the house style: zod validation, requireMember returns {group, member}, requireRole for admin gates, AppError with stable codes.

DELIVERABLES (exact paths):
1. apps/worker/src/handlers/ai.ts - implement exactly per HANDOFF section 3.B.1: POST /api/v1/groups/:groupId/ai/runs (requireMember; enforceRateLimit ai:<groupId> limits.ai_requests_per_minute_per_group window 60000; byokConfigured from db query on enabled BYOK configs; rt.orchestrator.startRun then rt.buildContextCandidates then orchestrator.executeRun; truncated=true means WAITING_APPROVAL), GET /api/v1/ai/runs/:runId (member of run.group_id only), POST /api/v1/ai/runs/:runId/cancel (requester or OWNER/ADMIN).
2. apps/worker/src/handlers/ai-config.ts - exactly per HANDOFF section 3.B.2, OWNER/ADMIN gated: GET config (sanitized configs + routes), PATCH config routes via router.validateRoutes then insert/upsert, POST providers/validate returns sanitized config + models (never raw key), POST providers/:id/models decrypts secret and calls OpenAICompatibleAdapter.listModels.
3. Tests in apps/worker/test/ covering: ai run happy path (mocked runtime), rate limiter 429 on ai endpoint, ai-config validate/store returns last4 only and never the raw key, routes PATCH persists entries.

Do NOT create memory.ts, intel.ts, github.ts or touch app.ts mounting yet - those are tasks B2/B3.

RULES: zod body validation like existing handlers; thin handlers, logic in packages/domain or services; follow existing AppError code conventions; no new deps. Run pnpm --filter @clanmind/worker typecheck && pnpm -r test until green (existing tests stay green).

FINAL SELF-REVIEW: git diff review, confirm only intended files touched, both commands green, report files changed + test count + any deviation from handoff wording.

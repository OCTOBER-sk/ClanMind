# ClanMind — Real Backend E2E Proof (verbatim, from live session)

All against REAL Cloud Supabase (`sdjvpsbifgglkanlpqle`, ap-south-1, Postgres 17.6) + real OpenRouter + real Tavily, via the Worker at localhost:8787. No mocks.

## 1. Auth (ES256 via real Supabase)
- Fixed ES256 JWKS verification (was HS256-only → `401 Unsupported token algorithm`).
- Commit `7088ab9`.
- Fresh user created via admin API; sign-in returns ES256 JWT; `GET /api/v1/me` → **200** with profile.

## 2. Real Odin AI run — COMPLETED (run_id 9bedce15-5133-4f0e-8875-f6d039a1a754)
- Worker → OpenRouter `openai/gpt-4o-mini`, gpt ASSIST mode.
- Commit `bc9224e` (unblocked APPLICATION provider + fixed Workers `Illegal invocation` fetch-this leak).
- Chain: real user JWT → Worker orchestrator → OpenRouter stream → AI message persisted → Supabase.

`ai_runs` row (verbatim select):
```json
[{"id":"9bedce15-5133-4f0e-8875-f6d039a1a754","group_id":"62c14d15-…","project_id":"b18df3a6-…",
  "requester_user_id":"67d85b9b-…","mode":"ASSIST","visibility":"GROUP",
  "provider_config_id":"2e5cb963-…","model_id":"openai/gpt-4o-mini","status":"COMPLETED",
  "usage_json":{"input_tokens":1062,"output_tokens":89},
  "started_at":"2026-08-25T18:30:25Z","completed_at":"2026-08-25T18:30:29Z"}]
```
Persisted AI message (verbatim): `sender_type=AI`, full Odin response body present.

## 3. Tavily web-research (live)
`POST api.tavily.com/search` → **HTTP 200**, real results (STM32 SPI DMA sources). Fetch-this leak fixed so the Worker can call Tavily/Exa.

## 4. Backend test suite
**355 tests green / 0 failures** (auth 18, ai-providers 6, search 6, domain 223, worker 91, skills 10, contracts 7, shared 3, ai? ).

## 5. Known gaps (honest)
- Client-requested `web.search` tool: model message assembly (orphan `role:'tool'`) → provider 400. Fix in progress (zeus).
- Frontend live group/project create was local-only → persisted group/project fix in progress (midas).
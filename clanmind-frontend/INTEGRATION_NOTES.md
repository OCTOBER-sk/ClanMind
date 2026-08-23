# Integration Notes — Frontend ↔ Backend ledger

Running log of contract decisions and any divergence between the backend
specification, the real backend implementation (parallel workstream), and the
frontend. Append-only; newest last.

---

## 2026-08-23 — P0 foundations

### D1 — Demo transport instead of MSW
The build bible originally specified MSW for the mock backend. Implemented as an
in-process `Transport` override (`src/api/transport.ts` +
`src/mocks/transportRoutes.ts`) plus a protocol-faithful WS hub
(`src/mocks/wsHub.ts`) instead. Reasons: no service-worker binary to manage in a
Tauri shell, identical behavior inside vitest/jsdom (where SWs are unavailable),
and zero prod-bundle surface (dynamic-import gated by `VITE_DEMO_MODE`). The
contract-first goal is unchanged: handlers implement BE §104–113 shapes with
BE §102 error envelopes.

### D2 — Demo AI runs flow through the REAL socket pipeline
The old `mockAiService.ts` mutated stores directly on timers. Replaced by
`wsHub.startAiRun`, which broadcasts §134A lifecycle events (`ai.status`,
`ai.tool`, `ai.delta`, `ai.completed`) as proper BE §17 envelopes through
`RealtimeClient`, projected into stores by `src/mocks/demoDispatch.ts`. Demo and
live mode therefore share one dispatch pathway; P5 replaces only the hub.

### D3 — Nav section moved from store state to URL
`activeNavSection` removed from `useUiStore`; sections are URL segments
(`/group/:id/:section`, `/group/:id/project/:pid/:section`). Deep links resolve
via `ObjectRedirect` routes. Store selection is synced FROM the route, never the
reverse.

### D4 — Auth session shape (pre-Supabase wiring)
Demo `/auth/login|signup` return `{ access_token, user }`. P1 will replace token
issuance with Supabase Auth sessions client-side while keeping this response
shape for profile hydration via `GET /api/v1/me`.

### Open questions for the backend stream
- Q1: Does `POST /groups/:groupId/messages` accept `client_message_id` in the
  body AND `Idempotency-Key` header, or strictly one of them? Client sends both.
- Q2: Exact payload of WS `connection.ready` beyond BE §165 metadata
  (e.g. presence snapshot?) so demo hub matches byte-for-byte.
- Q3: Confirm `sync.request(from_sequence)` response arrives as `sync.events`
  with `payload.events[]` ordered by sequence.

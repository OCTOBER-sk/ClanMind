You are Midas continuing ClanMind frontend P11 (offline sync engine). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root. Read every cited section before coding; BE md is authority on payload shapes.

STATE HANDOFF: P0-P10 committed green (369 tests). Patterns established: features/<name>/ + api/endpoints/<name>.ts + mocks/transportRoutes parity + realtime/dispatch. INTEGRATION_NOTES.md ledger D1-D24; append D25. NOTE: backend sync tables exist but BE sync endpoints are NOT yet built (audit H3) - so FE must implement the client engine against the FE spec's contract and demo-parity routes; live-mode sync will light up when Zeus builds BE endpoints (queued separately).

P11 SCOPE - grep FE spec for sync sections (offline, sync, queue, mutation log, connectivity, outbox) and read fully:
1. Offline detection + banner/indicator states per state matrix.
2. Mutation queue/outbox: enqueue failed mutations, replay on reconnect, ordering, conflict handling per spec.
3. Sync diagnostics view if specified (SyncDiagnosticsView exists from P10 - extend per spec).
4. Idempotency keys if spec requires them.
5. Demo transportRoutes parity for sync endpoints; dispatch handlers for sync events.
6. Tests: offline->online replay, queue ordering, conflict paths, connectivity transitions.
RULES (hard): no skipped/weakened tests; no dbg files; spec is authority; where BE endpoints don't exist yet, implement to FE spec contract and record honestly in D25. VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review vs cited sections + s325. Report sections covered, files changed, verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P12. Do NOT touch clanmind-backend/.
You are Midas continuing ClanMind frontend P10 (notifications). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root. Read every cited FE section before coding; when wiring any endpoint/payload, open the corresponding BE spec section and match field names/shapes exactly.

STATE HANDOFF: P0-P9 committed green (332 tests). Patterns: features/<name>/{View,useXController}.tsx + api/endpoints/<name>.ts + mocks/transportRoutes parity + realtime/dispatch wiring. INTEGRATION_NOTES.md ledger at D1-D23; append D24 for this phase.

P10 SCOPE - grep the FE spec for notification sections (notification, bell, unread, mention badge, quiet hours) and read fully before coding:
1. Notification center/panel per FE spec: list, unread states, mark-read, types (mention/reply/approval/meeting etc per spec).
2. Badges/indicators on nav surfaces per state matrix (s207-216).
3. Quiet hours / preferences if specified.
4. Wire to real BE endpoints (grep BE spec for notifications); demo transportRoutes parity; dispatch handlers for notification events.
5. Tests: render, unread flows, mark-read, flag/state matrices, payload shapes vs BE contract.
RULES (hard): no skipped/weakened tests; no dbg files; spec is authority. VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review vs cited sections + s325. Report sections covered, files changed, verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P11. Do NOT touch clanmind-backend/.
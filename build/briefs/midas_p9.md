You are Midas continuing ClanMind frontend P9 (meetings). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root. Read every cited FE section before coding; when wiring any endpoint/payload, open the corresponding section in the BACKEND spec and match field names/shapes exactly - the BE md is authority over INTEGRATION_REPORT.md summaries if they ever disagree.

STATE HANDOFF: P0-P8 committed green (298 tests). Established patterns: features/<name>/{View,Card,useXController}.tsx + api/endpoints/<name>.ts + mocks/transportRoutes parity + realtime/dispatch wiring. INTEGRATION_NOTES.md has D1-D22 ledger - append D23 for this phase.

P9 SCOPE - grep the FE spec for meeting sections (meeting_mode, scheduling, agenda, minutes) and read them fully before coding:
1. Whatever the FE spec defines under feature-flag meeting_mode (s165A gates it hidden-not-disabled): meeting scheduling UI, agenda view, in-meeting surface if specified, minutes/recap display.
2. Wire to real backend endpoints per BE spec meeting sections; demo transportRoutes parity.
3. Tests: render states, flag-gating (hidden when off), interactions, payload shapes vs BE contract.
RULES (hard): no skipped/weakened tests; no dbg throwaway files; diagnose by reading component+test together; spec is authority.
VERIFY LOOP until green at end: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review vs cited sections + s325; fix findings honestly. Report sections covered, files changed, verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P10. Do NOT touch clanmind-backend/.
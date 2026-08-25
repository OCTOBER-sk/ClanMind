You are Midas continuing ClanMind frontend P12 (settings). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root. Read every cited FE section before coding; BE md is authority on payload shapes.

STATE HANDOFF: P0-P11 committed green (377 tests). SettingsView exists (P7 added BYOK + notification prefs s278). INTEGRATION_NOTES.md ledger D1-D25; append D26.

P12 SCOPE - grep the FE spec for settings sections (s190-199 area, preferences, profile, appearance/theme, account) and read fully:
1. Complete the Settings view per spec: profile display/edit per contract, theme selection (light/dark/system), language if specified, connected accounts (GitHub/BYOK status + manage links), data & privacy section if specified, danger zone (sign out all, delete account) if specified.
2. All toggles persist per spec (local UI prefs vs server prefs - respect s11/s70 division).
3. Wire to real BE endpoints where they exist; demo parity routes otherwise.
4. Tests for every new surface: render states, toggle persistence, permission gates.
RULES (hard): no skipped/weakened tests; no dbg files; spec is authority - do not invent sections the spec doesn't define. VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review vs cited sections + s325. Report sections covered, files changed, verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P13. Do NOT touch clanmind-backend/.
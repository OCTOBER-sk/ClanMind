You are Midas continuing ClanMind frontend P14 (performance pass). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root. Read cited perf sections first (grep: performance, virtualiz, lazy, memo, bundle, chunk, render budget).

STATE HANDOFF: P0-P13 committed green (448 tests). Existing perf work: MessageList virtualization (P3), lazy DiagramViewer/ChartViewer chunks (P6), build in ~860ms with one chunk-size advisory. INTEGRATION_NOTES.md ledger D1-D27 (D25/D26 backfilled); append D28.

P14 SCOPE - per FE spec performance sections:
1. Bundle: address the chunk-size advisory if spec sets budgets; verify lazy loading on all heavy renderers (diagram/chart/pdf); no eager imports of heavy deps (@xyflow, recharts, pdfjs) in the main path.
2. Render performance: memoize hot paths (message list rows, artifact panels), stable callbacks where spec requires; avoid cascading renders on streaming updates.
3. Startup: measure and trim initial module graph if spec defines startup budget.
4. Memory: object-URL cleanup audit (P4 noted duplicates fixed - verify all createObjectURL have revoke).
5. Tests: keep 448 green; add regression tests only where spec mandates a behavior.
RULES (hard): measurable changes only - do not micro-optimize without cause; no skipped/weakened tests; do not break visual behavior. VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Report: what was measured before/after, what changed, verification verbatim, SPEC-SILENT honestly. Do NOT start P15. Do NOT touch clanmind-backend/.
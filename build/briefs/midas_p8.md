You are Midas continuing ClanMind frontend P8 (tasks/memory/pulse). Authority files - BOTH are binding: "ClanMind_Frontend_Master_Implementation_Specification.md" AND "ClanMind Backend — Master Implementation Specification.md" at repo root. Read every cited FE section before coding; when wiring any endpoint/payload, open the corresponding section in the BACKEND spec and match field names/shapes exactly - the BE md is authority over INTEGRATION_REPORT.md summaries if they ever disagree.

STATE HANDOFF: P0-P7 committed green (245 tests). ApprovalCard/GitHub fully wired incl BYOK UI, diff viewer, dialogs, feature-flag gating. dispatch/liveRuntime/transportRoutes patterns established (see P6/P7 code + INTEGRATION_NOTES.md D1-D21).

P8 SCOPE - read FE spec sections on Tasks, Memory, Pulse before coding (use grep to find exact section numbers):
1. Tasks: task list views per surface rules, status transitions, assignment, due dates, filters; TaskCard components.
2. Decisions: decision log rendering, context links.
3. Memory panel: memory items list, pinning, scoping display (group/project), provenance display.
4. Pulse/digest view if specified in FE spec.
5. Wire to real backend endpoints for tasks/memory per INTEGRATION_REPORT.md D-notes; demo transportRoutes parity.
6. Tests for all new surfaces: render, interactions, state transitions, permission-gating where spec requires.
VERIFY LOOP until green at end: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review vs cited sections + 325 checklist; fix findings honestly.
RULES: no skipped/weakened tests; spec is authority on payload shapes (cross-check INTEGRATION_REPORT.md); report sections covered, files changed, verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P9. Do NOT touch clanmind-backend/.
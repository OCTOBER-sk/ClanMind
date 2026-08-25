You are Midas continuing ClanMind frontend P2 (responsive desktop layout, FE spec section 13). Your authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root - build only what it specifies.

STATE HANDOFF (previous session completed these UNCOMMITTED changes in clanmind-frontend/, verified working tree):
- src/hooks/useLayoutMode.ts NEW - breakpoint controller (>=1440 three-pane / 1200-1439 compressed / 900-1199 two-pane / <900 single+sheet) per section 13
- src/design-system/components/Sheet.tsx NEW - sheet primitive for sub-900 right-surface-as-sheet behavior
- src/design-system/index.ts, src/index.css, src/state/useUiStore.ts MODIFIED - ui prefs now persist lastGroupId / lastProjectIdByGroup / recentGroupIds per section 195

YOUR JOB THIS RUN:
1. Finish P2 exactly where it stopped: restructure LeftNav per sections 17 + 20 + 303 (role-aware affordances, collapsible rail when narrow), wire AppShell to useLayoutMode (right artifact surface becomes Sheet under 900, left rail collapsible, composer stays anchored bottom per section 13), keep PanelResizer keyboard-resize intact (section 220).
   IMPORTANT: all file paths you write must resolve INSIDE clanmind-frontend/ - the previous session failed a write with a malformed external path.
2. Run the full verification loop until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build; purity grep dist for grp_robotics_1|user_arun_1|Robotics Core Team|mockAiService must be clean.
3. Self-review your full diff vs FE sections 12-13, 17, 20, 195, 220, 249, 303 and fix findings.
4. Report: spec sections covered, files changed, verification results verbatim, checklist items from section 320+ now relevant-and-passing, anything SPEC-SILENT or NOT VERIFIED.
Do NOT start P3. Do NOT touch clanmind-backend/.

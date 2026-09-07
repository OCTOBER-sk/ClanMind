# Phase 7-A: Command Palette and ActivityView

**Context Recap:**
We are in Phase 7 of the ClanMind M3 migration. The previous phases (0-6) have successfully restyled the core shell, primitives, and major view components (chat, composer, artifact, memory, team).
We need to implement the CommandPalette (§14.7) and ActivityView (§14.16) surfaces.

**Task:**
Implement the CommandPalette component (trigger `Cmd+K`, searchable actions list) and the ActivityView (timeline of user activity).

**Assertions:**
1. CommandPalette opens with `Cmd+K`, matches UI token spec, filters actions.
2. ActivityView displays recent activity stream.
3. No new build errors or test failures.

**Instructions:**
1. Implement the requested components.
2. Run build + test suite.
3. Compare test failures vs baseline (docs/m3-baseline.txt).
4. Report changes and stop.

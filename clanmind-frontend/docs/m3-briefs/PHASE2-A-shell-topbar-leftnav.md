# Phase 2-A — M3 restyle: TopBar + LeftNav (shell chrome)

Context: M3 tokens in src/index.css; Phases 0-A/0-B/1-A/1-B committed (git log). Read src/index.css @theme for utility names, docs/M3_MIGRATION_SPEC.md §14.0 (shell) and §12.1. Prerequisite commit: b2ad1a6.

SCOPE: ONLY src/features/shell/TopBar.tsx, src/features/shell/LeftNav.tsx (+ their existing test files TopBar.meeting.test.tsx, LeftNav.test.tsx if they assert old classnames). Do NOT touch AppShell.tsx, PanelResizer.tsx, SyncBanner.tsx, src/design-system/**, or any state/realtime/sync/local/hooks files. Keep ALL exports, props (TopBarProps, LeftNavProps), React.memo, and behavior intact — AppShell imports both unchanged.

HARD COMPAT: button/icon-button variant values in use across repo (must keep working via Phase 1-A alias map — do NOT rename call-site variants): ghost×64, primary×42, outline×22, text×15, neutral×12, danger×12, spectral×8, success×2, warning×1, secondary×1, info×1.

KEY SPEC POINTS (§14.0):
- TopBar: level 0, bg surface, bottom hairline outline-variant. Content order: ClanMind · Group ▸ Project · Search (Ctrl+K) · sync · notifications · profile. Group/Project switchers = M3 menus (§12.1: surface-container-high, shadow-2, corner-xs, 40px items).
- LeftNav ≥1200px = navigation drawer: icon+label, active item = secondary-container pill, corner-full. 900–1199px = navigation rail: icon-only + tooltips. <900px = sheet/hamburger mode (trigger lives in TopBar or AppShell — keep existing props controlling mode, just restyle). Sections Projects (active/other), Team, Garage, Activity, Settings — flat.
- State layers via color-mix overlays, not new bg colors. ZERO raw hex/px colors. focus-ring token on all interactive elements. Reduced-motion aware transitions.

VERIFY: pnpm build green; pnpm test — no new failures vs docs/m3-baseline.txt (current: 28 failed / 516 passed). Adapt classname assertions only; keep behavior assertions. Report files changed + test diff in ≤5 lines, then STOP.

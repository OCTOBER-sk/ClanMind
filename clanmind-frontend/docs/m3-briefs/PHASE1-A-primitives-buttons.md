# Phase 1-A — M3 restyle: Button, IconButton, FAB, Badge, Avatar, Tooltip, Chip

Context: M3 token foundation is LIVE in src/index.css (Phases 0-A/0-B, commits e148212, ef66e41) — `--md-*` role vars both themes, Tailwind utilities like `bg-surface-container-high`, `text-on-surface-variant`, `rounded-*`, `duration-*`; `.material-symbols-rounded` class available; JS token bridge in src/design-system/tokens/index.ts. Read src/index.css @theme block to see available utility names before writing classes.

Read docs/M3_MIGRATION_SPEC.md §12.1 (component specs), §4.4 (state layers), §7 (shape), §9 (density/icons).

SCOPE (this chunk ONLY these files under src/design-system/components/): Button.tsx, IconButton.tsx, Badge.tsx, Avatar.tsx, Tooltip.tsx + NEW Chip.tsx + NEW Fab.tsx if none exists (check imports in features/ first — if features import Button/IconButton variants, keep those variant prop names working via compat mapping, do NOT edit feature files).

RULES:
- Variants per §12.1 (filled/tonal/outlined/text/elevated/destructive/spectral); old variant names alias to new so feature code compiles unchanged.
- State layers §4.4 via color-mix overlay pseudo-element; disabled 38%/12%; focus-ring token; heights 32/40/48; IconButton 40px hit area.
- NO raw hex/px anywhere — tokens/utilities only. NO changes to props/ref APIs or Radix wiring.
- Do not touch src/api/, src/state/, src/realtime/, src/sync/, src/local/, src/hooks/, src/config/, src/tauri/, use*Controller.ts.

VERIFY: `pnpm build` green; `pnpm test` — no new failures vs docs/m3-baseline.txt (28-fail baseline). Update or add component tests only if an existing test asserts old variant classnames (adapt minimally, keep the behavior assertion). Report files changed + test diff, then STOP.

# Phase 1-B — M3 restyle: Input, Textarea, Select, Dropdown, ContextMenu, Checkbox, Switch, Tabs, Dialog, Sheet, Toast, Progress, Skeleton, ScrollArea, Popover

Context: M3 tokens live in src/index.css; Phases 0-A/0-B/1-A committed (see git log). Read src/index.css @theme for utility names; read docs/M3_MIGRATION_SPEC.md §12.1 for each component's exact M3 identity, §4.4 state layers, §7 shape map, §9 density.

SCOPE: ONLY files in src/design-system/components/ for the components listed above. Keep every existing prop/ref/Radix API and export name — features compile unchanged (grep feature usages first; where a prop value like size/variant differs from M3 naming, add compat aliases like Phase 1-A did).

KEY SPEC POINTS:
- Outlined text field: label floats to notched position on focus/fill; focus = primary border 2px; invalid = error + helper text; corner-extra-small; filled variant for search. States §216.
- Menus (Dropdown/ContextMenu/Select content): surface-container-high, shadow-2, corner-xs container, 40px items, leading-icon slot, state-layer rows, selected = secondary-container.
- Switch = M3 track+handle, handle grows when on, optional check; Checkbox corner-xs primary fill.
- Tabs: title-small labels, 3px primary active indicator sliding with ease-emphasized, state-layer hover.
- Dialog: surface-container-high, corner-large, shadow-5, scrim 60%, scale-in 220ms; Sheet: corner-large leading edges, slide 360ms decel-in/accel-out.
- Toast/Snackbar: inverse-surface, single line + optional action, corner-xs.
- Progress: linear + circular + new M3 Expressive shape-morph loading indicator component (MorphingSpinner) exported for Phase 4; wavy determinate variant.
- Skeleton: surface-container shimmer, NOT spectral. ScrollArea thumb outline-variant→outline hover.
- ZERO raw hex/px color values; state layers via color-mix overlays; focus-ring token on all.
- Do not touch src/api/, src/state/, src/realtime/, src/sync/, src/local/, src/hooks/, src/config/, src/tauri/, use*Controller.ts, or feature files.

VERIFY: pnpm build green; pnpm test — no new failures vs docs/m3-baseline.txt (28-fail). Adapt existing component tests ONLY if they assert old classnames; keep behavior assertions intact. Report files changed + test diff, then STOP.

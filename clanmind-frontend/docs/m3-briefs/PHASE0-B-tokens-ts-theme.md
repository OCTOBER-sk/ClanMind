# Phase 0-B — tokens/index.ts rewrite + theme controller + local fonts/icons

Prerequisite: Phase 0-A landed — src/index.css now defines `--md-*` role vars, `@theme` Tailwind mapping, light in `:root`, dark in `.dark` (base #000000). Read src/index.css first to see actual variable names.

Read docs/M3_MIGRATION_SPEC.md §3-§11 for values; §11 for the tokens contract; §6/§9 for fonts and icons.

TASK (this chunk only):
1. Rewrite src/design-system/tokens/index.ts: export the same M3 roles as JS constants that READ the CSS vars at runtime (getComputedStyle on documentElement, resolved per current theme) so recharts/@xyflow/canvas/inline styles theme correctly in both modes (spec §11 rule 2). Keep the module's existing export names working where other files import them (grep `from '.*tokens'` first; add compat re-exports, do not edit the consumers).
2. Theme controller: ensure an existing mechanism toggles `.dark` on <html> for light/dark/system per spec §11 rule 3. Look at how theme is currently applied (grep for 'dark' class toggling, useTheme, settings store). Wire system mode to prefers-color-scheme with a live listener. Persist choice via the EXISTING settings/store mechanism — do NOT create new state plumbing or touch src/state/ internals beyond consuming existing APIs.
3. Fonts: bundle locally for Tauri offline (spec §6): Roboto Flex (or Inter fallback already in repo), Roboto Mono, and Google Sans Text substitute if available offline — otherwise rely on fallback stack. Add @font-face rules in index.css referencing files under src/assets/fonts/ (download woff2 via npm packages @fontsource/roboto-flex @fontsource/roboto-mono if network allows; if download fails, use existing fonts and say so).
4. Material Symbols Rounded: install @material-symbols/font-400 (npm) OR download the woff2; add @font-face + .material-symbols-rounded CSS class in index.css. Do NOT migrate component icons in this chunk (Phase 1 adds the <Icon> wrapper).
5. Extend src/design-system/tokens.a11y.test.ts (or add a new test file) to programmatically verify EVERY text/bg role pair from spec §4.2 and §4.3 meets WCAG 2.2 AA (4.5:1 normal, 3:1 large) in BOTH themes by parsing the CSS values. NOTE: the existing a11y test currently FAILS on --color-text-tertiary (pre-existing baseline) — your new tests plus the compat aliases must leave that baseline test either green via aliases or explicitly superseded by the new role tests; never delete existing assertions.

VERIFY: `pnpm build` exits 0; `pnpm test` has no NEW failures vs docs/m3-baseline.txt; report files changed, test diff, font/icon status. Then STOP.

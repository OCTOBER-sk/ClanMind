# Phase 0-A — M3 token foundation in src/index.css (clanmind-frontend)

You are doing a PRESENTATION-LAYER rebuild per docs/M3_MIGRATION_SPEC.md (repo root). Read §3, §4, §5, §6, §7, §8, §9, §11 of that spec file FIRST — they contain exact hex values, role mappings, state-layer opacities, shape/motion/type values. Use the spec as the source of truth; do not invent values.

TASK (this chunk only):
1. Rewrite src/index.css to the §11 structure: `@import "tailwindcss"` then `@theme` block mapping Tailwind color/radius/duration/easing utilities to `--md-*` CSS custom properties; then `@layer base` with `:root` = LIGHT role values (spec §4.3) and `.dark` = DARK role values (spec §4.2, base surface/background = #000000 hard requirement).
2. Include ALL roles: 26 core M3 + surface-container tiers (7) + ClanMind extensions (success/warning/info sets + focus-ring) + state-layer opacity tokens (§4.4) + shadow elevation tokens (§5) + spacing scale 4..48 (§9) + type-scale custom properties (§6, sizes/lh/tracking) + motion tokens (§8 easings + durations 100/150/220/360ms + springs).
3. Expose every §4 role as a Tailwind `--color-*` token so `bg-surface-container-high`, `text-on-surface-variant`, etc. resolve.
4. PRESERVE existing rules in the current src/index.css that are NOT colors: .selectable-text, Tauri drag-region, scrollbar rules (restyle scrollbar thumb to outline/outline-variant), any keyframes still referenced elsewhere. Read the current file before rewriting.
5. Keep the existing `.dark` toggling mechanism used by the app (check how `.dark` is currently applied — src/main.tsx / App.tsx / theme hook) — do NOT change JS/TS files in this chunk.
6. Do NOT touch feature components in this chunk. Do NOT touch src/api/, src/state/, src/realtime/, src/sync/, src/local/, src/hooks/, src/config/, src/tauri/.

CONSTRAINTS:
- The repo currently has 30 pre-existing test failures (baseline in docs/m3-baseline.txt). Your chunk must not add NEW test-file failures; the app must still compile.
- If src/design-system/tokens/index.ts or components reference OLD CSS variables you are removing, ADD the old variable names as aliases pointing at the new roles so nothing breaks mid-migration (alias block with a `/* M3 migration aliases — remove in Phase 8 */` comment).

VERIFY before reporting (run these, fix until done):
- `pnpm build` exits 0
- `pnpm test` — compare failures against docs/m3-baseline.txt; no new entries allowed
Report: files changed, aliases added, build result, test diff vs baseline. Then STOP.

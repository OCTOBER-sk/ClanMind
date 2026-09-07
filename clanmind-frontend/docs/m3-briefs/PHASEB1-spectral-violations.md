# Phase B-1 — Remove permanent rainbow + indefinite spectral pulses (3 §10 violations)

Read docs/M3_MIGRATION_SPEC.md §10 (spectral gradient rules) FIRST. Spec §10 FORBIDS: (a) permanent rainbow on screen, (b) indefinite pulse on any loading state, (c) permanent gradient strips. Fix these THREE real violations in these EXACT files:

1. **src/features/auth/AuthScreen.tsx:65** — replace the `<div className="h-px w-32 spectral-active rounded-full opacity-60" />` decorative gradient strip with a static M3 role — use a `border-t border-outline-variant` or a single `h-px bg-outline-variant w-32 rounded-full`. The first-launch hero (spec §14.1) allows EXACTLY ONE spectral moment, and the wordmark line is it; a static divider underneath is fine, but no permanent gradient.

2. **src/features/meetings/MeetingActiveHeader.tsx:42** — the meeting dot `<span className="w-2.5 h-2.5 rounded-full spectral-active animate-pulse" />` violates spec §14.12 which says "the meeting dot uses `error`/live red, not spectral". Change `spectral-active` → `bg-error` (or `bg-[var(--md-error)]` if the utility isn't exposed), and REMOVE `animate-pulse` (indefinite pulse = §10 violation). Keep the dot a single round element, no animation; the live red color itself signals activity.

3. **src/design-system/components/Progress.tsx:47** — the wavy variant has `after:animate-[spectral-sweep_800ms_linear_infinite]` which is an INFINITE spectral pulse (§10 violation). Change to ONE-TIME sweep (e.g. `animate-[spectral-sweep_800ms_ease-out_1]`) OR remove the spectral layer entirely and rely on the existing primary fill. If kept, ensure `motion-reduce:animate-none` already gates it (verify line above and keep that hookup).

CONSTRAINTS:
- Token-only — use `bg-error` / `bg-outline-variant` / existing utilities. NO new hex/px.
- Do not touch any other file.
- Preserve existing layout / spacing / className structure where possible.

VERIFY: `pnpm build` green; `pnpm test` — no new failures vs docs/m3-baseline.txt (28-fail baseline). Report files changed + line numbers + test diff, then STOP.

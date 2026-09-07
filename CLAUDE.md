# ClanMind — Claude Code Operating Context

> **Read this first.** Atom (Hermes Agent) generated this per GHOST-PROTOCOL rule 4. All Claude Code sessions for this project start here. Sandy (project owner) approved this workflow on 2026-09-07.

## Project routing (Sandy's standing rule, 2026-09-06)

- **Frontend work (UI/UX, components, design system, visual polish)** = **OpenDesign workflow → Claude Code engine**, SERIAL only.
- **Backend work** = Claude Code direct, SERIAL only.
- **Both in same feature** = Backend Claude Code writes spec/MD FIRST, THEN OpenDesign frontend. NEVER parallel (20 RPM OpenRouter free-tier ceiling; parallel = 429 storm).

## Source of truth — read in this order

1. **`/home/santhosh/projects/ClanMind/clanmind-frontend/docs/M3_MIGRATION_SPEC.md`** — §810-line M3 Expressive spec, authoritative for ALL visual / UX / token decisions. Sections 3–10 are the token system; §14 enumerates every surface; §17 is the phased plan.
2. **`/home/santhosh/projects/ClanMind/clanmind-frontend/docs/FRONTEND_TODO.md`** — current outstanding TODOs, ranked.
3. **`/home/santhosh/projects/ClanMind/clanmind-frontend/docs/FRONTEND_AUDIT2_REPORT.md`** — current surface quality audit.
4. **`/home/santhosh/projects/ClanMind/clanmind-frontend/docs/m3-baseline.txt`** — 30-fail test baseline (do not regress; new failures = STOP).
5. **`/home/santhosh/projects/ClanMind/clanmind-frontend/docs/m3-briefs/PHASE*.md`** — phased briefs (Phase 0-A through 8-A complete; Phase B-1 / B-2 / 9 in scope).
6. **`/home/santhosh/projects/ClanMind/ClanMind_Frontend_Master_Implementation_Specification.md`** — product behaviour spec (cites as **FE §n**).
7. **`/home/santhosh/projects/ClanMind/ClanMind Backend — Master Implementation Specification.md`** — backend contract (cites as **BE §n**).

## Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind v4 + Radix UI primitives + Material 3 Expressive tokens (NOT MUI, NOT material-web — see spec §1 rationale).
- **Backend**: Hono on Cloudflare Workers (`clanmind-backend/apps/worker/`) + Supabase Postgres + D1/R2 + OpenRouter inference + Tavily research.
- **Desktop**: Tauri 2 wrapper (Phase 9+ only; web-mode verification first per standing rule).
- **Tests**: vitest 4.1.11, @testing-library/react. **Baseline: 30 fail / 458 pass / 488 total**, 13 files failing.
- **Lint**: oxlint (`pnpm lint` exit 0 even with warnings; count `error:` lines).
- **Typecheck**: `tsc -b` (must be 0 errors).
- **Build**: `pnpm build` (Vite 8.2.2, must be exit 0; warnings OK).

## Standing rules (Sandy, 2026-09-07)

1. **HANDS-OFF execution** — Atom fires the brief once. Agent works autonomously. No mid-task permission prompts, no babysitting, no split batches.
2. **Auto-mode safety** — `--dangerously-skip-permissions --max-budget-usd 0 --max-turns 200 --add-dir /home/santhosh/projects/ClanMind --add-dir /tmp/od-new`. $0 budget (`:free` slug only).
3. **Never pass `--model`** unless the slug ends `:free` AND Atom has pre-verified `openrouter.ai/api/v1/auth/key` shows no charge. Verify pre AND post.
4. **Dark theme base = `#000000`** pure black. Hard requirement (spec §4.2, M3 tonal elevation backbone).
5. **Token-only changes** — every color / radius / spacing / duration / type must come from `var(--md-*)` or `src/design-system/tokens/`. NO hex, NO px font-size, NO ad-hoc cubic-bezier outside the token system.
6. **Never touch `src/api/`, `src/state/`, `src/realtime/`, `src/sync/`, `src/local/`, `src/hooks/`, `src/config/`, `src/tauri/`, `use*Controller.ts`** except to consume existing outputs. Presentation-layer rebuild.
7. **Spectral discipline (§10)** — exactly 6 allowed contexts for `spectral-active` / `spectral-border` / `odin-working`: Odin Avatar, AiStatusIndicator, ArtifactPanel/DiagramViewer construction, ProjectPulse, selected node, onboarding (Auth/Onboarding). NO permanent rainbow, NO indefinite pulse on loading, NO permanent gradient strips. NO `animate-pulse` on loading states.
8. **WCAG 2.2 AA** — `tokens.a11y.test.ts` 92 tests must pass. `motion-reduce:` hooks required on every animation.
9. **No secrets in code** — Supabase URL/publishable key + service_role JWT live ONLY on the VPS in `clanmind-frontend/.env` and `clanmind-backend/apps/worker/.dev.vars` (both gitignored). GitHub push-protection has blocked probe scripts with real keys; those stay untracked forever.
10. **Git push via SSH** — VPS has no GitHub HTTPS creds. After clone, `git remote set-url origin 'git@github.com:OCTOBER-sk/ClanMind.git'`, then `GIT_TERMINAL_PROMPT=0 git push origin main`. Verify with `git ls-remote origin main`.

## Architecture rules (M3 Expressive, verified 2026-09-07)

- **Tonal palettes (HCT)**: 6 ramps — Primary (#4285F4 hue ≈284), Secondary (muted), Tertiary (cyan #00B8D4), Neutral (C≈2, surface backbone), Neutral-variant (C≈6, outlines), Error (canonical M3 red), plus Success/Warning/Info extensions. Roles defined in §3.
- **Color roles (26 + extensions)**: every component consumes a semantic role — `primary`, `on-primary`, `primary-container`, `surface-container-*`, `outline`, `outline-variant`, `inverse-*`, `scrim`, `shadow`, `success`/`warning`/`info` aliases. NEVER a tone directly.
- **State layers** — hover/focus/press = tinted overlay at fixed opacity over the base color, NOT a different color. Tooltip: 16%, Hover: 8%, Focus: 12%, Pressed: 12%.
- **Tonal elevation** — dark elevation expressed by lighter `surface-container` tones, not shadows. `surface-container-lowest` → `surface-container-highest` is the elevation backbone.
- **Type scale** — Display/Headline/Title/Body/Label × Large/Medium/Small with M3 sizes/line-heights/tracking.
- **Shape scale** — none→full corner tokens by component category, M3 Expressive's larger/more varied radii.
- **Expressive motion** — spring-based spatial motion + standard easing set, mapped onto the spec's duration budget (micro 100ms, standard 220ms, close 150ms).
- **No `animate-pulse` on any loading/skeleton/state affordance.** Wavy progress uses `animate-[spectral-sweep_800ms_ease-out_1]` (one-shot) with `motion-reduce:animate-none`.

## Quality bar (spec §1)

> Nothing generic, nothing childish, no default-template look. Every screen reads as a professional, AI-native team tool — disciplined like Linear, calm like a good IDE, expressive only when Odin or an artifact is actively doing work. A screen that looks like a stock Material template or a Slack clone has failed.

**Reference design systems** (for visual proof, NOT retheme): `apple-hig` skill (HIG principles — hierarchy, clarity, typography), `frontend-design`, `impeccable-design-polish`, `redesign-skill` — all available under `/tmp/od-new/skills/`.

## Project layout

```
ClanMind/
├── CLAUDE.md                              <-- this file
├── clanmind-frontend/
│   ├── .open-design.json                  <-- OpenDesign binding
│   ├── docs/
│   │   ├── M3_MIGRATION_SPEC.md           <-- §810 spec, source of truth
│   │   ├── FRONTEND_TODO.md               <-- outstanding work, ranked
│   │   ├── FRONTEND_AUDIT2_REPORT.md      <-- current surface audit
│   │   ├── m3-baseline.txt                <-- 30-fail test baseline
│   │   ├── m3-briefs/PHASE*.md            <-- phased briefs (0–8 complete, B-1/B-2/9 in scope)
│   │   ├── screenshots/m3-final/          <-- 1440×900 + 1280×1024 Playwright shots
│   │   └── screenshots/uiux/             <-- §312 surfaces
│   ├── scripts/
│   │   ├── capture_all.py                <-- Playwright headless capture
│   │   ├── capture.py
│   │   ├── capture_more.py
│   │   └── visual-audit.py
│   ├── src/
│   │   ├── design-system/                <-- tokens + components (TOUCH OK)
│   │   ├── features/                     <-- auth/chat/decisions/tasks/... (TOUCH OK)
│   │   ├── api/ | state/ | realtime/ | sync/ | local/ | hooks/ | config/ | tauri/  <-- DO NOT TOUCH
│   │   ├── App.tsx | main.tsx | index.css  <-- TOUCH OK only at root
│   │   ├── test/ | live/ | mocks/ | types/ | assets/ | app/
│   │   └── ...
│   ├── package.json
│   ├── pnpm-lock.yaml
│   └── .env                              <-- gitignored, Supabase URL + publishable key
├── clanmind-backend/
│   ├── apps/worker/                      <-- Cloudflare Worker (Hono + D1/R2 + Supabase + OpenRouter + Tavily)
│   └── ...
└── docs/
    ├── FINAL_AUDIT.md
    ├── FINAL_PREKEY_VERIFICATION.md
    ├── INTEGRATION_REPORT.md
    └── live/                             <-- E2E proof artifacts
```

## Verification (Atom will run after Claude exits)

1. **Spend delta** — `python3 /home/santhosh/scripts/or_credit.py "$KEY" /tmp/or_after.txt`; diff `/tmp/or_before.txt` vs `/tmp/or_after.txt`. Delta MUST be `$0.00` (`:free` slug).
2. **Build** — `cd /home/santhosh/projects/ClanMind && pnpm --filter clanmind-frontend build` — exit 0.
3. **Lint** — `pnpm --filter clanmind-frontend lint` — count `error:` lines; target 0.
4. **Tests** — `pnpm --filter clanmind-frontend test 2>&1 | tee /tmp/test.txt` → compare failing tests to `docs/m3-baseline.txt` (30 fail baseline). `comm -13` of baseline-sorted vs current-sorted must be empty (zero new failures).
5. **a11y tokens** — `pnpm --filter clanmind-frontend exec vitest run src/design-system/tokens.a11y.test.ts` — 92 PASS.
6. **Visual proof** — `python3 scripts/capture_all.py` against `pnpm --filter clanmind-frontend dev` on `:1420` (VPS, headless Chromium via Playwright). Output → `docs/screenshots/<phase>/`. Per-viewport @page WeasyPrint PDF acceptable as fallback if headless Chromium blocks (`libnspr4.so` may be missing).
7. **Git state** — meaningful commits with conventional messages, `git status` clean of unstaged source files, `git ls-remote origin main` shows new SHA after push.
8. **No new spectral violations** — `grep -rn "spectral-active|spectral-border|odin-working" src/` returns the same 6 allowed contexts Phase 8-A counted; no `animate-pulse` outside disabled contexts.

## Forbidden

- `--model` flag without `:free` suffix.
- `pnpm install` without `--prefer-offline --reporter=silent --reporter=silent` (OOM risk on this 6 GB VPS).
- Touching `src/api/`, `src/state/`, `src/realtime/`, `src/sync/`, `src/local/`, `src/hooks/`, `src/config/`, `src/tauri/`, `use*Controller.ts`.
- Hardcoded hex / px font-size / ad-hoc duration outside the token system.
- `animate-pulse` on any loading/skeleton/state affordance.
- Permanent rainbow / indefinite gradient strips / permanent spectral decorative strips outside AuthScreen hero.
- Secrets in committed code (Supabase service_role, JWT secret, OpenRouter keys, Tavily keys, BYOK, CF tokens).
- Parallel `claude -p` calls.
- `--max-budget-usd` above 0.
- Parallel agents / concurrent Claude Code instances.
- Tauri wrapping before web-mode verification passes (1 account = Tauri webview holds only 1 account).

## When you hit `max-turns`

Write `PROGRESS.md` with: files changed, files in-flight, gates run, what's left. Exit. Atom will dispatch a fresh continuation session that reads `PROGRESS.md` and resumes from the next file. **Don't blindly chain `--continue`** — fresh dispatch with a tightened prompt (shorter recap, fewer file reads) usually completes the remaining work in one shot.

## Emergency stop signals (STOP and report, do not work around)

- `pnpm build` fails and the fix is non-trivial.
- Test failure count grows above baseline (new regressions).
- `pnpm install` blocks > 5 min.
- A change to `src/api/`, `src/state/`, `src/realtime/`, `src/sync/`, `src/local/`, `src/hooks/`, `src/config/`, `src/tauri/`, `use*Controller.ts` would be required.
- Token system conflict — a feature needs a value that the M3 spec doesn't provide. Surface to Atom/Sandy.

---

**Generated by Atom (Hermes Agent) on 2026-09-07 per GHOST-PROTOCOL rule 4. Update at every phase completion.**
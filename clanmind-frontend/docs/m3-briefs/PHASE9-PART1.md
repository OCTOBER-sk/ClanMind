# Phase 9 — Peak Visual Polish + Audit Fixes

PROJECT ROOT: /home/santhosh/projects/ClanMind
MODEL: poolside/laguna-s-2.1:free

PREREQUISITE: Phase B-2 must be committed + pushed first. Verify HEAD advanced past b77eecf before starting.

SOURCE OF TRUTH:
  1. /home/santhosh/projects/ClanMind/clanmind-frontend/docs/M3_MIGRATION_SPEC.md (810 lines, M3 Expressive — authoritative for visuals/UX/tokens)
  2. /home/santhosh/projects/ClanMind/clanmind-frontend/docs/FRONTEND_TODO.md (652 lines, master TODO)
  3. /home/santhosh/projects/ClanMind/clanmind-frontend/docs/FRONTEND_AUDIT2_REPORT.md (613 lines, honest audit with file:line evidence)
  4. /home/santhosh/projects/ClanMind/clanmind-frontend/docs/m3-baseline.txt (30-fail baseline — DO NOT regress)
  5. /home/santhosh/projects/ClanMind/CLAUDE.md (standing rules, verification contract, forbidden patterns — READ FIRST)

QUALITY BAR (spec §1):
  Nothing generic, nothing childish, no default-template look. Every screen reads as a professional, AI-native team tool — disciplined like Linear, calm like a good IDE, expressive only when Odin or an artifact is actively doing work. A screen that looks like a stock Material template or a Slack clone has failed.

REFERENCE (for visual QA, NOT retheme):
  - /tmp/od-new/skills/apple-hig/SKILL.md — Apple HIG principles (hierarchy, clarity, typography). Apply through M3 tokens, don't copy palettes.
  - /tmp/od-new/skills/frontend-design/SKILL.md
  - /tmp/od-new/skills/impeccable-design-polish/SKILL.md
  - /tmp/od-new/skills/redesign-skill/SKILL.md

STANDING RULES (from CLAUDE.md):
  - Token-only: var(--md-*) or src/design-system/tokens. NO hex, NO px font-size, NO ad-hoc cubic-bezier outside tokens.
  - Dark theme base = #000000. Hard requirement.
  - NO animate-pulse on loading/skeleton/state. Use one-shot keyframes with motion-reduce gates.
  - WCAG 2.2 AA. tokens.a11y.test.ts 92 PASS required.
  - DO NOT touch: src/api/, src/state/, src/realtime/, src/sync/, src/local/, src/hooks/, src/config/, src/tauri/, use*Controller.ts (only consume outputs).
  - Exceptions documented in M3_DEVIATIONS.md: (a) 0.12/7.16 dispatch.ts privacy fix, (b) 3.6 outbox.ts multi-window wrap.
  - Git push via SSH: git remote set-url origin 'git@github.com:OCTOBER-sk/ClanMind.git'; GIT_TERMINAL_PROMPT=0 git push origin main. Verify with git ls-remote origin main.
  - Conventional commits: feat(m3): / fix(m3): / docs(m3): / refactor(m3): prefixes.
# ClanMind UI/UX Deep-Refinement Round — Orchestration Plan (Atom)

**Directive:** build/directives/UIUX_REFINEMENT_DIRECTIVE.md (3,123 ln) — Deep UI/UX Refinement & Visual System
**Authorities:** Be → FE Master Specs (both read in full), FE spec = UX truth, BE spec = contracts truth
**Routing:** midas @ opencode-go/ox-alpha-free → fallback mimo-v2.5 (Go 503 on 2026-08-25)
**Verification:** live vite dev (:1420, demo mode) + screenshots; tests/tsc/lint per agent; commit+push per phase

## North star (directive s5.2)
Black & white are the language; spectral is the event. True-black dark, white light, no persistent blue, red semantic, spectral only for AI activity. Calm at rest, alive during meaningful AI/artifact work.

## Agent program (sequential, Atom owns integration / shared component system)
| Agent | Scope | Directive s | Key files |
|---|---|---|---|
| A | Design system: tokens, true-black theme, type, icons, primitives | 5–15 | index.css, tokens/index.ts, design-system/components/* |
| B | Shell: top bar, left nav, three-region, responsive | 16–20 | features/shell/*, app/router+nav |
| C | Chat: messages, composer, reactions, threads, mentions, private | 22–30, 48 | features/chat/* |
| D | Odin/AI: states, streaming, tool timeline, research, quota/error | 44–49, 72 | features/ai/* + chat AI message |
| E | Artifacts: work surface, canvas alignment (HARD), viewers | 37–43, 69, 85–86 | features/artifacts/* |
| F | Garage, Team, Tasks, Decisions, Memory, Pulse | 21, 35–36, 50–51 | features/{garage,team,tasks,decisions,memory,projects}/* |
| G | Meetings, GitHub, approvals (generalized), notifications, settings, auth | 32–34, 52–56 | features/{meetings,github,approvals,notifications,settings,groups,auth,onboarding}/* |
| H | Offline/sync/conflict, a11y, error boundaries, reduced-motion, privacy-in-state | 57–60, 63–68, 77, 82–99 | features/sync/*, app/*ErrorBoundary* |

## Protocol per phase
1. brief → build/prompts_uiux/agent_X.txt (crystal-clear, real file paths, ≤~5KB)
2. dispatch `opencode run --agent midas "$(cat brief)" -f directive` (JSON log to /tmp/agentX.log)
3. ox-alpha-free 503 → re-dispatch with `--model opencode-go/mimo-v2.5`
4. VERIFY PHYSICALLY: git status + diff stat + tests + tsc + lint (never trust exit code / agent report)
5. one targeted fix round via `-c` if needed; commit+push, confirm remote advanced
6. report to Sandy

## QA gates
- tests green · tsc · lint · no new deps · no API/contract breaks · true-black/white · spectral restraint · screenshots of every major screen at 1440 + narrow · artifact geometry verified on rendered app · a11y (focus, announce, contrast, reduced-motion)

## Final deliverable
All screenshots captured to docs/screenshots/uiux/ + delivered to chat. Repo committed + pushed. Handoff of final visual state via the rendered app at multiple widths.
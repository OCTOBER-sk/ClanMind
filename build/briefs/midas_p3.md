You are Midas continuing ClanMind frontend P3 (chat realtime core). Your authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root - build only what it specifies. Read EVERY section this phase touches before coding.

STATE HANDOFF: P0/P1/P2 all committed and green (58 tests passing). Live mode is wired to real backend contracts via src/live/liveRuntime.ts + shared src/realtime/dispatch.ts. Demo mode stays behind compile gate.

P3 SCOPE (from FRONTEND_BUILD_BIBLE section 8 + the FE spec sections it cites):
1. TanStack Query message pages + @tanstack/react-virtual chat virtualization (spec 202/289: stable keys, preserved scroll anchors, cursor-load older messages, 10k+ target) - already a dependency.
2. Promote the demoDispatch pattern to production src/realtime/dispatch.ts usage across live path; wire server sequence tracking + gap detection -> sync.request recovery (spec 17.1/186A).
3. Mentions caret-tracking fix (spec 60): picker tracks caret, stays in viewport, repositions on resize.
4. /private recipient chooser (spec 55): unmistakable privacy header state per 55/58, recipient visible, no accidental public send on stale selection.
5. Threads in right work surface (spec 30): original + replies + composer, Esc closes with focus restore.
6. Private-leakage automated test: assert PRIVATE content never renders into GROUP-scope stores/views (spec 2 product rules + 176).

VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep. Self-review full diff vs every cited spec section; fix findings. Report sections covered, files changed, verification verbatim, checklist items now passing, SPEC-SILENT / NOT VERIFIED honestly.
Do NOT start P4. Do NOT touch clanmind-backend/.

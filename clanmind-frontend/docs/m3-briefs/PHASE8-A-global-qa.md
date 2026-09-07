# Phase 8-A: Global QA & Re-baseline
**Prerequisite:** PHASE7-A (command-palette-activity) verified.
**Brief:** Execute Phase 8 global QA gate per spec section 17.
1. Run `scripts/capture_all.py` (all breakpoints, light+dark).
2. Run `scripts/test_keyboard_nav.py` (critical flows FE §313).
3. Run `axe-core` on all §312 visual-regression surfaces.
4. Verify spectral gradient discipline (§10) and dark base #000000.
5. Report perf budgets (composer latency, scroll FPS).
6. Verify 0 new test failures vs m3-baseline.txt.

**Commands:**
- pnpm build
- pnpm test
- pnpm run test:axe
- node scripts/capture_all.py

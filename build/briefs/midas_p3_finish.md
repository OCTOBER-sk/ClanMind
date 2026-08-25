You are Midas finishing ClanMind frontend P3. A previous session did the work but left 2 failures. Fix ONLY these:

1) TYPECHECK: src/features/chat/MessageList.virtualization.test.tsx line ~67 - two TS errors: 'this' context of '(() => any) | undefined' not assignable, and 'realOffsetHeight.get' possibly undefined. Fix the Object.defineProperty mock typing properly (use a typed descriptor with explicit get functions).

2) TEST: same file, test "preserves the scroll anchor when older pages prepend - no scroll-jump" asserts scrollTop <= 32 after prepend compensation but got 1080. The anchor-compensation logic in MessageList.tsx (or the virtualizer setup) is not compensating correctly under jsdom. Debug the actual mechanism: when older messages prepend, scrollTop must shift by exactly the prepended height delta per spec section 289. If the component logic is wrong fix it; if the jsdom environment cannot produce reliable layout numbers, simplify the assertion to what jsdom can honestly verify (e.g., compensation function unit behavior) and mark pixel-precision as NOT VERIFIED in your report.

3) Remove any leftover debug scaffolding from that session (debug-anchor.test.tsx if it exists, console.log noise).

Then FULL VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review the whole P3 diff vs FE sections 30/55/58/60/176/202/289 and report: files changed, verification verbatim, checklist items passing, SPEC-SILENT / NOT VERIFIED.
Do NOT touch clanmind-backend/. Do NOT start P4.

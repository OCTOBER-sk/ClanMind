# Phase 9 — Part 2: Critical Bug Fixes

These are the FAIL/PARTIAL items from FRONTEND_AUDIT2_REPORT that MUST be fixed. Each is a real bug, not cosmetic.

## CRITICAL (FAIL — must fix)

### 0.12 / 7.16 — PRIVATE_AI privacy leak
  - dispatch.ts:250 — `recipientId === 'ai'` admits ANY user's PRIVATE_AI event into any device's cache.
  - chatSelectors.ts:49 — PRIVATE_AI case returns true for every PRIVATE_AI message without verifying the local user participates.
  - PROBE PROVED: foreign user's private AI body cached AND rendered in current user's PRIVATE_AI view.
  - GROUP view is safe. PRIVATE_PAIR paths are correctly gated+filtered.
  - FIX: add sender_id/request_id check in chatSelectors.ts:49 + dispatch gate in dispatch.ts:250.
  - Per §56–§58, §2.26, §190, §284.
  - EXCEPTION from DO-NOT-TOUCH: this is a structural privacy fix the spec explicitly requires. Document in M3_DEVIATIONS.md.

### 7.19 — Draft keys omit privacy component
  - AppShell.tsx:528 — key is `user:group:project`, omits privacy component.
  - Visibility change does not re-key or clear text.
  - Spec §58, §190 require draft keyed by private scope too.
  - FIX: add privacy component to draft key. After switching visibility, re-key or clear text.

## HIGH (PARTIAL — must fix)

### 1.5 — Hard-coded color literals drift
  - ProjectPulse.tsx:61–76 — amber/blue Tailwind palette classes (bypasses warning/info tokens). Replace with token-driven classes.
  - LeftNav.tsx:370,409 — `#fff`. Replace with token.
  - AppShell.tsx:1129 — `bg-black/80 … text-white` catastrophic screen. Replace with token.
  - MemoryView.tsx:149,244 — gray/white classes. Replace with tokens.

### 1.2 — Spacing scale skips 7/9/11
  - Add them: 7=28px section, 9=36px, 11=44px.
  - Verify no feature component invents ad-hoc px values.

### 1.10 — Wider content mode for research/code
  - Add explicit dual-width toggle in ArtifactPanel for table/code artifacts.

### 3.6 — Multi-window readiness (EXCEPTION from DO-NOT-TOUCH)
  - outbox.ts — replayInFlight is a module-local boolean. No BroadcastChannel or navigator.locks.
  - FIX: wrap replayInFlight with BroadcastChannel + navigator.locks. Minimal change, no logic change to the queue.
  - Document in M3_DEVIATIONS.md.

### 3.7 — Per-component test coverage where missing
  - Focus on components with new/risky logic.

### 4.4 / 0.1 — "Loading workspace…" copy breach
  - AppShell.tsx:930 — rename to "Loading your space…".

### 4.10 — Restore last Group/Project route on cold start
  - Add last-route persistence to RootRedirect.

### 4.11 — Re-check for update on every connection attempt
  - Currently only checked at mount. Add per-attempt check.

### 4.14 — Deep-link cold-start resolution
  - resolveObjectLocation should fetch-and-route for uncached object IDs.

### 4.15 — Tauri update flow
  - Wire the updater plugin properly. Non-interrupting install, no breaking active meetings.

### 5.1 — TeamView missing current-project column, Mention and Profile actions
  - Add them.

### 5.2 — TeamView hardcodes presence="ONLINE" for every member
  - Wire to realtime presence envelope.

### 5.4 — Clickable "N teammates here" list
  - Implement dropdown member list.

### 5.5 — Dedicated unified profile surface
  - Separate global vs Group-scoped.

### 6.3 — MessageActions More menu missing Quote, Mark unread
  - Add them.

### 6.12 — Chat-level pinned-messages view
  - Garage has artifact/file pins; chat pins are unhandled.

### 6.14 — Mention tokens visually styled
  - Not plain markdown text.

### 6.21 — Highlight-on-arrival styling in MessageRow
  - For notification/deep-link.

### 8.2 — View-ranked command grouping
  - Linear-style per-view reordering.

### 8.4 — Server full-text search modes (§175)
  - Stub the contract for now.

### 8.6 — Cross-Group navigation + scroll+highlight chain

### 8.7 — Debounce/AbortController on search (200–250ms)
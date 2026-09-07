# Phase 9: Peak visual polish + every remaining FRONTEND_TODO + AUDIT FAIL/PARTIAL fix

Treat the entire FRONTEND_TODO (652 lines, §0–§30) AND every FAIL/PARTIAL row in FRONTEND_AUDIT2_REPORT as your work. The audit is brutally honest — the real bugs are:

- 0.12 / 7.16: PRIVATE_AI privacy leak. dispatch.ts:250 admits any PRIVATE_AI event into any cache (recipientId==='ai'); chatSelectors.ts:49 PRIVATE_AI case returns true without requester check. PROBE PROVED foreign user's private AI body cached + rendered in current user's PRIVATE_AI view. GROUP view is safe. FIX structurally (sender_id/request_id check in selector + dispatch gate) per §56–§58, §2.26, §190, §284.
- 7.19: Draft keys omit privacy component. AppShell.tsx:528 key is `user:group:project`; visibility change does not re-key or clear text. Spec §58, §190 require draft keyed by private scope too.
- 1.5: Hard-coded color literals drift. ProjectPulse.tsx:61–76 amber/blue Tailwind palette (bypasses warning/info tokens); LeftNav.tsx:370,409 `#fff`; AppShell.tsx:1129 `bg-black/80 … text-white` catastrophic screen; MemoryView.tsx:149,244 gray/white classes. Replace with token-driven classes.
- 1.2: Spacing scale skips 7/9/11. Add them (semantic: 7=28px section, 9=36px, 11=44px); verify no feature component invents ad-hoc px.
- 1.10: Wider content mode for research/code. Add explicit dual-width toggle in ArtifactPanel for table/code artifacts.
- 3.6: Multi-window readiness. Add BroadcastChannel + navigator.locks to outbox.ts so two windows don't double-flight.
- 3.7: Per-component test coverage where missing (focus on components with new/risky logic).
- 4.4 / 0.1: "Loading workspace…" copy breach in AppShell.tsx:930. Rename to "Loading your space…".
- 4.10: Restore last Group/Project route on cold start. Add last-route persistence to RootRedirect.
- 4.11: Re-check for update on every connection attempt (not just mount).
- 4.14: Deep-link cold-start resolution. resolveObjectLocation should fetch-and-route for uncached object IDs.
- 4.15: Tauri update flow — non-interrupting install, no breaking active meetings. Wire the updater plugin properly.
- 5.1: TeamView missing current-project column, Mention and Profile actions.
- 5.2: TeamView hardcodes presence="ONLINE" for every member. Wire to realtime presence envelope.
- 5.4: Clickable "N teammates here" list — implement dropdown member list.
- 5.5: Dedicated unified profile surface separating global vs Group-scoped.
- 6.3: MessageActions More menu missing Quote, Mark unread.
- 6.12: Chat-level pinned-messages view (Garage has artifact/file pins; chat pins are unhandled).
- 6.14: Mention tokens visually styled (not plain markdown text).
- 6.21: Highlight-on-arrival styling in MessageRow for notification/deep-link.
- 7.16: Same root cause as 0.12 — covered there.
- 8.2: View-ranked command grouping (Linear-style per-view reordering).
- 8.4: Server full-text search modes (§175) — for now stub the contract.
- 8.6: Cross-Group navigation + scroll+highlight chain.
- 8.7: Debounce/AbortController on search (200–250ms).

ALSO peak visual polish across every surface (this is the "peak quality" Sandy asked for):
  - Chat hero: composer becomes the focal point when chat is empty, with calm Odin-present state and a single spectral breath on the avatar.
  - Artifact panel staging: construction stages (skeleton → edges drawing → nodes arriving → completion) feel choreographed — single subtle per-stage motion, no overlap, no perpetual movement.
  - Decisions/Tasks/Memory surfaces: each feels like its own instrument, not a card list. Use the surface-container-high/low tiers to differentiate.
  - AppShell: tighter gap rhythm, the three-pane proportions feel intentional not algorithmic. Right surface settles to a calm preview when empty, not a blank half-screen.
  - Every M3 §10 rule honoured (spectral only 6 contexts, dark base #000000, no animate-pulse anywhere, no permanent gradients).

Implementation discipline:
  - Token-only changes — use var(--md-*) or src/design-system/tokens. NO hex, NO px font-size, NO ad-hoc cubic-bezier.
  - Touch OK: src/design-system/**, src/features/** (auth/chat/decisions/tasks/artifacts/approvals/memory/team/shell/meetings/sync/ai/notifications/onboarding/projects/settings/github/garage/groups), src/App.tsx, src/main.tsx, src/index.css, src/test/, scripts/.
  - DO NOT touch: src/api/**, src/state/**, src/realtime/**, src/sync/**, src/local/**, src/hooks/**, src/config/**, src/tauri/**, any use*Controller.ts (only consume their outputs).
  - For privacy fix 0.12/7.16 — the structural fix in dispatch.ts (realtime event routing) IS allowed because §56–§58 explicitly require it and the controller layer is the only correct location. Treat this as an exception, document it in M3_DEVIATIONS.md.
  - For multi-window 3.6 — outbox.ts is in src/sync/ which is "DO NOT TOUCH". EXCEPTION: the spec requires multi-window readiness (§307), the fix is minimal (BroadcastChannel + navigator.locks wrapping existing replayInFlight), no logic change to the queue. Document as exception.

Quality bar:
  - Nothing generic, nothing childish, no default-template look. Every screen reads as a professional, AI-native team tool — disciplined like Linear, calm like a good IDE, expressive only when Odin or an artifact is actively doing work.
  - Reference: the visual quality of Apple HIG (apple-hig skill at /tmp/od-new/skills/apple-hig/SKILL.md) for hierarchy/clarity/typography principles — applied through the M3 token system, NOT by copying palettes.
  - Frontend-design, impeccable-design-polish, redesign-skill skills available under /tmp/od-new/skills/ — use them as reference material for visual QA, don't import external palettes.
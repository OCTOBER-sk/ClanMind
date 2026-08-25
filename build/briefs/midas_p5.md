You are Midas continuing ClanMind frontend P5 (AI streaming polish). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root. Read every cited section before coding.

STATE HANDOFF: P0-P4 committed green (100 tests). Live mode wired via src/live/liveRuntime.ts + src/realtime/dispatch.ts; demo behind compile gate. AI run state mapping already follows spec 134A canonical enums.

P5 SCOPE - FE spec sections:
1. 134/135/203 streaming rendering: batch deltas at render-friendly cadence, only active AI message rerenders, incremental Markdown.
2. 136 auto-scroll during AI: follow only when near bottom, Jump to latest button, resume on return.
3. 137 cancel: Stop control, preserve partial content, CANCELLED state per 134A.
4. 138 retry / 139 regenerate: new run each time, previous response preserved, artifact outputs become new versions not overwrites.
5. 140 error card: "Odin couldn't complete this response." + provider reason + Retry/Try fallback buttons mapped to real error codes.
6. 142 fallback indicator: subtle "Odin . fallback model" from AI response metadata; no alarm.
7. 218 a11y: announce started/completed/failed only, never every token.
Wire against the real WS event stream (ai.status/ai.delta/ai.completed/ai.failed) already flowing through dispatch.ts. Demo wsHub already emits the full timeline - keep parity.

VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review diff vs cited sections + section 325 mistakes list; fix findings. Report sections covered, files changed, verification verbatim, checklist items passing, SPEC-SILENT / NOT VERIFIED honestly.
Do NOT start P6. Do NOT touch clanmind-backend/.

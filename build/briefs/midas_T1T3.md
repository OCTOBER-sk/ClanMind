Agent: midas — Frontend P0 completion Tasks T1-T3 (handoff HANDOFF_FRONTEND.md section 3)
Repo workdir: clanmind-frontend/ inside this project. Sources of truth:
1. ../ClanMind_Frontend_Master_Implementation_Specification.md (UX authority, FE sections)
2. ../ClanMind Backend — Master Implementation Specification.md (API contract authority)
3. FRONTEND_BUILD_BIBLE.md in this repo (execution plan, 12 rules)

CONTEXT: P0 is ~90% done. Three small tasks remain before verification. Demo mode must stay compile-time gated; production builds tree-shake all of src/mocks.

TASK T1 - Purge the last three hardcoded IDs. Grep targets outside src/mocks/: grp_robotics_1, user_arun_1, proj_flight_ctrl.
1. src/features/meetings/MeetingDialogs.tsx line ~26 calls startMeeting with grp_robotics_1 and proj_flight_ctrl. Fix properly: read active group/project from useGroupStore inside MeetingStartDialog component (give it optional props if cleaner), do not pass literals.
2. src/features/settings/SettingsView.tsx around line 609 passes user_arun_1 to resolveConflict. Replace with useAuthStore.getState().user?.id ?? empty string.
3. src/mocks/index.ts line ~92 has fallback ?? grp_robotics_1 - simplify to use ds.groups[0]?.id filtered to undefined-safe.

TASK T2 - Restore demo meeting richness. INITIAL_CANDIDATES was purged from useMeetingStore so demo meetings look empty. Fix ONLY inside the demo layer:
- Add seedMeeting(sessionId: string) to the DemoRuntime interface (src/mocks/runtime.ts).
- Implement in src/mocks/index.ts: push six candidate rows matching FE spec section 124A candidate types DECISION / TASK / CONTRADICTION / OPEN_QUESTION / RESEARCH_NEED / MILESTONE_CHANGE into currentSession via useMeetingStore setState, plus two live_notes. Recreate content similar to the robotics-team theme (SPI DMA decision, Priya 500Hz contradiction, flash-logging open question, DMA-vs-I2C research need, milestone slip) since originals are unrecoverable.
- Call site: wherever UI calls startMeeting (find it in MeetingDialogs or AppShell) - after startMeeting succeeds, call getDemoRuntime()?.seedMeeting(id).

TASK T3 - Verification loop until green. Run INSIDE clanmind-frontend/, iterate until all pass:
  pnpm exec tsc -b          (must be silent)
  pnpm run lint             (only pre-existing fast-refresh warnings allowed)
  pnpm test                 (21 passing baseline; may grow)
  pnpm run build            (must succeed; dist/assets must contain NO mocks chunk)
Then purity grep: grep -rlE "grp_robotics_1|user_arun_1|Robotics Core Team|mockAiService" dist/assets must return nothing.

RULES: Do NOT edit files with sed/powershell-style replace on content containing unicode section marks or em-dashes (encoding corruption risk) - use proper file edit tools. Do not touch src-tauri. No new dependencies. Do not start phase P1. Keep demo fixtures strictly inside src/mocks/.

FINAL SELF-REVIEW (mandatory): re-read your full diff with git diff; verify zero hardcoded IDs remain outside src/mocks via grep; verify demo purity (grep dist); confirm all four verification commands green; then report files changed, each command result verbatim, and anything NOT verified.

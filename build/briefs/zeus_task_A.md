Agent: zeus — Backend remediation Task A of H (handoff section 3.A)
Repo workdir: clanmind-backend/ inside this project. Source of truth: ../ClanMind Backend — Master Implementation Specification.md. This task traces to handoff HANDOFF_BACKEND.md section 3.A.

CONTEXT: The previous agent left apps/worker/test/utils.ts referencing symbols it never imported. Current state: pnpm -r typecheck fails ONLY on test/utils.ts with exactly these errors:
- line ~801: AppServices object missing githubConnections, webhookEvents
- line ~803: Cannot find name parseLimits
- line ~822: Cannot find name MemoryService

STEP 1: Read apps/worker/test/utils.ts fully. Find its import block.
STEP 2: Add parseLimits to the existing @clanmind/shared import. Add MemoryService to the existing @clanmind/domain import. Check where githubConnections and webhookEvents are constructed elsewhere in the file or in src/services.ts, and add them to the services object with the same construction pattern the production code uses (they are Supabase-backed repos added in the remediation; see apps/worker/src/services.ts and repositories/github.repo.ts).
STEP 3: Export outboxEvents from the harness return object if it is not already exported (new tests will need to assert on published events).
STEP 4: Verify loop until clean:
  cd clanmind-backend && pnpm --filter @clanmind/worker typecheck
  then: pnpm -r typecheck   (must be fully green)
STEP 5: Run pnpm -r test and report the pass/fail count vs baseline 234 passing. Do NOT fix unrelated failing tests in this task - just report their names and counts.

RULES: Touch ONLY apps/worker/test/utils.ts unless typecheck proves another file needs a type-only adjustment (report any such file). No new deps. No logic changes. Do not start Task B.

FINAL SELF-REVIEW: re-read your diff (git diff), confirm zero out-of-scope edits, confirm both typecheck commands green, run tests, then report: files changed, typecheck status, test count passed/failed with failing test names if any.

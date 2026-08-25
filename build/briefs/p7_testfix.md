You are Midas FIXING P7 test failures in ClanMind frontend. Do NOT touch other phases.

STATE: 10 tests fail across 4 files (run `pnpm test 2>&1 | grep FAIL` to list them). Prior session's debugging notes:
- DiffViewer tests: hunks not rendering. `readHunksFor(payload, path)` reads `payload.file_diffs[path]`; tests pass payload with key 'src/imu.c' and 10 lines (> HUNK_COLLAPSE_THRESHOLD 8) but "Show 2 more lines" button not found, nor syntax-highlight content. File tree stats DID render (−3 counts found) - so files render but hunks come back empty. SUSPECT: readHunksFor signature/shape mismatch (maybe it expects payload.file_diffs to be a map path->string, not path->string[], or reads payload.diff instead).
- ApprovalCard/GitHubActionCard dialog tests may share the same payload-shape issue.

YOUR JOB:
1. Read the DiffViewer component + readHunksFor implementation FIRST; determine the actual expected payload shape.
2. Fix EITHER the component (if it ignores real backend payload shape per BE spec s76-80 - the spec is authority) OR the tests (if tests built wrong payloads vs spec). Cite which and why.
3. Re-run failing files until green: pnpm exec vitest run <file>
4. Full verify loop green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build.
5. Self-review: no weakened assertions, no skipped tests, payload shapes match BE contract.
Report root cause, what changed, verification verbatim.
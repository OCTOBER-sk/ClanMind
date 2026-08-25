You are Midas continuing ClanMind frontend P7 (approvals/GitHub wiring). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root. Read cited sections before coding.

STATE HANDOFF: P0-P6 committed (178 tests green). A previous P7 session made UNCOMMITTED partial progress then was killed by host I/O pressure. Working tree now contains (verify before building on it):
- ApprovalCard error handling (GROUP_PERMISSION_DENIED shows toast, errorMessageOf)
- ErrorBoundary wrapping GitHub + Team panels
- BYOK/GitHub/approval wire-up in progress: 53 file writes so far, diff-viewer components partially built
- Uncommitted changes live in clanmind-frontend/src (git status will show them)

YOUR JOB: 1) Run the verify loop FIRST (pnpm exec tsc -b && lint && test && build) to see the true state of the partial work - fix whatever fails until green. 2) Complete the remaining P7 scope per spec: BYOK UI s156-158 (never reveal saved key, last4), GitHub panel+status s159-165, GitHubActionCard s161, diff viewer s162, approval dialogs s163 (hash+version submission s164A.2), merge dialog s164, generic ApprovalCard reuse + status mapping + EXPIRED re-review s164A.3-4, feature-flags hidden-not-disabled s165A. 3) Connect to real endpoints per docs/INTEGRATION_REPORT.md D-notes + demo transportRoutes parity. 4) Self-review vs cited sections + s325.

VERIFY LOOP until green at the end: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Report sections covered, files changed, verification verbatim, checklist passing, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P8. Do NOT touch clanmind-backend/.
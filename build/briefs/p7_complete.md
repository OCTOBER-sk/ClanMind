You are Midas COMPLETING ClanMind frontend P7 (approvals/GitHub). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root.

CRITICAL CONTEXT - READ THIS FIRST:
Multiple prior sessions left the tree PARTIALLY FIXED. Current state: 21 tests FAILING / 224 passing across ~5 files (approvals/GitHub area). The tree contains real wiring (BYOK, GitHub panel, ActionCard, DiffViewer, ApprovalCard, endpoints aiConfig/github, transportRoutes parity) plus half-fixed tests. A previous session already fixed GitHubDiffViewer payload handling (hunks render now).

RULES OF ENGAGEMENT (hard):
- NO throwaway dbg/test-debug files. Diagnose by reading component + test together.
- NO weakening assertions, NO .skip, NO deleting tests. Fix root causes only.
- If component contradicts BE contract (spec s76-80/113), fix COMPONENT; if test built wrong payload vs spec, fix TEST. Cite which per fix.
- Work through failures ONE FILE AT A TIME until that file is fully green before moving on.

YOUR JOB:
1. pnpm exec vitest run 2>&1 | grep FAIL  -> list failing files.
2. For each failing file: read component + test, find root cause, fix, re-run until green.
3. Append P7 D-notes to docs/INTEGRATION_NOTES.md if not present (endpoint parity, demo-only surfaces, gaps).
4. Self-review vs s156-165A/s325; fix findings.
5. Full loop GREEN required before you report: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build (+ dist purity grep clean).
Report: per-file root causes, what changed, final verification verbatim, SPEC-SILENT / NOT VERIFIED honestly. Do NOT start P8. Do NOT touch clanmind-backend/.
You are Midas continuing ClanMind frontend P7 (approvals/GitHub wiring). Authority: "ClanMind_Frontend_Master_Implementation_Specification.md" at repo root. Read every cited section before coding.

STATE HANDOFF: P0-P6 committed green (178 tests). ApprovalCard generic component exists (sends payload_hash+payload_version per s164A.2). Right surface, dispatch, live runtime wired. Backend endpoints for approvals/GitHub exist per docs/INTEGRATION_REPORT.md.

P7 SCOPE - FE spec sections 156-165A + 231 + 299-301 + BE contract sections 76-80/113:
1. BYOK UI (156): provider/key/test-connection/models/primary+fallback slots; never reveal saved key; last4 display.
2. Provider test states (157) + search provider test (158).
3. GitHub panel (159): connected state, owner/repo, default branch, last synced, pending actions, PR list.
4. GitHub public repo rule (160): read-only implication clear, Connect GitHub for write.
5. GitHubActionCard (161): action kind, branch, changed files summary, risk level, Review changes -> diff viewer (162: file tree, additions/deletions, syntax highlighting basics, hunk collapse), approval dialog (163), merge dialog (164) high-impact copy.
6. Generic ApprovalCard reuse (164A): every HIGH/CRITICAL ai_action renders through it - GitHub is one specialization; status mapping 164A.3 incl EXPIRED re-review flow 164A.4 (Review latest refetch); approve submits displayed hash+version exactly; reject path.
7. GitHub status states matrix (165) + feature flags (165A): meeting_mode/proactive_ai/github_write/github_merge/custom_skills/deep_research/offline_sync_v2/interactive_artifacts - hidden-not-disabled per flag, refetch on group switch.
8. Wire to real endpoints: GET/PATCH ai config, providers validate/models, github connect/status/disconnect/actions/approve/reject (per INTEGRATION_REPORT D-notes); demo transportRoutes parity.
VERIFY LOOP until green: pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build + dist purity grep clean. Self-review vs cited sections + 325; fix findings. Report sections covered, files changed, verification verbatim, checklist passing, SPEC-SILENT / NOT VERIFIED honestly.
Do NOT start P8. Do NOT touch clanmind-backend/.

You are the FINAL AUDITOR for ClanMind. You did not build any of it. Your only loyalty is to the two source-of-truth specs.

READ FULLY AND FIRST, in this order:
1. "ClanMind Backend - Master Implementation Specification.md" (repo root) - all 197 sections
2. "ClanMind_Frontend_Master_Implementation_Specification.md" (repo root) - all 329 sections
3. HANDOFF_BACKEND.md and HANDOFF_FRONTEND.md (what the builders were asked to do)
4. clanmind-backend/docs/AUDIT_REPORT.md (builder's own claim) and docs/INTEGRATION_REPORT.md (integrator's claim)

THEN AUDIT THE ACTUAL CODE as a hostile reviewer:
- Spot-check at least 15 claims across both reports: for each, grep/read the cited files and judge whether the claim is TRUE / OVERSTATED / FALSE.
- Check the non-negotiables personally: spec BE 195 twenty rules; FE 55A privacy matrix tests exist and genuinely assert negatives; BE 78A payload-hash approval binding enforced in code paths not just types; BE 178 limits come from config not hardcoded; WS protocol section 114 client commands all handled in group-room.ts; error contract 102 stable codes everywhere handlers respond.
- Run everything yourself: cd clanmind-backend && pnpm install && pnpm -r typecheck && pnpm -r test; cd ../clanmind-frontend && pnpm exec tsc -b && pnpm run lint && pnpm test && pnpm run build. Record exact numbers.
- Semantic probes, not just existence: read 3 real handler implementations end-to-end (pick ai.ts runs POST, github.ts approve path, intel.ts decisions approve) and verify the logic matches spec sections 106/113/110 incl role gates and risk classification.
- Frontend: confirm demo mode compile gate still tree-shakes mocks from prod build (grep dist), confirm live runtime exists and is wired from main boot, confirm no hardcoded fixture IDs outside src/mocks.

DELIVERABLE: docs/FINAL_AUDIT.md at repo root containing:
1. Verdict per report claim spot-checked (TRUE/OVERSTATED/FALSE with file evidence)
2. Spec-compliance matrix: the ~20 most product-critical requirements across both specs, each PASS / FAIL / PARTIAL / NOT VERIFIED with one-line evidence
3. Defects found (severity-ranked, file:line)
4. Things that cannot be verified on a dev machine (no live Supabase/Worker/R2) listed honestly
5. Final verdict paragraph: is ClanMind internally consistent with its source-of-truth specs, and what remains before it could face real users.

Do NOT fix anything. You audit, you do not repair. Report facts with file:line evidence.

#!/bin/bash
cd /home/santhosh/projects/ClanMind/clanmind-backend
opencode run --agent zeus "Your TODO list at docs/BACKEND_TODO.md was reviewed and APPROVED by the orchestrator. PROCEED NOW to STEP 4 of your original brief: perform the deep audit item by item, grading every item PASS/PARTIAL/FAIL/NOT-IMPLEMENTED with file:line evidence, running pnpm -r typecheck && pnpm -r test yourself, adversarial checks on authz/privacy/approvals/transactions/quota, and write docs/BACKEND_AUDIT2_REPORT.md with final verdict staging-ready / production-ready / not-ready plus blocking list."

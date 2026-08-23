# Disaster Recovery & Operations (§145, §146, §167, §168)

## Targets

- **RTO:** 4 hours (Worker redeploy + DNS cutover).
- **RPO:** 15 minutes (Supabase PITR / scheduled backups).

## Restore process

1. Database: restore the Supabase project from the latest PITR point or
   scheduled backup; verify schema version via migration history.
2. Objects: R2 versioning/lifecycle retains prior object versions — restore
   by prefix `groups/{group_id}/...` as needed.
3. Secrets: re-provision from the platform secret store (never from repo
   copies — §162/§164); BYOK envelope-encryption keys come from the
   dedicated key holder outside the database (§63.2).
4. GitHub: reconnect the App installation per Group; `github_connections`
   metadata is rebuilt from the installation event (§167).
5. Verify: `GET /health/ready` green; replay a message send + AI run.

## Backup plan (§145)

- Supabase automated backups + PITR (paid tier) or daily `pg_dump` to R2.
- R2 object versioning on the shared-objects bucket.
- Migration replayability: every migration is additive/reversible-per-§150;
  restore testing is part of the deployment runbook.

## Retention (§146)

- Shared Group content: retained while the Group exists.
- Soft-deleted content: 30-day recovery window (§178), then the async
  deletion job purges it (§9).
- Operational logs: minimum necessary; AI run traces avoid storing raw
  private prompt/context payloads indefinitely (§146).

## Key rotation (§168)

- BYOK envelope-encryption keys: rotate the master key; secrets re-encrypt
  lazily on next decrypt — no historical row rewrites.
- Application provider keys / GitHub App credentials / search keys: swap in
  the secret store; adapters pick up new keys per isolate.

## DR drill

Quarterly: restore staging from backup, run the §151 suites against it.

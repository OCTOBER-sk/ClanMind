# ClanMind Backend

Implementation of the **ClanMind Backend — Master Implementation Specification**.
The specification file (`../ClanMind Backend — Master Implementation Specification.md`)
is the single authority: every table, event, enum, and rule here is built
verbatim from it, in its own implementation order (§189, Phases A–I).

## Structure (spec §5)

```
apps/worker      Cloudflare Worker: routes, middleware, realtime DO rooms
packages/
  shared         limits (§178), errors (§102), logging (§101), pagination (§156)
  contracts      Zod schemas: enums, §17 envelope, §18 taxonomy, §114 WS protocol
  db             privileged Supabase client (service layer, §87A)
  domain         domain services (§182)
  auth           Supabase Auth gateway (§6)
  ai-core        orchestrator, context engine, model router
  ai-providers   provider adapters (§62)
  tools          tool registry/executor (§56/§57A)
  skills         skill service (§34)
  memory         memory service (§35–§38)
  github         GitHub service (§76–§80)
  search         search provider abstraction (§67)
  sync           sync service (§20/§20A)
  security       security utilities (§88/§89)
supabase/        migrations + seed
tests/           unit / integration / security / realtime / ai / e2e
```

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev          # wrangler dev
```

Never commit `.env` (§162). All §178 limits are configuration-driven.

## Non-negotiables (§2, §181, §195)

- `Account → Group → Projects`; no Workspace/Organization hierarchy.
- One shared AI per Group (default: Odin).
- Supabase Auth only — no custom password storage.
- Postgres is canonical; Durable Objects only coordinate realtime.
- Private content never crosses into shared scope (§55A).
- Approvals bind to `ai_actions.payload_hash` + `payload_version` (§78A.1).

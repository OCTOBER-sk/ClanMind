# ClanMind Backend Implementation Plan

> **For agentic workers:** execute task-by-task in order (Phase 0 → I per spec §189). TDD per task: failing test → implement → pass → commit. The spec (`ClanMind Backend — Master Implementation Specification.md`) is the single authority.

**Goal:** Complete ClanMind backend built strictly per the backend specification — nothing added (§190 honored), nothing omitted, nothing renamed.

**Architecture:** Modular monolith in one Cloudflare Worker + Durable Object group rooms + Supabase Postgres/Auth/RLS + R2. Postgres canonical; DO coordinates only (Correction 2). Route handlers → application/domain services (§182–§186).

**Global constraints:** `/api/v1`; §17 versioned envelope with per-group sequence; §18 event taxonomy only; Supabase Auth only (Correction 1); §55A privacy matrix enforced; §78A approval hash binding; §178 limits config-driven; §19 idempotency everywhere; §156 cursor pagination; all enum/table names verbatim.

## Task list (tracked in session TodoWrite)

- **Phase 0:** scaffold monorepo/tooling/CI; contracts package (Zod: envelope, WS, errors, cursors); db + shared packages.
- **Phase A (§189 A):** A1 profiles+auth gateway+`/me`; A2 groups+members+RLS; A3 roles/removal/transfer; A4 invites; A5 deletion lifecycle+job; A6 projects+instructions; A7 nicknames; A8 outbox+audit+background_jobs+JobRunner; A9 middleware (request-id, errors, Zod, idempotency, cursors).
- **Phase B:** B1 DO room; B2 envelope+sequence+protocol gate; B3 messages+revisions; B4 broadcast+messages RLS; B5 reactions/mentions/pins/commands; B6 private conversations; B7 presence/typing; B8 attachments+R2+signed URLs; B9 search; B10 notifications; B11 activity.
- **Phase C:** C1 ai_agents; C2 BYOK/provider configs; C3 model router; C4 provider adapters; C5 runs+streaming+§115 lifecycle; C6 Context Engine (§54A); C7 tool registry+ledger; C8 quotas+usage.
- **Phase D:** D1 memories+RLS; D2 candidates+extraction; D3 retrieval; D4 contradictions; D5 secret rejection; D6 endpoints.
- **Phase E:** E1 search providers; E2 citations; E3 deep research jobs; E4 skills.
- **Phase F:** F1 artifacts; F2 Garage endpoints; F3 live events; F4 decisions; F5 tasks; F6 snapshots; F7 meetings; F8 proactivity.
- **Phase G:** G1 connections; G2 Approval Engine; G3 github_actions; G4 safe workflow; G5 webhooks; G6 endpoints+quota.
- **Phase H:** H1 sync tables; H2 reconnect; H3 conflicts; H4 WS sync messages.
- **Phase I:** I1 rate limits; I2 cost controls; I3 observability; I4 health; I5 client version; I6 flags; I7 file indexing; I8 security suite (§55A matrix + §187); I9 backups/DR; I10 final self-review (§196 checklist, §181 corrections, §185 invariants).

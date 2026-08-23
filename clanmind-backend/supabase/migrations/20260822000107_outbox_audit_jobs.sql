-- §123 outbox_events + §99 audit_events + §158A background_jobs.

-- §123 Outbox pattern: prevents "DB committed but event broadcast lost".
create table if not exists public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  group_id uuid null,
  actor_id uuid null,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSED','FAILED')),
  created_at timestamptz not null default now(),
  processed_at timestamptz null,
  retry_count integer not null default 0
);

create index if not exists outbox_pending_idx
  on public.outbox_events (status, created_at)
  where status = 'PENDING';

-- §99 audit log: append-only from the application perspective.
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid null,
  actor_user_id uuid null,
  action_type text not null,
  subject_type text not null,
  subject_id text not null,
  payload jsonb not null default '{}'::jsonb,
  request_id text null,
  created_at timestamptz not null default now()
);

create index if not exists audit_group_idx on public.audit_events (group_id, created_at desc);
create index if not exists audit_action_idx on public.audit_events (action_type, created_at desc);

revoke update, delete on public.audit_events from anon, authenticated;

-- §158A background jobs table.
create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  source_event_id uuid null,
  idempotency_key text not null,
  payload jsonb not null,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','RUNNING','SUCCEEDED','FAILED_RETRYABLE','FAILED_PERMANENT')),
  retry_count integer not null default 0,
  max_retries integer not null default 5,
  next_attempt_at timestamptz null,
  last_error text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  unique (job_type, idempotency_key)
);

create index if not exists background_jobs_due_idx
  on public.background_jobs (status, next_attempt_at);

alter table public.background_jobs enable row level security;
-- Job state is service-layer only; no direct client access policies.

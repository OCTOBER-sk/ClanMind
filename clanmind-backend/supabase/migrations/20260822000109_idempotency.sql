-- §19 Idempotency: offline clients may retry; the backend must produce one
-- logical operation per (actor, operation id).

create table if not exists public.idempotency_operations (
  operation_id text not null,
  actor_id uuid not null,
  request_hash text not null,
  result_status integer null,
  result_body jsonb null,
  result_reference uuid null,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation_id)
);

create index if not exists idempotency_created_idx
  on public.idempotency_operations (created_at desc);

alter table public.idempotency_operations enable row level security;
-- Idempotency records are service-layer bookkeeping; no direct client access.

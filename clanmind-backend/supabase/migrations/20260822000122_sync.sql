-- §20A Sync Protocol Tables — verbatim shapes.

create table if not exists public.sync_checkpoints (
  device_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  last_server_sequence bigint not null,
  last_synced_at timestamptz not null default now(),
  primary key (device_id, group_id)
);

create table if not exists public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  user_id uuid not null references public.profiles(id),
  group_id uuid not null references public.groups(id) on delete cascade,
  client_operation_id text not null,
  operation_type text not null,
  payload jsonb not null,
  client_created_at timestamptz not null,
  server_received_at timestamptz null,
  status text not null default 'PENDING' check (status in ('PENDING','APPLIED','REJECTED','CONFLICT')),
  result_reference uuid null,
  unique (device_id, client_operation_id)
);

create index if not exists sync_operations_group_status_idx
  on public.sync_operations (group_id, status);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  sync_operation_id uuid not null references public.sync_operations(id) on delete cascade,
  conflict_type text not null check (conflict_type in ('version_mismatch','concurrent_edit','deleted_upstream')),
  local_payload jsonb not null,
  server_payload jsonb not null,
  resolution_strategy text null check (resolution_strategy in ('server_wins','client_wins','merged','manual')),
  resolved_by uuid null,
  resolved_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.sync_operations enable row level security;
create policy sync_operations_own on public.sync_operations
  for select
  using (user_id = auth.uid());

alter table public.sync_conflicts enable row level security;
create policy sync_conflicts_own on public.sync_conflicts
  for select
  using (exists (
    select 1 from public.sync_operations o
    where o.id = sync_conflicts.sync_operation_id and o.user_id = auth.uid()
  ));

alter table public.sync_checkpoints enable row level security;
create policy sync_checkpoints_own on public.sync_checkpoints
  for select
  using (user_id = auth.uid());

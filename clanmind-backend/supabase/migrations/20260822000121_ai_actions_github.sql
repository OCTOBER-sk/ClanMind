-- §78A ai_actions + ai_action_approvals + §77 github_connections +
-- §78 github_actions + §80 github_webhook_events.

create table if not exists public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  ai_run_id uuid null references public.ai_runs(id) on delete set null,
  initiated_by_user_id uuid null references public.profiles(id),
  action_kind text not null,
  risk_level text not null check (risk_level in ('READ_ONLY','LOW','MEDIUM','HIGH','CRITICAL')),
  payload jsonb not null,
  payload_hash text not null,
  payload_version integer not null default 1,
  status text not null check (status in
    ('PROPOSED','WAITING_APPROVAL','APPROVED','EXECUTING','SUCCEEDED','FAILED','REJECTED','EXPIRED')),
  requires_approval boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists ai_actions_group_status_idx on public.ai_actions (group_id, status);
create index if not exists ai_actions_run_idx on public.ai_actions (ai_run_id);

create table if not exists public.ai_action_approvals (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.ai_actions(id) on delete cascade,
  approved_by uuid not null references public.profiles(id),
  approver_role text not null,
  approved_payload_hash text not null,
  approved_payload_version integer not null,
  approved_at timestamptz not null default now(),
  execution_result jsonb null,
  executed_at timestamptz null
);

create index if not exists ai_action_approvals_action_idx on public.ai_action_approvals (action_id);

create table if not exists public.github_connections (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.groups(id) on delete cascade,
  installation_id bigint null,
  owner_login text null,
  repo_name text null,
  repo_full_name text null,
  default_branch text null,
  permission_mode text not null default 'READ_ONLY' check (permission_mode in ('READ_ONLY','READ_WRITE')),
  connected_at timestamptz null,
  disconnected_at timestamptz null
);

-- §78: github_actions carries ONLY GitHub-specific fields; approval
-- lifecycle lives once on ai_actions and is reached via the join.
create table if not exists public.github_actions (
  id uuid primary key default gen_random_uuid(),
  ai_action_id uuid not null references public.ai_actions(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null,
  action_type text not null check (action_type in ('create_branch','apply_patch','create_pr','merge_pr')),
  branch_name text null,
  target_sha text null,
  preview_json jsonb null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists github_actions_action_idx on public.github_actions (ai_action_id);

create table if not exists public.github_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  installation_id bigint null,
  group_id uuid null references public.groups(id),
  received_at timestamptz not null default now()
);

create index if not exists github_webhook_events_group_idx
  on public.github_webhook_events (group_id, received_at desc);

alter table public.ai_actions enable row level security;
create policy ai_actions_select on public.ai_actions
  for select
  using (public.is_group_member(group_id));

alter table public.ai_action_approvals enable row level security;
create policy ai_action_approvals_select on public.ai_action_approvals
  for select
  using (exists (
    select 1 from public.ai_actions a
    where a.id = ai_action_approvals.action_id
      and public.is_group_member(a.group_id)
  ));

alter table public.github_connections enable row level security;
create policy github_connections_admin on public.github_connections
  for select
  using (exists (
    select 1 from public.group_members
    where group_id = github_connections.group_id
      and user_id = auth.uid()
      and role in ('OWNER','ADMIN')
      and removed_at is null
  ));

alter table public.github_actions enable row level security;
create policy github_actions_select on public.github_actions
  for select
  using (public.is_group_member(group_id));

alter table public.github_webhook_events enable row level security;
create policy github_webhook_events_select on public.github_webhook_events
  for select
  using (group_id is not null and public.is_group_member(group_id));

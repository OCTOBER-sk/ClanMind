-- §52 ai_runs + §53 ai_run_steps + §57A ai_tool_calls + §93 usage_events +
-- quota_states.

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  requester_user_id uuid not null references public.profiles(id),
  ai_agent_id uuid not null references public.ai_agents(id),
  mode text not null check (mode in ('ASSIST','FACILITATE','ACT')),
  visibility text not null check (visibility in ('GROUP','PRIVATE_PAIR','PRIVATE_AI')),
  provider_config_id uuid null references public.ai_provider_configs(id),
  model_id text not null,
  status text not null check (status in
    ('QUEUED','RUNNING','WAITING_TOOL','STREAMING','COMPLETED','FAILED','CANCELLED')),
  input_message_id uuid null references public.messages(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  failure_code text null,
  usage_json jsonb null
);

create index if not exists ai_runs_group_idx on public.ai_runs (group_id, started_at desc);
create index if not exists ai_runs_requester_idx on public.ai_runs (requester_user_id);

create table if not exists public.ai_run_steps (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  step_number integer not null,
  step_type text not null,
  tool_name text null,
  status text not null,
  input_json jsonb null,
  output_json jsonb null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists ai_run_steps_run_idx on public.ai_run_steps (ai_run_id, step_number);

-- §57A tool-call ledger — the security/audit unit for every capability use.
create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  ai_run_step_id uuid null references public.ai_run_steps(id),
  tool_name text not null,
  tool_version text not null,
  risk_level text not null check (risk_level in ('READ_ONLY','LOW','MEDIUM','HIGH','CRITICAL')),
  input_json jsonb not null,
  output_json jsonb null,
  status text not null check (status in
    ('PENDING','APPROVED','EXECUTING','SUCCEEDED','FAILED','DENIED')),
  requires_approval boolean not null,
  ai_action_id uuid null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  error_code text null
);

create index if not exists ai_tool_calls_run_idx on public.ai_tool_calls (ai_run_id);
create index if not exists ai_tool_calls_tool_idx on public.ai_tool_calls (tool_name, status);

-- §93 usage ledger — centralized, never scattered counters.
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid null references public.profiles(id),
  category text not null,
  provider text null,
  model text null,
  quantity numeric not null,
  unit text not null,
  estimated_cost numeric null,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_group_idx on public.usage_events (group_id, created_at desc);

-- Per-Group quota state; overrides of §178 defaults live here (§178 note).
create table if not exists public.quota_states (
  group_id uuid not null references public.groups(id) on delete cascade,
  category text not null,
  used numeric not null default 0,
  limit_override numeric null,
  window_started_at timestamptz not null default now(),
  primary key (group_id, category)
);

alter table public.ai_runs enable row level security;
create policy ai_runs_select on public.ai_runs
  for select
  using (public.is_group_member(group_id));

alter table public.ai_run_steps enable row level security;
create policy ai_run_steps_select on public.ai_run_steps
  for select
  using (exists (
    select 1 from public.ai_runs r
    where r.id = ai_run_steps.ai_run_id and public.is_group_member(r.group_id)
  ));

alter table public.usage_events enable row level security;
create policy usage_events_select on public.usage_events
  for select
  using (exists (
    select 1 from public.group_members
    where group_id = usage_events.group_id
      and user_id = auth.uid()
      and role in ('OWNER','ADMIN')
      and removed_at is null
  ));

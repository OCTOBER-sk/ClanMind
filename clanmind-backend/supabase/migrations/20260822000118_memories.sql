-- §35 memories + §36 memory_candidates.
-- Typed memory with three scopes; AI identity is configuration, not memory.

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('GROUP','PROJECT','USER_PRIVATE')),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete cascade,
  user_id uuid null references public.profiles(id),
  memory_type text not null,
  content text not null,
  normalized_content text null,
  confidence numeric(4,3) not null,
  importance numeric(4,3) not null,
  source_type text not null,
  source_id uuid null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED','SUPERSEDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz null,
  archived_at timestamptz null
);

create index if not exists memories_scope_idx on public.memories (group_id, scope_type, status);
create index if not exists memories_project_idx on public.memories (project_id, status);

create table if not exists public.memory_candidates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null,
  user_id uuid null,
  source_message_id uuid null,
  candidate_type text not null,
  content text not null,
  confidence numeric(4,3) not null,
  recommended_scope text not null check (recommended_scope in ('GROUP','PROJECT','USER_PRIVATE')),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED','MERGED','EXPIRED')),
  created_at timestamptz not null default now()
);

create index if not exists memory_candidates_group_idx
  on public.memory_candidates (group_id, status);

-- §87A RLS — the single most important policy set in the schema.
alter table public.memories enable row level security;

create policy memories_select_group on public.memories
  for select
  using (
    scope_type = 'GROUP'
    and public.is_group_member(group_id)
  );

create policy memories_select_project on public.memories
  for select
  using (
    scope_type = 'PROJECT'
    and public.is_group_member(group_id)
  );

create policy memories_select_user_private on public.memories
  for select
  using (
    scope_type = 'USER_PRIVATE'
    and user_id = auth.uid()
  );

alter table public.memory_candidates enable row level security;

create policy memory_candidates_group on public.memory_candidates
  for select
  using (
    recommended_scope in ('GROUP','PROJECT')
    and public.is_group_member(group_id)
  );

create policy memory_candidates_own_private on public.memory_candidates
  for select
  using (
    recommended_scope = 'USER_PRIVATE'
    and user_id = auth.uid()
  );

create trigger memories_touch_updated_at
  before update on public.memories
  for each row execute function public.touch_updated_at();

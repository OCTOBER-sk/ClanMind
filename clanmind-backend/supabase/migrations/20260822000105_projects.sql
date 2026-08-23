-- §28 projects + §29 project_instructions.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  description text null,
  goal text null,
  project_type text null check (project_type in
    ('software','iot','startup','research','college','school','personal','other')),
  status text not null default 'active' check (status in ('active','archived')),
  progress numeric(5,2) null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null
);

create index if not exists projects_group_idx on public.projects (group_id);
create index if not exists projects_group_status_idx on public.projects (group_id, status);

create table if not exists public.project_instructions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  instruction_text text not null,
  priority integer not null default 100,
  enabled boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_instructions_project_idx
  on public.project_instructions (project_id, priority);

alter table public.projects enable row level security;
create policy projects_select on public.projects
  for select
  using (public.is_group_member(group_id));
create policy projects_insert on public.projects
  for insert
  with check (public.is_group_member(group_id));
create policy projects_update on public.projects
  for update
  using (public.is_group_member(group_id));

alter table public.project_instructions enable row level security;
create policy project_instructions_select on public.project_instructions
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_instructions.project_id
      and public.is_group_member(p.group_id)
  ));

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create trigger project_instructions_touch_updated_at
  before update on public.project_instructions
  for each row execute function public.touch_updated_at();

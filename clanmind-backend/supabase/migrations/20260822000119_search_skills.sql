-- §33 search_provider_configs + §34 skills/group_skills/project_skills +
-- research job records (§68/§119) + citation ledger (§69).

create table if not exists public.search_provider_configs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  provider text not null check (provider in ('TAVILY','EXA','BRAVE')),
  credential_ref text null,
  enabled boolean not null default true,
  priority integer not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists search_provider_configs_idx
  on public.search_provider_configs (group_id, priority);

create table if not exists public.research_jobs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null,
  requested_by uuid not null references public.profiles(id),
  query text not null,
  status text not null default 'QUEUED' check (status in
    ('QUEUED','RUNNING','SEARCHING','SYNTHESIZING','VALIDATING','COMPLETED','FAILED','CANCELLED')),
  output_json jsonb null,
  search_batches_used integer not null default 0,
  sources_considered integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists research_jobs_group_idx on public.research_jobs (group_id, created_at desc);

create table if not exists public.research_sources (
  id uuid primary key default gen_random_uuid(),
  research_job_id uuid not null references public.research_jobs(id) on delete cascade,
  citation_id text not null,
  provider text not null,
  title text not null,
  url text not null,
  snippet text null,
  domain text not null,
  retrieved_at timestamptz not null default now(),
  used_in_output boolean not null default false
);

create index if not exists research_sources_job_idx on public.research_sources (research_job_id);

-- §34 skills
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  version text not null,
  description text not null,
  definition jsonb not null,
  built_in boolean not null default true
);

create table if not exists public.group_skills (
  group_id uuid not null references public.groups(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  primary key (group_id, skill_id)
);

create table if not exists public.project_skills (
  project_id uuid not null references public.projects(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  primary key (project_id, skill_id)
);

alter table public.search_provider_configs enable row level security;
create policy search_provider_configs_admin on public.search_provider_configs
  for select
  using (exists (
    select 1 from public.group_members
    where group_id = search_provider_configs.group_id
      and user_id = auth.uid()
      and role in ('OWNER','ADMIN')
      and removed_at is null
  ));

alter table public.research_jobs enable row level security;
create policy research_jobs_select on public.research_jobs
  for select
  using (public.is_group_member(group_id));

alter table public.research_sources enable row level security;
create policy research_sources_select on public.research_sources
  for select
  using (exists (
    select 1 from public.research_jobs j
    where j.id = research_sources.research_job_id
      and public.is_group_member(j.group_id)
  ));

alter table public.skills enable row level security;
create policy skills_select on public.skills for select using (true);

alter table public.group_skills enable row level security;
create policy group_skills_select on public.group_skills
  for select
  using (public.is_group_member(group_id));

alter table public.project_skills enable row level security;
create policy project_skills_select on public.project_skills
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_skills.project_id
      and public.is_group_member(p.group_id)
  ));

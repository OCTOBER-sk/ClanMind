-- §44 artifacts/versions/links + §47 decisions + §48 tasks/dependencies +
-- §49 snapshots + §50/§50A meetings + §71 proactive suggestions.
-- `version` columns on decisions/tasks implement §21.2 optimistic concurrency.

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  artifact_type text not null check (artifact_type in
    ('DOCUMENT','MARKDOWN','DIAGRAM','FLOWCHART','ARCHITECTURE','GRAPH','CHART','TIMELINE',
     'MINDMAP','DECISION_TREE','TABLE','RESEARCH','IMAGE','INTERACTIVE','CODE','HTML','OTHER')),
  created_by_user_id uuid null references public.profiles(id),
  created_by_ai_id uuid null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','GENERATING','DELETED')),
  pinned boolean not null default false,
  current_version_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists artifacts_project_idx on public.artifacts (project_id, updated_at desc);

create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_number integer not null,
  content_type text not null,
  content_ref text not null,
  checksum text null,
  created_by_user_id uuid null,
  created_by_ai_id uuid null,
  parent_version_id uuid null,
  created_at timestamptz not null default now(),
  unique (artifact_id, version_number)
);

alter table public.artifacts
  add column if not exists current_version_id uuid null;
-- (FK added after versions exist)
do $$ begin
  alter table public.artifacts
    add constraint artifacts_current_version_fk
    foreign key (current_version_id) references public.artifact_versions(id);
exception when duplicate_object then null; end $$;

create table if not exists public.artifact_links (
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  relation text not null,
  primary key (artifact_id, target_type, target_id, relation)
);

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  context text null,
  options jsonb null,
  selected_option jsonb null,
  rationale text null,
  status text not null default 'PROPOSED' check (status in ('PROPOSED','APPROVED','REJECTED','SUPERSEDED')),
  version integer not null default 1,
  proposed_by uuid null,
  approved_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz null
);

create index if not exists decisions_project_idx on public.decisions (project_id, created_at desc);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text null,
  owner_user_id uuid null references public.profiles(id),
  status text not null default 'TODO' check (status in ('TODO','IN_PROGRESS','DONE','CANCELLED')),
  priority text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','URGENT')),
  due_at timestamptz null,
  version integer not null default 1,
  created_by_user_id uuid null,
  created_by_ai_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index if not exists tasks_project_idx on public.tasks (project_id, status);

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.project_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  summary text null,
  created_by_user_id uuid null,
  created_by_ai_id uuid null,
  snapshot_payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  started_by uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','ENDED')),
  summary_artifact_id uuid null
);

create table if not exists public.meeting_candidates (
  id uuid primary key default gen_random_uuid(),
  meeting_session_id uuid not null references public.meeting_sessions(id) on delete cascade,
  candidate_type text not null check (candidate_type in
    ('DECISION','TASK','OPEN_QUESTION','CONTRADICTION','RESEARCH_NEED','MILESTONE_CHANGE')),
  content jsonb not null,
  confidence numeric(4,3) not null,
  source_message_id uuid null,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED','MERGED','EXPIRED')),
  promoted_to_type text null,
  promoted_to_id uuid null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create index if not exists meeting_candidates_session_idx
  on public.meeting_candidates (meeting_session_id, status);

create table if not exists public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_session_id uuid not null unique references public.meeting_sessions(id) on delete cascade,
  summary_text text not null,
  decisions_json jsonb not null default '[]'::jsonb,
  tasks_json jsonb not null default '[]'::jsonb,
  open_questions_json jsonb not null default '[]'::jsonb,
  research_needed_json jsonb not null default '[]'::jsonb,
  risks_json jsonb not null default '[]'::jsonb,
  next_steps_json jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  confirmed_by uuid null,
  confirmed_at timestamptz null
);

create table if not exists public.ai_proactive_suggestions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null,
  reason_code text not null,
  summary text not null,
  confidence numeric(4,3) not null,
  status text not null default 'PENDING' check (status in ('PENDING','SHOWN','ACTED','DISMISSED')),
  created_at timestamptz not null default now(),
  shown_at timestamptz null,
  acted_at timestamptz null
);

create index if not exists proactive_group_idx
  on public.ai_proactive_suggestions (group_id, created_at desc);

-- RLS: members read; service layer owns mutations.
alter table public.artifacts enable row level security;
create policy artifacts_select on public.artifacts
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = artifacts.project_id and public.is_group_member(p.group_id)
  ));

alter table public.artifact_versions enable row level security;
create policy artifact_versions_select on public.artifact_versions
  for select
  using (exists (
    select 1 from public.artifacts a
    join public.projects p on p.id = a.project_id
    where a.id = artifact_versions.artifact_id and public.is_group_member(p.group_id)
  ));

alter table public.decisions enable row level security;
create policy decisions_select on public.decisions
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = decisions.project_id and public.is_group_member(p.group_id)
  ));

alter table public.tasks enable row level security;
create policy tasks_select on public.tasks
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = tasks.project_id and public.is_group_member(p.group_id)
  ));

alter table public.project_snapshots enable row level security;
create policy snapshots_select on public.project_snapshots
  for select
  using (exists (
    select 1 from public.projects p
    where p.id = project_snapshots.project_id and public.is_group_member(p.group_id)
  ));

alter table public.meeting_sessions enable row level security;
create policy meetings_select on public.meeting_sessions
  for select
  using (public.is_group_member(group_id));

alter table public.meeting_candidates enable row level security;
create policy meeting_candidates_select on public.meeting_candidates
  for select
  using (exists (
    select 1 from public.meeting_sessions s
    where s.id = meeting_candidates.meeting_session_id
      and public.is_group_member(s.group_id)
  ));

alter table public.meeting_summaries enable row level security;
create policy meeting_summaries_select on public.meeting_summaries
  for select
  using (exists (
    select 1 from public.meeting_sessions s
    where s.id = meeting_summaries.meeting_session_id
      and public.is_group_member(s.group_id)
  ));

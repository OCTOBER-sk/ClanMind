-- §30 Group AI agent — one shared AI identity per Group (default: Odin).
-- The unique constraint keeps v1 single-agent; business logic must not
-- couple to that uniqueness beyond this constraint so a future is_primary
-- flag is a non-breaking migration (§2.2).

create table if not exists public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null unique references public.groups(id) on delete cascade,
  name text not null default 'Odin',
  avatar_object_id uuid null,
  language text null,
  tone text null,
  personality_config jsonb not null default '{}'::jsonb,
  mode_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_agents enable row level security;
create policy ai_agents_select on public.ai_agents
  for select
  using (public.is_group_member(group_id));
create policy ai_agents_update on public.ai_agents
  for update
  using (exists (
    select 1 from public.group_members
    where group_id = ai_agents.group_id
      and user_id = auth.uid()
      and role in ('OWNER','ADMIN')
      and removed_at is null
  ));

create trigger ai_agents_touch_updated_at
  before update on public.ai_agents
  for each row execute function public.touch_updated_at();

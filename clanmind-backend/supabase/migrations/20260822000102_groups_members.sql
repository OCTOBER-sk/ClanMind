-- §24 groups + §25 group_members + §87A RLS.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text null,
  avatar_object_id uuid null,
  owner_user_id uuid not null references public.profiles(id),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','ARCHIVED','DELETING','DELETED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists groups_owner_idx on public.groups (owner_user_id);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('OWNER','ADMIN','MEMBER','GUEST')),
  joined_at timestamptz not null default now(),
  removed_at timestamptz null,
  group_display_name text null,
  group_avatar_object_id uuid null,
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id)
  where removed_at is null;

-- §87A reusable membership predicate for RLS policies.
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and removed_at is null
  );
$$;

-- §87A: groups policies — members read; OWNER/ADMIN update.
alter table public.groups enable row level security;

create policy groups_select on public.groups
  for select
  using (public.is_group_member(id));

create policy groups_update on public.groups
  for update
  using (
    exists (
      select 1 from public.group_members
      where group_id = groups.id
        and user_id = auth.uid()
        and role in ('OWNER','ADMIN')
        and removed_at is null
    )
  );

-- Writes for group_members: the service layer owns membership mutations
-- (role rules, owner invariants); direct client writes are not permitted.
alter table public.group_members enable row level security;

create policy group_members_select on public.group_members
  for select
  using (public.is_group_member(group_id));

create trigger groups_touch_updated_at
  before update on public.groups
  for each row execute function public.touch_updated_at();

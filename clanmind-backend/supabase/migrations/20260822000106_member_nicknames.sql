-- §26 member_nicknames — a viewer can rename a teammate only for themselves.
-- The nickname belongs to (viewer, Group, target); no other member sees it.

create table if not exists public.member_nicknames (
  group_id uuid not null references public.groups(id) on delete cascade,
  viewer_user_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, viewer_user_id, target_user_id),
  check (viewer_user_id <> target_user_id)
);

alter table public.member_nicknames enable row level security;

-- Viewer-private by definition: only the viewer reads/writes their mappings.
create policy member_nicknames_select on public.member_nicknames
  for select
  using (viewer_user_id = auth.uid());

create policy member_nicknames_write on public.member_nicknames
  for insert
  with check (
    viewer_user_id = auth.uid()
    and public.is_group_member(group_id)
  );

create policy member_nicknames_update on public.member_nicknames
  for update
  using (viewer_user_id = auth.uid());

create policy member_nicknames_delete on public.member_nicknames
  for delete
  using (viewer_user_id = auth.uid());

create trigger member_nicknames_touch_updated_at
  before update on public.member_nicknames
  for each row execute function public.touch_updated_at();

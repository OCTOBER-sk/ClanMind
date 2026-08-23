-- §41 message_reactions + §39B message_pins.

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

create table if not exists public.message_pins (
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id),
  pinned_at timestamptz not null default now(),
  unpinned_at timestamptz null,
  primary key (group_id, message_id)
);

create index if not exists message_pins_open_idx
  on public.message_pins (group_id, project_id)
  where unpinned_at is null;

alter table public.message_reactions enable row level security;
create policy message_reactions_select on public.message_reactions
  for select
  using (exists (
    select 1 from public.messages m
    where m.id = message_reactions.message_id
      and (
        (m.visibility = 'GROUP' and public.is_group_member(m.group_id))
        or exists (
          select 1 from public.private_conversations pc
          join public.private_conversation_members pcm on pcm.conversation_id = pc.id
          where pc.id = m.private_conversation_id and pcm.user_id = auth.uid()
        )
      )
  ));

alter table public.message_pins enable row level security;
create policy message_pins_select on public.message_pins
  for select
  using (public.is_group_member(group_id));

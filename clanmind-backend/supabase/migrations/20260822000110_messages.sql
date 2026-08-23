-- §39 messages + §39A revisions + §40 private conversations (needed by the
-- §87A messages RLS policies) + per-group sequence allocation.

create table if not exists public.private_conversations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  type text not null check (type in ('HUMAN_PAIR','AI')),
  created_by uuid not null references public.profiles(id),
  ai_agent_id uuid null,
  created_at timestamptz not null default now()
);

create table if not exists public.private_conversation_members (
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create index if not exists pcm_user_idx on public.private_conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  sender_type text not null check (sender_type in ('USER','AI','SYSTEM')),
  sender_user_id uuid null references public.profiles(id),
  sender_ai_id uuid null,
  visibility text not null check (visibility in ('GROUP','PRIVATE_PAIR','PRIVATE_AI')),
  private_conversation_id uuid null references public.private_conversations(id),
  body text not null,
  body_format text not null default 'markdown',
  reply_to_id uuid null references public.messages(id),
  client_message_id text not null,
  server_sequence bigint not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz null,
  deleted_at timestamptz null,
  unique (group_id, client_message_id)
);

create index if not exists messages_group_seq_idx on public.messages (group_id, server_sequence);
create index if not exists messages_group_created_idx on public.messages (group_id, created_at);
create index if not exists messages_project_created_idx on public.messages (project_id, created_at);
create index if not exists messages_sender_created_idx on public.messages (sender_user_id, created_at);

create table if not exists public.message_revisions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  previous_body text not null,
  previous_body_format text not null,
  edited_by_user_id uuid null,
  edited_by_ai_id uuid null,
  edited_at timestamptz not null default now()
);

create index if not exists message_revisions_idx on public.message_revisions (message_id, edited_at);

-- Per-group message sequence (§39 server_sequence).
create table if not exists public.group_sequences (
  group_id uuid primary key references public.groups(id) on delete cascade,
  last_sequence bigint not null default 0
);

-- §87A messages RLS: one policy per visibility — no catch-all using(true).
alter table public.messages enable row level security;

create policy messages_select_group on public.messages
  for select
  using (
    visibility = 'GROUP'
    and public.is_group_member(group_id)
  );

create policy messages_select_private_pair on public.messages
  for select
  using (
    visibility = 'PRIVATE_PAIR'
    and exists (
      select 1 from public.private_conversations pc
      join public.private_conversation_members pcm on pcm.conversation_id = pc.id
      where pc.id = messages.private_conversation_id
        and pcm.user_id = auth.uid()
    )
  );

create policy messages_select_private_ai on public.messages
  for select
  using (
    visibility = 'PRIVATE_AI'
    and exists (
      select 1 from public.private_conversations pc
      join public.private_conversation_members pcm on pcm.conversation_id = pc.id
      where pc.id = messages.private_conversation_id
        and pcm.user_id = auth.uid()
    )
  );

-- §122 atomic write: message + mentions + outbox in one transaction.
create or replace function public.create_message_with_mentions(input jsonb)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid := (input->>'group_id')::uuid;
  v_seq bigint;
  v_message public.messages;
begin
  insert into public.group_sequences (group_id, last_sequence)
  values (v_group_id, 1)
  on conflict (group_id)
  do update set last_sequence = public.group_sequences.last_sequence + 1
  returning last_sequence into v_seq;

  insert into public.messages (
    group_id, project_id, sender_type, sender_user_id, visibility,
    private_conversation_id, body, body_format, reply_to_id,
    client_message_id, server_sequence
  ) values (
    v_group_id,
    (input->>'project_id')::uuid,
    coalesce(input->>'sender_type', 'USER'),
    (input->>'sender_user_id')::uuid,
    coalesce(input->>'visibility', 'GROUP'),
    (input->>'private_conversation_id')::uuid,
    input->>'body',
    coalesce(input->>'body_format', 'markdown'),
    (input->>'reply_to_id')::uuid,
    input->>'client_message_id',
    v_seq
  )
  on conflict (group_id, client_message_id) do nothing
  returning * into v_message;

  if v_message is null then
    -- Idempotent duplicate: return the already-created message (§19).
    select * into v_message from public.messages
    where group_id = v_group_id and client_message_id = input->>'client_message_id';
    return v_message;
  end if;

  if jsonb_typeof(input->'mention_user_ids') = 'array' then
    insert into public.message_mentions (message_id, mentioned_user_id)
    select v_message.id, m::uuid
    from jsonb_array_elements_text(input->'mention_user_ids') as m;
  end if;

  insert into public.outbox_events (event_type, aggregate_type, aggregate_id, group_id, actor_id, payload)
  values (
    'message.created', 'message', v_message.id, v_group_id,
    (input->>'sender_user_id')::uuid,
    jsonb_build_object(
      'message_id', v_message.id,
      'visibility', v_message.visibility,
      'private_conversation_id', v_message.private_conversation_id,
      'project_id', v_message.project_id,
      'server_sequence', v_message.server_sequence,
      'preview', left(v_message.body, 140)
    )
  );

  return v_message;
end;
$$;

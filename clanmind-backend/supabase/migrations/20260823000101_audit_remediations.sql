-- Audit remediations (post-implementation review against the spec):
-- 1. §42: the missing `message_mentions` table — the atomic send RPC
--    (create_message_with_mentions) and the mention-filtered search both
--    reference it; without it every mention-bearing send fails.
-- 2. §57A: missing FK `ai_tool_calls.ai_action_id → ai_actions(id)` — the
--    approval-binding integrity anchor required by spec line 2506.
-- 3. §52: `ai_runs.provider_config_id` must be not null.
-- 4. §32: enforce "at most three fallback positions" at the DB level via a
--    unique (group_id, role) constraint (the partial PRIMARY-only index did
--    not stop duplicate FALLBACK_n rows).
-- 5. §39B: pin visibility inherits the pinned message's visibility — add the
--    column that carries it and backfill from the joined message.
-- 6. §87/§87A defense-in-depth: RLS on tables that expose private or
--    sensitive rows but had no policies (message_revisions leaks pre-edit
--    private bodies; private_conversation* leaks the private graph;
--    ai_tool_calls leaks tool payloads). audit_events becomes service-only.

-- ---------------------------------------------------------------------------
-- 1. message_mentions (§42)
-- ---------------------------------------------------------------------------
create table if not exists public.message_mentions (
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid null references public.profiles(id) on delete cascade,
  mentioned_ai_id uuid null,
  created_at timestamptz not null default now()
);

create index if not exists message_mentions_message_idx
  on public.message_mentions (message_id);
create index if not exists message_mentions_user_idx
  on public.message_mentions (mentioned_user_id);

alter table public.message_mentions enable row level security;

create policy message_mentions_select on public.message_mentions
  for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_mentions.message_id
        and (
          (m.visibility = 'GROUP' and public.is_group_member(m.group_id))
          or (
            m.visibility in ('PRIVATE_PAIR','PRIVATE_AI')
            and exists (
              select 1 from public.private_conversation_members pcm
              where pcm.conversation_id = m.private_conversation_id
                and pcm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 2. ai_tool_calls → ai_actions integrity anchor (§57A)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_tool_calls_action_fk'
      and conrelid = 'public.ai_tool_calls'::regclass
  ) then
    alter table public.ai_tool_calls
      add constraint ai_tool_calls_action_fk
      foreign key (ai_action_id) references public.ai_actions(id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. ai_runs.provider_config_id not null (§52)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_runs'
      and column_name = 'provider_config_id'
      and is_nullable = 'YES'
  ) then
    alter table public.ai_runs alter column provider_config_id set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. One route per role per group (§32: one PRIMARY, ≤3 fallbacks)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'ai_model_routes'
      and indexname = 'ai_model_routes_group_role_key'
  ) then
    create unique index ai_model_routes_group_role_key
      on public.ai_model_routes (group_id, role);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. message_pins visibility inheritance (§39B)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'message_pins'
      and column_name = 'visibility'
  ) then
    alter table public.message_pins
      add column visibility text not null default 'GROUP';
  end if;
end $$;

update public.message_pins p
set visibility = m.visibility
from public.messages m
where m.id = p.message_id
  and p.visibility is distinct from m.visibility;

create index if not exists message_pins_group_visible_idx
  on public.message_pins (group_id)
  where unpinned_at is null and visibility = 'GROUP';

-- Pin rows are readable only by members who can read the underlying message.
alter table public.message_pins enable row level security;

drop policy if exists message_pins_select on public.message_pins;
create policy message_pins_select on public.message_pins
  for select
  using (
    (
      visibility = 'GROUP'
      and public.is_group_member(group_id)
    )
    or (
      visibility in ('PRIVATE_PAIR','PRIVATE_AI')
      and exists (
        select 1 from public.messages m
        join public.private_conversation_members pcm
          on pcm.conversation_id = m.private_conversation_id
        where m.id = message_pins.message_id
          and pcm.user_id = auth.uid()
      )
    )
  );

drop policy if exists message_pins_write on public.message_pins;
create policy message_pins_write on public.message_pins
  for insert
  with check (public.is_group_member(group_id));

-- ---------------------------------------------------------------------------
-- 6a. message_revisions RLS — pre-edit bodies inherit message visibility.
--     (Spec §39A: revisions readable by exactly those who can read the
--     message itself.)
-- ---------------------------------------------------------------------------
alter table public.message_revisions enable row level security;

create policy message_revisions_select on public.message_revisions
  for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_revisions.message_id
        and (
          (m.visibility = 'GROUP' and public.is_group_member(m.group_id))
          or (
            m.visibility in ('PRIVATE_PAIR','PRIVATE_AI')
            and exists (
              select 1 from public.private_conversation_members pcm
              where pcm.conversation_id = m.private_conversation_id
                and pcm.user_id = auth.uid()
            )
          )
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 6b. private_conversations / private_conversation_members RLS — the private
--     graph is visible to conversation participants only (§2.4/§11.2).
-- ---------------------------------------------------------------------------
alter table public.private_conversations enable row level security;

create policy private_conversations_participant on public.private_conversations
  for select
  using (
    exists (
      select 1 from public.private_conversation_members pcm
      where pcm.conversation_id = private_conversations.id
        and pcm.user_id = auth.uid()
    )
  );

alter table public.private_conversation_members enable row level security;

create policy private_conversation_members_self on public.private_conversation_members
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.private_conversation_members other
      where other.conversation_id = private_conversation_members.conversation_id
        and other.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 6c. ai_tool_calls RLS — tool payloads may contain sensitive material.
--     Group members may read ledger rows for their group; everything else is
--     service-layer only.
-- ---------------------------------------------------------------------------
alter table public.ai_tool_calls enable row level security;

create policy ai_tool_calls_group_select on public.ai_tool_calls
  for select
  using (
    exists (
      select 1 from public.ai_runs r
      where r.id = ai_tool_calls.ai_run_id
        and public.is_group_member(r.group_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 6d. audit_events lockdown (§99 append-only from the application's point of
--     view): revoke client SELECT/INSERT entirely — writes flow exclusively
--     through the Worker's service-role connection.
-- ---------------------------------------------------------------------------
revoke select on public.audit_events from anon, authenticated;
revoke insert on public.audit_events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. §122 RPC update: carry sender_ai_id so AI responses persist with the
--    correct sender identity (sender_type = 'AI', sender_user_id null).
-- ---------------------------------------------------------------------------
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
    group_id, project_id, sender_type, sender_user_id, sender_ai_id,
    visibility, private_conversation_id, body, body_format, reply_to_id,
    client_message_id, server_sequence
  ) values (
    v_group_id,
    (input->>'project_id')::uuid,
    coalesce(input->>'sender_type', 'USER'),
    (input->>'sender_user_id')::uuid,
    (input->>'sender_ai_id')::uuid,
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
    coalesce((input->>'sender_user_id')::uuid, (input->>'sender_ai_id')::uuid),
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

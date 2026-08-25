-- Blocker 2 (FINAL_PREKEY_VERIFICATION A4/B2): the composer uploads
-- attachment bytes BEFORE the message exists, then sends `attachment_ids`
-- on POST /messages. The previous §122 RPC ignored that field, so live
-- messages never gained `message_attachments` rows (links silently lost).
--
-- This replaces `create_message_with_mentions` with a version that inserts
-- the §43 `message_attachments` links INSIDE the same transaction as the
-- message, mentions and the `message.created` outbox row.
--
-- M3-consistent authorization (mirrors handlers/attachments.ts
-- linkToMessageInGroup): every linked attachment must belong to THIS Group,
-- be owned by the message sender, and still exist. A forged, foreign or
-- deleted id aborts the WHOLE transaction — links are never silently
-- dropped, and no partial write escapes.

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
    -- Idempotent duplicate: return the already-created message (§19). Its
    -- attachment links were persisted by the original call — never re-inserted.
    select * into v_message from public.messages
    where group_id = v_group_id and client_message_id = input->>'client_message_id';
    return v_message;
  end if;

  if jsonb_typeof(input->'mention_user_ids') = 'array' then
    insert into public.message_mentions (message_id, mentioned_user_id)
    select v_message.id, m::uuid
    from jsonb_array_elements_text(input->'mention_user_ids') as m;
  end if;

  -- ---------------------------------------------------------------------
  -- §43/§122 attachment links (this migration's purpose).
  -- Authorization first: any attachment that does not exist, is soft-deleted,
  -- belongs to another Group, or is not owned by the sender aborts the
  -- transaction (loud contract violation — never a silent strip).
  -- ---------------------------------------------------------------------
  if jsonb_typeof(input->'attachment_ids') = 'array' then
    perform 1
    from jsonb_array_elements_text(input->'attachment_ids') as a(id)
    where not exists (
      select 1 from public.attachments att
      where att.id = (a.id)::uuid
        and att.group_id = v_group_id
        and att.owner_user_id = coalesce(
              (input->>'sender_user_id')::uuid,
              (input->>'sender_ai_id')::uuid)
        and att.deleted_at is null
    )
    limit 1;
    if found then
      raise exception
        'attachment_ids contains an unknown, deleted, foreign-Group, or non-owned attachment';
    end if;

    insert into public.message_attachments (message_id, attachment_id)
    select distinct v_message.id, a.id::uuid
    from jsonb_array_elements_text(input->'attachment_ids') as a(id)
    on conflict (message_id, attachment_id) do nothing;
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

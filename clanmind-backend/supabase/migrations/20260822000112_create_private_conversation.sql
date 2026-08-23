-- Atomic private-conversation creation: conversation + members together.

create or replace function public.create_private_conversation(
  p_group_id uuid,
  p_type text,
  p_created_by uuid,
  p_ai_agent_id uuid,
  p_member_user_ids uuid[]
)
returns public.private_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.private_conversations;
begin
  insert into public.private_conversations (group_id, type, created_by, ai_agent_id)
  values (p_group_id, p_type, p_created_by, p_ai_agent_id)
  returning * into v_conversation;

  insert into public.private_conversation_members (conversation_id, user_id)
  select v_conversation.id, m from unnest(p_member_user_ids) as m;

  return v_conversation;
end;
$$;

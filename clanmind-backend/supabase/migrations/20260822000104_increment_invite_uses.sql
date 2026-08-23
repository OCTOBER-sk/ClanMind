-- Atomic invite use increment for §8 acceptance (no silent max_uses overrun).
create or replace function public.increment_invite_uses(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.group_invites
  set uses_count = uses_count + 1
  where id = p_invite_id
    and revoked_at is null
    and expires_at > now()
    and (max_uses is null or uses_count < max_uses);

  if not found then
    raise exception 'invite_not_acceptable';
  end if;
end;
$$;

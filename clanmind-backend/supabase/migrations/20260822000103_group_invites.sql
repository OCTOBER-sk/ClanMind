-- §27 group_invites — invite issuance/acceptance (§8).
-- Only a hash of the invite token is stored (§8.2); the raw token exists only
-- in the share link / email handed to the recipient.

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  email text null,
  role text not null check (role in ('ADMIN','MEMBER','GUEST')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer null,
  uses_count integer not null default 0,
  revoked_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists group_invites_group_idx on public.group_invites (group_id);

alter table public.group_invites enable row level security;

-- Invites are managed exclusively through the service layer (token secrecy,
-- expiry, and use-count rules); direct client reads are not permitted.
create policy group_invites_select on public.group_invites
  for select
  using (public.is_group_member(group_id));

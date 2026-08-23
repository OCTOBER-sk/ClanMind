-- §43 attachments + message_attachments.

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null references public.projects(id) on delete set null,
  owner_user_id uuid not null references public.profiles(id),
  object_ref text not null,
  object_storage text not null check (object_storage in ('LOCAL_REFERENCE','R2')),
  mime_type text not null,
  byte_size bigint not null,
  checksum text null,
  original_name text not null,
  status text not null check (status in
    ('LOCAL_ONLY','QUEUED','UPLOADING','SYNCED','REMOTE_CHANGED','LOCAL_CHANGED',
     'CONFLICT','DELETED','RESTORABLE')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists attachments_group_idx on public.attachments (group_id);
create index if not exists attachments_owner_idx on public.attachments (owner_user_id);

create table if not exists public.message_attachments (
  message_id uuid not null references public.messages(id) on delete cascade,
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  primary key (message_id, attachment_id)
);

alter table public.attachments enable row level security;
create policy attachments_select on public.attachments
  for select
  using (public.is_group_member(group_id));

alter table public.message_attachments enable row level security;
create policy message_attachments_select on public.message_attachments
  for select
  using (exists (
    select 1 from public.attachments a
    where a.id = message_attachments.attachment_id
      and public.is_group_member(a.group_id)
  ));

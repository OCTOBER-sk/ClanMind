-- §125 search index + §95A notifications + §98A activity_events.

-- §125 Postgres full-text search over messages. The index inherits the same
-- privacy boundary as the source data: queries always filter by visibility +
-- membership/conversation ACL (§13).
alter table public.messages
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('simple', coalesce(body, ''))) stored;

create index if not exists messages_search_idx
  on public.messages using gin (search_vector);

-- §95A
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null,
  category text not null check (category in
    ('MENTION','PRIVATE_MESSAGE','AI_RESPONSE','AI_ACTION_APPROVAL','TASK_ASSIGNMENT',
     'DECISION_APPROVAL','ARTIFACT_READY','GITHUB_EVENT','MEETING_SUMMARY',
     'PROACTIVE_AI','SYSTEM')),
  subject_type text not null,
  subject_id uuid not null,
  title text not null,
  body text null,
  delivery_state text not null default 'PENDING' check (delivery_state in
    ('PENDING','DELIVERED_REALTIME','DELIVERED_EMAIL','SUPPRESSED_BY_PREFERENCE','FAILED')),
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (recipient_user_id, read_at)
  where read_at is null;

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  category text not null,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  primary key (user_id, group_id, category)
);

alter table public.notifications enable row level security;
create policy notifications_select_own on public.notifications
  for select
  using (recipient_user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update
  using (recipient_user_id = auth.uid());

alter table public.notification_preferences enable row level security;
create policy notification_preferences_own on public.notification_preferences
  for select
  using (user_id = auth.uid());
create policy notification_preferences_write_own on public.notification_preferences
  for insert
  with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences
  for update
  using (user_id = auth.uid());

-- §98A activity feed — denormalized, pre-rendered, never PRIVATE_*.
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  project_id uuid null,
  actor_type text not null check (actor_type in ('USER','AI','SYSTEM')),
  actor_user_id uuid null,
  actor_ai_id uuid null,
  activity_type text not null,
  summary text not null,
  subject_type text not null,
  subject_id uuid not null,
  visibility text not null check (visibility in ('GROUP','PROJECT')),
  occurred_at timestamptz not null default now()
);

create index if not exists activity_group_idx
  on public.activity_events (group_id, occurred_at desc);
create index if not exists activity_project_idx
  on public.activity_events (project_id, occurred_at desc)
  where project_id is not null;

alter table public.activity_events enable row level security;
create policy activity_select on public.activity_events
  for select
  using (public.is_group_member(group_id));

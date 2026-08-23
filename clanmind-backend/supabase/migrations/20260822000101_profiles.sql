-- §23 profiles — application-side user record.
-- Supabase Auth `auth.users` owns credentials (§6.1); never duplicate
-- passwords in the application schema (Correction 1).

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email_snapshot text,
  display_name text not null,
  avatar_object_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz null
);

-- §87/§87A: RLS as defense-in-depth for direct reads. Each user may read and
-- update only their own profile row; the Worker service layer remains the
-- authorization authority for anything involving business rules.
alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update
  using (id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert
  with check (id = auth.uid());

create index if not exists profiles_last_seen_idx on public.profiles (last_seen_at desc nulls last);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- §31 ai_provider_configs + §32 ai_model_routes.
-- API keys never live in these tables — only secret-store references (§63).

create table if not exists public.ai_provider_configs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  kind text not null check (kind in ('APPLICATION','BYOK')),
  provider text not null,
  credential_ref text null,
  key_last4 text null,
  enabled boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_provider_configs_group_idx
  on public.ai_provider_configs (group_id, kind);

create table if not exists public.ai_model_routes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  provider_config_id uuid not null references public.ai_provider_configs(id) on delete cascade,
  role text not null check (role in ('PRIMARY','FALLBACK_1','FALLBACK_2','FALLBACK_3')),
  model_id text not null,
  priority integer not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists ai_model_routes_group_idx on public.ai_model_routes (group_id);
create unique index if not exists ai_model_routes_one_primary
  on public.ai_model_routes (group_id)
  where role = 'PRIMARY' and enabled;

alter table public.ai_provider_configs enable row level security;
create policy ai_provider_configs_select on public.ai_provider_configs
  for select
  using (exists (
    select 1 from public.group_members
    where group_id = ai_provider_configs.group_id
      and user_id = auth.uid()
      and role in ('OWNER','ADMIN')
      and removed_at is null
  ));

alter table public.ai_model_routes enable row level security;
create policy ai_model_routes_select on public.ai_model_routes
  for select
  using (exists (
    select 1 from public.group_members
    where group_id = ai_model_routes.group_id
      and user_id = auth.uid()
      and removed_at is null
  ));

create trigger ai_provider_configs_touch_updated_at
  before update on public.ai_provider_configs
  for each row execute function public.touch_updated_at();

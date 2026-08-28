-- §31 bis: allow arbitrary OpenAI-compatible endpoints (BYOK versatility —
-- local ollama/lm-studio/custom gateways). base_url overrides the built-in
-- provider map when set.
alter table public.ai_provider_configs
  add column if not exists base_url text null;

-- Index is unnecessary (low-cardinality, group-scoped lookups are by PK);
-- only widen the RLS select policy implicitly (no new columns exposed beyond
-- group admin, already covered).

comment on column public.ai_provider_configs.base_url is
  'Optional custom OpenAI-compatible base URL. When set, overrides PROVIDER_BASE_URLS; enables local/custom providers.';

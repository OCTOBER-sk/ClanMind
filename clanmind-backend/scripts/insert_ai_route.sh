#!/usr/bin/env bash
# Insert OpenRouter APPLICATION provider config + PRIMARY/fallback routes directly into
# Supabase (bypassing the /models listing path), then verify. Run from clanmind-backend.
set -uo pipefail
cd ~/projects/ClanMind/clanmind-backend
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SERVICE_ROLE=$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' apps/worker/.dev.vars | cut -d= -f2-)
GID=$(grep -oE '^GID=.*' /tmp/e2e_refs.txt | cut -d= -f2-)
OWNER="67d85b9b-c4eb-4206-898f-cf4b21d3a214"

AUTH="apikey: $SERVICE_ROLE"
echo "### delete any prior config/routes for group"
curl -s -m 20 -X POST "$SUPABASE_URL/rest/v1/rpc/delete_group_routes" -H "$AUTH" -H "Authorization: Bearer $SERVICE_ROLE" -H "Content-Type: application/json" -d "{\"gid\":\"$GID\"}" >/dev/null 2>&1 || true

echo "### insert provider config"
CFG=$(curl -s -m 20 -X POST "$SUPABASE_URL/rest/v1/ai_provider_configs" \
  -H "$AUTH" -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"group_id\":\"$GID\",\"kind\":\"APPLICATION\",\"provider\":\"openrouter\",\"credential_ref\":null,\"key_last4\":null,\"created_by\":\"$OWNER\",\"enabled\":true}")
echo "$CFG"
CFGID=$(echo "$CFG" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if isinstance(d,list) and d else '')" 2>/dev/null)
echo "CFGID=$CFGID"

echo "### insert routes (PRIMARY gpt-4o-mini + fallbacks)"
ROUTE=$(curl -s -m 20 -X POST "$SUPABASE_URL/rest/v1/ai_model_routes" \
  -H "$AUTH" -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "[{\"group_id\":\"$GID\",\"provider_config_id\":\"$CFGID\",\"role\":\"PRIMARY\",\"model_id\":\"openai/gpt-4o-mini\",\"priority\":0,\"enabled\":true},
       {\"group_id\":\"$GID\",\"provider_config_id\":\"$CFGID\",\"role\":\"FALLBACK_1\",\"model_id\":\"deepseek/deepseek-chat\",\"priority\":1,\"enabled\":true},
       {\"group_id\":\"$GID\",\"provider_config_id\":\"$CFGID\",\"role\":\"FALLBACK_2\",\"model_id\":\"qwen/qwen-2.5-72b-instruct\",\"priority\":2,\"enabled\":true}]")
echo "$ROUTE" | python3 -c "import sys,json;d=json.load(sys.stdin);print('routes inserted:',[(r['role'],r['model_id']) for r in d])" 2>/dev/null || echo "$ROUTE"
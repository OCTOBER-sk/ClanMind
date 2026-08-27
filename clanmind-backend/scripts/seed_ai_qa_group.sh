#!/usr/bin/env bash
# Seed OpenRouter APPLICATION AI config + routes for the QA group (85b2dcff).
set -uo pipefail
cd /home/santhosh/projects/ClanMind/clanmind-backend
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SERVICE_ROLE=$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' apps/worker/.dev.vars | cut -d= -f2-)
GID="85b2dcff-1d25-4b02-9066-ea5d10dac06c"; OWNER="82c7e38f-cbcd-4e8c-88e5-f83343036d41"
A="apikey: $SERVICE_ROLE"
echo "### config"
CFG=$(curl -s -m 20 -o /tmp/cfg.json -w "%{http_code}" -X POST "$SUPABASE_URL/rest/v1/ai_provider_configs" \
  -H "$A" -H "Authorization: Bearer $SERVICE_ROLE" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "{\"group_id\":\"$GID\",\"kind\":\"APPLICATION\",\"provider\":\"openrouter\",\"credential_ref\":null,\"key_last4\":null,\"created_by\":\"$OWNER\",\"enabled\":true}")
echo "cfg HTTP $CFG"; head -c 300 /tmp/cfg.json; echo
CFGID=$(python3 -c "import json;d=json.load(open('/tmp/cfg.json'));print(d[0]['id'] if isinstance(d,list) and d else (d.get('id') or ''))" 2>/dev/null)
echo "CFGID=$CFGID"
if [ -z "$CFGID" ]; then echo "INSERT FAILED — retry REST reachability below"; curl -s -m 15 -o /dev/null -w "REST probe HTTP %{http_code}\n" "$SUPABASE_URL/rest/v1/health" -H "$A" -H "Authorization: Bearer $SERVICE_ROLE"; exit 1; fi
echo "### routes"
curl -s -m 20 -o /tmp/routes.json -w "HTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/ai_model_routes" \
  -H "$A" -H "Authorization: Bearer $SERVICE_ROLE" -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d "[{\"group_id\":\"$GID\",\"provider_config_id\":\"$CFGID\",\"role\":\"PRIMARY\",\"model_id\":\"openai/gpt-4o-mini\",\"priority\":0,\"enabled\":true},
       {\"group_id\":\"$GID\",\"provider_config_id\":\"$CFGID\",\"role\":\"FALLBACK_1\",\"model_id\":\"deepseek/deepseek-chat\",\"priority\":1,\"enabled\":true}]"
python3 -c "import json;d=json.load(open('/tmp/routes.json'));print('routes:',[(r['role'],r['model_id']) for r in d])" 2>/dev/null || cat /tmp/routes.json
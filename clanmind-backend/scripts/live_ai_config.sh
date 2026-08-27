#!/usr/bin/env bash
# Provision real OpenRouter AI config for the E2E group, then re-run AI.
set -uo pipefail
cd ~/projects/ClanMind/clanmind-backend
BASE="http://localhost:8787"
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SERVICE_ROLE=$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' apps/worker/.dev.vars | cut -d= -f2-)
SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)
APPKEY=$(grep -oE '^APPLICATION_AI_API_KEY=.*' apps/worker/.dev.vars | cut -d= -f2-)
ANON=$(curl -s -m 20 -H "Authorization: Bearer $SBP" \
  "https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print([k['api_key'] for k in d if k['name']=='anon'][0])")
GID=$(grep -oE '^GID=.*' /tmp/e2e_refs.txt | cut -d= -f2-)
PID=$(grep -oE '^PID=.*' /tmp/e2e_refs.txt | cut -d= -f2-)

EMAIL="freshlogin@clanmind.io"; PASS="ClanMind#Fresh#2026"
TOK=$(curl -s -m 20 -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")

echo "### validate+store OpenRouter provider config"
V=$(curl -s -m 40 -X POST "$BASE/api/v1/groups/$GID/ai/providers/validate" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "{\"provider\":\"openrouter\",\"api_key\":\"$APPKEY\"}")
echo "$V" | head -c 2000; echo
CFGID=$(echo "$V" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('config',{}).get('id',''))" 2>/dev/null)
echo "CFGID=$CFGID"

echo; echo "### available models (first 25 ids)"
echo "$V" | python3 -c "import sys,json;d=json.load(sys.stdin);ms=d.get('models',[]);[print(m.get('id')) for m in ms[:25]];
import json as j;open('/tmp/models.json','w').write(j.dumps(ms))"

echo; echo "### pick model + wire PRIMARY route"
# prefer a capable reasoning/free model present in the list; fall back to first
MODEL=$(echo "$V" | python3 -c "
import sys,json
d=json.load(sys.stdin); ms=d.get('models',[])
prefs=['anthropic/claude-3.5-sonnet','openai/gpt-4o','openai/gpt-4o-mini','meta-llama/llama-3.3-70b-instruct','anthropic/claude-sonnet-4']
ids=[m.get('id') for m in ms]
import re
for p in prefs:
    hit=[i for i in ids if p in i]
    if hit: print(hit[0]); break
else:
    print(ids[0] if ids else '')
")
echo "MODEL=$MODEL"
PATCHBODY="{\"routes\":[{\"provider_config_id\":\"$CFGID\",\"role\":\"PRIMARY\",\"model_id\":\"$MODEL\"}]}"
echo "patch body: $(echo $PATCHBODY | python3 -c 'import sys,json;d=json.load(sys.stdin);print({k:(v[:8]+"..." if k=="provider_config_id" else v) for k,v in d["routes"][0].items()})')"
R=$(curl -s -m 30 -X PATCH "$BASE/api/v1/groups/$GID/ai/config" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d "$PATCHBODY")
echo "patch response: $R"
echo "$MODEL" > /tmp/e2e_model.txt
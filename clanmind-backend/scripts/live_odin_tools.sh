#!/usr/bin/env bash
# Prove live Tavily web-research through the Worker via an explicit tool call.
set -uo pipefail
cd ~/projects/ClanMind/clanmind-backend
BASE="http://localhost:8787"
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)
ANON=$(curl -s -m 20 -H "Authorization: Bearer $SBP" \
  "https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print([k['api_key'] for k in d if k['name']=='anon'][0])")
GID="62c14d15-cdfb-4254-a262-4c905a062e9f"; PID="b18df3a6-d76d-4b4c-b3c4-ed96ed8d235d"
TOK=$(curl -s -m 20 -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"freshlogin@clanmind.io","password":"ClanMind#Fresh#2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")

BODY='{"message":"Research STM32 SPI1 TX DMA on APB2 F446 and cite sources.","project_id":"'$PID'","mode":"ASSIST","tool_calls":[{"tool_name":"web.search","input":{"query":"STM32 F446 SPI1 DMA TX APB2 configuration best practice","max_results":4}}]}'
echo "### POST /ai/runs (with web.search tool call)"
curl -s -m 120 -X POST "$BASE/api/v1/groups/$GID/ai/runs" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d "$BODY" | python3 -m json.tool 2>/dev/null | head -80
echo "--- END RUN RESPONSE ---"
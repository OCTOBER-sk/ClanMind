#!/usr/bin/env bash
cd ~/projects/ClanMind/clanmind-backend
SUP=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)
ANON=$(curl -s -m 10 -H "Authorization: Bearer $SBP" https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys | python3 -c "import sys,json;d=json.load(sys.stdin);print([k['api_key'] for k in d if k['name']=='anon'][0])")
TOK=$(curl -s -m 10 -X POST "$SUP/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" -d '{"email":"frontendqa@clanmind.io","password":"ClanMind#QA#2026"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "toklen=${#TOK}"
echo "=== WS direct ==="
node /tmp/wstest.js "$TOK" 2>&1 | head -3
sleep 1
echo "=== worker WS-DBG ==="
grep "WS-DBG" /tmp/worker_ws.log | tail -4
#!/usr/bin/env bash
# Fire a REAL Odin AI run in the already-configured group, poll to terminal, dump verbatim.
set -uo pipefail
cd ~/projects/ClanMind/clanmind-backend
BASE="http://localhost:8787"
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)
ANON=$(curl -s -m 20 -H "Authorization: Bearer $SBP" \
  "https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print([k['api_key'] for k in d if k['name']=='anon'][0])")
GID="62c14d15-cdfb-4254-a262-4c905a062e9f"
PID="b18df3a6-d76d-4b4c-b3c4-ed96ed8d235d"
EMAIL="freshlogin@clanmind.io"; PASS="ClanMind#Fresh#2026"
TOK=$(curl -s -m 20 -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")

MSG='Research current best practice for STM32 SPI + DMA-on-F446, then summarise: 1) the DMA request mapping for SPI1 TX on APB2, 2) the correct IRQ priority pattern, 3) one real gotcha. Produce a concise technical brief as the artifact.'

RUN_OUT=$(mktemp)
echo "### POST /ai/runs (request body below)"
echo "{\"message\":\"$MSG\",\"project_id\":\"$PID\",\"mode\":\"ASSIST\"}"
echo "---"
curl -s -m 180 -X POST "$BASE/api/v1/groups/$GID/ai/runs" \
  -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "{\"message\":\"$MSG\",\"project_id\":\"$PID\",\"mode\":\"ASSIST\"}" > "$RUN_OUT"
echo "HTTP response (first 5000 chars):"
head -c 5000 "$RUN_OUT"; echo
echo "---"
RID=$(python3 -c "import json;d=json.load(open('$RUN_OUT'));print(d.get('id') or (d.get('run') or {}).get('id') or '')" 2>/dev/null)
RS=$(python3 -c "import json;d=json.load(open('$RUN_OUT'));print(d.get('status') or (d.get('run') or {}).get('status') or '')" 2>/dev/null)
echo "RUN_ID=$RID initial_status=$RS"
echo "$RID" > /tmp/live_run_id.txt

echo
echo "### poll run"
for i in $(seq 1 20); do
  [ -z "$RID" ] && break
  R=$(curl -s -m 20 "$BASE/api/v1/ai/runs/$RID" -H "Authorization: Bearer $TOK")
  S=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  echo "poll$i status=$S"
  case "$S" in COMPLETED|FAILED|CANCELLED|WAITING_APPROVAL|IDLE) echo "$R" > /tmp/last_run.json; echo "--- final run (pruned 9000) ---"; head -c 9000 /tmp/last_run.json; echo; break;; esac
  sleep 10
done
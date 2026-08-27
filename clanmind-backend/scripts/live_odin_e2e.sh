#!/usr/bin/env bash
# REAL Odin E2E: live user -> group -> project -> AI run (OpenRouter+Tavily) -> verify.
# Prints verbatim I/O for the PDF. Run from clanmind-backend.
set -uo pipefail
cd ~/projects/ClanMind/clanmind-backend
BASE="http://localhost:8787"
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SERVICE_ROLE=$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' apps/worker/.dev.vars | cut -d= -f2-)
SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)
ANON=$(curl -s -m 20 -H "Authorization: Bearer $SBP" \
  "https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print([k['api_key'] for k in d if k['name']=='anon'][0])")

EMAIL="freshlogin@clanmind.io"; PASS="ClanMind#Fresh#2026"
TOK=$(curl -s -m 20 -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))")
echo "toklen=${#TOK}"

echo; echo "### create group"
GRP=$(curl -s -m 20 -X POST "$BASE/api/v1/groups" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"name":"ClanMind Live E2E Group"}')
echo "$GRP"
GID=$(echo "$GRP" | python3 -c "import sys,json;print(json.load(sys.stdin).get('id',''))")
echo "GID=$GID"

echo; echo "### create project (if endpoint exists)"
PROJ=$(curl -s -m 20 -X POST "$BASE/api/v1/groups/$GID/projects" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" -d '{"name":"STM32 SPI DMA Telemetry","description":"Real E2E project"}')
echo "$PROJ"
PID=$(echo "$PROJ" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id','') if isinstance(d,dict) else '')")
echo "PID=$PID"

echo; echo "### real AI run (web research -> Odin response; may take 15-60s)"
RUN_OUT=$(mktemp)
curl -s -m 120 -X POST "$BASE/api/v1/groups/$GID/ai/runs" -H "Authorization: Bearer $TOK" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"Research the current best-practice for STM32 SPI + DMA on the F446, then summarize: 1) the DMA request mapping for SPI1-TX on APB2, 2) the correct IRQ priority pattern, 3) one gotcha. Produce a concise technical brief.\",\"project_id\":$([ -n "$PID" ] && echo "\"$PID\"" || echo null),\"mode\":\"ASSIST\"}" \
  > "$RUN_OUT"
echo "HTTP run output (first 4000 chars):"
head -c 4000 "$RUN_OUT"; echo
RID=$(python3 -c "import json;d=json.load(open('$RUN_OUT'));print(d.get('id') or (d.get('run') or {}).get('id') or '')" 2>/dev/null)
RSTATUS=$(python3 -c "import json;d=json.load(open('$RUN_OUT'));print(d.get('status') or (d.get('run') or {}).get('status') or '')" 2>/dev/null)
echo "RUN ID=$RID  initial status=$RSTATUS"

echo; echo "### poll run until terminal"
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  [ -z "$RID" ] && break
  R=$(curl -s -m 20 "$BASE/api/v1/ai/runs/$RID" -H "Authorization: Bearer $TOK")
  S=$(echo "$R" | python3 -c "import sys,json;print(json.load(sys.stdin).get('status',''))" 2>/dev/null)
  echo "poll$i status=$S"
  if [ "$S" = "COMPLETED" ] || [ "$S" = "FAILED" ] || [ "$S" = "CANCELLED" ] || [ "$S" = "WAITING_APPROVAL" ]; then
    echo "$R" > /tmp/last_run.json
    echo "--- final run (truncated 7000) ---"
    head -c 7000 /tmp/last_run.json; echo
    break
  fi
  sleep 10
done
echo "GID=$GID" > /tmp/e2e_refs.txt
echo "PID=$PID" >> /tmp/e2e_refs.txt
echo "RUN_ID=$RID" >> /tmp/e2e_refs.txt
echo "EMAIL=$EMAIL" >> /tmp/e2e_refs.txt
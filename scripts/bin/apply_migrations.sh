#!/usr/bin/env bash
# Apply ClanMind Supabase migrations via the Management API Query endpoint.
# Uses curl (python urllib is blocked by Cloudflare error 1010 on this box).
set -u
REF=sdjvpsbifgglkanlpqle
MIG=supabase/migrations
LOG=/tmp/clanmind_apply.log
SBP=$(grep '^SBP_MANAGEMENT_TOKEN=' apps/worker/.dev.vars | cut -d= -f2 | tr -d '\r\n')
: > "$LOG"
ok=0; fail=0
for f in "$MIG"/*.sql; do
  name=$(basename "$f")
  payload=$(/home/santhosh/.hermes/hermes-agent/venv/bin/python -c \
    "import json,sys; print(json.dumps({'query': open(sys.argv[1]).read()}))" "$f")
  code=$(curl -s -o /tmp/mig_resp.json -w "%{http_code}" \
    -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SBP" -H "Content-Type: application/json" \
    --data "$payload")
  if [ "$code" = "200" ]; then ok=$((ok+1)); printf 'OK   %s\n' "$name" >> "$LOG"; \
  else fail=$((fail+1)); printf 'FAIL %s -> %s %s\n' "$name" "$code" "$(head -c 200 /tmp/mig_resp.json)" >> "$LOG"; fi
done
echo "=== applied OK=$ok FAIL=$fail ==="
cat "$LOG"
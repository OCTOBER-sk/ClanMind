#!/usr/bin/env bash
set -euo pipefail
cd ~/projects/ClanMind/clanmind-backend

# load secrets (names only echoed; values never printed)
SUPABASE_URL=$(grep -oE '^SUPABASE_URL=.*' apps/worker/.dev.vars | cut -d= -f2-)
SERVICE_ROLE=$(grep -oE '^SUPABASE_SERVICE_ROLE_KEY=.*' apps/worker/.dev.vars | cut -d= -f2-)
SBP=$(grep -oE '^SBP_MANAGEMENT_TOKEN=.*' apps/worker/.dev.vars | cut -d= -f2-)

# fetch anon key via management API
ANON=$(curl -s -m 20 -H "Authorization: Bearer $SBP" \
  "https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/api-keys" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print([k['api_key'] for k in d if k['name']=='anon'][0])")

EMAIL="freshlogin@clanmind.io"
PASS="ClanMind#Fresh#2026"

echo "### STEP 1: create fresh user (admin API)"
RESP=$(curl -s -m 20 -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE" -H "Authorization: Bearer $SERVICE_ROLE" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true}")
echo "$RESP" | python3 -c "import sys,json;d=json.load(sys.stdin);print('created id:',d.get('id'),'email:',d.get('email'),'status:',d.get('status'))"

echo
echo "### STEP 2: sign in with anon key (REAL auth flow)"
SIGNIN=$(curl -s -m 20 -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
TOK=$(echo "$SIGNIN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('access_token',''))")
echo "token length: ${#TOK}"
if [ -n "$TOK" ]; then
  echo "alg/kid in header:"
  echo "$TOK" | cut -d. -f1 | base64 -d 2>/dev/null
  echo
fi

echo
echo "### STEP 3: GET /api/v1/me with real JWT through Worker"
echo "--- full response (verbatim for PDF) ---"
curl -s -m 20 "http://localhost:8787/api/v1/me" -H "Authorization: Bearer $TOK"
echo
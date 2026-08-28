#!/usr/bin/env python3
"""Raw WS probe: hello -> subscribe -> message.react on a real message. Print all frames."""
import json, time, urllib.request, uuid
from websocket import create_connection  # websocket-client

DEVVARS = "/home/santhosh/projects/ClanMind/clanmind-backend/apps/worker/.dev.vars"
vals = dict(l.strip().split("=", 1) for l in open(DEVVARS) if "=" in l and not l.startswith("#"))
GID = "dd369df2-0c85-4ec5-a5af-cab1c5863c1d"

# token
body = json.dumps({"email": "atom.e2e.arun@clanmind.test", "password": "ClanMind#E2E#2026!"}).encode()
req = urllib.request.Request(vals["SUPABASE_URL"] + "/auth/v1/token?grant_type=password",
    data=body, headers={"Content-Type": "application/json", "apikey": vals["SUPABASE_SERVICE_ROLE_KEY"]})
tok = json.load(urllib.request.urlopen(req, timeout=20))["access_token"]

# find a recent GROUP message id to react on
q = urllib.request.Request(
    f"http://127.0.0.1:8787/api/v1/groups/{GID}/messages?limit=5",
    headers={"Authorization": f"Bearer {tok}"})
items = json.load(urllib.request.urlopen(q, timeout=20))
mid = None
for m in items.get("items", []):
    if (m.get("visibility") or "GROUP") == "GROUP":
        mid = m["id"]; break
print("target message:", mid)

ws = create_connection(f"ws://127.0.0.1:8787/api/v1/groups/{GID}/ws?token={tok}")
def send(obj):
    print(">>", json.dumps(obj)[:180])
    ws.send(json.dumps(obj))
def drain(seconds):
    ws.settimeout(seconds)
    t0 = time.time()
    while time.time() - t0 < seconds:
        try:
            fr = json.loads(ws.recv())
            print("<<", json.dumps(fr)[:220])
        except Exception:
            break

send({"type": "connection.hello", "request_id": f"req_{uuid.uuid4()}", "client_operation_id": f"op_{uuid.uuid4()}",
      "protocol_version": 1, "client_version": "1.0.0", "device_id": str(uuid.uuid4())})
drain(3)
send({"type": "room.subscribe", "request_id": f"req_{uuid.uuid4()}", "client_operation_id": f"op_{uuid.uuid4()}", "group_id": GID})
drain(3)
send({"type": "message.react", "request_id": f"req_{uuid.uuid4()}", "client_operation_id": f"op_{uuid.uuid4()}",
      "message_id": mid, "emoji": "🔥", "action": "add"})
drain(6)
ws.close()

# verify persistence
import subprocess
q2 = json.dumps({"query": f"select emoji, user_id from message_reactions where message_id='{mid}'"})
r = urllib.request.Request("https://api.supabase.com/v1/projects/sdjvpsbifgglkanlpqle/database/query",
    data=q2.encode(), headers={"Authorization": f"Bearer {vals['SBP_MANAGEMENT_TOKEN']}", "Content-Type": "application/json"})
print("DB check:", urllib.request.urlopen(r, timeout=30).read().decode()[:300])

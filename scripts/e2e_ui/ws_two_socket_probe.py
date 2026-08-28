#!/usr/bin/env python3
"""Two-socket WS probe: does socket B receive A's reaction.updated broadcast?"""
import json, time, urllib.request, uuid, sys
from websocket import create_connection

DEVVARS = "/home/santhosh/projects/ClanMind/clanmind-backend/apps/worker/.dev.vars"
vals = dict(l.strip().split("=", 1) for l in open(DEVVARS) if "=" in l and not l.startswith("#"))
GID = "dd369df2-0c85-4ec5-a5af-cab1c5863c1d"

def token(email):
    body = json.dumps({"email": email, "password": "ClanMind#E2E#2026!"}).encode()
    req = urllib.request.Request(vals["SUPABASE_URL"] + "/auth/v1/token?grant_type=password",
        data=body, headers={"Content-Type": "application/json", "apikey": vals["SUPABASE_SERVICE_ROLE_KEY"]})
    return json.load(urllib.request.urlopen(req, timeout=20))["access_token"]

tokA = token("atom.e2e.arun@clanmind.test")
tokB = token("atom.e2e.kavitha@clanmind.test")

def connect(tok):
    ws = create_connection(f"ws://127.0.0.1:8787/api/v1/groups/{GID}/ws?token={tok}")
    ws.send(json.dumps({"type": "connection.hello", "request_id": f"req_{uuid.uuid4()}",
        "client_operation_id": f"op_{uuid.uuid4()}", "protocol_version": 1,
        "client_version": "1.0.0", "device_id": str(uuid.uuid4())}))
    ws.settimeout(4)
    try: ws.recv()
    except Exception: pass
    ws.send(json.dumps({"type": "room.subscribe", "request_id": f"req_{uuid.uuid4()}",
        "client_operation_id": f"op_{uuid.uuid4()}", "group_id": GID}))
    try: ws.recv()
    except Exception: pass
    return ws

def drain(ws, label, seconds):
    ws.settimeout(seconds)
    t0 = time.time()
    while time.time() - t0 < seconds:
        try:
            fr = json.loads(ws.recv())
            et = fr.get("envelope", {}).get("event_type") or fr.get("type")
            pl = fr.get("envelope", {}).get("payload", {})
            print(f"[{label}] {et} {json.dumps(pl)[:140]}")
        except Exception:
            break

A = connect(tokA)
B = connect(tokB)
print("both connected+subscribed")
# find fresh message via REST as A
q = urllib.request.Request(f"http://127.0.0.1:8787/api/v1/groups/{GID}/messages?limit=3",
                           headers={"Authorization": f"Bearer {tokA}"})
items = json.load(urllib.request.urlopen(q, timeout=20))["items"]
mid = items[0]["id"]
print("reacting to", mid)
A.send(json.dumps({"type": "message.react", "request_id": f"req_{uuid.uuid4()}",
    "client_operation_id": f"op_{uuid.uuid4()}", "message_id": mid, "emoji": "🎉", "action": "add"}))
drain(A, "A(arun)", 5)
drain(B, "B(kavitha)", 5)
A.close(); B.close()

#!/usr/bin/env python3
"""Probe: does direct /group/:id/chat access bounce to /onboarding? Capture console+network."""
import sys, time, json, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

GID = refs_read().get("gid") or "dd369df2-0c85-4ec5-a5af-cab1c5863c1d"
log(f"=== PROBE direct chat access gid={GID} ===")
net = []
with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    pg.on("response", lambda r: net.append(f"{r.status} {r.url[:120]}") if "/api/" in r.url else None)
    try:
        goto(pg, "/", settle=3)
        log(f"[probe] start url={pg.url}")
        goto(pg, f"/group/{GID}/chat", settle=4)
        time.sleep(2)
        b = body(pg)
        log(f"[probe] final url={pg.url}")
        log(f"[probe] body_head={b[:250].replace(chr(10),' | ')!r}")
        shot(pg, "probe_group_chat")
        dump_errors(pg, "probe")
        log("[probe] api calls: " + " || ".join(net[-14:]))
    except Exception as e:
        log(f"[probe] ERROR {str(e)[:200]}")
    finally:
        ctx.close()
print("DONE")

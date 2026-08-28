#!/usr/bin/env python3
"""PHASE 6: reactions — Arun reacts to Santhosh's message; toggle-off; live fan-out."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 6: reactions real-time ===")
refs = refs_read()
GID = refs["gid"]
TS = int(time.time())
MARKER = f"[RT-santhosh] Deploying water sensor node alpha at"

def wait_ready(pg, key, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

def react_to(pg, marker, emoji="👍"):
    """Hover Santhosh's message, open quick reactions, click the emoji."""
    row = pg.get_by_text(marker, exact=False).last
    row.hover(); time.sleep(1)
    loc = pg.get_by_label("Add reaction")
    t0 = time.time(); opened = False
    while time.time() - t0 < 8:
        for i in range(loc.count()):
            el = loc.nth(i)
            try:
                if el.is_visible():
                    el.click(); opened = True; break
            except Exception: continue
        if opened: break
        time.sleep(0.6)
    if not opened: return False
    time.sleep(0.8)
    rl = pg.get_by_label(f"React with {emoji}")
    t0 = time.time()
    while time.time() - t0 < 8:
        for i in range(rl.count()):
            el = rl.nth(i)
            try:
                if el.is_visible():
                    el.click(); return True
            except Exception: continue
        time.sleep(0.6)
    return False

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        goto(pg, f"/group/{GID}/chat", settle=3)
        wait_ready(pg, u["key"])
    pages = {k: v[1] for k, v in ctxs.items()}
    shot(pages["arun"], "p6_before_react")

    clicked = react_to(pages["arun"], MARKER)
    log(f"[p6] arun clicked reaction={clicked}")
    # fan-out check on the other three
    cross = {}
    for obs in ["santhosh", "kavitha", "priya"]:
        t0 = time.time(); okk = False
        while time.time() - t0 < 25:
            b = body(pages[obs])
            if "👍" in b: okk = True; break
            time.sleep(1.5)
        cross[obs] = okk
    log(f"[p6] REACTION fan-out: {cross}")
    shot(pages["santhosh"], "p6_reaction_seen_santhosh")

    # toggle off by Arun
    if clicked:
        off = react_to(pages["arun"], MARKER)
        time.sleep(3)
        gone = {}
        for obs in ["santhosh", "kavitha", "priya"]:
            gone[obs] = "👍" not in body(pages[obs])
        log(f"[p6] TOGGLE-OFF removal visible={gone}")
        shot(pages["arun"], "p6_reaction_removed")

    refs["p6"] = {"clicked": clicked, "fanout": cross}
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p6-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE6 RESULT clicked={clicked} fanout={cross}")
print("DONE", clicked, cross)

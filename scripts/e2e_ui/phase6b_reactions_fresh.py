#!/usr/bin/env python3
"""PHASE 6b: reactions on a FRESH bottom-of-list message — viewport-fair assertions."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 6b: reactions on fresh message ===")
refs = refs_read()
GID = refs["gid"]
TS = int(time.time())
MARKER = f"[REACT-{TS}] Rate sensor readings every 5 minutes"

def wait_ready(pg, key, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

def react_to(pg, marker, emoji="👍"):
    row = pg.get_by_text(marker, exact=False).last
    row.hover(); time.sleep(0.9)
    loc = pg.get_by_label("Add reaction")
    t0 = time.time(); opened = False
    while time.time() - t0 < 8:
        for i in range(loc.count()):
            el = loc.nth(i)
            try:
                if el.is_visible(): el.click(); opened = True; break
            except Exception: continue
        if opened: break
        time.sleep(0.5)
    if not opened: return False
    time.sleep(0.7)
    rl = pg.get_by_label(f"React with {emoji}")
    t0 = time.time()
    while time.time() - t0 < 8:
        for i in range(rl.count()):
            el = rl.nth(i)
            try:
                if el.is_visible(): el.click(); return True
            except Exception: continue
        time.sleep(0.5)
    return False

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        goto(pg, f"/group/{GID}/chat", settle=3)
        wait_ready(pg, u["key"])
    pages = {k: v[1] for k, v in ctxs.items()}

    # Santhosh sends fresh message → lands live at bottom of every list
    ta = pages["santhosh"].locator("textarea").first
    ta.fill(MARKER); time.sleep(0.4); ta.press("Enter")
    for key, pg in pages.items():
        t0 = time.time(); okk = False
        while time.time() - t0 < 30:
            if MARKER in body(pg): okk = True; break
            time.sleep(1.5)
        log(f"[p6b] {key} sees fresh msg={okk}")

    time.sleep(2)
    clicked = react_to(pages["arun"], MARKER)
    log(f"[p6b] arun reacted={clicked}")
    fanout = {}
    for obs in ["santhosh", "kavitha", "priya"]:
        t0 = time.time(); okk = False
        while time.time() - t0 < 30:
            if "👍" in body(pages[obs]): okk = True; break
            time.sleep(1.5)
        fanout[obs] = okk
    log(f"[p6b] FAN-OUT {fanout}")
    shot(pages["santhosh"], "p6b_reaction_fanout")

    if clicked:
        react_to(pages["arun"], MARKER)  # toggle off
        time.sleep(3.5)
        removed = {o: "👍" not in body(pages[o]) for o in ["santhosh", "kavitha", "priya"]}
        log(f"[p6b] TOGGLE-OFF removal={removed}")
        shot(pages["kavitha"], "p6b_removed")

    refs["p6b"] = {"clicked": clicked, "fanout": fanout}
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p6b-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE6b RESULT clicked={clicked} fanout={fanout}")
print("DONE", clicked, fanout)

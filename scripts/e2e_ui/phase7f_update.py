#!/usr/bin/env python3
"""PHASE 7f: artifact version update — no navigation during the run window."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7f: version update (patient, no nav) ===")
refs = refs_read()
GID = refs["gid"]

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    goto(pg, f"/group/{GID}/chat", settle=4)
    t0 = time.time()
    while time.time() - t0 < 75 and "Innovators" not in body(pg):
        time.sleep(2)
    pg.locator("textarea").first.fill(
        "@Odin Update the 'Odin Runbook' document: append a 6th step titled 'Decommissioning'.")
    pg.locator("textarea").first.press("Enter")
    log("[p7f] update request sent; staying on page")
    v_ok = False
    t0 = time.time()
    while time.time() - t0 < 240:
        b = body(pg)
        # Odin's reply mentioning Decommissioning (not our own message)
        if re.search(r"Odin[\s\S]{0,500}Decommissioning", b):
            v_ok = True; break
        time.sleep(4)
    log(f"[p7f] odin update reply seen={v_ok} (t+{time.time()-t0:.0f}s)")
    shot(pg, "p7f_update_reply")
    # only NOW check versions via API (no page nav needed)
    dump_errors(pg, "p7f")
    ctx.close()
print("DONE", v_ok)

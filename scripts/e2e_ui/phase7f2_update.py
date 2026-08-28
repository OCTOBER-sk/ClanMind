#!/usr/bin/env python3
"""PHASE 7f2: artifact version update — waits for a NEW [artifact:<id>] marker."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7f2: version update (marker-based wait) ===")
refs = refs_read()
GID = refs["gid"]

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    goto(pg, f"/group/{GID}/chat", settle=4)
    t0 = time.time()
    while time.time() - t0 < 75 and "Innovators" not in body(pg):
        time.sleep(2)
    time.sleep(2)
    before = body(pg).count("[artifact:")
    log(f"[p7f2] artifact markers before={before}")
    pg.locator("textarea").first.fill(
        "@Odin Update the 'Odin Runbook' document: append a 6th step titled 'Decommissioning'.")
    pg.locator("textarea").first.press("Enter")
    sent_at = time.time()
    new_marker = False
    t0 = time.time()
    while time.time() - t0 < 240:
        if body(pg).count("[artifact:") > before:
            new_marker = True
            break
        time.sleep(4)
    log(f"[p7f2] NEW artifact marker appeared={new_marker} (waited {time.time()-t0:.0f}s)")
    shot(pg, "p7f2_update_reply")
    # keep context open a moment for trailing events, then close
    time.sleep(3)
    dump_errors(pg, "p7f2")
    ctx.close()
print("DONE", new_marker)

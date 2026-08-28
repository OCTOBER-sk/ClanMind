#!/usr/bin/env python3
"""PHASE 7e: version update via chat + artifact viewer from Garage."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7e: versioning + viewers ===")
refs = refs_read()
GID = refs["gid"]

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    goto(pg, f"/group/{GID}/chat", settle=4)
    t0 = time.time()
    while time.time() - t0 < 75 and ("Loading your groups" in body(pg) or "Innovators" not in body(pg)):
        time.sleep(2)
    # version update request
    pg.locator("textarea").first.fill(
        "@Odin Update the 'Odin Runbook' document: append a 6th step titled 'Decommissioning'.")
    pg.locator("textarea").first.press("Enter")
    v_ok = False
    t0 = time.time()
    while time.time() - t0 < 220:
        if "Decommissioning" in body(pg):
            v_ok = True; break
        time.sleep(3)
    log(f"[p7e] update visible in chat={v_ok}")
    shot(pg, "p7e_update_chat")

    # Garage: list + open Runbook viewer
    goto(pg, f"/group/{GID}/garage", settle=5)
    t0 = time.time()
    while time.time() - t0 < 30 and "Innovators" not in body(pg):
        time.sleep(2)
    time.sleep(3)
    gb = body(pg)
    log(f"[p7e] garage has calibrate.ino={'calibrate.ino' in gb} runbook={'Odin Runbook' in gb}")
    shot(pg, "p7e_garage_full")
    opened = False
    try:
        pg.get_by_text("Odin Runbook", exact=False).last.click()
        time.sleep(4)
        vb = body(pg)
        opened = "Runbook" in vb
        has_decom = "Decommissioning" in vb
        ver_hint = bool(re.search(r"[Vv]ersion\s*2|v2", vb))
        log(f"[p7e] runbook viewer opened={opened} shows_decommissioning={has_decom} version_hint={ver_hint}")
        shot(pg, "p7e_runbook_viewer")
    except Exception as e:
        log(f"[p7e] viewer ERROR {str(e)[:140]}")
    dump_errors(pg, "p7e")
    ctx.close()
print("DONE", v_ok, opened)

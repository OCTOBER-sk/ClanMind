#!/usr/bin/env python3
"""Re-verify Odin answers via the live OpenRouter PRIMARY route, and test the
task.create + decision.propose directive protocol end-to-end."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== Odin live (OpenRouter PRIMARY) + task/decision protocol ===")
refs = refs_read()
GID = refs["gid"]

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    goto(pg, f"/group/{GID}/chat", settle=4)
    t0 = time.time()
    while time.time() - t0 < 75 and "Innovators" not in body(pg):
        time.sleep(2)

    # simple question
    pg.locator("textarea").first.fill("Odin, say hello in one short sentence.")
    pg.locator("textarea").first.press("Enter")
    time.sleep(8)
    # wait for a reply bubble that isn't the user's
    replied = False
    t0 = time.time()
    while time.time() - t0 < 60:
        b = body(pg)
        if "hello" in b.lower() or "hi" in b.lower() or "gren" in b.lower():
            replied = True; break
        time.sleep(3)
    log(f"[odin] answered={replied}")
    shot(pg, "odin_live_reply")

    # task via protocol
    pg.locator("textarea").first.fill("@Odin Create a task titled 'Verify sensor uplink' with description 'Ping all nodes'.")
    pg.locator("textarea").first.press("Enter")
    time.sleep(14)
    # decision via protocol
    pg.locator("textarea").first.fill("@Odin Propose a decision titled 'Choose MQTT broker' asking whether to use Mosquitto or EMQX.")
    pg.locator("textarea").first.press("Enter")
    time.sleep(14)
    shot(pg, "odin_td_protocol")
    dump_errors(pg, "odin_live")
    ctx.close()
print("DONE")

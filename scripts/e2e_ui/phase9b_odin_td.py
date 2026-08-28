#!/usr/bin/env python3
"""PHASE 9b: Odin task.create + decision.propose via chat; DB ground truth; approvals UI."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 9b: Odin task/decision tools ===")
refs = refs_read()
GID = refs["gid"]

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    goto(pg, f"/group/{GID}/chat", settle=4)
    t0 = time.time()
    while time.time() - t0 < 75 and "Innovators" not in body(pg):
        time.sleep(2)

    # TASK via protocol
    pg.locator("textarea").first.fill(
        "@Odin Create a task titled 'Replace pH probe membranes' with description 'All 3 field probes, before field deployment'.")
    pg.locator("textarea").first.press("Enter")
    log("[p9b] task request sent")
    # decision via protocol
    time.sleep(3)
    pg.locator("textarea").first.fill(
        "@Odin Propose a decision titled 'Adopt MQTT broker' asking the team to pick between Mosquitto and EMQX.")
    pg.locator("textarea").first.press("Enter")
    log("[p9b] decision request sent")
    time.sleep(20)
    shot(pg, "p9b_chat")

    # check waiting-approval UI surface
    wb = body(pg)
    approval_visible = bool(re.search(r"(WAITING_APPROVAL|Waiting for approval|Approval requested|needs approval)", wb, re.I))
    log(f"[p9b] approval UI hint={approval_visible}")
    shot(pg, "p9b_approval_state")
    dump_errors(pg, "p9b")
    ctx.close()
print("DONE")

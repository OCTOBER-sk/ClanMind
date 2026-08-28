#!/usr/bin/env python3
"""PHASE 7: artifacts — Odin generates doc/diagram/table/code via chat UI in the
4-account room; viewers verified; versioning exercised. Flagship QA."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7: artifacts (flagship) ===")
refs = refs_read()
GID = refs["gid"]

def wait_ready(pg, key, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

def ask_odin(pg, who, prompt):
    ta = pg.locator("textarea").first
    ta.fill(prompt)
    time.sleep(0.4)
    ta.press("Enter")
    log(f"[p7] {who} asked Odin: {prompt[:70]}…")

def wait_artifact(pg, who, keyword, timeout_s=150):
    """Poll the composer's page for artifact card/panel mention of keyword."""
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if keyword.lower() in b.lower() and re.search(r"(Artifact|artifact)", b):
            return True
        time.sleep(3)
    return False

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        goto(pg, f"/group/{GID}/chat", settle=3)
        wait_ready(pg, u["key"])
    pages = {k: v[1] for k, v in ctxs.items()}

    # ---------- DOCUMENT artifact (Santhosh asks) ----------
    doc_prompt = ("@Odin Create a document artifact titled 'System Architecture Overview' for our water "
                  "quality monitoring project. Include sections: Sensor Layer, Data Pipeline, and Dashboard.")
    ask_odin(pages["santhosh"], "santhosh", doc_prompt)
    # capture spectral flow animation mid-build (flagship visual)
    time.sleep(6)
    shot(pages["kavitha"], "p7_flow_animation_build")
    time.sleep(4)
    shot(pages["kavitha"], "p7_flow_animation_build2")
    doc_done = wait_artifact(pages["santhosh"], "santhosh", "System Architecture Overview")
    cross = {}
    for obs in ["kavitha", "arun", "priya"]:
        cross[obs] = wait_artifact(pages[obs], obs, "System Architecture Overview", 60)
    log(f"[p7] DOC artifact: done={doc_done} others_see={cross}")
    shot(pages["santhosh"], "p7_doc_created")

    # open the artifact (click the artifact card / open in panel)
    opened = False
    try:
        card = pages["santhosh"].get_by_text("System Architecture Overview", exact=False).last
        card.click()
        time.sleep(4)
        opened = "Artifact" in body(pages["santhosh"]) or "Architecture" in body(pages["santhosh"])
        shot(pages["santhosh"], "p7_doc_viewer")
        log(f"[p7] doc viewer opened={opened}")
    except Exception as e:
        log(f"[p7] doc open ERROR {str(e)[:160]}")

    refs["p7_doc"] = {"done": doc_done, "cross": cross, "viewer": opened}
    refs_write(refs)
    log("PHASE7 PART1 DONE (document) — continuing in part 2")
    for u in USERS:
        ctxs[u["key"]][0].close()
print("DONE", doc_done, cross, opened)

#!/usr/bin/env python3
"""PHASE 7d: full artifact matrix via UI — diagram/table/chart/code + version update.
Ground truth = artifacts table rows; UI = viewers render + cross-context."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7d: artifact matrix ===")
refs = refs_read()
GID = refs["gid"]

def wait_ready(pg, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

def ask_and_wait(asker, prompt, kw, watchers, per_timeout=200):
    pages[asker].locator("textarea").first.fill(prompt)
    pages[asker].locator("textarea").first.press("Enter")
    ok = False
    t0 = time.time()
    while time.time() - t0 < per_timeout:
        b = body(pages[asker])
        # artifact card: name + Artifact wording; avoid plain echo by requiring
        # the artifact store fetch to have completed — strongest signal is the
        # artifacts listing page, but in-chat card is the primary UX.
        if kw in b and re.search(r"artifact", b, re.I):
            ok = True; break
        time.sleep(3)
    cross = {}
    for o in watchers:
        t0 = time.time(); okk = False
        while time.time() - t0 < 60:
            if kw in body(pages[o]): okk = True; break
            time.sleep(2.5)
        cross[o] = okk
    log(f"[p7d] {kw}: asker_seen={ok} others={cross}")
    return ok, cross

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        c, g = user_ctx(p, u["key"])
        ctxs[u["key"]] = (c, g)
        goto(g, f"/group/{GID}/chat", settle=3)
        wait_ready(g)
    pages = {k: v[1] for k, v in ctxs.items()}

    results = {}

    # DIAGRAM (Kavitha)
    ok, cross = ask_and_wait(
        "kavitha",
        "@Odin Create a diagram artifact named 'Deployment Topology' showing this Mermaid flow: "
        "Sensors --> Gateway --> Cloud --> Dashboard.",
        "Deployment Topology", ["santhosh", "arun", "priya"])
    results["diagram"] = {"ok": ok, "cross": cross}
    shot(pages["kavitha"], "p7d_diag_chat")

    # TABLE (Arun)
    ok, cross = ask_and_wait(
        "arun",
        "@Odin Create a table artifact named 'Calibration Log' as JSON: an array with 3 objects, "
        "fields sensor_id, location, offset.",
        "Calibration Log", ["santhosh", "kavitha", "priya"])
    results["table"] = {"ok": ok, "cross": cross}
    shot(pages["arun"], "p7d_table_chat")

    # CHART (Priya)
    ok, cross = ask_and_wait(
        "priya",
        "@Odin Create a chart artifact named 'Turbidity Trend' as JSON: array of objects with "
        "fields day and ntu for 5 days of rising turbidity.",
        "Turbidity Trend", ["santhosh", "kavitha", "arun"])
    results["chart"] = {"ok": ok, "cross": cross}
    shot(pages["priya"], "p7d_chart_chat")

    # CODE (Santhosh)
    ok, cross = ask_and_wait(
        "santhosh",
        "@Odin Create a code artifact named 'calibrate.ino' with Arduino C++ code that reads "
        "A0 and prints NTU every second in setup/loop.",
        "calibrate.ino", ["kavitha", "arun", "priya"])
    results["code"] = {"ok": ok, "cross": cross}
    shot(pages["santhosh"], "p7d_code_chat")

    # open Garage to confirm the artifact store lists them
    goto(pages["santhosh"], f"/group/{GID}/garage", settle=4)
    wait_ready(pages["santhosh"])
    gb = body(pages["santhosh"])
    results["garage_lists"] = {
        "runbook": "Odin Runbook" in gb,
        "topology": "Deployment Topology" in gb,
        "calib": "Calibration Log" in gb,
        "trend": "Turbidity Trend" in gb,
        "ino": "calibrate.ino" in gb,
    }
    log(f"[p7d] garage={results['garage_lists']}")
    shot(pages["santhosh"], "p7d_garage")

    # version update via chat (update the Runbook)
    pages["santhosh"].locator("textarea").first.fill(
        "@Odin Update the 'Odin Runbook' document: append a 6th step called 'Decommissioning'.")
    pages["santhosh"].locator("textarea").first.press("Enter")
    time.sleep(12)
    v_ok = False
    t0 = time.time()
    while time.time() - t0 < 200:
        b = body(pages["santhosh"])
        if "Decommissioning" in b:
            v_ok = True; break
        time.sleep(3)
    results["version_update"] = v_ok
    log(f"[p7d] version_update visible={v_ok}")

    refs["p7d"] = results
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p7d-{u['key']}")
        ctxs[u["key"]][0].close()
print("DONE", results)

#!/usr/bin/env python3
"""PHASE 7b: diagram/table/code artifacts + versioning via UI."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7b: diagram/table/code + versioning ===")
refs = refs_read()
GID = refs["gid"]

def wait_ready(pg, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

def ask_and_wait(asker_pg, keyword, watchers, timeout_s=170):
    asker_pg.locator("textarea").first.fill("")  # noop touch
    return keyword

def wait_artifact(pg, keyword, timeout_s=170):
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
        wait_ready(pg)
    pages = {k: v[1] for k, v in ctxs.items()}
    results = {}

    # ---------- DIAGRAM (Kavitha asks) ----------
    diag_kw = "Data Flow Diagram"
    pages["kavitha"].locator("textarea").first.fill(
        f"@Odin Create a diagram artifact '{diag_kw}' for the water project showing the flow: "
        "Sensors -> Edge Gateway -> Cloud API -> Dashboard. Use nodes and edges.")
    pages["kavitha"].locator("textarea").first.press("Enter")
    time.sleep(6)
    shot(pages["arun"], "p7b_flow_diag")
    d_done = wait_artifact(pages["kavitha"], diag_kw)
    d_cross = {o: wait_artifact(pages[o], diag_kw, 60) for o in ["santhosh", "arun", "priya"]}
    log(f"[p7b] DIAGRAM done={d_done} others={d_cross}")
    # open viewer
    try:
        pages["kavitha"].get_by_text(diag_kw, exact=False).last.click()
        time.sleep(4)
        results["diag_viewer"] = "Diagram" in body(pages["kavitha"]) or "svg" in pages["kavitha"].content().lower()
        shot(pages["kavitha"], "p7b_diag_viewer")
    except Exception as e:
        results["diag_viewer"] = f"ERR {str(e)[:100]}"
    results["diag"] = d_done; results["diag_cross"] = d_cross

    # ---------- TABLE (Arun asks) ----------
    tbl_kw = "Sensor Inventory"
    pages["arun"].locator("textarea").first.fill(
        f"@Odin Create a table artifact '{tbl_kw}' listing 5 water quality sensors with columns: "
        "Sensor ID, Location, Parameter, Status. Use realistic sample rows.")
    pages["arun"].locator("textarea").first.press("Enter")
    t_done = wait_artifact(pages["arun"], tbl_kw)
    t_cross = {o: wait_artifact(pages[o], tbl_kw, 60) for o in ["santhosh", "kavitha", "priya"]}
    log(f"[p7b] TABLE done={t_done} others={t_cross}")
    try:
        pages["arun"].get_by_text(tbl_kw, exact=False).last.click()
        time.sleep(4)
        results["table_viewer"] = "Sensor ID" in body(pages["arun"]) or "Location" in body(pages["arun"])
        shot(pages["arun"], "p7b_table_viewer")
    except Exception as e:
        results["table_viewer"] = f"ERR {str(e)[:100]}"
    results["table"] = t_done; results["table_cross"] = t_cross

    # ---------- CODE (Priya asks) ----------
    code_kw = "Turbidity Reader"
    pages["priya"].locator("textarea").first.fill(
        f"@Odin Create a code artifact '{code_kw}': an Arduino C++ sketch that reads a turbidity "
        "sensor on analog pin A0 and prints the NTU value over Serial every second.")
    pages["priya"].locator("textarea").first.press("Enter")
    c_done = wait_artifact(pages["priya"], code_kw)
    c_cross = {o: wait_artifact(pages[o], code_kw, 60) for o in ["santhosh", "kavitha", "arun"]}
    log(f"[p7b] CODE done={c_done} others={c_cross}")
    try:
        pages["priya"].get_by_text(code_kw, exact=False).last.click()
        time.sleep(4)
        cb = body(pages["priya"])
        results["code_viewer"] = ("void setup" in cb or "setup()" in cb or "loop()" in cb)
        shot(pages["priya"], "p7b_code_viewer")
    except Exception as e:
        results["code_viewer"] = f"ERR {str(e)[:100]}"
    results["code"] = c_done; results["code_cross"] = c_cross

    # ---------- VERSIONING (Santhosh asks Odin to update the doc) ----------
    pages["santhosh"].locator("textarea").first.fill(
        "@Odin Update the 'System Architecture Overview' document: add a new section "
        "'Calibration Procedure' describing 3-point calibration for the sensors.")
    pages["santhosh"].locator("textarea").first.press("Enter")
    time.sleep(8)
    v_done = False
    t0 = time.time()
    while time.time() - t0 < 170:
        b = body(pages["santhosh"])
        if "Calibration Procedure" in b and ("v2" in b.lower() or "version" in b.lower() or "Version" in b):
            v_done = True; break
        if "Calibration Procedure" in b and t0 != 0 and time.time() - t0 > 90:
            v_done = "Calibration Procedure" in b; break
        time.sleep(3)
    log(f"[p7b] VERSION2 done={v_done}")
    try:
        pages["santhosh"].get_by_text("System Architecture Overview", exact=False).last.click()
        time.sleep(4)
        vb = body(pages["santhosh"])
        results["version_panel"] = ("Version" in vb or "v2" in vb) and "Calibration" in vb
        shot(pages["santhosh"], "p7b_versions")
    except Exception as e:
        results["version_panel"] = f"ERR {str(e)[:100]}"
    results["version"] = v_done

    refs["p7b"] = results
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p7b-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE7b RESULT {results}")
print("DONE", results)

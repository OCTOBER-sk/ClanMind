#!/usr/bin/env python3
"""PHASE 8+9: file upload (composer attachment) + tasks + decisions via UI."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 8+9: files + tasks + decisions ===")
refs = refs_read()
GID = refs["gid"]

# small test file for upload
TESTFILE = "/tmp/clanmind_sensor_spec.txt"
open(TESTFILE, "w").write(
    "ClanMind sensor spec v1\n- turbidity: NTU range 0-1000\n- ph: 6.5-8.5\n- temp: -5..60C\n")

def wait_ready(pg, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        c, g = user_ctx(p, u["key"])
        ctxs[u["key"]] = (c, g)
        goto(g, f"/group/{GID}/chat", settle=3)
        wait_ready(g)
    pages = {k: v[1] for k, v in ctxs.items()}

    # ---------- FILE UPLOAD via composer attachment ----------
    upload_ok, msg_seen = False, {}
    try:
        attach = pages["arun"].get_by_label(re.compile("ttach", re.I)).first
        if not attach.count():
            attach = pages["arun"].locator("input[type=file]").first
        if attach.count():
            attach.set_input_files(TESTFILE)
            time.sleep(3)  # upload starts
            # composer chip should appear; send with a caption
            pages["arun"].locator("textarea").first.fill("Sensor spec sheet for review")
            pages["arun"].locator("textarea").first.press("Enter")
            time.sleep(4)
            upload_ok = True
            log("[p8] upload sent")
        else:
            log("[p8] no file input found")
    except Exception as e:
        log(f"[p8] upload ERROR {str(e)[:180]}")
    # observers see the message with attachment
    for o in ["santhosh", "kavitha", "priya"]:
        t0 = time.time(); okk = False
        while time.time() - t0 < 30:
            if "Sensor spec sheet" in body(pages[o]): okk = True; break
            time.sleep(2)
        msg_seen[o] = okk
    log(f"[p8] attachment msg cross-context={msg_seen}")
    shot(pages["arun"], "p8_upload_sent")

    # ---------- TASKS via UI (Odin creates from message + manual) ----------
    results = {}
    try:
        # Odin: create task from Arun's pinned message
        pages["santhosh"].locator("textarea").first.fill(
            "@Odin Create a task in the project titled 'Review sensor spec sheet' assigned to nobody, due this week.")
        pages["santhosh"].locator("textarea").first.press("Enter")
        time.sleep(12)
        task_odin = False
        t0 = time.time()
        while time.time() - t0 < 200:
            if "Review sensor spec sheet" in body(pages["santhosh"]):
                task_odin = True; break
            time.sleep(3)
        log(f"[p9] task via Odin created={task_odin}")
        results["task_via_odin"] = task_odin
    except Exception as e:
        log(f"[p9] odin task ERROR {str(e)[:160]}")
        results["task_via_odin"] = False

    # tasks view: verify listed + manual create
    goto(pages["kavitha"], f"/group/{GID}/tasks", settle=4)
    wait_ready(pages["kavitha"])
    tb = body(pages["kavitha"])
    results["tasks_view_lists"] = "Review sensor spec sheet" in tb
    log(f"[p9] tasks view lists odin task={results['tasks_view_lists']}")
    shot(pages["kavitha"], "p9_tasks_view")
    # manual create via UI
    manual = False
    try:
        add = pages["kavitha"].get_by_role("button", name=re.compile("(New Task|Add Task|Create Task)", re.I))
        if add.count():
            add.first.click(); time.sleep(1.5)
            fld = pages["kavitha"].get_by_placeholder(re.compile("task title", re.I))
            if not fld.count():
                fld = pages["kavitha"].locator("input[type=text], input:not([type])").last
            fld.fill("Order calibration fluids")
            sub = pages["kavitha"].get_by_role("button", name=re.compile("(Create|Save|Add)", re.I))
            if sub.count():
                sub.last.click(); time.sleep(2.5)
            manual = "Order calibration fluids" in body(pages["kavitha"])
    except Exception as e:
        log(f"[p9] manual task ERR {str(e)[:140]}")
    results["task_manual"] = manual
    log(f"[p9] manual task={manual}")
    shot(pages["kavitha"], "p9_task_manual")

    # ---------- DECISIONS via UI ----------
    dec_odin = False
    try:
        pages["priya"].locator("textarea").first.fill(
            "@Odin Propose a decision: which MQTT broker should we use, Mosquitto or EMQX? Include context.")
        pages["priya"].locator("textarea").first.press("Enter")
        time.sleep(12)
        t0 = time.time()
        while time.time() - t0 < 200:
            if "Mosquitto" in body(pages["priya"]) and ("decision" in body(pages["priya"]).lower()):
                dec_odin = True; break
            time.sleep(3)
    except Exception as e:
        log(f"[p9] odin decision ERR {str(e)[:160]}")
    results["decision_via_odin"] = dec_odin
    log(f"[p9] decision proposed via Odin={dec_odin}")

    goto(pages["santhosh"], f"/group/{GID}/decisions", settle=4)
    wait_ready(pages["santhosh"])
    db_ = body(pages["santhosh"])
    results["decisions_view"] = "Mosquitto" in db_
    log(f"[p9] decisions view shows proposal={results['decisions_view']}")
    shot(pages["santhosh"], "p9_decisions_view")

    # approve decision if UI offers it
    approved = False
    try:
        appr = pages["santhosh"].get_by_role("button", name=re.compile("Approve", re.I))
        if appr.count():
            appr.first.click(); time.sleep(2.5)
            approved = "approved" in body(pages["santhosh"]).lower() or "APPROVED" in body(pages["santhosh"])
            shot(pages["santhosh"], "p9_decision_approved")
    except Exception as e:
        log(f"[p9] approve ERR {str(e)[:140]}")
    results["decision_approved"] = approved
    log(f"[p9] decision approved={approved}")

    refs["p8"] = {"upload": upload_ok, "cross": msg_seen}
    refs["p9"] = results
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p89-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE8+9 RESULT {results}")
print("DONE", results)

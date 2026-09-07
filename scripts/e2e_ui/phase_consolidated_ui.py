#!/usr/bin/env python3
"""CONSOLIDATED ClanMind REAL-UI E2E — drives the live app (vite :1420) across
the full surface with 4 real accounts. Banks DISTINCT screenshots per step and
asserts cross-account propagation. No mocks; real Supabase + OpenRouter."""
import sys, time, re, json, os
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

SHOT = "/home/santhosh/projects/ClanMind/docs/screenshots/e2e_ui"
os.makedirs(SHOT, exist_ok=True)
ref = refs_read()
GID = ref.get("gid") or "dd369df2-0c85-4ec5-a5af-cab1c5863c1d"

def wait_ready(pg, t=75):
    t0 = time.time()
    while time.time() - t0 < t:
        if "Innovators" in body(pg) or "SIH 2026" in body(pg):
            return True
        time.sleep(2)
    return False

results = {}
with sync_playwright() as p:
    # ---- 4 isolated browser contexts (one login each) ----
    sessions = {}
    for u in USERS:
        c, g = user_ctx(p, u["key"])
        sessions[u["key"]] = (c, g)
        goto(g, f"/group/{GID}/chat", settle=3)
        wait_ready(g)
    pages = {k: v[1] for k, v in sessions.items()}

    # ===== P: real-time messaging cross-account =====
    msg = f"E2E live ping {int(time.time())}"
    pages["santhosh"].locator("textarea").first.fill(msg)
    pages["santhosh"].locator("textarea").first.press("Enter")
    seen = {}
    for o in ["kavitha", "arun", "priya"]:
        t0 = time.time(); ok = False
        while time.time() - t0 < 30:
            if msg in body(pages[o]): ok = True; break
            time.sleep(2)
        seen[o] = ok
    shot(pages["kavitha"], "ui_realtime_msg")
    results["realtime_msg"] = seen

    # ===== P: mention/tag a teammate =====
    pages["arun"].locator("textarea").first.fill("@Santhosh can you check the sensor uplink?")
    pages["arun"].locator("textarea").first.press("Enter")
    time.sleep(4)
    shot(pages["arun"], "ui_mention_sent")
    # santhosh should see the mention highlighted
    t0 = time.time(); men = False
    while time.time() - t0 < 30:
        if "@Santhosh" in body(pages["santhosh"]): men = True; break
        time.sleep(2)
    results["mention_visible"] = men

    # ===== P: reactions (hover msg -> Add reaction -> emoji) =====
    react_ok = False; react_propagated = False
    try:
        ping_el = pages["santhosh"].locator("text=E2E live ping").first
        if ping_el.count():
            ping_el.scroll_into_view_if_needed(); ping_el.hover(); time.sleep(1.5)
            ar = pages["santhosh"].get_by_role("button", name="Add reaction")
            if ar.count():
                ar.first.click(); time.sleep(2)
                shot(pages["santhosh"], "ui_reaction_picker")
                emo = pages["santhosh"].locator("button", has_text="👍")
                if emo.count():
                    emo.first.click(); time.sleep(2.5)
                    react_ok = True
                    shot(pages["santhosh"], "ui_reaction_done")
                    # kavitha should see the reaction on the same message (scroll to it)
                    try:
                        pages["kavitha"].locator("text=E2E live ping").first.scroll_into_view_if_needed()
                    except Exception: pass
                    t0 = time.time()
                    while time.time() - t0 < 25:
                        if "👍" in body(pages["kavitha"]):
                            react_propagated = True; break
                        time.sleep(2)
    except Exception as e:
        log(f"[react] err {str(e)[:80]}")
    results["reaction_clicked"] = react_ok
    results["reaction_propagated"] = react_propagated

    # ===== P: artifacts rendered in UI (open artifacts panel) =====
    art_ok = False
    try:
        link = pages["kavitha"].get_by_text("Garage", exact=False)
        if link.count():
            link.first.click(); time.sleep(3)
            b = body(pages["kavitha"])
            art_ok = ("Odin Runbook" in b) or ("Deployment" in b) or ("Calibration" in b) or ("Turbidity" in b)
            shot(pages["kavitha"], "ui_artifacts_panel")
    except Exception as e:
        log(f"[art] {str(e)[:80]}")
    results["artifacts_panel"] = art_ok

    # ===== P: tasks view (UI) =====
    try:
        tl = pages["priya"].get_by_text("Tasks", exact=False)
        if tl.count():
            tl.first.click(); time.sleep(3)
            tb = body(pages["priya"])
            results["tasks_view"] = ("Verify sensor uplink" in tb) or ("Order calibration" in tb)
            shot(pages["priya"], "ui_tasks_view")
    except Exception as e:
        log(f"[tasks] {str(e)[:80]}")

    # ===== P: decisions view (UI) =====
    try:
        for attempt in range(3):
            dl = pages["santhosh"].get_by_text("Decisions", exact=False)
            if dl.count():
                dl.first.click(); time.sleep(3)
                if "Choose MQTT broker" in body(pages["santhosh"]):
                    break
            time.sleep(2)
        db = body(pages["santhosh"])
        results["decisions_view"] = "Choose MQTT broker" in db
        shot(pages["santhosh"], "ui_decisions_view")
    except Exception as e:
        log(f"[decisions] {str(e)[:80]}")

    # ===== P: file upload via composer =====
    TESTFILE = "/tmp/clanmind_spec.txt"
    open(TESTFILE, "w").write("ClanMind field spec v2\n- turbidity NTU 0-1000\n- ph 6.5-8.5\n")
    up_ok = False
    try:
        f = pages["arun"].locator("input[type=file]").first
        if f.count():
            f.set_input_files(TESTFILE)
            time.sleep(3)
            pages["arun"].locator("textarea").first.fill("Field spec upload")
            pages["arun"].locator("textarea").first.press("Enter")
            time.sleep(4)
            up_ok = "Field spec upload" in body(pages["arun"])
            shot(pages["arun"], "ui_file_upload")
    except Exception as e:
        log(f"[upload] {str(e)[:80]}")
    results["file_upload_sent"] = up_ok

    # ===== P: settings / BYOK panel (already verified, screenshot for PDF) =====
    try:
        for attempt in range(3):
            sl = pages["santhosh"].get_by_text("Settings", exact=False)
            if sl.count():
                sl.first.click(); time.sleep(2)
            ai = pages["santhosh"].get_by_role("button", name=re.compile("^AI$", re.I))
            if ai.count():
                ai.first.click(); time.sleep(2)
            if "Bring Your Own Key" in body(pages["santhosh"]):
                break
            time.sleep(2)
        shot(pages["santhosh"], "ui_settings_ai")
        results["settings_ai_opened"] = "Bring Your Own Key" in body(pages["santhosh"])
    except Exception as e:
        log(f"[settings] {str(e)[:80]}")

    # console error sweep
    for u in USERS:
        dump_errors(pages[u["key"]], f"ui_{u['key']}")

    for u in USERS:
        sessions[u["key"]][0].close()

ref["ui_results"] = results
refs_write(ref)
print("UI_RESULTS", json.dumps(results, indent=2))
print("DONE")

#!/usr/bin/env python3
"""PHASE 4c: edit (Santhosh=OWNER) + pin (Kavitha=ADMIN) on fresh messages, hover actions."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 4c: edit/pin via hover actions ===")
refs = refs_read()
GID = refs["gid"]
TS = int(time.time())

def wait_ready(pg, key, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

def click_visible(pg, label, timeout=8):
    """Click the first VISIBLE element with aria-label `label`."""
    loc = pg.get_by_label(label)
    t0 = time.time()
    while time.time() - t0 < timeout:
        for i in range(loc.count()):
            el = loc.nth(i)
            try:
                if el.is_visible():
                    el.click(); return True
            except Exception:
                continue
        time.sleep(0.6)
    return False

def actions_menu(pg, marker):
    row = pg.get_by_text(marker, exact=False).first
    row.hover(); time.sleep(1)
    if not click_visible(pg, "More message actions"):
        return False
    time.sleep(1)
    return pg.get_by_role("menuitem").count() > 0

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        goto(pg, f"/group/{GID}/chat", settle=3)
        wait_ready(pg, u["key"])
    pages = {k: v[1] for k, v in ctxs.items()}

    edit_marker = f"[E2E-edit-{TS}] Sensor calibration window confirmed"
    pin_marker = f"[E2E-pin-{TS}] Firmware v2.1 is the release candidate"

    send = lambda pgk, txt: (pages[pgk].locator("textarea").first.fill(txt), time.sleep(0.4), pages[pgk].locator("textarea").first.press("Enter"), time.sleep(2))
    send("santhosh", edit_marker)
    send("arun", pin_marker)

    # ---- EDIT (Santhosh, OWNER) ----
    edit_ok, others_edit = False, []
    try:
        if actions_menu(pages["santhosh"], edit_marker):
            shot(pages["santhosh"], "p4c_menu")
            mi = pages["santhosh"].get_by_role("menuitem", name="Edit message")
            if mi.count():
                mi.first.click(); time.sleep(1.5)
                ta = pages["santhosh"].locator("textarea").first
                cur = ta.input_value()
                ta.fill(cur + " ✏️edited")
                ta.press("Enter"); time.sleep(2.5)
                edit_ok = "✏️edited" in body(pages["santhosh"])
                for obs in ["kavitha", "arun", "priya"]:
                    t0 = time.time(); okk = False
                    while time.time() - t0 < 20:
                        if "✏️edited" in body(pages[obs]): okk = True; break
                        time.sleep(1.5)
                    others_edit.append((obs, okk))
                log(f"EDIT: applied={edit_ok} others_live={others_edit}")
                shot(pages["santhosh"], "p4c_edit_done")
        else:
            log("EDIT: menu never opened")
    except Exception as e:
        log(f"EDIT ERROR {str(e)[:180]}")

    # ---- PIN (Kavitha, ADMIN) on Arun's message ----
    pin_ok, pin_cross = False, {}
    try:
        if actions_menu(pages["kavitha"], pin_marker):
            mi = pages["kavitha"].get_by_role("menuitem", name="Pin message")
            if mi.count():
                mi.first.click(); time.sleep(2.5)
                pin_ok = "pinned" in body(pages["kavitha"]).lower()
                for o in ["santhosh", "arun", "priya"]:
                    t0 = time.time(); okk = False
                    while time.time() - t0 < 20:
                        if "pinned" in body(pages[o]).lower(): okk = True; break
                        time.sleep(1.5)
                    pin_cross[o] = okk
                log(f"PIN: kavitha={pin_ok} others_live={pin_cross}")
                shot(pages["kavitha"], "p4c_pin_done")
        else:
            log("PIN: menu never opened")
    except Exception as e:
        log(f"PIN ERROR {str(e)[:180]}")

    refs["p4c"] = {"edit": edit_ok, "others_edit": others_edit, "pin": pin_ok, "pin_cross": pin_cross}
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p4c-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE4c RESULT edit={edit_ok} others={others_edit} pin={pin_ok} cross={pin_cross}")
print("DONE", edit_ok, pin_ok)

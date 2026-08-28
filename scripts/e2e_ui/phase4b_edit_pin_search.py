#!/usr/bin/env python3
"""PHASE 4b: edit (Santhosh=OWNER), pin (Kavitha=ADMIN), search (Priya) — real menu labels."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 4b: edit/pin/search ===")
refs = refs_read()
GID = refs["gid"]

def open_menu_for(pg, marker):
    """Hover message row, click the actions trigger, wait for menu items."""
    row = pg.get_by_text(marker, exact=False).first
    row.hover(); time.sleep(0.9)
    opened = row.evaluate("""el => {
      const row = el.closest('[class*=group]') || el.closest('li') || el.parentElement?.parentElement;
      if (!row) return false;
      const btns = [...row.querySelectorAll('button')];
      const trig = btns.find(b => b.getAttribute('aria-haspopup')) ||
                   btns.find(b => !(b.textContent||'').trim());
      if (trig) { trig.click(); return true; }
      return false;
    }""")
    time.sleep(1.2)
    return bool(opened) and pg.get_by_role("menuitem").count() > 0

def menu_click(pg, label):
    mi = pg.get_by_role("menuitem", name=label)
    if mi.count():
        mi.first.click(); time.sleep(1.5); return True
    return False

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        goto(pg, f"/group/{GID}/chat", settle=3)
        # wait ready
        t0 = time.time()
        while time.time() - t0 < 75:
            b = body(pg)
            if "Loading your groups" not in b and "Innovators" in b: break
            time.sleep(2)
    pages = {k: v[1] for k, v in ctxs.items()}

    # ---- EDIT by Santhosh (OWNER) ----
    edit_ok, others_edit = False, []
    try:
        b = body(pages["santhosh"])
        m = re.search(r"\[RT-santhosh\] Deploying water sensor node alpha at \d+", b)
        if m and open_menu_for(pages["santhosh"], m.group(0)):
            shot(pages["santhosh"], "p4b_menu_open")
            if menu_click(pages["santhosh"], "Edit message"):
                ta = pages["santhosh"].locator("textarea").first
                cur = ta.input_value()
                ta.fill(cur + " ✏️edited")
                ta.press("Enter"); time.sleep(2.5)
                edit_ok = "edited" in body(pages["santhosh"])
                for obs in ["kavitha", "arun", "priya"]:
                    t0 = time.time(); okk = False
                    while time.time() - t0 < 20:
                        if "✏️edited" in body(pages[obs]): okk = True; break
                        time.sleep(1.5)
                    others_edit.append((obs, okk))
                log(f"EDIT: applied={edit_ok} others_live={others_edit}")
                shot(pages["santhosh"], "p4b_edit_done")
        else:
            log("EDIT: menu did not open / marker missing")
    except Exception as e:
        log(f"EDIT ERROR {str(e)[:180]}")

    # ---- PIN by Kavitha (ADMIN) on Arun's message ----
    pin_ok = False
    try:
        b = body(pages["kavitha"])
        m = re.search(r"\[RT-arun\] Deploying water sensor node alpha at \d+", b)
        if m and open_menu_for(pages["kavitha"], m.group(0)):
            if menu_click(pages["kavitha"], "Pin message"):
                time.sleep(2)
                pin_ok = "pinned" in body(pages["kavitha"]).lower()
                cross = {o: ("pinned" in body(pages[o]).lower()) for o in ["santhosh", "arun", "priya"]}
                log(f"PIN: kavitha_sees={pin_ok} others={cross}")
                shot(pages["kavitha"], "p4b_pin_done")
        else:
            log("PIN: menu did not open / marker missing")
    except Exception as e:
        log(f"PIN ERROR {str(e)[:180]}")

    # ---- SEARCH by Priya (TopBar palette) ----
    search_ok = False
    try:
        sb = pages["priya"].get_by_role("button", name="Search or jump to")
        if not sb.count():
            sb = pages["priya"].locator("[aria-label='Search or jump to']")
        sb.first.click(); time.sleep(1.5)
        pages["priya"].keyboard.type("water sensor", delay=60)
        time.sleep(3.5)
        b = body(pages["priya"])
        hits = ("sensor node" in b.lower()) or ("[RT-" in b)
        search_ok = hits
        log(f"SEARCH: results_found={hits}")
        shot(pages["priya"], "p4b_search")
        pages["priya"].keyboard.press("Escape")
    except Exception as e:
        log(f"SEARCH ERROR {str(e)[:180]}")

    refs["p4b"] = {"edit": edit_ok, "others_edit": others_edit, "pin": pin_ok, "search": search_ok}
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p4b-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE4b RESULT edit={edit_ok} others={others_edit} pin={pin_ok} search={search_ok}")
print("DONE", edit_ok, pin_ok, search_ok)

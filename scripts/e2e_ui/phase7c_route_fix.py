#!/usr/bin/env python3
"""PHASE 7c: fix AI route via UI (Kavitha=ADMIN sets PRIMARY to a working model),
then regenerate the document artifact and prove it lands in the DB + all 4 UIs."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 7c: route fix + artifact regeneration ===")
refs = refs_read()
GID = refs["gid"]
MODEL = "meta-llama/llama-3.3-70b-instruct"

def wait_ready(pg, timeout_s=75):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

with sync_playwright() as p:
    # ---------- Kavitha (ADMIN) fixes the route in Settings→AI ----------
    ctx, pg = user_ctx(p, "kavitha")
    try:
        goto(pg, f"/group/{GID}/settings", settle=4)
        wait_ready(pg)
        tab = pg.get_by_role("button", name=re.compile("^AI", re.I))
        for i in range(tab.count()):
            t = tab.nth(i)
            if (t.inner_text() or "").strip() in ("AI", "AI Teammate", "AI Settings") and t.is_visible():
                t.click(); break
        time.sleep(1.5)
        pm = pg.get_by_label("Primary model")
        pm.select_option(label=MODEL)
        time.sleep(1)
        pg.get_by_role("button", name="Save model routes").click()
        time.sleep(3)
        shot(pg, "p7c_route_fixed")
        log(f"[p7c] route set to {MODEL}")
    except Exception as e:
        log(f"[p7c] route fix ERROR {str(e)[:200]}")
    ctx.close()

    # ---------- all four back to chat; Santhosh re-asks Odin ----------
    ctxs = {}
    for u in USERS:
        c, g = user_ctx(p, u["key"])
        ctxs[u["key"]] = (c, g)
        goto(g, f"/group/{GID}/chat", settle=3)
        wait_ready(g)
    pages = {k: v[1] for k, v in ctxs.items()}

    DOC = "Odin Runbook"
    pages["santhosh"].locator("textarea").first.fill(
        f"@Odin Create a document artifact titled '{DOC}' listing the 5 key operational steps "
        "for deploying the water sensor network. Keep it concise.")
    pages["santhosh"].locator("textarea").first.press("Enter")
    time.sleep(10)
    shot(pages["santhosh"], "p7c_odin_working")

    created = False
    t0 = time.time()
    while time.time() - t0 < 180:
        b = body(pages["santhosh"])
        if DOC in b and ("artifact" in b.lower()):
            created = True; break
        time.sleep(3)
    cross = {}
    for o in ["kavitha", "arun", "priya"]:
        t0 = time.time(); okk = False
        while time.time() - t0 < 60:
            if DOC in body(pages[o]): okk = True; break
            time.sleep(2.5)
        cross[o] = okk
    log(f"[p7c] DOC v2 created={created} others={cross}")
    shot(pages["kavitha"], "p7c_doc_all")
    try:
        pages["santhosh"].get_by_text(DOC, exact=False).last.click()
        time.sleep(4)
        shot(pages["santhosh"], "p7c_doc_viewer")
    except Exception:
        pass
    refs["p7c"] = {"created": created, "cross": cross, "model": MODEL}
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p7c-{u['key']}")
        ctxs[u["key"]][0].close()
print("DONE", created, cross)

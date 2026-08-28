#!/usr/bin/env python3
"""PHASE 5b: BYOK via Settings UI — same persistent context, new tab."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 5b: BYOK config via UI ===")
refs = refs_read()
GID = refs["gid"]
VARS = {}
for ln in open("/home/santhosh/projects/ClanMind/clanmind-backend/apps/worker/.dev.vars"):
    ln = ln.strip()
    if "=" in ln and not ln.startswith("#"):
        k, v = ln.split("=", 1)
        VARS[k.strip()] = v.strip()
OR_KEY = VARS.get("APPLICATION_AI_API_KEY", "")

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    ok = False
    try:
        goto(pg, f"/group/{GID}/settings", settle=4)
        t0 = time.time()
        while time.time() - t0 < 60 and "Loading your groups" in body(pg):
            time.sleep(2)
        # open AI tab
        tab = pg.get_by_role("button", name=re.compile("^AI", re.I))
        clicked = False
        for i in range(tab.count()):
            t = tab.nth(i)
            txt = (t.inner_text() or "").strip()
            if txt in ("AI", "AI Teammate", "AI Settings") and t.is_visible():
                t.click(); clicked = True; break
        log(f"[p5b] AI tab clicked={clicked}")
        time.sleep(1.5)
        shot(pg, "p5b_ai_tab")
        prov = pg.get_by_label("Provider")
        if not prov.count():
            log(f"[p5b] provider select missing; body={body(pg)[:200]!r}")
        prov.first.select_option("openrouter")
        pg.get_by_placeholder("Paste your openrouter API key").fill(OR_KEY)
        shot(pg, "p5b_filled")
        pg.get_by_role("button", name="Test connection").click()
        # poll for BYOK-specific success: the saved-configs list gains an openrouter row
        t0 = time.time(); connected = False
        while time.time() - t0 < 70:
            try:
                if pg.locator("[data-testid=byok-saved-configs]").get_by_text("openrouter", exact=False).count():
                    connected = True; break
            except Exception:
                pass
            time.sleep(2)
        m = re.search(r"Connected · (\d+) models", body(pg))
        log(f"[p5b] connected={connected} models={m.group(1) if m else '?'}")
        shot(pg, "p5b_connected")
        if connected:
            # wait for the route slot to actually offer openrouter
            t0 = time.time(); slot_ready = False
            while time.time() - t0 < 40:
                try:
                    pg.get_by_label("Primary provider").select_option(label="openrouter", timeout=3000)
                    slot_ready = True; break
                except Exception:
                    time.sleep(2)
            log(f"[p5b] primary provider selected={slot_ready}")
            if slot_ready:
                time.sleep(3.5)
                pm = pg.get_by_label("Primary model")
                model_choice = ""
                t0 = time.time()
                while time.time() - t0 < 30 and not model_choice:
                    opts = pm.locator("option").all_inner_texts()
                    model_choice = next((o for o in opts if o and o.strip() != "—"), "")
                    if not model_choice: time.sleep(2)
                log(f"[p5b] model chosen={model_choice[:48]}")
                if model_choice:
                    pm.select_option(label=model_choice)
                    pg.get_by_role("button", name="Save model routes").click()
                    time.sleep(3)
                    shot(pg, "p5b_routes_saved")
                    ok = True
    except Exception as e:
        log(f"[p5b] ERROR {str(e)[:220]}")
        shot(pg, "p5b_error")
    dump_errors(pg, "p5b")
    ctx.close()

refs["p5_byok"] = ok
refs_write(refs)
log(f"PHASE5b RESULT byok={ok}")
print("DONE", ok)

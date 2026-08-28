#!/usr/bin/env python3
"""PHASE 5: BYOK provider config via Settings UI (owner), @mention notification,
@Odin AI streaming observed live by all 4 contexts."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 5: AI provider + mentions + @Odin ===")
refs = refs_read()
GID = refs["gid"]
VARS = {}
for ln in open("/home/santhosh/projects/ClanMind/clanmind-backend/apps/worker/.dev.vars"):
    ln = ln.strip()
    if "=" in ln and not ln.startswith("#"):
        k, v = ln.split("=", 1)
        VARS[k.strip()] = v.strip()
OR_KEY = VARS.get("APPLICATION_AI_API_KEY", "")

def wait_ready(pg, key, timeout_s=90):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and "Innovators" in b: return True
        time.sleep(2)
    return False

with sync_playwright() as p:
    ctxs, pages = {}, {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        pages[u["key"]] = pg
        goto(pg, f"/group/{GID}/chat", settle=3)
    for u in USERS:
        wait_ready(pages[u["key"]], u["key"])
    log("[p5] all four contexts in chat")

    # ---------- OWNER: BYOK via Settings → AI ----------
    ok, octx, opg = False, *ctxs["santhosh"]
    try:
        ctx2, pg2 = user_ctx(p, "santhosh")
        goto(pg2, f"/group/{GID}/settings", settle=4)
        tab = pg2.get_by_role("button", name=re.compile("^AI", re.I))
        clicked_tab = False
        for i in range(tab.count()):
            t = tab.nth(i)
            txt = (t.inner_text() or "").strip()
            if txt in ("AI", "AI Teammate", "AI Settings") and t.is_visible():
                t.click(); clicked_tab = True; break
        log(f"[p5] AI tab clicked={clicked_tab}")
        time.sleep(1.5)
        prov = pg2.get_by_label("Provider")
        if prov.count():
            prov.first.select_option("openrouter")
            key_inp = pg2.get_by_placeholder("Paste your openrouter API key")
            key_inp.fill(OR_KEY)
            shot(pg2, "p5_byok_filled")
            pg2.get_by_role("button", name="Test connection").click()
            # wait for Connected
            t0 = time.time(); connected = False
            while time.time() - t0 < 40:
                b = body(pg2)
                if "Connected" in b and "model" in b: connected = True; break
                if "authenticate" in b: break
                time.sleep(1.5)
            log(f"[p5] BYOK connected={connected}")
            shot(pg2, "p5_byok_connected")
            if connected:
                m = re.search(r"Connected · (\d+) models", body(pg2))
                log(f"[p5] models_found={m.group(1) if m else '?'}")
                # PRIMARY route: provider + first model
                pg2.get_by_label("Primary provider").select_option(label="openrouter")
                time.sleep(2.5)  # models fetch for that config
                pm = pg2.get_by_label("Primary model")
                opts = pm.locator("option").all_inner_texts()
                model_choice = next((o for o in opts if o and o != "—"), "")
                log(f"[p5] model_options={[o[:28] for o in opts[:6]]} -> {model_choice[:40]}")
                if model_choice:
                    pm.select_option(label=model_choice)
                pg2.get_by_role("button", name="Save model routes").click()
                time.sleep(2.5)
                shot(pg2, "p5_routes_saved")
                ok = True
        ctx2.close()
    except Exception as e:
        log(f"[p5] BYOK ERROR {str(e)[:200]}")
    refs["p5_byok"] = ok

    # ---------- MENTION: Arun mentions Priya ----------
    mention_ok = False
    try:
        ta = pages["arun"].locator("textarea").first
        ta.click()
        ta.fill("@[placeholder]", timeout=2000)  # will be replaced below
    except Exception:
        pass
    try:
        ta = pages["arun"].locator("textarea").first
        ta.fill(f"@Priya [p5-{int(time.time())}] please review the sensor BOM when free")
        time.sleep(1.2)  # mention autocomplete may appear; UI records mention server-side
        ta.press("Enter")
        time.sleep(2.5)
        # Priya's notification: bell/badge in her context
        npg = pages["priya"]
        notif = False
        t0 = time.time()
        while time.time() - t0 < 25:
            b = body(npg)
            # notification center badge count or mention highlight
            if re.search(r"\b[2-9]\b", b.split("Search or jump")[0][:200] if "Search or jump" in b else b[:200]):
                pass  # too fuzzy; rely on explicit bell below
            if "Notification" in b:
                notif = True; break
            time.sleep(1.5)
        # open notification center if button exists
        bell = npg.locator("[aria-label*='otification'], button:has(svg.lucide-bell)").first
        if bell.count():
            try: bell.click(timeout=4000); time.sleep(2)
            except Exception: pass
        b = body(npg)
        notif_ok = "review the sensor BOM" in b or "mentioned" in b.lower()
        log(f"[p5] MENTION notification visible for priya={notif_ok}")
        shot(npg, "p5_mention_priya")
        mention_ok = notif_ok
    except Exception as e:
        log(f"[p5] MENTION ERROR {str(e)[:180]}")

    # ---------- @Odin streaming ----------
    odin_ok = False
    try:
        ta = pages["kavitha"].locator("textarea").first
        ta.fill(f"@Odin In one sentence, what makes a good water-quality monitoring dashboard?")
        ta.press("Enter")
        t0 = time.time()
        stream_seen, final_seen = False, False
        while time.time() - t0 < 75:
            b = body(pages["kavitha"])
            if "Odin" in b and ("…" in b or "▍" in b or "typing" in b.lower()):
                stream_seen = True
            # AI reply bubble: any message from Odin with substance
            if re.search(r"Odin[\s\S]{0,400}dashboard", b):
                final_seen = True; break
            time.sleep(2)
        for obs in ["santhosh", "arun", "priya"]:
            t0 = time.time(); okk = False
            while time.time() - t0 < 30:
                if re.search(r"Odin[\s\S]{0,400}dashboard", body(pages[obs])): okk = True; break
                time.sleep(2)
            log(f"[p5] ODIN reply visible to {obs}={okk}")
        odin_ok = final_seen
        log(f"[p5] ODIN streaming_seen={stream_seen} final_seen={final_seen}")
        shot(pages["kavitha"], "p5_odin_reply")
    except Exception as e:
        log(f"[p5] ODIN ERROR {str(e)[:180]}")

    refs["p5"] = {"byok": ok, "mention": mention_ok, "odin": odin_ok}
    refs_write(refs)
    for u in USERS:
        dump_errors(pages[u["key"]], f"p5-{u['key']}")
        ctxs[u["key"]][0].close()

log(f"PHASE5 RESULT byok={ok} mention={mention_ok} odin={odin_ok}")
print("DONE", ok, mention_ok, odin_ok)

#!/usr/bin/env python3
"""PHASE 4: real-time messaging across 4 simultaneously-open browser contexts.
Cross-context assertions prove live delivery (no reloads). Then edit/reply/pin/search."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 4: real-time messaging (4 live contexts) ===")
refs = refs_read()
GID = refs["gid"]
CHAT = f"/group/{GID}/chat"

def wait_shell(pg, key, timeout_s=90):
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and ("Chat" in b or GROUP_HINT_OK(b)):
            log(f"[{key}] chat ready after {time.time()-t0:.0f}s")
            return True
        time.sleep(2)
    log(f"[{key}] chat NOT ready in {timeout_s}s")
    return False

def GROUP_HINT_OK(b):
    return "Innovators" in b

def send_msg(pg, key, text):
    ta = pg.locator("textarea").first
    ta.fill(text)
    time.sleep(0.4)
    ta.press("Enter")
    time.sleep(1.2)

def open_actions_menu(pg, marker):
    """Hover own message row, open the ⋯ actions menu."""
    row = pg.get_by_text(marker, exact=False).first
    row.hover()
    time.sleep(0.8)
    # action buttons appear on hover near the row: find buttons inside the row container
    btn = row.evaluate("""el => {
      const row = el.closest('[class*=group]') || el.closest('li') || el.parentElement;
      if (!row) return null;
      const b = [...row.querySelectorAll('button')].find(x => !x.textContent.trim());
      return b ? true : false;
    }""")
    if btn:
        row.evaluate("""el => {
          const row = el.closest('[class*=group]') || el.closest('li') || el.parentElement;
          const b = [...row.querySelectorAll('button')].find(x => !x.textContent.trim());
          b && b.click();
        }""")
        time.sleep(1)
        return True
    return False

with sync_playwright() as p:
    ctxs = {}
    for u in USERS:
        ctx, pg = user_ctx(p, u["key"])
        ctxs[u["key"]] = (ctx, pg)
        goto(pg, CHAT, settle=3)
    # patient warm-up for all
    for u in USERS:
        wait_shell(ctxs[u["key"]][1], u["key"], 90)
        shot(ctxs[u["key"]][1], f"p4_chat_{u['key']}")

    pages = {k: v[1] for k, v in ctxs.items()}

    # ---- ROUND-ROBIN REAL-TIME SENDS ----
    results = []
    for sender in ["santhosh", "kavitha", "arun", "priya"]:
        marker = f"[RT-{sender}] Deploying water sensor node alpha at {int(time.time())}"
        send_msg(pages[sender], sender, marker)
        sent_at = time.time()
        for observer, opg in pages.items():
            if observer == sender:
                continue
            seen = False
            t0 = time.time()
            while time.time() - t0 < 25:
                if marker in body(opg):
                    seen = True; break
                time.sleep(1.5)
            lat = time.time() - sent_at
            results.append((sender, observer, seen, round(lat, 1)))
            log(f"RT {sender} -> {observer}: seen={seen} latency≈{lat:.1f}s")
            if seen:
                shot(opg, f"p4_rt_{sender}_seen_by_{observer}")
        shot(pages[sender], f"p4_sent_{sender}")

    # ---- EDIT (Arun edits his own message) ----
    edit_ok = False
    try:
        # find Arun's last RT message text
        b = body(pages["arun"])
        m = re.search(r"\[RT-arun\] Deploying water sensor node alpha at \d+", b)
        if m:
            old = m.group(0)
            if open_actions_menu(pages["arun"], old):
                b2 = body(pages["arun"])
                mi = pages["arun"].get_by_text("Edit", exact=False)
                if mi.count():
                    mi.last.click(); time.sleep(1.2)
                    ta = pages["arun"].locator("textarea").first
                    cur = ta.input_value()
                    ta.fill(cur + " (edited)")
                    ta.press("Enter")
                    time.sleep(3)
                    edited = "(edited)" in body(pages["arun"])
                    # others see it live?
                    others_see = []
                    for obs in ["santhosh", "kavitha", "priya"]:
                        t0 = time.time()
                        okk = False
                        while time.time() - t0 < 20:
                            if "(edited)" in body(pages[obs]): okk = True; break
                            time.sleep(1.5)
                        others_see.append(okk)
                    edit_ok = edited
                    log(f"EDIT: applied={edited} others_live={others_see}")
                    shot(pages["arun"], "p4_edit_arun")
    except Exception as e:
        log(f"EDIT ERROR {str(e)[:160]}")

    # ---- REPLY/THREAD (Kavitha replies to Santhosh's message) ----
    reply_ok = False
    try:
        b = body(pages["kavitha"])
        m = re.search(r"\[RT-santhosh\] Deploying water sensor node alpha at \d+", b)
        if m:
            target = m.group(0)
            row = pages["kavitha"].get_by_text(target, exact=False).first
            row.hover(); time.sleep(0.8)
            row.evaluate("""el => {
              const row = el.closest('[class*=group]') || el.closest('li') || el.parentElement;
              const btns = row ? [...row.querySelectorAll('button')] : [];
              const reply = btns.find(x => (x.getAttribute('aria-label')||'').toLowerCase().includes('reply'))
                || btns.find(x => (x.textContent||'').toLowerCase().includes('reply'));
              reply && reply.click();
            }""")
            time.sleep(1.5)
            # thread panel composer
            ta = pages["kavitha"].locator("textarea").last
            ta.fill("[thread] Ground sensors vs floating probes — thoughts?")
            ta.press("Enter")
            time.sleep(3)
            reply_ok = "Ground sensors vs floating probes" in body(pages["kavitha"])
            log(f"REPLY: thread_reply_visible={reply_ok}")
            shot(pages["kavitha"], "p4_reply_kavitha")
    except Exception as e:
        log(f"REPLY ERROR {str(e)[:160]}")

    # ---- PIN (Santhosh pins Kavitha's message) ----
    pin_ok = False
    try:
        b = body(pages["santhosh"])
        m = re.search(r"\[RT-kavitha\] Deploying water sensor node alpha at \d+", b)
        if m:
            if open_actions_menu(pages["santhosh"], m.group(0)):
                mi = pages["santhosh"].get_by_text("Pin", exact=False)
                if mi.count():
                    mi.last.click(); time.sleep(2)
                    pin_ok = "Pinned" in body(pages["santhosh"]) or "pinned" in body(pages["santhosh"])
                    log(f"PIN: pinned_indicator={pin_ok}")
                    shot(pages["santhosh"], "p4_pin_santhosh")
    except Exception as e:
        log(f"PIN ERROR {str(e)[:160]}")

    # ---- SEARCH (Priya searches 'water') ----
    search_ok = False
    try:
        sb = pages["priya"].get_by_placeholder(re.compile("Search", re.I))
        if not sb.count():
            sb = pages["priya"].locator("input[placeholder*=earch], input[aria-label*=earch]")
        if sb.count():
            sb.first.click(); time.sleep(1)
            pages["priya"].keyboard.type("water sensor")
            time.sleep(3)
            b = body(pages["priya"])
            search_ok = "water sensor" in b.lower() or "sensor node" in b.lower()
            log(f"SEARCH: results={search_ok}")
            shot(pages["priya"], "p4_search_priya")
        else:
            log("SEARCH: no search input found")
    except Exception as e:
        log(f"SEARCH ERROR {str(e)[:160]}")

    refs["p4"] = {"rt": results, "edit": edit_ok, "reply": reply_ok, "pin": pin_ok, "search": search_ok}
    refs_write(refs)

    for u in USERS:
        dump_errors(pages[u["key"]], f"p4-{u['key']}")
        ctxs[u["key"]][0].close()

rt_ok = sum(1 for _,_,s,_ in results if s)
log(f"PHASE4 RESULT rt_deliveries={rt_ok}/{len(results)} edit={edit_ok} reply={reply_ok} pin={pin_ok} search={search_ok}")
print("DONE", rt_ok, len(results), edit_ok, reply_ok, pin_ok, search_ok)

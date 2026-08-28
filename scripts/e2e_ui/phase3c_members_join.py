#!/usr/bin/env python3
"""PHASE 3c: members join the real group via UI — patient polling waits.
Members are already past onboarding (scratch groups exist). Kavitha handled for both cases."""
import sys, time, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 3c: member joins (patient waits) ===")
refs = refs_read()
GID = refs["gid"]
LINKS = refs["invite_links"]
GROUP_HINT = "Innovators"

def wait_shell(pg, key, timeout_s=90):
    """Poll until the app shell is interactive (group name visible / loading gone)."""
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        b = body(pg)
        if "Loading your groups" not in b and ("Chat" in b or "Overview" in b or GROUP_HINT in b):
            log(f"[{key}] shell ready after {time.time()-t0:.0f}s url={pg.url}")
            return True
        time.sleep(2)
    log(f"[{key}] shell NOT ready in {timeout_s}s; body={body(pg)[:120]!r}")
    return False

def advancer(pg, candidates, label):
    for cand in candidates:
        btns = pg.get_by_role("button", name=cand)
        for i in range(btns.count()):
            b = btns.nth(i)
            if b.is_visible() and b.is_enabled():
                b.click(); time.sleep(1.7); return True
    btns = pg.locator("button:enabled")
    last = None
    for i in range(btns.count()):
        b = btns.nth(i)
        t = (b.inner_text() or "").strip().lower()
        cls = b.get_attribute("class") or ""
        if b.is_visible() and ("primary" in cls or "spectral" in cls) \
           and not any(x in t for x in ("back", "skip", "copy", "send", "replay")):
            last = b
    if last is not None:
        last.click(); time.sleep(1.7); return True
    return False

def wizard_if_needed(pg, key):
    goto(pg, "/onboarding", settle=4); time.sleep(2)
    if not any(s in body(pg) for s in ("your team called", "Team Setup")):
        return  # already onboarded
    log(f"[{key}] walking scratch wizard")
    pg.get_by_placeholder("e.g. Robotics Team, Startup Core").fill(f"{U[key]['name']} Scratch"); time.sleep(0.5)
    advancer(pg, ["Continue"], f"{key}-s1")
    advancer(pg, ["Skip for now"], f"{key}-s2")
    advancer(pg, ["Continue", "Next", "See the core loop"], f"{key}-s3")
    advancer(pg, ["Continue"], f"{key}-s4")
    advancer(pg, ["Create First Project"], f"{key}-s5")
    try:
        pg.get_by_placeholder("e.g. Flight Controller Firmware").fill("Scratch"); time.sleep(0.5)
    except Exception: pass
    advancer(pg, ["Continue"], f"{key}-s6")
    advancer(pg, [f"Enter {U[key]['name']} Scratch", "Enter"], f"{key}-s7")
    # onComplete does createGroup+createProject (cold round-trips can take 60s).
    # Poll patiently; do NOT navigate away while it is in flight.
    t0 = time.time()
    while time.time() - t0 < 90:
        u = pg.url
        b = body(pg)
        if "/group/" in u and "ONBOARDING" not in b:
            log(f"[{key}] entered shell after {time.time()-t0:.0f}s")
            return
        if "Failed to create group" in b:
            log(f"[{key}] onComplete toast error")
            return
        time.sleep(2)
    log(f"[{key}] post-Enter wait timed out; url={pg.url}")

with sync_playwright() as p:
    results = {}
    for key in ["kavitha", "arun", "priya"]:
        ctx, pg = user_ctx(p, key)
        try:
            # with Bug#5 fix live: cold load → bootstrap lands groups → auto-exit wizard
            goto(pg, "/", settle=4)
            if not wait_shell(pg, key, 75):
                # genuinely groupless → walk scratch wizard (patient post-Enter wait)
                wizard_if_needed(pg, key)
                goto(pg, "/", settle=4)
                wait_shell(pg, key, 75)
            recover_to_shell(pg)
            wait_shell(pg, key, 60)
            # open group switcher (topbar group-name button)
            opened = False
            for attempt in range(4):
                try:
                    sw = pg.locator("header button, [class*=topbar] button").first
                    sw.click(timeout=6000)
                    time.sleep(1.6)
                    if pg.get_by_text("Join Group", exact=True).count() or pg.get_by_role("menuitem", name="Join Group").count():
                        opened = True; break
                except Exception:
                    time.sleep(2)
            if not opened:
                log(f"[{key}] switcher never opened"); results[key] = False
                shot(pg, f"p3c_error_{key}"); ctx.close(); continue
            shot(pg, f"p3c_switcher_{key}")
            ji = pg.get_by_text("Join Group", exact=True)
            if not ji.count():
                ji = pg.get_by_role("menuitem", name="Join Group")
            ji.first.click(); time.sleep(1.8)
            shot(pg, f"p3c_dialog_{key}")
            pg.locator("#invite-link").fill(LINKS[key])
            pg.get_by_role("button", name=re.compile("^Join", re.I)).last.click()
            # patient wait for join outcome
            joined = False
            t0 = time.time()
            while time.time() - t0 < 30:
                b = body(pg)
                if GROUP_HINT in b:
                    joined = True; break
                if "invalid" in b.lower() or "expired" in b.lower():
                    log(f"[{key}] join rejected: {b[:150]!r}"); break
                time.sleep(2)
            log(f"[{key}] JOINED={joined} url={pg.url}")
            shot(pg, f"p3c_after_join_{key}")
            results[key] = joined
            dump_errors(pg, f"p3c-{key}")
        except Exception as e:
            log(f"[{key}] ERROR {str(e)[:200]}"); shot(pg, f"p3c_error_{key}")
            results[key] = False
        finally:
            try: ctx.close()
            except Exception: pass
    refs_write(refs)

log(f"PHASE3c RESULT joined={results}")
print("DONE", results)

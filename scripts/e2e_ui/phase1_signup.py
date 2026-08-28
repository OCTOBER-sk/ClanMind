#!/usr/bin/env python3
"""PHASE 1: register 4 accounts through the real signup UI (no API user creation)."""
import sys, time, shutil, os
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

run = sys.argv[1] if len(sys.argv) > 1 else "fresh"
log("=== PHASE 1: signup 4 accounts via UI ===")
refs = refs_read()
refs.setdefault("users", {})
ok, fail = [], []

with sync_playwright() as p:
    for u in USERS:
        key = u["key"]
        prof = f"{PROF}/{key}"
        if run == "fresh" and os.path.exists(prof):
            shutil.rmtree(prof, ignore_errors=True)
        ctx, pg = user_ctx(p, key)
        try:
            goto(pg, "/", settle=3.5)
            b = body(pg)
            log(f"[{key}] landing url={pg.url} has_signup_btn={'Create an account' in b}")
            shot(pg, f"p1_landing_{key}")
            # enter signup view
            if "Create an account" in b:
                pg.get_by_role("button", name="Create an account").first.click()
                time.sleep(1.5)
            b = body(pg)
            if "Create your account" not in b and "Your name" not in b:
                log(f"[{key}] signup view NOT visible; body={b[:200]!r}")
                fail.append(key); ctx.close(); continue
            # fill by placeholder
            pg.get_by_placeholder("Your name").fill(u["name"])
            pg.get_by_placeholder("you@team.com").fill(u["email"])
            pws = pg.get_by_placeholder("••••••••")
            n = pws.count()
            pws.nth(0).fill(u["pw"])
            if n > 1: pws.nth(1).fill(u["pw"])
            else: pg.get_by_placeholder("8+ characters").fill(u["pw"])
            shot(pg, f"p1_signup_filled_{key}")
            # submit: the form's submit button
            clicked = False
            for name in ["Create your account", "Create account", "Sign up"]:
                btn = pg.get_by_role("button", name=name)
                if btn.count():
                    btn.last.click(); clicked = True; break
            if not clicked:
                pg.locator("button[type=submit], form button").last.click()
            time.sleep(6)
            b2 = body(pg)
            authed = is_authed(pg)
            log(f"[{key}] after-submit url={pg.url} authed={authed} body_head={b2[:160].replace(chr(10),' | ')!r}")
            shot(pg, f"p1_after_signup_{key}")
            refs["users"][key] = {"email": u["email"], "name": u["name"], "authed": authed}
            (ok if authed else fail).append(key)
            dump_errors(pg, f"p1-{key}")
        except Exception as e:
            log(f"[{key}] ERROR {str(e)[:220]}")
            shot(pg, f"p1_error_{key}")
            fail.append(key)
        ctx.close()

refs_write(refs)
log(f"PHASE1 RESULT ok={ok} fail={fail}")
print("DONE", ok, fail)

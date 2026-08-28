#!/usr/bin/env python3
"""PHASE 2+3 v2: correct onboarding labels; owner creates group+project,
members scratch-then-join via Join Group dialog, Kavitha promoted via Team UI."""
import sys, time, json, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 2+3 (v2): group creation + invites + roles ===")
refs = refs_read()
GROUP_NAME = "SIH 2026 — Team Innovators"
PROJECT_NAME = "Smart Water Management"

def advancer(pg, candidates, label):
    for cand in candidates:
        btns = pg.get_by_role("button", name=cand)
        for i in range(btns.count()):
            b = btns.nth(i)
            if b.is_visible() and b.is_enabled():
                b.click(); time.sleep(1.7); log(f"[{label}] clicked {cand!r}"); return True
    # variant fallback: advance buttons are primary/spectral, never Back/Skip/Copy/Send/Replay
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
        t = (last.inner_text() or "").strip()
        last.click(); time.sleep(1.7); log(f"[{label}] clicked variant-btn {t!r}"); return True
    log(f"[{label}] NO ADVANCE BUTTON ({candidates})")
    return False

def onboarding_steps(pg, key, group_name, project_name, owner):
    goto(pg, "/onboarding", settle=3)
    pg.get_by_placeholder("e.g. Robotics Team, Startup Core").fill(group_name)
    shot(pg, f"p2_s1_{key}")
    if not advancer(pg, ["Continue"], f"{key}-s1"): return False
    if owner:
        advancer(pg, ["Skip for now"], f"{key}-s2")   # real invites come from TeamView later
    else:
        advancer(pg, ["Skip for now"], f"{key}-s2")
    advancer(pg, ["Continue", "Next", "Meet Odin"], f"{key}-s3")
    advancer(pg, ["Continue"], f"{key}-s4")
    advancer(pg, ["Create First Project"], f"{key}-s5")
    try:
        pg.get_by_placeholder("e.g. Flight Controller Firmware").fill(project_name)
        shot(pg, f"p2_s6_{key}")
    except Exception as e:
        log(f"[{key}] project fill failed: {str(e)[:120]}")
    advancer(pg, ["Continue"], f"{key}-s6")
    shot(pg, f"p2_s7_{key}")
    advancer(pg, [f"Enter {group_name}", "Enter"], f"{key}-s7")
    time.sleep(4)
    log(f"[{key}] post-onboarding url={pg.url}")
    return "/group/" in pg.url or "/onboarding" not in pg.url

with sync_playwright() as p:
    # ---------- OWNER ----------
    ctx, pg = user_ctx(p, "santhosh")
    try:
        ok = onboarding_steps(pg, "santhosh", GROUP_NAME, PROJECT_NAME, owner=True)
        m = re.search(r"/group/([0-9a-f-]{36})", pg.url)
        refs["gid"] = m.group(1) if m else None
        log(f"[santhosh] onboarding_ok={ok} GID={refs['gid']}")
        shot(pg, "p2_owner_chat")
        dump_errors(pg, "p2-owner")
    except Exception as e:
        log(f"[santhosh] ERROR {str(e)[:240]}"); shot(pg, "p2_error_owner")
    finally:
        ctx.close()
    refs_write(refs)

    if not refs.get("gid"):
        log("PHASE2 ABORT: no gid"); print("DONE partial"); sys.exit(0)

    # ---------- OWNER: create real invite from TeamView ----------
    ctx, pg = user_ctx(p, "santhosh")
    try:
        goto(pg, f"/group/{refs['gid']}/team", settle=3.5)
        shot(pg, "p3_teamview")
        invite = {"link": None, "resp": None}
        def on_resp(r):
            if "/invites" in r.url and r.request.method == "POST":
                try: invite["resp"] = r.json()
                except Exception: pass
        pg.on("response", on_resp)
        try: ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
        except Exception as e: log(f"clipboard grant failed: {e}")
        clicked = False
        for cand in ["Invite", "Invite Teammate"]:
            b = pg.get_by_role("button", name=cand)
            if b.count():
                b.first.click(); time.sleep(1.8); clicked = True; break
        log(f"[santhosh] invite button clicked={clicked}")
        shot(pg, "p3_invite_dialog")
        # dialog may create link automatically or need another click
        for cand in ["Create Invite Link", "Copy Invite Link", "Copy link", "Create Link", "Copy"]:
            b = pg.get_by_role("button", name=cand)
            if b.count():
                b.first.click(); time.sleep(1.8); log(f"[santhosh] invite dlg clicked {cand!r}"); break
        try: invite["link"] = pg.evaluate("navigator.clipboard.readText()")
        except Exception as e: log(f"clipboard read failed: {str(e)[:90]}")
        if not invite.get("link") and invite.get("resp"):
            d = invite["resp"] or {}
            tok = d.get("token") or (d.get("invite") or {}).get("token") or ""
            if tok: invite["link"] = tok
        # last resort: any invite URL text visible in the dialog
        if not invite.get("link"):
            b = body(pg)
            m2 = re.search(r"https?://\S*join\S*|/join/[A-Za-z0-9\-_]+", b)
            if m2: invite["link"] = m2.group(0)
        log(f"[santhosh] invite_link={str(invite.get('link'))[:90]}")
        shot(pg, "p3_invite_link")
        refs["invite_link"] = invite.get("link")
    except Exception as e:
        log(f"[santhosh-invite] ERROR {str(e)[:240]}")
    finally:
        ctx.close()
    refs_write(refs)

    if not refs.get("invite_link"):
        log("PHASE3 ABORT: no invite link"); print("DONE partial"); sys.exit(0)

    # ---------- MEMBERS join ----------
    results = {}
    for key in ["kavitha", "arun", "priya"]:
        ctx, pg = user_ctx(p, key)
        try:
            ok = onboarding_steps(pg, key, f"{U[key]['name']} Scratch", "Scratch", owner=False)
            time.sleep(1.5)
            # group switcher → Join Group
            sw = pg.get_by_role("button", name=f"{U[key]['name']} Scratch")
            if not sw.count():
                sw = pg.locator("header button").first
            sw.first.click(); time.sleep(1.4)
            ji = pg.get_by_role("menuitem", name="Join Group")
            if not ji.count():
                ji = pg.get_by_text("Join Group", exact=True)
            ji.first.click(); time.sleep(1.4)
            shot(pg, f"p3_join_dialog_{key}")
            pg.locator("#invite-link").fill(refs["invite_link"])
            pg.get_by_role("button", name=re.compile("^Join", re.I)).last.click()
            time.sleep(5)
            b = body(pg)
            joined = ("Innovators" in b) or ("/group/" in pg.url and "Scratch" not in pg.url)
            log(f"[{key}] onb_ok={ok} joined={joined} url={pg.url}")
            shot(pg, f"p3_after_join_{key}")
            results[key] = joined
            dump_errors(pg, f"p3-{key}")
        except Exception as e:
            log(f"[{key}] ERROR {str(e)[:240]}"); shot(pg, f"p3_error_{key}")
            results[key] = False
        finally:
            ctx.close()

    # ---------- OWNER: verify members + promote Kavitha ----------
    ctx, pg = user_ctx(p, "santhosh")
    try:
        goto(pg, f"/group/{refs['gid']}/team", settle=3.5)
        b = body(pg)
        names_present = [n for n in ["Santhosh", "Kavitha", "Arun", "Priya"] if n in b]
        log(f"[team] members visible={names_present}")
        shot(pg, "p3_team_before_promote")
        promoted = False
        # find Kavitha's row, then a select/button in the same row container
        krow = pg.locator("div", has_text="Kavitha").locator("select")
        if krow.count():
            krow.first.select_option(label="ADMIN"); promoted = True
        else:
            btns = pg.get_by_role("button")
            for i in range(btns.count()):
                bb = btns.nth(i)
                near = bb.evaluate("el => el.closest('div')?.textContent || ''")
                if "Kavitha" in near and ("role" in near.lower() or "member" in near.lower() or "admin" in near.lower()):
                    bb.click(); time.sleep(1.2)
                    for cand in ["Make Admin", "Make admin", "Admin"]:
                        mi = pg.get_by_role("menuitem", name=cand)
                        if mi.count():
                            mi.first.click(); promoted = True; break
                    if promoted: break
        if not promoted:
            sels = pg.locator("select")
            for i in range(sels.count()):
                try:
                    sels.nth(i).select_option(label="ADMIN"); promoted = True; break
                except Exception:
                    continue
        time.sleep(2.5)
        b2 = body(pg)
        log(f"[team] promoted={promoted}")
        shot(pg, "p3_team_after_promote")
        refs["promote_done"] = promoted
        refs["members_seen"] = names_present
        dump_errors(pg, "p3-team")
    except Exception as e:
        log(f"[team] ERROR {str(e)[:240]}")
    finally:
        ctx.close()
    refs_write(refs)

log(f"PHASE2+3 RESULT joined={results} gid={refs.get('gid')} promote={refs.get('promote_done')}")
print("DONE", results)

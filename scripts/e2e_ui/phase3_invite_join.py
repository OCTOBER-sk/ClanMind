#!/usr/bin/env python3
"""PHASE 3 (final): owner creates real invite via TeamView UI; members join via
Join Group dialog; Kavitha promoted to ADMIN via Team UI."""
import sys, time, json, re
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

log("=== PHASE 3: real invite + joins + promote ===")
refs = refs_read()
GID = refs.get("gid") or "dd369df2-0c85-4ec5-a5af-cab1c5863c1d"
refs["gid"] = GID
GROUP_HINT = "Innovators"

def recover_to_shell(pg):
    """Bootstrap via / first (RootRedirect proved reliable), then reach section."""
    if "/onboarding" in pg.url:
        goto(pg, "/", settle=3.5)
        log(f"[recover] now at {pg.url}")

def go_section(pg, url, settle=4):
    goto(pg, "/", settle=4)
    if "Loading your groups" in body(pg):
        time.sleep(3)
    goto(pg, url, settle=settle)
    time.sleep(1.5)

def advancer(pg, candidates, label):
    for cand in candidates:
        btns = pg.get_by_role("button", name=cand)
        for i in range(btns.count()):
            b = btns.nth(i)
            if b.is_visible() and b.is_enabled():
                b.click(); time.sleep(1.7); log(f"[{label}] clicked {cand!r}"); return True
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

def walk_wizard(pg, key, group_name, project_name):
    """Proven full 7-step walk (variant-label fallback included)."""
    goto(pg, "/onboarding", settle=4)
    time.sleep(2)
    if not any(s in body(pg) for s in ("your team called", "Team Setup")):
        log(f"[{key}] wizard not at step1; url={pg.url}")
        return
    pg.get_by_placeholder("e.g. Robotics Team, Startup Core").fill(group_name)
    time.sleep(0.5)
    if not advancer(pg, ["Continue"], f"{key}-s1"): return
    advancer(pg, ["Skip for now"], f"{key}-s2")
    advancer(pg, ["Continue", "Next", "See the core loop"], f"{key}-s3")
    advancer(pg, ["Continue"], f"{key}-s4")
    advancer(pg, ["Create First Project"], f"{key}-s5")
    try:
        pg.get_by_placeholder("e.g. Flight Controller Firmware").fill(project_name)
        time.sleep(0.5)
    except Exception: pass
    advancer(pg, ["Continue"], f"{key}-s6")
    advancer(pg, [f"Enter {group_name}", "Enter"], f"{key}-s7")
    time.sleep(4)
    log(f"[{key}] wizard done; url={pg.url}")

with sync_playwright() as p:
    # ---------- OWNER creates invite in TeamView ----------
    ctx, pg = user_ctx(p, "santhosh")
    invite = {"link": None, "resp": None}
    try:
        def on_resp(r):
            if "/invites" in r.url and r.request.method == "POST":
                try: invite["resp"] = r.json()
                except Exception: pass
        pg.on("response", on_resp)
        go_section(pg, f"/group/{GID}/settings")
        recover_to_shell(pg)
        # open the Members tab (InviteCard lives there, §72)
        tab = pg.get_by_role("button", name=re.compile("^Members", re.I))
        if tab.count():
            tab.first.click(); time.sleep(1.6)
        shot(pg, "p3b_settings_members")
        b = body(pg)
        log(f"[owner] url={pg.url} invite_card={'Send invites' in b}")
        # §72 InviteCard: per-email invite → capture token from fresh network resp
        links = {}
        for member in ["kavitha", "arun", "priya"]:
            email = U[member]["email"]
            invite["resp"] = None
            pg.get_by_label("Invite email").fill(email)
            pg.get_by_label("Invite role").select_option(label="Admin" if member == "kavitha" else "Member")
            pg.get_by_role("button", name="Send invites").click()
            # wait for THIS invite's network response (robust vs stale panel)
            for _ in range(30):
                if invite.get("resp"): break
                time.sleep(0.5)
            d = invite.get("resp") or {}
            tok = d.get("token") or (d.get("invite") or {}).get("token") or ""
            if tok:
                links[member] = f"{BASE}/invite/{tok}"
            else:
                panel = pg.locator("[data-testid=invite-token-panel]")
                panel.wait_for(timeout=8000)
                links[member] = panel.locator("code").inner_text().strip()
            log(f"[owner] invite for {member}: {links[member][:60]}… role_from_resp={d.get('invite',{}).get('role') or d.get('role')}")
            shot(pg, f"p3b_invite_{member}")
            time.sleep(1)
        refs["invite_links"] = links
        refs["invite_link"] = links.get("kavitha")
    except Exception as e:
        log(f"[owner] ERROR {str(e)[:240]}"); shot(pg, "p3b_error_owner")
    finally:
        ctx.close()
    refs_write(refs)

    if not refs.get("invite_links"):
        log("PHASE3 ABORT: no invite links"); print("DONE partial"); sys.exit(0)

    # ---------- MEMBERS join (each with their own emailed invite link) ----------
    results = {}
    for key in ["kavitha", "arun", "priya"]:
        ctx, pg = user_ctx(p, key)
        try:
            # deterministic wizard walk with variant-label fallback
            walk_wizard(pg, key, f"{U[key]['name']} Scratch", "Scratch")
            recover_to_shell(pg)
            time.sleep(2)
            # group switcher: click the topbar group-name button (shows group name or avatar)
            sw = pg.locator("header button, [class*=topbar] button").first
            clicked = False
            for _ in range(3):
                try:
                    sw.click(timeout=4000); clicked = True; break
                except Exception:
                    time.sleep(1.5)
            if not clicked:
                # fall back to any button whose text mentions the scratch group
                sw2 = pg.get_by_role("button", name=re.compile("Scratch", re.I))
                sw2.first.click(); clicked = True
            time.sleep(1.6)
            shot(pg, f"p3b_switcher_{key}")
            ji = pg.get_by_text("Join Group", exact=True)
            if not ji.count():
                ji = pg.get_by_role("menuitem", name="Join Group")
            ji.first.click(); time.sleep(1.6)
            shot(pg, f"p3b_join_dialog_{key}")
            pg.locator("#invite-link").fill(refs["invite_links"][key])
            pg.get_by_role("button", name=re.compile("^Join", re.I)).last.click()
            time.sleep(5.5)
            b = body(pg)
            joined = GROUP_HINT in b
            log(f"[{key}] joined={joined} url={pg.url}")
            shot(pg, f"p3b_after_join_{key}")
            results[key] = joined
            dump_errors(pg, f"p3b-{key}")
        except Exception as e:
            log(f"[{key}] ERROR {str(e)[:240]}"); shot(pg, f"p3b_error_{key}")
            results[key] = False
        finally:
            ctx.close()

    # ---------- OWNER: verify team + promote Kavitha ----------
    ctx, pg = user_ctx(p, "santhosh")
    try:
        goto(pg, f"/group/{GID}/team", settle=4)
        recover_to_shell(pg)
        b = body(pg)
        names_present = [n for n in ["Santhosh", "Kavitha", "Arun", "Priya"] if n in b]
        log(f"[team] members visible={names_present}")
        shot(pg, "p3b_team_full")
        promoted = False
        sels = pg.locator("select")
        for i in range(sels.count()):
            s = sels.nth(i)
            ctx_txt = s.evaluate("el => el.closest('div,li,section')?.textContent || ''")
            if "Kavitha" in ctx_txt:
                s.select_option(label="ADMIN"); promoted = True; break
        if not promoted:
            btns = pg.get_by_role("button")
            for i in range(btns.count()):
                bb = btns.nth(i)
                near = bb.evaluate("el => (el.closest('div,li')?.textContent || '')")
                if "Kavitha" in near:
                    bb.click(); time.sleep(1.2)
                    for cand in ["Make Admin", "Make admin", "Promote", "Admin"]:
                        mi = pg.get_by_role("menuitem", name=cand)
                        if mi.count():
                            mi.first.click(); promoted = True; break
                    if promoted: break
        time.sleep(2.5)
        b2 = body(pg)
        log(f"[team] promoted={promoted} admin_count={b2.count('ADMIN')}")
        shot(pg, "p3b_team_after_promote")
        refs["promote_done"] = promoted
        refs["members_seen"] = names_present
        dump_errors(pg, "p3b-team")
    except Exception as e:
        log(f"[team] ERROR {str(e)[:240]}")
    finally:
        ctx.close()
    refs_write(refs)

log(f"PHASE3 RESULT joined={results} promote={refs.get('promote_done')} members={refs.get('members_seen')}")
print("DONE", results)

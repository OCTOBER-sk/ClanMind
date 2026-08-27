#!/usr/bin/env python3
"""Resumable walk of ClanMind live onboarding + screens using persistent context."""
import os, time
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
BASE="http://localhost:1420"; EMAIL="frontendqa@clanmind.io"; PASS="ClanMind#QA#2026"
SHOT="/home/santhosh/projects/ClanMind/docs/screenshots/live"; os.makedirs(SHOT, exist_ok=True)
PROF="/tmp/clanmind_qa_profile"
def shot(pg,name): pg.screenshot(path=f"{SHOT}/{name}.png"); print(f"SHOT:{name}")
def fill_visible(pg):
    for i in range(pg.locator("input").count()):
        el=pg.locator("input").nth(i)
        try:
            if not el.is_visible(): continue
        except: continue
        ph=(el.get_attribute("placeholder") or "").lower()
        v="ClanMind QA Hub"
        if "context" in ph or "optional" in ph: v="Live E2E testing workspace for flagship validation"
        elif "email" in ph: v=""  # don't invite
        elif "name" in ph: v="Fresh QA Member"
        else: v="STM32 telemetry at scale"
        if v: 
            try: el.fill(v)
            except: pass

with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(PROF, headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"], viewport={"width":1440,"height":900})
    pg=ctx.new_page()
    pg.goto(BASE, wait_until="networkidle"); time.sleep(1.5)
    body=pg.inner_text("body")
    # Landing page -> open auth form
    si_btn=pg.get_by_role("button", name="Sign in")
    if si_btn.count() and si_btn.first.is_visible() and "Create an account" in body:
        si_btn.first.click(); time.sleep(1.5); body=pg.inner_text("body")
    # Now on auth form (Welcome back / or a sign-in title)
    if "Welcome back" in body or "Forgot password" in body or "Password" in body:
        f=pg.locator("input")
        for i in range(f.count()):
            el=f.nth(i); t=(el.get_attribute("type") or "")
            el.fill(PASS if "password" in t else EMAIL)
        shot(pg,"auth_filled")
        try: pg.get_by_role("button", name="Sign in").last.click()
        except Exception as e: print("submit err",e)
        time.sleep(4.5)
    print("URL:", pg.url)
    shot(pg,"qa_start")
    # walk onboarding steps
    for it in range(14):
        body=pg.inner_text("body")
        if "/onboarding" not in pg.url and "ONBOARDING" not in body:
            print("leaving onboarding:", pg.url); break
        print(f"[it{it}] body head: {body[:110].replace(chr(10),' | ')}")
        fill_visible(pg)
        shot(pg, f"qa_onb_{it}")
        clicked=False
        cands=["Skip for now","See the core loop","Looks good","Let's go","Get started","Next","Continue","Send invites","Finish","Create","Start","Explore","Open project","Go to clann","Done","Got it","Enter"]
        for txt in cands:
            bt=pg.get_by_role("button", name=txt)
            if bt.count() and bt.first.is_visible():
                try: bt.last.click(); clicked=True; print("clicked:",txt); break
                except: pass
        if not clicked:
            # fallback: click last visible non-Back button with -> 
            btns=pg.eval_on_selector_all("button","els=>els.filter(e=>e.offsetParent!==null).map(e=>({t:e.innerText.trim()}))")
            nonback=[b["t"] for b in btns if b["t"] and b["t"]!="Back"]
            if nonback:
                last=nonback[-1]
                try: pg.get_by_role("button", name=last).last.click(); clicked=True; print("fallback clicked:",last)
                except Exception as e: print("fb err",e)
        if not clicked:
            print("no cta; halting onboarding"); break
        time.sleep(2.2)
    # final state
    print("FINAL URL:", pg.url)
    print("FINAL BODY:", pg.inner_text("body")[:2000])
    shot(pg,"qa_final")
    ctx.close()
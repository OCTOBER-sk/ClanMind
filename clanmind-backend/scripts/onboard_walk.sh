#!/usr/bin/env python3
"""Auto-walk ClanMind live onboarding (7 steps) as fresh user, capturing each step."""
import os, time, json
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
BASE="http://localhost:1420"; EMAIL="frontendqa@clanmind.io"; PASS="ClanMind#QA#2026"
SHOT="/home/santhosh/projects/ClanMind/docs/screenshots/live"; os.makedirs(SHOT, exist_ok=True)

def shot(pg,name):
    path=f"{SHOT}/{name}.png"; pg.screenshot(path=path); print(f"SHOT:{name}")

def heading(pg):
    return pg.eval_on_selector_all("h1,h2", "els=>els.map(e=>e.innerText.trim().slice(0,60))")

def fill_visible(pg):
    for i in range(pg.locator("input").count()):
        el=pg.locator("input").nth(i)
        if not el.is_visible(): continue
        ph=(el.get_attribute("placeholder") or "").lower()
        if "group" in ph or "team" in ph: el.fill("ClanMind QA Hub")
        elif "context" in ph or "optional" in ph or "tell" in ph: el.fill("Live E2E testing workspace for the flagship validation")
        elif "focus" in ph or "goal" in ph or "project" in ph : el.fill("STM32 telemetry at scale")
        elif "name" in ph: el.fill("Fresh QA Member")
        else:
            try: el.fill("STM32 telemetry at scale")
            except: pass

with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"])
    pg=b.new_page(viewport={"width":1440,"height":900})
    # login if needed (fresh profile, so must sign in)
    pg.goto(BASE, wait_until="networkidle"); time.sleep(1.2)
    if pg.get_by_role("button", name="Sign in").count() and pg.get_by_role("button", name="Sign in").first.is_visible():
        pg.get_by_role("button", name="Sign in").first.click(); time.sleep(1.2)
        fields=pg.locator("input")
        for i in range(fields.count()):
            el=fields.nth(i); t=(el.get_attribute("type") or "")
            el.fill(PASS if "password" in t else EMAIL)
        try: pg.get_by_role("button", name="Sign in").last.click()
        except: pass
        time.sleep(4)
    shot(pg,"onb_0_postlogin")
    # walk steps
    step=1
    for it in range(12):
        body=pg.inner_text("body")
        hds=heading(pg)
        print(f"--- iteration {it}: H1={hds} ---")
        if "Continue" in body or "Next" in body or "Create" in body or "Finish" in body:
            fill_visible(pg)
            shot(pg, f"onb_step{step}")
            # click primary CTA
            done=False
            for txt in ["Continue","Next","Create","Finish","Let's go","Get started"]:
                bt=pg.get_by_role("button", name=txt)
                if bt.count() and bt.first.is_visible():
                    # use last to avoid header 'Continue' dupes if any
                    bt.last.click(); done=True; print("clicked:",txt); step+=1; break
            time.sleep(2.5)
            if not done:
                print("no CTA found; halting"); break
        else:
            # maybe finished onboarding -> app home
            print("no CTA in body; assume done. body head:", body[:200])
            break
    shot(pg,"onb_final")
    print("FINAL URL:", pg.url)
    print("FINAL BODY:", pg.inner_text("body")[:900])
    b.close()
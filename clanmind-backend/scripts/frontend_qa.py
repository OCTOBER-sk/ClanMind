#!/usr/bin/env python3
"""ClanMind LIVE frontend QA driver (headless Playwright, VPS-safe).
Sets LD_LIBRARY_PATH for the NSS user-space libs, then drives the live app.
Usage: python3 frontend_qa.py <step>
"""
import os, sys, time, json
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright

BASE = "http://localhost:1420"
SHOT_DIR = "/home/santhosh/projects/ClanMind/docs/screenshots/live"
os.makedirs(SHOT_DIR, exist_ok=True)
EMAIL = "frontendqa@clanmind.io"
PASS = "ClanMind#QA#2026"

step = sys.argv[1] if len(sys.argv) > 1 else "login"

def shot(page, name):
    p = f"{SHOT_DIR}/{name}.png"
    page.screenshot(path=p, full_page=False)
    print(f"SHOT:{p}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox", "--disable-dev-shm-usage"])
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    if step == "login":
        page.goto(BASE, wait_until="networkidle")
        time.sleep(1.5)
        print("TITLE:", page.title())
        # dump inputs
        inputs = page.eval_on_selector_all("input", "els => els.map((e,i)=>({i,t:e.type,n:e.name,p:e.placeholder,id:e.id,aria:e.getAttribute('aria-label')}))")
        print("INPUTS:", json.dumps(inputs))
        btns = page.eval_on_selector_all("button", "els => els.map((e,i)=>e.innerText.trim().slice(0,40))")
        print("BUTTONS:", json.dumps(btns))
        print("BODY_TXT:", page.inner_text("body")[:900])
        shot(page, "01_login")
        browser.close()

    elif step == "signin":
        page.goto(BASE, wait_until="networkidle")
        time.sleep(1.5)
        # open auth: click "Sign in"
        si = page.get_by_role("button", name="Sign in")
        if si.count() and si.first.is_visible():
            si.first.click(); print("clicked Sign in"); time.sleep(1.5)
        print("URL after:", page.url)
        print("AUTH BODY:", page.inner_text("body")[:600])
        shot(page, "02_auth_form")
        # fill fields
        fields = page.locator("input")
        print("auth inputs:", fields.count())
        for i in range(fields.count()):
            el = fields.nth(i)
            t = (el.get_attribute("type") or "")
            ph = (el.get_attribute("placeholder") or "").lower()
            if "password" in t or "pass" in ph:
                el.fill(PASS)
            else:
                el.fill(EMAIL)
        shot(page, "02b_auth_filled")
        # submit the auth form's primary button
        clicked_f = False
        for txt in ["Sign in","Sign In","Login","Log in","Continue","Submit","Create account","Sign up","Register"]:
            b = page.get_by_role("button", name=txt)
            if b.count() and b.first.is_visible():
                try:
                    b.first.click(); clicked_f = True; print("submitted:", txt); break
                except Exception as e:
                    print("click err", e)
        if not clicked_f:
            page.eval_on_selector_all("button", "els => els.forEach(e=>e.offsetParent!==null && ['button','submit'].includes((e.type||'button')) && e.click())")
            print("fallback click all")
        time.sleep(4.5)
        print("POST-LOGIN URL:", page.url)
        print("POST-LOGIN TITLE:", page.title())
        print("BODY_TXT:", page.inner_text("body")[:1500])
        shot(page, "03_home_after_login")
        browser.close()

    else:
        print("unknown step", step)
        browser.close()
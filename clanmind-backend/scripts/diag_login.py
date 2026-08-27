#!/usr/bin/env python3
"""Diagnose live sign-in: capture console + supabase auth network outcome."""
import os, time, json
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
BASE="http://localhost:1420"; EMAIL="frontendqa@clanmind.io"; PASS="ClanMind#QA#2026"
console=[]; reqs=[]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"])
    pg=b.new_page(viewport={"width":1440,"height":900})
    pg.on("console", lambda m: console.append(f"{m.type}: {m.text[:300]}"))
    pg.on("requestfailed", lambda r: console.append(f"REQFAIL {r.url[:120]} {r.failure}"))
    pg.on("response", lambda r: reqs.append((r.status, r.url[:140])) if "supabase" in r.url else None)
    pg.goto(BASE, wait_until="networkidle"); time.sleep(1.5)
    pg.get_by_role("button", name="Sign in").first.click(); time.sleep(1.2)
    fields=pg.locator("input")
    for i in range(fields.count()):
        el=fields.nth(i); t=(el.get_attribute("type") or "")
        el.fill(PASS if "password" in t else EMAIL)
    pg.get_by_role("button", name="Sign in").last.click()  # the form submit
    time.sleep(4)
    print("=== CONSOLE (errors/important) ===")
    for c in console:
        if any(k in c.lower() for k in ["error","fail","supabase","auth","fetch","401","403","400"]) or c.startswith("error"):
            print(c)
    print("=== SUPABASE NETWORK ===")
    for s,u in reqs: print(s, u)
    print("=== body ===")
    print(pg.inner_text("body")[:900])
    b.close()
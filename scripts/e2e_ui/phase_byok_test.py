#!/usr/bin/env python3
"""E2E: BYOK versatile provider + Test connection + Test model via UI.
Uses Santhosh (OWNER) account. Reads the BYOK key from the worker .dev.vars
so no secret is ever committed. Paste model openai/gpt-4o-mini, click Test
connection then Test model; screenshots both states."""
import sys, time, re, os
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

# Key comes from the gitignored .dev.vars — never hardcode.
def _load_or_key():
    devvars = "/home/santhosh/projects/ClanMind/clanmind-backend/apps/worker/.dev.vars"
    if os.path.exists(devvars):
        for line in open(devvars):
            if line.startswith("OPENROUTER_API_KEY="):
                return line.strip().split("=", 1)[1]
    return os.environ.get("OPENROUTER_API_KEY", "")

OR_KEY = _load_or_key()
if not OR_KEY:
    raise SystemExit("No OpenRouter key found in .dev.vars OPENROUTER_API_KEY or env.")

with sync_playwright() as p:
    ctx, pg = user_ctx(p, "santhosh")
    goto(pg, "/settings", settle=3)
    time.sleep(4)
    for sel in ["a:has-text('Settings')", "[data-testid='nav-settings']", "text=Settings"]:
        try:
            el = pg.locator(sel).first
            if el.count() and el.is_visible():
                el.click(); time.sleep(3); break
        except Exception:
            pass
    for sel in ["button:has-text('AI')", "[data-testid='nav-ai']", "a:has-text('AI')"]:
        try:
            el = pg.locator(sel).first
            if el.count() and el.is_visible():
                el.click(); time.sleep(3); break
        except Exception:
            pass
    t0 = time.time()
    while time.time() - t0 < 30 and "Bring Your Own Key" not in body(pg):
        time.sleep(2)
    shot(pg, "byok_before")

    pg.select_option("select", "openrouter", timeout=8000)
    time.sleep(1)
    pg.locator("input[type=password]").first.fill(OR_KEY)
    time.sleep(1)
    model_input = pg.get_by_label(re.compile("^Model", re.I))
    if not model_input.count():
        model_input = pg.get_by_placeholder(re.compile("openai/gpt-4o-mini|llama", re.I))
    if model_input.count():
        model_input.first.fill("openai/gpt-4o-mini")
    time.sleep(1)
    shot(pg, "byok_filled")

    tc = pg.get_by_role("button", name=re.compile("Test connection", re.I))
    if tc.count():
        tc.first.click()
        time.sleep(14)
        shot(pg, "byok_test_conn")
    tm = pg.get_by_role("button", name=re.compile("Test model", re.I))
    if tm.count():
        tm.first.click()
        time.sleep(22)
        shot(pg, "byok_test_model")

    wb = body(pg)
    log(f"[byok] connected={'Connected' in wb} model_connected={'Model connected' in wb}")
    dump_errors(pg, "byok")
    ctx.close()
print("DONE")

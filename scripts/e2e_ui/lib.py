#!/usr/bin/env python3
"""Shared harness for ClanMind 4-account UI E2E. UI-CLICKS-ONLY for product flows.
4 persistent Chromium contexts = 4 users with independent sessions."""
import os, json, time, glob, shutil, datetime

BASE = "http://localhost:1420"
CHROME = "/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"
REPO = "/home/santhosh/projects/ClanMind"
SHOT = f"{REPO}/docs/screenshots/e2e_ui"
LOGF = f"{REPO}/docs/live/E2E_UI_LOG.txt"
REFS = "/tmp/e2e_ui_refs.json"
PROF = "/tmp/e2e_profiles"

USERS = [
    {"key": "santhosh", "name": "Santhosh", "email": "atom.e2e.santhosh@clanmind.test", "pw": "ClanMind#E2E#2026!", "role": "OWNER"},
    {"key": "kavitha",  "name": "Kavitha",  "email": "atom.e2e.kavitha@clanmind.test",  "pw": "ClanMind#E2E#2026!", "role": "ADMIN"},
    {"key": "arun",     "name": "Arun",     "email": "atom.e2e.arun@clanmind.test",     "pw": "ClanMind#E2E#2026!", "role": "MEMBER"},
    {"key": "priya",    "name": "Priya",    "email": "atom.e2e.priya@clanmind.test",    "pw": "ClanMind#E2E#2026!", "role": "MEMBER"},
]
U = {u["key"]: u for u in USERS}

os.makedirs(SHOT, exist_ok=True)
os.makedirs(f"{REPO}/docs/live", exist_ok=True)
os.environ.setdefault("LD_LIBRARY_PATH", "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu")

_SHOTS_TAKEN = []

def log(msg):
    line = f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOGF, "a") as f:
        f.write(line + "\n")

def shot(pg, name):
    path = f"{SHOT}/{name}.png"
    pg.screenshot(path=path)
    _SHOTS_TAKEN.append(name)
    log(f"SHOT {name}")

def refs_read():
    return json.load(open(REFS)) if os.path.exists(REFS) else {}

def refs_write(d):
    json.dump(d, open(REFS, "w"), indent=1)

def user_ctx(p, key, width=1500, height=940):
    """Persistent context per user — sessions survive between phase scripts."""
    d = f"{PROF}/{key}"
    os.makedirs(d, exist_ok=True)
    ctx = p.chromium.launch_persistent_context(
        d, headless=True, executable_path=CHROME,
        args=["--no-sandbox", "--disable-dev-shm-usage", f"--window-size={width},{height}"],
        viewport={"width": width, "height": height})
    pg = ctx.new_page()
    errors = []
    pg.on("console", lambda m: errors.append(f"{m.type}:{m.text[:160]}") if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(f"pageerror:{str(e)[:160]}"))
    pg.set_default_timeout(15000)
    pg._e2e_errors = errors
    return ctx, pg

def body(pg):
    return pg.inner_text("body")

def auth_token(pg):
    """Read the Supabase session token from the app's localStorage (real session)."""
    return pg.evaluate("() => { for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) { try { const v = JSON.parse(localStorage[k]); return v?.access_token || v?.currentSession?.access_token || null } catch(e){} } return null }")

def goto(pg, path, settle=2.5):
    pg.goto(f"{BASE}{path}", wait_until="domcontentloaded")
    time.sleep(settle)

def do_login(pg, email, pw):
    """Login through the real AuthScreen UI."""
    goto(pg, "/", settle=3)
    b = body(pg)
    if "Create an account" in b:
        pg.get_by_role("button", name="Sign in").first.click(); time.sleep(1.2)
    if "Welcome back" not in body(pg):
        # maybe already logged in
        if "/group/" in pg.url or "Odin" in body(pg):
            return "already"
    fields = pg.locator("input")
    for i in range(fields.count()):
        el = fields.nth(i)
        t = (el.get_attribute("type") or "")
        if t == "password": el.fill(pw)
        elif t == "email": el.fill(email)
    pg.get_by_role("button", name="Sign in").last.click()
    time.sleep(4.5)
    return "submitted"

def is_authed(pg):
    u = pg.url
    return "/group/" in u or "/onboarding" in u or "/join" in u or (auth_token(pg) or "") != ""

def dump_errors(pg, tag):
    errs = getattr(pg, "_e2e_errors", [])
    real = [e for e in errs if "favicon" not in e.lower()][:6]
    log(f"CONSOLE[{tag}] errors={real if real else 'none'}")
    return real

def recover_to_shell(pg):
    """If stuck on /onboarding, go to / — RootRedirect enters the first group."""
    if "/onboarding" in pg.url:
        goto(pg, "/", settle=3.5)
        log(f"[recover] now at {pg.url}")

#!/usr/bin/env python3
"""Walk the REAL group's screens directly (bypasses re-onboarding). Captures each screen."""
import os, time, json
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
BASE="http://localhost:1420"; EMAIL="frontendqa@clanmind.io"; PASS="ClanMind#QA#2026"
GID="85b2dcff-1d25-4b02-9066-ea5d10dac06c"
SHOT="/home/santhosh/projects/ClanMind/docs/screenshots/live"; os.makedirs(SHOT, exist_ok=True)
PROF="/tmp/clanmind_qa_profile"
rep=[]
def add(s): rep.append(s); print(s)

with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(PROF, headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"], viewport={"width":1500,"height":940})
    pg=ctx.new_page()
    pg.set_default_timeout(12000)
    pg.goto(f"{BASE}/group/{GID}/chat", wait_until="domcontentloaded"); time.sleep(3.5)
    body=pg.inner_text("body")
    if "Create an account" in body or "Welcome back" in body:
        if "Create an account" in body: pg.get_by_role("button", name="Sign in").first.click(); time.sleep(1.4)
        f=pg.locator("input")
        for i in range(f.count()):
            el=f.nth(i); el.fill(PASS if "password" in (el.get_attribute("type") or "") else EMAIL)
        try: pg.get_by_role("button", name="Sign in").last.click()
        except: pass
        time.sleep(4)
        pg.goto(f"{BASE}/group/{GID}/chat", wait_until="domcontentloaded"); time.sleep(3)
    pg.goto(f"{BASE}/group/{GID}/chat", wait_until="domcontentloaded"); time.sleep(3)
    add("URL="+pg.url); add("TITLE="+pg.title())
    nav=pg.eval_on_selector_all("a","els=>els.filter(e=>e.offsetParent!==null).map(e=>e.getAttribute('href')).filter(Boolean)")
    add("NAV_LINKS="+json.dumps(nav))
    def shot(nm): pg.screenshot(path=f"{SHOT}/{nm}.png"); print(f"SHOT:{nm}")

    def open_screen(seg, wait=2.6):
        np=ctx.new_page(); np.set_default_timeout(12000)
        errs=[]; fails=[]
        np.on("console", lambda m, _e=errs: _e.append(f"{m.type}:{m.text[:140]}") if m.type in ("error","warning") else None)
        np.on("pageerror", lambda e, _f=fails: _f.append(str(e)[:180]))
        try:
            np.goto(f"{BASE}/group/{GID}/{seg}", wait_until="domcontentloaded"); time.sleep(wait)
            shot(f"screen_{seg}")
            t=np.inner_text("body")
            add(f"[{seg}] url={np.url} title={np.title()} bodylen={len(t)}")
            add(f"[{seg}] body={t[:420].replace(chr(10),' | ')}")
            add(f"[{seg}] console_errors={errs[:4]}")
            add(f"[{seg}] pageerrors={fails[:4]}")
        except Exception as e:
            add(f"[{seg}] ERR {str(e)[:160]}")
        np.close()

    # chat (flagship) first
    open_screen("chat", wait=3)
    # core interaction: send a real chat message
    try:
        np=ctx.new_page(); np.set_default_timeout(12000)
        np.goto(f"{BASE}/group/{GID}/chat", wait_until="domcontentloaded"); time.sleep(2.5)
        errs=[]; np.on("console", lambda m,_e=errs: _e.append(f"{m.type}:{m.text[:120]}") if m.type in ("error","warning") else None)
        ta=np.locator("textarea")
        add(f"[chat] composer textareas={ta.count()}")
        if ta.count():
            ta.first.fill("Odin, research the current state of STM32 SPI DMA and give me a one-line summary.");
            time.sleep(0.3); ta.first.press("Enter"); time.sleep(3)
            shot("chat_message_sent")
            add("[chat] after-send="+np.inner_text("body")[:300].replace(chr(10)," | "))
        add(f"[chat] console_errors={errs[:4]}")
        np.close()
    except Exception as e: add(f"[chat-send] ERR {str(e)[:160]}")

    # remaining screens
    for seg in ["overview","tasks","decisions","memory","team","garage","activity","settings"]:
        open_screen(seg)

    # two-width flagship corroboration (chat at 1280 + 1920)
    for w in (1280,1920):
        try:
            np=ctx.new_page(); np.set_viewport_size({"width":w,"height":900})
            np.goto(f"{BASE}/group/{GID}/chat", wait_until="domcontentloaded"); time.sleep(2.5)
            np.screenshot(path=f"{SHOT}/chat_width_{w}.png"); np.close()
        except: pass

    open("/home/santhosh/projects/ClanMind/docs/live/FE_WALK_REPORT.txt","w").write("\n".join(rep))
    ctx.close()
print("DONE")
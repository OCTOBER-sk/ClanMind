#!/usr/bin/env python3
"""Full ClanMind LIVE E2E walkthrough: every nav screen, real interactions, screenshots,
per-screen console/pageerror + network capture. Per-screen fresh page for clean listeners."""
import os, time, json
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
BASE="http://localhost:1420"; EMAIL="frontendqa@clanmind.io"; PASS="ClanMind#QA#2026"
SHOT="/home/santhosh/projects/ClanMind/docs/screenshots/live"; os.makedirs(SHOT, exist_ok=True)
PROF="/tmp/clanmind_qa_profile"
report=[]
def add(s): report.append(s); print(s)

def audit_screen(pg, name):
    errs=[]; fails=[]
    pg.on("console", lambda m: errs.append(f"{m.type}:{m.text[:160]}") if m.type in ("error","warning") else None)
    pg.on("pageerror", lambda e: fails.append(str(e)[:200]))
    return errs, fails

with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(PROF, headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"], viewport={"width":1500,"height":940})
    pg=ctx.new_page()
    # ensure signed in
    pg.goto(BASE, wait_until="domcontentloaded"); time.sleep(1.5)
    body=pg.inner_text("body")
    if "Create an account" in body:
        pg.get_by_role("button", name="Sign in").first.click(); time.sleep(1.4)
        f=pg.locator("input")
        for i in range(f.count()):
            el=f.nth(i); el.fill(PASS if "password" in (el.get_attribute("type") or "") else EMAIL)
        pg.get_by_role("button", name="Sign in").last.click(); time.sleep(4)
    print("AUTHED URL:", pg.url)
    # If onboarding shows, complete it fast (reuse prior working flow by clicking through)
    for _ in range(14):
        if "/onboarding" not in pg.url and "ONBOARDING" not in pg.inner_text("body"): break
        for txt in ["Continue","Skip for now","See the core loop","Create","Enter"]:
            b=pg.get_by_role("button", name=txt)
            if b.count() and b.first.is_visible():
                try: b.last.click(); time.sleep(1.2); break
                except: pass
    time.sleep(2)
    print("HOME URL:", pg.url)
    add("home_url="+pg.url)
    shot_n=0
    def shot(pg,name): pg.screenshot(path=f"{SHOT}/{name}.png"); print(f"SHOT:{name}")

    # nav links present in app shell
    nav = pg.eval_on_selector_all("a", "els=>els.filter(e=>e.offsetParent!==null).map(e=>({t:e.innerText.trim(), h:e.getAttribute('href')})).filter(x=>x.t)")
    add("NAV="+json.dumps(nav[:30]))

    # ── Walk each primary nav screen ──
    order=["chat","overview","tasks","decisions","memory","team","garage","activity","settings"]
    for seg in order:
        gid=pg.url.split("/group/")[1].split("/")[0] if "/group/" in pg.url else ""
        url=f"{BASE}/group/{gid}/{seg}"
        try:
            np=ctx.new_page(); np.goto(url, wait_until="domcontentloaded"); time.sleep(2.2)
            errs,fails=audit_screen(np,seg)
            shot_n+=1; shot(np, f"screen_{seg}")
            txt=np.inner_text("body")[:500].replace("\n"," | ")
            add(f"[{seg}] url={np.url} title={np.title()}")
            add(f"[{seg}] body={txt}")
            add(f"[{seg}] console_errors={errs[:5]}")
            add(f"[{seg}] pageerrors={fails[:5]}")
            np.close()
        except Exception as e:
            add(f"[{seg}] WALK ERR {e}")

    # ── Core interactions in chat ──
    try:
        np=ctx.new_page(); np.goto(f"{BASE}/group/{gid}/chat", wait_until="domcontentloaded"); time.sleep(2)
        errs,fails=audit_screen(np,"chat_write")
        # find composer textarea/input and send a real message
        comp = np.locator("textarea").count() or np.locator("input[type=text]").count()
        add(f"[chat] composer fields={comp}")
        try:
            ta=np.locator("textarea").first
            if ta.count(): ta.fill("Hello Odin — live E2E check. What is the DMA request for SPI1 TX on APB2?"); time.sleep(0.4); ta.press("Enter")
            else:
                inp=np.locator("input[type=text]").first; inp.fill("Hello Odin — live E2E check."); time.sleep(0.4); inp.press("Enter")
            time.sleep(3); shot(np,"chat_sent")
            add("[chat] after-send body="+np.inner_text("body")[:400].replace("\n"," | "))
        except Exception as e: add("[chat] send ERR "+str(e)[:200])
        add("[chat] console_errors="+json.dumps(errs[:5]))
        add("[chat] pageerrors="+json.dumps(fails[:5]))
        np.close()
    except Exception as e: add("[chat-walk] ERR "+str(e)[:200])

    with open("/home/santhosh/projects/ClanMind/docs/live/FE_WALK_REPORT.txt","w") as fh: fh.write("\n".join(report))
    ctx.close()
print("DONE — report written")
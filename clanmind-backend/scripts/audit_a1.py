import os, time, json
os.environ["LD_LIBRARY_PATH"] = "/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu:" + os.environ.get("LD_LIBRARY_PATH", "")
from playwright.sync_api import sync_playwright
BASE="http://localhost:1420"; GID="85b2dcff-1d25-4b02-9066-ea5d10dac06c"; PROF="/tmp/clanmind_qa_profile"; SHOT="/home/santhosh/projects/ClanMind/docs/screenshots/live/audit"
os.makedirs(SHOT, exist_ok=True)
R={}
def shot(pg,n): pg.screenshot(path=f"{SHOT}/{n}.png"); print("SHOT",n)
with sync_playwright() as p:
    ctx=p.chromium.launch_persistent_context(PROF, headless=True, executable_path="/home/santhosh/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", args=["--no-sandbox","--disable-dev-shm-usage"], viewport={"width":1500,"height":940})
    pg=ctx.new_page(); pg.set_default_timeout(14000)
    errs=[]; pg.on("console", lambda m: errs.append(f"{m.type}:{m.text[:120]}") if m.type=="error" else None)
    def goto(u): pg.goto(u, wait_until="domcontentloaded"); time.sleep(2.6)
    # A1: profile edit + persist
    goto(f"{BASE}/group/{GID}/settings")
    R["A1_settings_url"]=pg.url
    dname=pg.locator("input").all() if pg.locator("input").count() else []
    print("settings inputs:", len(pg.locator("input").all()), "| labels:", [ (i.get_attribute("placeholder") or i.get_attribute("aria-label") or i.get_attribute("name") or "") for i in pg.locator("input").all()])
    # try save profile name change
    try:
        inp=pg.get_by_label("Display name")
        if inp.count(): inp.fill("Frontend QA"); time.sleep(0.4); shot(pg,"a1_profile_edit")
        sv=pg.get_by_role("button", name="Save")
        if sv.count(): sv.click(); time.sleep(1.5); R["A1_profile_save_pressed"]=True
    except Exception as e: R["A1_profile_err"]=str(e)[:150]
    shot(pg,"a1_settings")
    # AI identity (AI tooling) — find ai screen
    try:
        goto(f"{BASE}/group/{GID}/ai")
        R["A1_ai_url"]=pg.url
        shot(pg,"a1_ai_identity")
        print("AI identity body:", pg.inner_text("body")[:300].replace(chr(10)," | "))
    except Exception as e: R["A1_ai_url"]="ERR "+str(e)[:120]
    # Team / members
    goto(f"{BASE}/group/{GID}/team")
    R["A1_team_body"]=pg.inner_text("body")[:300].replace(chr(10)," | ")
    shot(pg,"a1_team")
    ctx.close()
with open("/home/santhosh/projects/ClanMind/docs/live/AUDIT_A1.json","w") as f: json.dump(R,f,indent=2)
print(json.dumps(R,indent=2)[:1500])
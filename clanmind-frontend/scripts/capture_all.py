#!/usr/bin/env python3
"""ClanMind main-screen capture (demo mode, :1420).
Logs in with a demo credential, then captures each left-nav surface + the
shell chat into docs/screenshots/uiux/. Best-effort: continues on per-screen
errors and prints what it captured vs could not.
"""
import os, time, json
os.environ['LD_LIBRARY_PATH']='/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu'
from playwright.sync_api import sync_playwright

OUT = 'docs/screenshots/uiux'
W, H = 1440, 900
EMAIL, PWD = 'dana@clanmind.io', 'demo-pass'
NAV = ['Chat','Overview','Tasks','Decisions','Memory','Team','Garage','Activity','Settings']

def click_nav(page, label):
    # find a <button> whose visible text equals label and is inside the left rail
    return page.evaluate("""(label) => {
        const btns=[...document.querySelectorAll('button')];
        const b=btns.find(x=>x.textContent.trim()===label && !!x.closest('nav, aside, [class*="rail"], [class*="nav"], [class*="sidebar"]'));
        if(b){ b.click(); return true; }
        // fallback: first button whose trimmed text matches start of label
        const b2=btns.find(x=>x.textContent.trim().startsWith(label));
        if(b2){ b2.click(); return true; }
        return false;
    }""", label)

def main():
    os.makedirs(OUT, exist_ok=True)
    results = {}
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        pg = b.new_page(viewport={'width': W, 'height': H})
        pg.goto('http://localhost:1420/auth', wait_until='load', timeout=30000)
        time.sleep(3)
        # login
        try:
            pg.fill('input[type=email]', EMAIL)
            pg.fill('input[type=password]', PWD)
            pg.get_by_text('Sign in', exact=True).click()
        except Exception as e:
            results['error_login'] = repr(e)
        time.sleep(4)
        results['after_login_url'] = pg.url
        # chat/shell
        try:
            pg.screenshot(path=f'{OUT}/01_chat.png')
            results['chat'] = 'ok'
        except Exception as e:
            results['chat'] = repr(e)
        # nav surfaces
        for i, label in enumerate(NAV, start=2):
            try:
                ok = click_nav(pg, label)
                time.sleep(2.5)
                fname = f'{OUT}/{i:02d}_{label.lower()}.png'
                pg.screenshot(path=fname)
                results[label] = 'ok' if ok else 'click-not-found-but-shot'
            except Exception as e:
                results[label] = repr(e)
        b.close()
    print(json.dumps(results, indent=2))

if __name__ == '__main__':
    main()
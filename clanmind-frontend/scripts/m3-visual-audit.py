#!/usr/bin/env python3
"""Phase A — M3 visual audit (Atom-driven, NOT agent).

Drives the real running vite (http://localhost:1420) through every left-nav
surface at every breakpoint x both themes. Saves per-shot screenshots to
docs/screenshots/m3-final/ and a JSON verdict per shot.
"""
import os, time, json
from pathlib import Path
os.environ.setdefault('LD_LIBRARY_PATH', '/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu')

ROOT = Path('/home/santhosh/projects/ClanMind/clanmind-frontend')
OUT = ROOT / 'docs' / 'screenshots' / 'm3-final'
OUT.mkdir(parents=True, exist_ok=True)
LOG = ROOT / 'logs' / 'visual-audit'
LOG.mkdir(parents=True, exist_ok=True)

BREAKPOINTS = [
    ('1440', 1440, 900),
    ('1280', 1280, 800),
    ('1024', 1024, 768),
    ('800',  800,  600),
]
NAV = ['Chat','Overview','Tasks','Decisions','Memory','Team','Garage','Activity','Settings']
EMAIL, PWD = 'dana@clanmind.io', 'demo-pass'
BASE = 'http://localhost:1420'

from playwright.sync_api import sync_playwright

def click_nav(page, label):
    return page.evaluate(
        """(label) => {
            const btns = [...document.querySelectorAll('button, a')];
            const navBtns = btns.filter(x => !!x.closest('nav, aside, [class*="rail"], [class*="nav"], [class*="sidebar"]'));
            let b = navBtns.find(x => x.textContent.trim().toLowerCase() === label.toLowerCase());
            if (!b) b = navBtns.find(x => x.textContent.trim().toLowerCase().startsWith(label.toLowerCase()));
            if (!b) b = btns.find(x => x.textContent.trim().toLowerCase() === label.toLowerCase());
            if (b) { b.click(); return true; }
            return false;
        }""",
        label,
    )

def login(page):
    page.goto(BASE + '/auth', wait_until='load', timeout=30000)
    time.sleep(2)
    try:
        page.fill('input[type=email]', EMAIL)
        page.fill('input[type=password]', PWD)
        page.get_by_text('Sign in', exact=True).click()
        time.sleep(3)
    except Exception as e:
        return 'login_err: ' + repr(e)
    return page.url

def shot_for(page, name):
    path = OUT / (name + '.png')
    page.screenshot(path=str(path), full_page=False)
    return str(path.relative_to(ROOT))

def main():
    summary = {'shots': [], 'errors': []}
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        for dark in (False, True):
            theme = 'dark' if dark else 'light'
            for bp_name, w, h in BREAKPOINTS:
                ctx = browser.new_context(viewport={'width': w, 'height': h})
                page = ctx.new_page()
                page.goto(BASE, wait_until='load')
                # set theme BEFORE login
                theme_str = 'dark' if dark else 'light'
                # zustand persist shape: localStorage.cm_ui = JSON({state:{theme:...}, version:...})
                page.evaluate(
                    "localStorage.setItem('cm_ui', JSON.stringify({state:{theme:'"
                    + theme_str + "',sidebarWidth:240,rightPanelWidth:500,isSidebarCollapsed:false,"
                    "onboardingComplete:false,lastGroupId:undefined,lastProjectIdByGroup:{},"
                    "recentGroupIds:[],garageViewMode:'grid'},version:0}))"
                )
                after = login(page)
                summary['shots'].append({
                    'phase': 'login',
                    'theme': theme, 'bp': bp_name,
                    'after_url': after,
                    'shot': shot_for(page, 'login_' + theme + '_' + bp_name),
                })
                for label in NAV:
                    try:
                        ok = click_nav(page, label)
                        time.sleep(2.0)
                        p2 = shot_for(page, label.lower() + '_' + theme + '_' + bp_name)
                        summary['shots'].append({
                            'theme': theme, 'bp': bp_name,
                            'nav': label, 'clicked': ok, 'shot': p2,
                            'url': page.url,
                        })
                    except Exception as e:
                        summary['errors'].append({'theme': theme, 'bp': bp_name, 'nav': label, 'err': repr(e)})
                ctx.close()
        browser.close()
    (LOG / 'A-shots.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps({'count': len(summary['shots']), 'errors': len(summary['errors'])}, indent=2))

if __name__ == '__main__':
    main()

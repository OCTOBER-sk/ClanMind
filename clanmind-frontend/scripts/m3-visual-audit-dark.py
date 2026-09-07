#!/usr/bin/env python3
"""Phase A-3 — Dark theme only capture (no stdout pipe issues)."""
import os, time, json
from pathlib import Path
os.environ.setdefault('LD_LIBRARY_PATH', '/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu')
if not os.environ.get('LD_LIBRARY_PATH'):
    raise SystemExit('LD_LIBRARY_PATH must include /tmp/chamlibs/root/usr/lib/x86_64-linux-gnu so chromium can load libnspr4/libnss3')
ROOT = Path('/home/santhosh/projects/ClanMind/clanmind-frontend')
OUT = ROOT / 'docs' / 'screenshots' / 'm3-final'
LOG = ROOT / 'logs' / 'visual-audit'
BREAKPOINTS = [('1440',1440,900),('1280',1280,800),('1024',1024,768),('800',800,600)]
NAV = ['Chat','Overview','Tasks','Decisions','Memory','Team','Garage','Activity','Settings']
EMAIL, PWD = 'dana@clanmind.io','demo-pass'
BASE = 'http://localhost:1420'
from playwright.sync_api import sync_playwright

def click_nav(page, label):
    return page.evaluate("""(label) => {
        const btns = [...document.querySelectorAll('button, a')];
        const navBtns = btns.filter(x => !!x.closest('nav, aside, [class*='rail'], [class*='nav'], [class*='sidebar']'));
        let b = navBtns.find(x => x.textContent.trim().toLowerCase() === label.toLowerCase());
        if (!b) b = navBtns.find(x => x.textContent.trim().toLowerCase().startsWith(label.toLowerCase()));
        if (!b) b = btns.find(x => x.textContent.trim().toLowerCase() === label.toLowerCase());
        if (b) { b.click(); return true; }
        return false;
    }""", label)

def login(page):
    page.goto(BASE + '/auth', wait_until='load', timeout=30000)
    time.sleep(2)
    try:
        # click "Sign in" button to reveal the email/password form
        page.get_by_text('Sign in', exact=True).first.click()
        time.sleep(1.5)
        page.fill('input#login-email', EMAIL)
        page.fill('input#login-password', PWD)
        page.get_by_text('Sign in', exact=True).last.click()
        time.sleep(4)
    except Exception as e:
        return 'login_err: ' + repr(e)
    return page.url

def shot(page, name):
    p = OUT / (name + '.png')
    page.screenshot(path=str(p), full_page=False)

def main():
    summary = {'shots': [], 'errors': []}
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        for bp_name, w, h in BREAKPOINTS:
            ctx = b.new_context(viewport={'width':w,'height':h})
            page = ctx.new_page()
            page.goto(BASE + '/auth', wait_until='load', timeout=30000)
            page.evaluate("localStorage.setItem('cm_ui', JSON.stringify({state:{theme:'dark',sidebarWidth:240,rightPanelWidth:500,isSidebarCollapsed:false,onboardingComplete:false,lastGroupId:undefined,lastProjectIdByGroup:{},recentGroupIds:[],garageViewMode:'grid'},version:0}))")
            time.sleep(2)
            # screen 1: auth landing
            shot(page, 'auth_landing_dark_' + bp_name)
            summary['shots'].append({'theme':'dark','bp':bp_name,'screen':'auth_landing','shot':'auth_landing_dark_' + bp_name + '.png'})
            # screen 2: login form
            try:
                page.get_by_text('Sign in', exact=True).first.click()
                time.sleep(1.5)
                shot(page, 'auth_login_dark_' + bp_name)
                summary['shots'].append({'theme':'dark','bp':bp_name,'screen':'auth_login_form','shot':'auth_login_dark_' + bp_name + '.png'})
                # screen 3: filled + error
                page.fill('input#login-email', EMAIL)
                page.fill('input#login-password', PWD)
                page.get_by_text('Sign in', exact=True).last.click()
                time.sleep(3)
                shot(page, 'auth_login_error_dark_' + bp_name)
                summary['shots'].append({'theme':'dark','bp':bp_name,'screen':'auth_login_error','shot':'auth_login_error_dark_' + bp_name + '.png'})
            except Exception as e:
                summary['errors'].append({'phase':'login_form','bp':bp_name,'err':repr(e)})
            ctx.close()
        b.close()
    (LOG / 'A-DARK-shots.json').write_text(json.dumps(summary, indent=2))

if __name__ == '__main__':
    main()

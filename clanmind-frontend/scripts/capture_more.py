#!/usr/bin/env python3
"""Capture Memory screen + multi-width QA of the chat/artifact shell."""
import os, time, json
os.environ['LD_LIBRARY_PATH']='/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu'
from playwright.sync_api import sync_playwright

OUT='docs/screenshots/uiux'; EMAIL, PWD='dana@clanmind.io','demo-pass'
MEM_URL='http://localhost:1420/group/grp_robotics_1/project/proj_flight_ctrl/memory'
GOTO='http://localhost:1420/group/grp_robotics_1/project/proj_flight_ctrl/chat'

def login(pg):
    pg.goto('http://localhost:1420/auth', wait_until='load', timeout=30000); time.sleep(3)
    pg.fill('input[type=email]', EMAIL); pg.fill('input[type=password]', PWD)
    pg.get_by_text('Sign in', exact=True).click(); time.sleep(4)

def main():
    os.makedirs(OUT, exist_ok=True); res={}
    with sync_playwright() as p:
        b=p.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage'])
        pg=b.new_page(viewport={'width':1440,'height':900})
        try:
            login(pg); pg.goto(MEM_URL, wait_until='load', timeout=30000); time.sleep(3)
            pg.screenshot(path=f'{OUT}/06_memory.png'); res['memory']='ok'
        except Exception as e: res['memory']=repr(e)
        # multi-width chat/artifact QA
        try:
            pg.goto(GOTO, wait_until='load', timeout=30000)
        except Exception as e: res['goto']=repr(e)
        for w in (1280,1600,1920):
            try:
                pg.set_viewport_size({'width':w,'height':900}); time.sleep(2.5)
                pg.screenshot(path=f'{OUT}/qa_chat_{w}.png'); res[f'chat_{w}']='ok'
            except Exception as e: res[f'chat_{w}']=repr(e)
        b.close()
    print(json.dumps(res,indent=2))

if __name__=='__main__': main()
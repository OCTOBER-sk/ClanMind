#!/usr/bin/env python3
"""Headless screenshot harness for ClanMind (vite :1420, demo mode).
Sets LD_LIBRARY_PATH for the user-space-installed chrome libs, then captures.
Usage: capture.py <out.png> [url] [--wait S] [--width W --height H] [--full]
Keeps geometry QA honest: real headless chromium, viewport-sized (or full-page) shot.
"""
import os, sys, time
os.environ['LD_LIBRARY_PATH'] = '/tmp/chamlibs/root/usr/lib/x86_64-linux-gnu' + ':' + os.environ.get('LD_LIBRARY_PATH', '')
from playwright.sync_api import sync_playwright

def main():
    args = sys.argv[1:]
    out = args[0]
    url = args[1] if len(args) > 1 else 'http://localhost:1420/'
    wait, w, h, full = 2.0, 1440, 900, False
    if '--wait' in args: wait = float(args[args.index('--wait')+1])
    if '--width' in args: w = int(args[args.index('--width')+1])
    if '--height' in args: h = int(args[args.index('--height')+1])
    if '--full' in args: full = True
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True, args=['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'])
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.goto(url, wait_until='load', timeout=30000)
        time.sleep(wait)
        if full:
            pg.screenshot(path=out, full_page=True)
        else:
            pg.screenshot(path=out, full_page=False)
        print('saved=%s url=%s title=%s' % (out, pg.url, pg.title()))
        b.close()

if __name__ == '__main__':
    main()
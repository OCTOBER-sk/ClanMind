#!/usr/bin/env python3
"""Deep diagnosis: what happens on / for a member? Capture api+console+storage for 60s."""
import sys, time
sys.path.insert(0, "/home/santhosh/projects/ClanMind/scripts/e2e_ui")
from lib import *
from playwright.sync_api import sync_playwright

key = sys.argv[1] if len(sys.argv) > 1 else "kavitha"
log(f"=== DIAG {key} ===")
net = []
with sync_playwright() as p:
    ctx, pg = user_ctx(p, key)
    pg.on("response", lambda r: net.append(f"{r.status} {r.request.method} {r.url[:110]}") if "/api/" in r.url else None)
    try:
        goto(pg, "/", settle=4)
        t0 = time.time()
        while time.time() - t0 < 60:
            time.sleep(3)
        u = pg.url
        b = body(pg)
        log(f"[diag] final url={u}")
        log(f"[diag] body_head={b[:200].replace(chr(10),' | ')!r}")
        log(f"[diag] authed={bool(auth_token(pg))} token_head={(auth_token(pg) or '')[:20]}")
        ls = pg.evaluate("() => Object.fromEntries(Object.keys(localStorage).map(k => [k, (localStorage[k]||'').slice(0,40)]))")
        log(f"[diag] localStorage keys: {list(ls.keys())}")
        log("[diag] api calls:")
        for n in net:
            log("   " + n)
        dump_errors(pg, f"diag-{key}")
        shot(pg, f"diag_{key}")
    except Exception as e:
        log(f"[diag] ERROR {str(e)[:200]}")
    finally:
        ctx.close()
print("DONE")

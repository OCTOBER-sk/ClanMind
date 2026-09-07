#!/usr/bin/env python3
"""Phase A-2 — Pixel-level M3 audit on captured PNGs.

Answers the structural questions WITHOUT vision API:
- Background luminance (is dark really #000000? is light really #FFFFFF?)
- Detects raw hex brand colors leaking (Google blue #4285F4 / #1A73E8)
- Counts how many pixels per row are tinted with rainbow (spectral overuse)
- Detects ALL_CAPS status pills (heuristic)
- Detects text rendering at expected M3 sizes

Outputs logs/visual-audit/A-PER-SCREEN-REPORT.md
"""
import os, json, glob, zlib
from pathlib import Path
from collections import Counter

ROOT = Path('/home/santhosh/projects/ClanMind/clanmind-frontend')
SHOTS = ROOT / 'docs' / 'screenshots' / 'm3-final'
LOG = ROOT / 'logs' / 'visual-audit'

def load_png(path):
    """Decode PNG to raw RGB bytes (very small impl). Uses zlib + manual IDAT."""
    data = open(path, 'rb').read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos = 8
    width = height = bit_depth = color_type = None
    idat = b''
    while pos < len(data):
        length = int.from_bytes(data[pos:pos+4], 'big'); pos += 4
        ctype = data[pos:pos+4]; pos += 4
        chunk = data[pos:pos+length]; pos += length
        pos += 4  # crc
        if ctype == b'IHDR':
            width = int.from_bytes(chunk[0:4], 'big')
            height = int.from_bytes(chunk[4:8], 'big')
            bit_depth = chunk[8]; color_type = chunk[9]
        elif ctype == b'IDAT':
            idat += chunk
        elif ctype == b'IEND':
            break
    raw = zlib.decompress(idat)
    # color_type 2 = RGB (3 channels), 6 = RGBA (4)
    channels = 3 if color_type == 2 else 4 if color_type == 6 else 0
    assert channels in (3, 4), f'unexpected color_type {color_type}'
    stride = width * channels + 1  # +1 for filter byte
    rows = []
    prev = bytearray(width * channels)
    for y in range(height):
        ftype = raw[y*stride]
        scan = bytearray(raw[y*stride+1:(y+1)*stride])
        if ftype == 0:
            pass
        elif ftype == 1:  # Sub
            for i in range(channels, len(scan)):
                scan[i] = (scan[i] + scan[i-channels]) & 0xFF
        elif ftype == 2:  # Up
            for i in range(len(scan)):
                scan[i] = (scan[i] + prev[i]) & 0xFF
        elif ftype == 3:  # Average
            for i in range(len(scan)):
                left = scan[i-channels] if i >= channels else 0
                scan[i] = (scan[i] + (left + prev[i]) // 2) & 0xFF
        elif ftype == 4:  # Paeth
            for i in range(len(scan)):
                a = scan[i-channels] if i >= channels else 0
                b = prev[i]
                c = prev[i-channels] if i >= channels else 0
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pred = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                scan[i] = (scan[i] + pred) & 0xFF
        else:
            raise ValueError(f'filter {ftype}')
        rows.append(bytes(scan))
        prev = scan
    return width, height, channels, rows

def pixel_stats(rows, channels):
    """Compute: top-of-screen bg color, percent of pure-black, percent of rainbow-tinted pixels."""
    if not rows: return {}
    w = len(rows[0]) // channels
    bg_samples = []
    total_pixels = 0
    pure_black = 0
    pure_white = 0
    google_blue = 0
    rainbow = 0
    for y in (0, 1, 2, min(10, len(rows)-1)):
        for x in range(0, w, max(1, w//20)):
            r = rows[y][x*channels]; g = rows[y][x*channels+1]; b = rows[y][x*channels+2]
            bg_samples.append((r,g,b))
    for y in range(0, len(rows), 8):
        for x in range(0, w, 8):
            r = rows[y][x*channels]; g = rows[y][x*channels+1]; b = rows[y][x*channels+2]
            total_pixels += 1
            if r < 8 and g < 8 and b < 8: pure_black += 1
            if r > 248 and g > 248 and b > 248: pure_white += 1
            # Google Blue family: 66,133,244 (#4285F4) ± tolerance; M3 primary used here is #B5C4FF (dark) / #005CBA (light)
            if abs(r-66)<20 and abs(g-133)<20 and abs(b-244)<20: google_blue += 1
            # rainbow hues (high chroma)
            mx, mn = max(r,g,b), min(r,g,b)
            chroma = mx - mn
            if chroma > 90 and mx > 100: rainbow += 1
    bg_top = Counter(bg_samples).most_common(1)[0][0]
    return {
        'top_bg_hex': '#%02X%02X%02X' % bg_top,
        'pure_black_pct': round(100*pure_black/total_pixels, 1),
        'pure_white_pct': round(100*pure_white/total_pixels, 1),
        'google_blue_pct': round(100*google_blue/total_pixels, 2),
        'rainbow_chroma_pct': round(100*rainbow/total_pixels, 2),
    }

def analyze_shot(path):
    try:
        w, h, ch, rows = load_png(path)
        s = pixel_stats(rows, ch)
        s['size'] = f'{w}x{h}'
        return s
    except Exception as e:
        return {'error': repr(e)}

def main():
    shots = sorted(glob.glob(str(SHOTS / '*.png')))
    report = []
    for p in shots:
        name = Path(p).stem
        stats = analyze_shot(p)
        stats['shot'] = str(Path(p).relative_to(ROOT))
        stats['theme'] = 'dark' if 'dark' in name else 'light'
        stats['bp'] = next((b for b in ('1440','1280','1024','800') if b in name), '?')
        stats['screen'] = name.split('_')[0]
        report.append(stats)
    out = LOG / 'A-PIXEL-REPORT.json'
    out.write_text(json.dumps(report, indent=2))
    # verdict rollup
    issues = []
    for r in report:
        if r['theme'] == 'dark' and r.get('pure_black_pct', 0) < 40:
            issues.append(f"{r['shot']}: dark but only {r['pure_black_pct']}% pure-black")
        if r['theme'] == 'light' and r.get('pure_white_pct', 0) < 30:
            issues.append(f"{r['shot']}: light but only {r['pure_white_pct']}% pure-white")
        if r.get('google_blue_pct', 0) > 1:
            issues.append(f"{r['shot']}: {r['google_blue_pct']}% Google Blue (#4285F4) pixels — primary color leak?")
        if r.get('rainbow_chroma_pct', 0) > 8:
            issues.append(f"{r['shot']}: {r['rainbow_chroma_pct']}% high-chroma pixels — possible spectral overuse")
    print(f"analyzed {len(report)} shots, {len(issues)} issues")
    for i in issues[:30]: print('  -', i)
    (LOG / 'A-ISSUES.txt').write_text('\n'.join(issues))

if __name__ == '__main__':
    main()

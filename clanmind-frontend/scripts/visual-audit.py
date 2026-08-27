#!/usr/bin/env python3
"""
ClanMind Frontend Visual Audit — Playwright screenshot capture
Captures every major screen at 1440x900 for UI/UX review.
"""
import asyncio
import os
import sys

# Ensure playwright is importable
try:
    from playwright.async_api import async_playwright
except ImportError:
    os.system("pip install playwright && playwright install chromium")
    from playwright.async_api import async_playwright

SCREENSHOTS_DIR = os.path.expanduser("~/projects/ClanMind/docs/screenshots/audit")
BASE_URL = "http://localhost:1420"
VIEWPORT = {"width": 1440, "height": 900}

# All screens to capture — per directive §84
SCREENS = [
    # (name, url_path, wait_seconds, description)
    ("01-login", "/auth", 2, "Login / Auth screen"),
    ("02-main-chat", "/group/grp_robotics_1/chat", 3, "Main group chat"),
    ("03-project-chat", "/group/grp_robotics_1/project/proj_flight_ctrl/chat", 3, "Project-scoped chat"),
    ("04-team", "/group/grp_robotics_1/team", 2, "Team view"),
    ("05-garage", "/group/grp_robotics_1/garage", 2, "Garage"),
    ("06-tasks", "/group/grp_robotics_1/project/proj_flight_ctrl/tasks", 2, "Tasks"),
    ("07-decisions", "/group/grp_robotics_1/project/proj_flight_ctrl/decisions", 2, "Decisions"),
    ("08-memory", "/group/grp_robotics_1/project/proj_flight_ctrl/memory", 2, "Memory"),
    ("09-overview", "/group/grp_robotics_1/project/proj_flight_ctrl/overview", 2, "Project Overview"),
    ("10-activity", "/group/grp_robotics_1/activity", 2, "Activity feed"),
    ("11-settings", "/group/grp_robotics_1/settings", 2, "Settings"),
]

async def capture_screens():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        context = await browser.new_context(
            viewport=VIEWPORT,
            device_scale_factor=2,
        )
        page = await context.new_page()
        
        # First, login to get past auth gate
        print("=== Logging in ===")
        await page.goto(f"{BASE_URL}/auth", wait_until="networkidle", timeout=15000)
        await asyncio.sleep(2)
        
        # Try to fill login form
        try:
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first
            password_input = page.locator('input[type="password"], input[name="password"]').first
            
            if await email_input.is_visible(timeout=5000):
                await email_input.fill("demo@clanmind.app")
                await password_input.fill("demo1234")
                # Click sign in
                submit = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")').first
                if await submit.is_visible(timeout=3000):
                    await submit.click()
                    await asyncio.sleep(3)
                    print("Login submitted")
            else:
                print("No email input found — checking if already logged in or demo mode auto-logs in")
        except Exception as e:
            print(f"Login attempt: {e}")
        
        # Capture each screen
        for name, path, wait, desc in SCREENS:
            url = f"{BASE_URL}{path}"
            print(f"\n=== Capturing: {name} — {desc} ===")
            try:
                await page.goto(url, wait_until="networkidle", timeout=15000)
                await asyncio.sleep(wait)
                
                # Scroll to capture full page
                filepath = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
                await page.screenshot(path=filepath, full_page=False)
                print(f"  ✓ Saved: {filepath}")
            except Exception as e:
                print(f"  ✗ Failed: {e}")
                # Try screenshot anyway
                try:
                    filepath = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
                    await page.screenshot(path=filepath, full_page=False)
                    print(f"  ✓ Saved (after error): {filepath}")
                except:
                    pass
        
        # Also capture dark mode version of main chat
        print("\n=== Capturing dark mode ===")
        try:
            await page.goto(f"{BASE_URL}/group/grp_robotics_1/chat", wait_until="networkidle", timeout=15000)
            await asyncio.sleep(2)
            # Toggle dark mode if possible
            await page.evaluate("""() => {
                document.documentElement.classList.add('dark');
            }""")
            await asyncio.sleep(1)
            filepath = os.path.join(SCREENSHOTS_DIR, "12-main-chat-dark.png")
            await page.screenshot(path=filepath, full_page=False)
            print(f"  ✓ Saved dark mode: {filepath}")
        except Exception as e:
            print(f"  ✗ Dark mode failed: {e}")
        
        # Capture narrow viewport
        print("\n=== Capturing narrow viewport (1280px) ===")
        try:
            await page.set_viewport_size({"width": 1280, "height": 900})
            await page.goto(f"{BASE_URL}/group/grp_robotics_1/chat", wait_until="networkidle", timeout=15000)
            await asyncio.sleep(2)
            filepath = os.path.join(SCREENSHOTS_DIR, "13-chat-1280.png")
            await page.screenshot(path=filepath, full_page=False)
            print(f"  ✓ Saved narrow: {filepath}")
        except Exception as e:
            print(f"  ✗ Narrow failed: {e}")
        
        await browser.close()
    
    print(f"\n=== Done — screenshots in {SCREENSHOTS_DIR} ===")
    return SCREENSHOTS_DIR

if __name__ == "__main__":
    result = asyncio.run(capture_screens())
    print(f"\nAll screenshots saved to: {result}")

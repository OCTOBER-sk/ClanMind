/**
 * ClanMind P0 smoke — build/smoke/smoke.js
 * Run: node smoke.js  (requires `pnpm dev` on :1420, VITE_DEMO_MODE=1)
 * Selectors assert ACTUAL rendered UI text (verified against components).
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail: String(detail).slice(0, 200) }); };
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE_ERROR:', m.text().slice(0, 300)); });
  page.on('pageerror', (e) => console.log('PAGE_ERROR:', String(e).slice(0, 300)));

  // ── 1. Wrong password → inline field error (AuthScreen copy) ──────────────
  await page.goto('http://localhost:1420/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'shot_01_auth.png' });
  await page.fill('input[placeholder="you@team.com"]', 'sandy@clanmind.dev');
  await page.fill('input[type="password"]', 'wrongpass');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(1500);
  const errVisible = await page.locator('text=Check your email and password').count();
  check('T4a wrongpass shows inline error', errVisible > 0, `matches=${errVisible}`);
  await page.screenshot({ path: 'shot_02_wrongpass.png' });

  // ── 2. Correct login lands in Robotics chat ────────────────────────────────
  await page.fill('input[type="password"]', 'demo-password-123');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2500);
  const landedChat = await page.locator('text=/Robotics/i').count();
  check('T4b login lands in Robotics chat', landedChat > 0, `matches=${landedChat}`);
  await page.screenshot({ path: 'shot_03_chat.png' });

  // ── 3. WS truth: banner invisible (connected calm default, FE §185) ────────
  const bannerText = await page.evaluate(() => {
    const el = document.querySelector('[role="status"]');
    return document.body.innerText.match(/Reconnecting…|Offline|Syncing \d+ change/g) || [];
  });
  check('T4g sync banner silent while connected (WS handshake OK)', bannerText.length === 0,
    `banner matches=${JSON.stringify(bannerText)}`);

  const composer = page.locator('textarea').first();
  if ((await composer.count()) === 0) {
    check('T4c composer exists', false, 'no textarea found');
  } else {
    // ── 4. Normal message echoes exactly once; no stuck pending/offline UI ───
    await composer.fill('Smoke test message alpha');
    await composer.press('Enter');
    await page.waitForTimeout(2500);
    const echoes = await page.locator('text=Smoke test message alpha').count();
    const bodyText = await page.evaluate(() => document.body.innerText);
    check('T4c message echoes exactly once', echoes === 1, `echoes=${echoes}`);
    check('T4c2 message not stuck Sending/Queued',
      !bodyText.includes('Sending…') && !bodyText.includes('Queued · Offline'),
      `sending=${bodyText.includes('Sending…')} queuedOffline=${bodyText.includes('Queued · Offline')}`);
    await page.screenshot({ path: 'shot_04_message.png' });

    // ── 5. @Odin AI run streams over the socket ──────────────────────────────
    await composer.fill('@Odin give me a quick status of the flight controller project');
    await composer.press('Enter');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: 'shot_05_ai_streaming.png' });
    const working = await page.locator('[aria-label*="is working"], [title*="is working"]').count();
    check('T4d1 AI run active indicator while streaming', working > 0, `matches=${working}`);
    await page.waitForTimeout(9300);
    await page.screenshot({ path: 'shot_06_ai_done.png' });
    const doneBody = await page.evaluate(() => document.body.innerText);
    check('T4d2 AI run completes with streamed answer',
      /Adopt SPI DMA double-buffering/i.test(doneBody),
      `finalBody=${/Adopt SPI DMA double-buffering/i.test(doneBody)}`);
    const toolTimeline = await page.locator('text=Odin Tool Activity').count();
    check('T4d3 AI tool timeline rendered after completion', toolTimeline > 0, `matches=${toolTimeline}`);

    // ── 6. quota keyword → §141 quota card (AI-triggered like production) ────
    await composer.fill('@Odin quota');
    await composer.press('Enter');
    await page.waitForTimeout(3000);
    const quotaCard = await page.locator('text=Application AI Quota Reached').count();
    check('T4e quota card appears (§141)', quotaCard > 0, `matches=${quotaCard}`);
    await page.screenshot({ path: 'shot_07_quota.png' });
  }

  // ── 7. Deep-link reload straight into settings section ─────────────────────
  await page.goto('http://localhost:1420/group/grp_robotics_1/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const settingsOk = await page.locator('text=/settings/i').count();
  check('T4f deep link to settings works after reload', settingsOk > 0,
    `url=${page.url()} matches=${settingsOk}`);
  await page.screenshot({ path: 'shot_08_deeplink_settings.png' });

  console.log('\n=== SMOKE RESULTS ===');
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`TOTAL: ${results.length}, FAILED: ${failed}`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch((e) => { console.error('SMOKE_CRASH:', e.message); process.exit(2); });

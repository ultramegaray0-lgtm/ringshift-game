// Browser check of phone layouts and the demo-end screen. Needs Playwright + Chromium; skips cleanly without them.
//   node tests/layout.test.js
// 1. Difficulty screen: the WINS / KEYS tally, the title, the POWER button and INVENTORY never overlap, in portrait
//    and in short landscape (v0.40: in landscape the tally used to cover the subtitle and the POWER button).
// 2. Demo-end screen: there is no Steam store page yet, so no Steam link or WISHLIST button is shown and the text
//    does not ask the player to wishlist (v0.40: the button used to open Steam's home page).
'use strict';
const path = require('path');
const H = require('./harness');
let chromium;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch (e) { /* try next */ } }
if (!chromium) { console.log('layout test SKIPPED: playwright not installed'); process.exit(0); }
const { test, finish } = H.runner('PHONE LAYOUT + DEMO END  (' + path.basename(H.gameFile()) + ', headless Chromium)');

const SIZES = [[360, 640], [390, 844], [412, 915], [568, 320], [640, 360], [740, 360], [844, 390], [915, 412], [1280, 800]];

(async () => {
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.log('layout test SKIPPED: Chromium unavailable (' + e.message.split('\n')[0] + ')'); process.exit(0); }
  const errors = [], overlaps = [], demoEnd = [];
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 1000 });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(`${w}x${h}: ${e.message}`));
    await page.goto('file://' + H.gameFile());
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    await page.evaluate(() => goModeSelect());
    const r = await page.evaluate(() => {
      const box = s => { const b = document.querySelector(s).getBoundingClientRect(); return { s, l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const items = [box('#modeScreen .coinTally'), box('#modeScreen .screenTitle'), box('#modeScreen .screenSub'), box('#modeScreen .powerEquipBtn'), box('#shopBtnMode')];
      const hit = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
      const out = [];
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (hit(items[i], items[j])) out.push(items[i].s + ' / ' + items[j].s);
      return { out, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (r.out.length || r.sideways) overlaps.push(`${w}x${h}: ${r.out.join(', ')}${r.sideways ? ' + sideways scroll' : ''}`);
    for (const mode of ['easy', 'rocket']) {
      const d = await page.evaluate(m => {
        showWishlistScreen(m);
        const b = document.getElementById('wlWishlistBtn');
        return { shown: getComputedStyle(b).display !== 'none', href: b.getAttribute('href'),
          steamLinks: [...document.querySelectorAll('a[href]')].filter(a => /steam/i.test(a.getAttribute('href'))).length,
          text: document.getElementById('wlBody').textContent,
          buttons: [...document.querySelectorAll('#wishlistScreen .wlBtn')].filter(x => getComputedStyle(x).display !== 'none').length };
      }, mode);
      if (d.shown || d.href || d.steamLinks || /wishlist/i.test(d.text) || d.buttons < 1) demoEnd.push(`${w}x${h} after ${mode}: ${JSON.stringify(d)}`);
    }
    await ctx.close();
  }
  await browser.close();
  test(`difficulty screen: tally, title, subtitle, POWER and INVENTORY never overlap (${SIZES.length} portrait / landscape sizes)`,
    () => H.assert(!overlaps.length, overlaps.join('\n        ')));
  test('demo-end screen: no Steam link or WISHLIST button while there is no store page, and the text does not ask to wishlist',
    () => H.assert(!demoEnd.length, demoEnd.join('\n        ')));
  test('no page errors', () => H.assert(!errors.length, errors.slice(0, 3).join(' | ')));
  process.exitCode = finish() ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

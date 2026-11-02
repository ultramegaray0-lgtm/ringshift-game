// Browser check of phone layouts and the demo-end screen. Needs Playwright + Chromium; skips cleanly without them.
//   node tests/layout.test.js
// 1. Difficulty screen: the WINS / KEYS tally, the title, the POWER button and INVENTORY never overlap, in portrait
//    and in short landscape (v0.40: in landscape the tally used to cover the subtitle and the POWER button).
// 2. Demo-end screen: there is no Steam store page yet, so no Steam link or WISHLIST button is shown and the text
//    does not ask the player to wishlist (v0.40: the button used to open Steam's home page).
// 4. In-level HUD (v0.41): stats never run together or leave the screen at phone, embed, tablet and desktop widths.
// 3. Legal pages (v0.41): the difficulty screen and Options link to privacy.html and terms.html, which exist next to
//    the game file, open in a new tab, fit a 320 px phone without sideways scrolling, and link back to the game.
'use strict';
const path = require('path'), fs = require('fs');
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
  // 3. legal pages
  const legal = [];
  {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push('legal: ' + e.message));
    await page.goto('file://' + H.gameFile());
    const links = await page.evaluate(() => ['#modeScreen .legalLinks a', '#optionsModal .legalBtns a'].map(sel =>
      [...document.querySelectorAll(sel)].map(a => a.getAttribute('href') + '|' + a.target + '|' + a.rel).sort().join(' ')));
    const want = 'privacy.html|_blank|noopener terms.html|_blank|noopener';
    links.forEach((l, i) => { if (l !== want) legal.push((i ? 'Options' : 'difficulty screen') + ' links: ' + l); });
    await page.evaluate(() => goModeSelect());
    const vis = await page.evaluate(() => { const a = document.querySelector('#modeScreen .legalLinks a'); if (!a) return false; a.scrollIntoView({ block: 'center' });
      const b = a.getBoundingClientRect(), hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!hit && (hit === a || a.contains(hit)); });
    if (!vis) legal.push('difficulty-screen Privacy link is covered or off screen');
    for (const name of ['privacy.html', 'terms.html']) {
      const file = path.join(path.dirname(H.gameFile()), name);
      if (!fs.existsSync(file)) { legal.push(name + ' missing next to the game file'); continue; }
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto('file://' + file);
      const r = await page.evaluate(() => ({ sideways: document.documentElement.scrollWidth > innerWidth + 1,
        back: [...document.querySelectorAll('a')].filter(a => a.getAttribute('href') === 'index.html').length,
        rootLinks: [...document.querySelectorAll('a')].filter(a => (a.getAttribute('href') || '').startsWith('/')).length }));
      if (r.sideways) legal.push(name + ' scrolls sideways at 320 px');
      if (r.back < 1) legal.push(name + ' has no link back to the game (index.html)');
      if (r.rootLinks) legal.push(name + ' has a root-relative link, which leaves /ringshift-game/');
    }
    await ctx.close();
  }
  // 4. in-level HUD (v0.41): at itch.io-embed / tablet / sideways-phone widths the one-row HUD used to run its items
  //    together ("LOCKS 0/10 moves00:02"); every stat must keep clear of the others, on screen, in every mode.
  const hud = [];
  for (const [w, h] of [[360, 640], [640, 360], [700, 500], [800, 600], [863, 360], [960, 640], [1024, 768], [1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(`hud ${w}x${h}: ${e.message}`));
    await page.goto('file://' + H.gameFile());
    await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
    const bad = await page.evaluate(() => {
      save.tutorialSeen = true; save.options.debugMode = true; const out = [];
      for (const [m, i] of [['easy', 0], ['challenge', 0], ['special', 8], ['orchestra', 9], ['rocket', 9]]) {
        goGame(m, i); stopGameTimers();
        const els = ['backToLevelsBtn', 'gameLvlLabel', 'lockCountLabel', 'movesLabel', 'timeLabel', 'coinStatusLabel', 'rocketHudText', 'meteorHud']
          .map(id => document.getElementById(id)).filter(e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0 && e.textContent.trim());
        const box = e => (e.id === 'lockCountLabel' ? e.parentElement : e).getBoundingClientRect();
        for (let a = 0; a < els.length; a++) {
          const A = box(els[a]);
          if (A.left < -1 || A.right > innerWidth + 1) out.push(`${m} ${i + 1}: ${els[a].id} off screen`);
          for (let c = a + 1; c < els.length; c++) { const B = box(els[c]);
            if (A.left < B.right + 4 && B.left < A.right + 4 && A.top < B.bottom - 1 && B.top < A.bottom - 1) out.push(`${m} ${i + 1}: ${els[a].id} / ${els[c].id} closer than 4 px`); }
        }
      }
      return out;
    });
    bad.forEach(x => hud.push(`${w}x${h} ${x}`));
    await ctx.close();
  }
  await browser.close();
  test('in-level HUD: level name, Locks, moves, time and mode stats keep 4 px apart and stay on screen (8 sizes x 5 modes)',
    () => H.assert(!hud.length, hud.slice(0, 8).join('\n        ')));
  test('Privacy and Terms: linked from the difficulty screen and Options (new tab), present, phone-friendly, and link back to the game',
    () => H.assert(!legal.length, legal.join('\n        ')));
  test(`difficulty screen: tally, title, subtitle, POWER and INVENTORY never overlap (${SIZES.length} portrait / landscape sizes)`,
    () => H.assert(!overlaps.length, overlaps.join('\n        ')));
  test('demo-end screen: no Steam link or WISHLIST button while there is no store page, and the text does not ask to wishlist',
    () => H.assert(!demoEnd.length, demoEnd.join('\n        ')));
  test('no page errors', () => H.assert(!errors.length, errors.slice(0, 3).join(' | ')));
  process.exitCode = finish() ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

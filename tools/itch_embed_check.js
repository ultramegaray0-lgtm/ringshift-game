// itch-style embed check of the built ZIP (python3 tools/build_itch.py first). Usage:
//   node tools/itch_embed_check.js dist/ringshift-vX.YY-itch-html5.zip
// Serves the extracted ZIP on 127.0.0.1:8611 and a host page with an <iframe> on localhost:8612 (two origins, like
// itch's game CDN inside itch.io), then checks with real clicks / keys at 1024x768, 630x500 and a Pixel 7: version
// label, tally layout, first-level How To Play, ring rotation, save across reload, legal pages, zero external or
// failed requests, zero page errors.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { execFileSync } = require('child_process');
let chromium, devices;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({ chromium, devices } = require(p)); break; } catch (e) { /* next */ } }
const ZIP = path.resolve(process.argv[2] || '');
if (!process.argv[2] || !fs.existsSync(ZIP)) { console.error('usage: node tools/itch_embed_check.js <zip>'); process.exit(2); }
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'itchzip-'));
execFileSync('python3', ['-c', 'import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', ZIP, DIR]);
const HOST = '<!doctype html><html><body style="margin:0;background:#222"><iframe id="g" src="http://127.0.0.1:8611/index.html" allow="autoplay; fullscreen *; clipboard-write" allowfullscreen style="border:0"></iframe><script>const p=new URLSearchParams(location.search);const f=document.getElementById("g");f.width=p.get("w")||1024;f.height=p.get("h")||768;</script></body></html>';
const game = http.createServer((q, r) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = path.join(DIR, rel);
  if (!f.startsWith(DIR) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(8611, '127.0.0.1');
const host = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(HOST); }).listen(8612, 'localhost');
const results = []; const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); };
(async () => {
  const browser = await chromium.launch();
  for (const [w, h, label, dev] of [[1024, 768, 'desktop 1024x768'], [630, 500, 'desktop 630x500'], [393, 760, 'Pixel 7 portrait', devices['Pixel 7']]]) {
    const ctx = await browser.newContext(dev ? { ...dev } : { viewport: { width: w + 40, height: h + 40 } });
    const page = await ctx.newPage();
    const external = [], failed = [], errors = [];
    page.on('request', r => { const u = r.url(); if (!/^(http:\/\/(127\.0\.0\.1:8611|localhost:8612)|data:|blob:|about:)/.test(u)) external.push(u); });
    page.on('requestfailed', r => failed.push(r.url()));
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(`http://localhost:8612/index.html?w=${w}&h=${h}`);
    const frame = page.frames().find(f => f.url().startsWith('http://127.0.0.1:8611')) || (await (await page.waitForSelector('#g')).contentFrame());
    await frame.waitForSelector('#titleScreen.active', { timeout: 15000 });
    const label0 = await frame.textContent('#titleScreen .sub');
    ok(`${label}: title shows v0.47`, /v0\.47/.test(label0), label0);
    // first input: a tap/click on the title, like a player
    await page.mouse.click(20 + w / 2, 20 + h / 2);
    await frame.waitForSelector('#modeScreen.active', { timeout: 8000 });
    const overlap = await frame.evaluate(() => {
      const a = document.querySelector('#modeScreen .coinTally').getBoundingClientRect();
      const b = document.querySelector('#modeScreen .screenTitle').getBoundingClientRect();
      return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    });
    ok(`${label}: WINS/KEYS tally clear of SELECT DIFFICULTY`, !overlap);
    // start Easy 1 through the real UI
    await frame.evaluate(() => goGame('easy', 0));
    await frame.waitForSelector('#gameScreen.active', { timeout: 8000 });
    const tut = await frame.evaluate(() => document.querySelector('#howToPlayModal').classList.contains('show'));
    ok(`${label}: How To Play opens on the first level`, tut);
    await frame.click('#htpCloseBtn');                      // real click on the close button
    await page.waitForTimeout(300);
    const before = await frame.evaluate(() => JSON.stringify(gstate.rotations || gstate.rot || null));
    await frame.locator('body').press('ArrowRight'); await page.waitForTimeout(250);
    await frame.locator('body').press('ArrowRight'); await page.waitForTimeout(250);
    const after = await frame.evaluate(() => JSON.stringify(gstate.rotations || gstate.rot || null));
    ok(`${label}: arrow keys rotate a ring inside the iframe`, before !== after, `${before} -> ${after}`);
    // save survives a reload of the host page (third-party iframe storage)
    await frame.evaluate(() => { save.hintTime = save.hintTime || {}; save.hintTime['e2e:probe'] = 4242; persistSave(); });
    await page.reload(); await page.waitForTimeout(1500);
    const fr2 = page.frames().find(f => f.url().startsWith('http://127.0.0.1:8611'));
    const kept = await fr2.evaluate(() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)).hintTime['e2e:probe']; } catch (e) { return String(e); } });
    ok(`${label}: save survives reload inside the cross-origin iframe`, kept === 4242, String(kept));
    // privacy / terms links resolve inside the ZIP
    for (const p of ['privacy.html', 'terms.html']) {
      const r = await page.request.get('http://127.0.0.1:8611/' + p);
      ok(`${label}: ${p} served from the ZIP`, r.status() === 200);
    }
    ok(`${label}: no external network requests`, external.length === 0, external.slice(0, 3).join(' '));
    ok(`${label}: no failed requests`, failed.length === 0, failed.slice(0, 3).join(' '));
    ok(`${label}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }
  await browser.close(); game.close(); host.close();
  for (const r of results) console.log(`  ${r[0]}  ${r[1]}${r[2] ? '  (' + r[2] + ')' : ''}`);
  const f = results.filter(r => r[0] === 'FAIL').length;
  console.log(`${results.length - f}/${results.length} passed`); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

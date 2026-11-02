// Browser check of save safety (v0.42). Needs Playwright + Chromium; skips cleanly without them.
//   node tests/save.test.js
// 1. Back Up Progress: a backup code restores the exact same progress into an empty browser (after a confirm),
//    and so does the backup FILE (downloaded, then loaded with the file picker).
// 2. A wrong or damaged code is refused with a message, and nothing changes.
// 3. A damaged save (half-written JSON) falls back to the last save that loaded cleanly instead of a new game.
// 4. The backup dialog fits a 360x640 phone: every button reachable.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const H = require('./harness');
let chromium;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch (e) { /* try next */ } }
if (!chromium) { console.log('save test SKIPPED: playwright not installed'); process.exit(0); }
const { test, finish } = H.runner('SAVE SAFETY  (' + path.basename(H.gameFile()) + ', headless Chromium)');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.log('save test SKIPPED: Chromium unavailable (' + e.message.split('\n')[0] + ')'); process.exit(0); }
  const errors = [];
  const URL = 'file://' + H.gameFile();
  // a save with real progress: Easy 1-12 cleared (6 with gift boxes), Normal 1-3, a theme equipped, Rocket banks
  const seed = async page => page.evaluate(() => {
    save.tutorialSeen = true;
    for (let i = 0; i < 12; i++) { save.progress.easy[i].completed = true; save.progress.easy[i].star = true; save.progress.easy[i].coin = i % 2 === 0; }
    for (let i = 0; i < 3; i++) { save.progress.normal[i].completed = true; save.progress.normal[i].star = true; }
    save.rewards.rocketLocks = { '0:2': true, '0:9': true }; save.options.musicVol = 11;
    recomputeTotalCoins(); persistSave(); return localStorage.getItem(SAVE_KEY);
  });
  const state = page => page.evaluate(() => ({ wins: levelWinCount(), coins: save.totalCoins, rocket: rocketGiftLockCount(), music: save.options.musicVol,
    prog: JSON.stringify(save.progress) }));
  const openBackup = async page => { await page.evaluate(() => { goModeSelect(); }); await page.click('#optBtn, #optionsBtn, .optBtn', { timeout: 2000 }).catch(() => page.evaluate(() => openModal('optionsModal')));
    await page.click('#backupOpenBtn'); await sleep(150); };

  // 1a. code round trip
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await ctx1.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const p1 = await ctx1.newPage(); p1.on('pageerror', e => errors.push(e.message));
  await p1.goto(URL); await p1.waitForFunction(() => typeof gstate !== 'undefined');
  await seed(p1); const before = await state(p1);
  await openBackup(p1);
  const code = await p1.inputValue('#backupCode');
  await p1.click('#backupCopyBtn'); await sleep(200);
  const copyMsg = await p1.textContent('#backupStatus');
  const hint = await p1.textContent('#backupHint');
  // the file
  const [dl] = await Promise.all([p1.waitForEvent('download', { timeout: 5000 }), p1.click('#backupSaveFileBtn')]);
  const filePath = path.join(os.tmpdir(), dl.suggestedFilename()); await dl.saveAs(filePath);
  const fileObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // fresh browser: restore from the code
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage(); p2.on('pageerror', e => errors.push(e.message));
  await p2.goto(URL); await p2.waitForFunction(() => typeof gstate !== 'undefined');
  const empty = await state(p2);
  await openBackup(p2);
  await p2.fill('#backupCode', 'hello'); await p2.click('#backupRestoreBtn'); await sleep(150);
  const badMsg = await p2.textContent('#backupStatus'); const badConfirm = await p2.evaluate(() => document.getElementById('confirmModal').classList.contains('show'));
  await p2.fill('#backupCode', code.slice(0, code.length - 40)); await p2.click('#backupRestoreBtn'); await sleep(150);
  const cutMsg = await p2.textContent('#backupStatus');
  const stillEmpty = await state(p2);
  await p2.fill('#backupCode', code); await p2.click('#backupRestoreBtn'); await sleep(150);
  const confirmText = await p2.textContent('#confirmBody');
  await Promise.all([p2.waitForNavigation(), p2.click('#confirmOkBtn')]);
  await p2.waitForFunction(() => typeof gstate !== 'undefined');
  const afterCode = await state(p2);
  // 1b. fresh browser: restore from the file
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p3 = await ctx3.newPage(); p3.on('pageerror', e => errors.push(e.message));
  await p3.goto(URL); await p3.waitForFunction(() => typeof gstate !== 'undefined');
  await openBackup(p3);
  await p3.setInputFiles('#backupFileInput', filePath); await sleep(300);
  await Promise.all([p3.waitForNavigation(), p3.click('#confirmOkBtn')]);
  await p3.waitForFunction(() => typeof gstate !== 'undefined');
  const afterFile = await state(p3);
  // 3. damaged save falls back to the last good one
  await p3.evaluate(k => localStorage.setItem(k, localStorage.getItem(k).slice(0, 200)), 'ringshiftDemoSave_v1');
  await p3.reload(); await p3.waitForFunction(() => typeof gstate !== 'undefined');
  const afterDamage = await state(p3);
  // 4. phone layout of the dialog
  const ctx4 = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true }); const p4 = await ctx4.newPage();
  await p4.goto(URL); await p4.waitForFunction(() => typeof gstate !== 'undefined'); await openBackup(p4);
  const reach = await p4.evaluate(async () => { const bad = [];
    for (const b of document.querySelectorAll('#backupModal button, #backupModal textarea')) { b.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(r));
      const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (r.left < 0 || r.right > innerWidth + 1 || !(hit === b || b.contains(hit))) bad.push(b.id || b.textContent.trim()); }
    return { bad, sideways: document.documentElement.scrollWidth > innerWidth + 1 }; });
  await browser.close();

  test('backup code restores the same progress into an empty browser, after a confirm that names both sides',
    () => { H.assert(empty.wins === 0, 'second browser was not empty');
      H.assert(code.startsWith('RINGSHIFT-SAVE-1:'), 'code prefix: ' + code.slice(0, 20));
      H.assert(/15 levels won/.test(confirmText) && /0 levels won/.test(confirmText), 'confirm text: ' + confirmText);
      H.assert(JSON.stringify(afterCode) === JSON.stringify(before), 'restored ' + JSON.stringify(afterCode) + ' vs ' + JSON.stringify(before)); });
  test('backup file (download, then LOAD BACKUP FILE) restores the same progress',
    () => { H.assert(fileObj.ringshiftBackup === 1 && fileObj.code === code && fileObj.wins === 15, 'file content');
      H.assert(JSON.stringify(afterFile) === JSON.stringify(before), 'restored from file ' + JSON.stringify(afterFile)); });
  test('a wrong or cut-off code is refused with a message and changes nothing',
    () => { H.assert(/not a Ringshift backup/.test(badMsg) && !badConfirm, 'bad code: ' + badMsg);
      H.assert(/incomplete|not a Ringshift/.test(cutMsg), 'cut code: ' + cutMsg);
      H.assert(stillEmpty.wins === 0, 'progress changed by a bad code'); });
  test('copying the code and saving the file update "Last backup"',
    () => { H.assert(/copied|copy it by hand/.test(copyMsg), 'copy: ' + copyMsg); H.assert(!/never/.test(hint), 'hint still says never: ' + hint); });
  test('a damaged save falls back to the last save that loaded cleanly (no silent new game)',
    () => H.assert(afterDamage.wins === before.wins && afterDamage.prog === before.prog, 'after damage ' + JSON.stringify(afterDamage)));
  test('the backup dialog fits a 360x640 phone: every button and the code box reachable, no sideways scroll',
    () => H.assert(!reach.bad.length && !reach.sideways, JSON.stringify(reach)));
  test('no page errors', () => H.assert(!errors.length, errors.slice(0, 3).join(' | ')));
  process.exitCode = finish() ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

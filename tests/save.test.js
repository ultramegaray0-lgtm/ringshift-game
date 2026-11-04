// Browser check of save safety (v0.42). Needs Playwright + Chromium; skips cleanly without them.
//   node tests/save.test.js
// 1. Back Up Progress: a backup code restores the exact same progress into an empty browser (after a confirm),
//    and so does the backup FILE (downloaded, then loaded with the file picker).
// 2. A wrong or damaged code is refused with a message, and nothing changes.
// 3. A damaged save (half-written JSON) falls back to the last save that loaded cleanly instead of a new game.
// 4. The backup dialog fits a 360x640 phone: every button reachable.
// 5. v0.41 compatibility: tests/fixtures/save-v0.41.json is a real save written by v0.41 at the end of a full
//    scripted playthrough (every level, gift and reward). Loaded by this build it gives the identical save, and that
//    save also restores through the backup dialog (pasted as raw JSON, or loaded as a file).
// 6. Restoring an OLDER backup over newer progress: the confirm names both win counts and warns; CANCEL changes
//    nothing; CONFIRM gives exactly the older progress.
// 7. Invalid backups (wrong text, cut codes, JSON that is not a save, empty / junk / huge files) never touch a
//    valid save: the stored save and its last-good copy stay byte-identical and no confirm appears.
// 8. More damage cases: a save that parses to "null" also falls back; damage with no last-good copy starts a new
//    game without crashing but keeps the damaged value aside; after a fallback the next write is a good save.
// 9. Touch: on an emulated phone the whole flow (Options -> BACK UP -> copy / save file -> paste -> restore ->
//    confirm) works with taps.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const H = require('./harness');
let chromium, devices;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({ chromium, devices } = require(p)); break; } catch (e) { /* try next */ } }
if (!chromium) { console.log('save test SKIPPED: playwright not installed'); process.exit(0); }
const { test, finish } = H.runner('SAVE SAFETY  (' + path.basename(H.gameFile()) + ', headless Chromium)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'ringshiftDemoSave_v1';
const V41 = fs.readFileSync(path.join(__dirname, 'fixtures', 'save-v0.41.json'), 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-save-'));
// same data regardless of key order (loading a save rebuilds some objects with their keys in another order)
const canon = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x);
const same = (a, b) => canon(JSON.parse(a)) === canon(JSON.parse(b));

(async () => {
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.log('save test SKIPPED: Chromium unavailable (' + e.message.split('\n')[0] + ')'); process.exit(0); }
  const errors = [];
  const URL = 'file://' + H.gameFile();
  const newPage = async (opts) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts });
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL); await page.waitForFunction(() => typeof gstate !== 'undefined'); return page;
  };
  const ready = page => page.waitForFunction(() => typeof gstate !== 'undefined');
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
  const full = page => page.evaluate(() => JSON.stringify(save));
  const stored = page => page.evaluate(k => [localStorage.getItem(k), localStorage.getItem(k + '_lastGood')], KEY);
  const openBackup = async page => { await page.evaluate(() => { goModeSelect(); }); await page.click('#optionsBtn', { timeout: 2000 }).catch(() => page.evaluate(() => openModal('optionsModal')));
    await page.click('#backupOpenBtn'); await sleep(150); };
  const confirmShown = page => page.evaluate(() => document.getElementById('confirmModal').classList.contains('show'));
  const writeTmp = (name, text) => { const f = path.join(TMP, name); fs.writeFileSync(f, text); return f; };

  // ---- 1. code + file round trip --------------------------------------------------------------------------------
  const p1 = await newPage();
  await p1.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await seed(p1); const before = await state(p1);
  await openBackup(p1);
  const code = await p1.inputValue('#backupCode');
  await p1.click('#backupCopyBtn'); await sleep(200);
  const copyMsg = await p1.textContent('#backupStatus');
  const clip = await p1.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  const hint = await p1.textContent('#backupHint');
  const [dl] = await Promise.all([p1.waitForEvent('download', { timeout: 5000 }), p1.click('#backupSaveFileBtn')]);
  const filePath = path.join(TMP, dl.suggestedFilename()); await dl.saveAs(filePath);
  const fileObj = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // fresh browser: restore from the code
  const p2 = await newPage();
  const empty = await state(p2);
  await openBackup(p2);
  await p2.fill('#backupCode', 'hello'); await p2.click('#backupRestoreBtn'); await sleep(150);
  const badMsg = await p2.textContent('#backupStatus'); const badConfirm = await confirmShown(p2);
  await p2.fill('#backupCode', code.slice(0, code.length - 40)); await p2.click('#backupRestoreBtn'); await sleep(150);
  const cutMsg = await p2.textContent('#backupStatus');
  const stillEmpty = await state(p2);
  await p2.fill('#backupCode', code); await p2.click('#backupRestoreBtn'); await sleep(150);
  const confirmText = await p2.textContent('#confirmBody');
  await Promise.all([p2.waitForNavigation(), p2.click('#confirmOkBtn')]); await ready(p2);
  const afterCode = await state(p2);
  // fresh browser: restore from the file
  const p3 = await newPage();
  await openBackup(p3);
  await p3.setInputFiles('#backupFileInput', filePath); await sleep(300);
  await Promise.all([p3.waitForNavigation(), p3.click('#confirmOkBtn')]); await ready(p3);
  const afterFile = await state(p3);
  // ---- 3. damaged save falls back to the last good one ----------------------------------------------------------
  await p3.evaluate(k => localStorage.setItem(k, localStorage.getItem(k).slice(0, 200)), KEY);
  await p3.reload(); await ready(p3);
  const afterDamage = await state(p3);
  // ---- 8. more damage cases ------------------------------------------------------------------------------------
  const damagedKept = await p3.evaluate(k => (localStorage.getItem(k + '_damaged') || '').length, KEY);
  await p3.evaluate(() => persistSave());
  const rewritten = await p3.evaluate(k => { try { const o = JSON.parse(localStorage.getItem(k)); return o.progress.easy.filter(p => p.completed).length; } catch (e) { return -1; } }, KEY);
  await p3.evaluate(k => localStorage.setItem(k, 'null'), KEY);
  await p3.reload(); await ready(p3);
  const afterNull = await state(p3);
  const p8 = await newPage();
  await p8.evaluate(k => { localStorage.clear(); localStorage.setItem(k, '{"totalCoins":12,"progress":{"easy":[{"comp'); }, KEY);
  await p8.reload(); await ready(p8);
  const noBackup = await p8.evaluate(k => ({ wins: levelWinCount(), screen: document.querySelector('.screen.active').id,
    kept: localStorage.getItem(k + '_damaged') }), KEY);
  await p8.evaluate(() => goModeSelect());
  const noBackupMenu = await p8.evaluate(() => document.querySelector('.screen.active').id);

  // ---- 5. v0.41 compatibility ----------------------------------------------------------------------------------
  const p5 = await newPage();
  await p5.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, V41]); await p5.reload(); await ready(p5);
  const v41loaded = await full(p5);
  const v41stats = await p5.evaluate(() => ({ wins: levelWinCount(), keys: keyCount(), coins: save.totalCoins,
    unlocked: ['challenge', 'special', 'orchestra', 'rocket'].map(m => isModeUnlocked(m)), claimed: Object.keys(save.rewards.claimed).length }));
  const v41lastGood = (await stored(p5))[1];
  await openBackup(p5);
  const v41code = await p5.inputValue('#backupCode');
  // the v0.41 save restored from its raw JSON (pasted) and as a file, into empty browsers
  const p6 = await newPage();
  await openBackup(p6);
  await p6.fill('#backupCode', V41); await p6.click('#backupRestoreBtn'); await sleep(150);
  const v41confirm = await p6.textContent('#confirmBody');
  await Promise.all([p6.waitForNavigation(), p6.click('#confirmOkBtn')]); await ready(p6);
  const v41fromRaw = await full(p6);
  const p7 = await newPage();
  await openBackup(p7);
  await p7.setInputFiles('#backupFileInput', writeTmp('v041-save.json', V41)); await sleep(300);
  await Promise.all([p7.waitForNavigation(), p7.click('#confirmOkBtn')]); await ready(p7);
  const v41fromFile = await full(p7);
  // and the v0.42 code made from it
  const p9 = await newPage();
  await openBackup(p9);
  await p9.fill('#backupCode', v41code); await p9.click('#backupRestoreBtn'); await sleep(150);
  await Promise.all([p9.waitForNavigation(), p9.click('#confirmOkBtn')]); await ready(p9);
  const v41fromCode = await full(p9);

  // ---- 6. restoring an older backup over newer progress ---------------------------------------------------------
  const p10 = await newPage();
  await seed(p10); await p10.reload(); await ready(p10);   // compare against the progress as the game loads it
  const older = await state(p10); const olderFull = await full(p10);
  await openBackup(p10); const olderCode = await p10.inputValue('#backupCode');
  await p10.evaluate(() => { closeModal('backupModal'); closeModal('optionsModal');
    for (let i = 3; i < 8; i++) { save.progress.normal[i].completed = true; save.progress.normal[i].star = true; } recomputeTotalCoins(); persistSave(); });
  const newer = await state(p10); const newerStored = await stored(p10);
  await openBackup(p10);
  await p10.fill('#backupCode', olderCode); await p10.click('#backupRestoreBtn'); await sleep(150);
  const olderConfirm = await p10.textContent('#confirmBody');
  await p10.click('#confirmCancelBtn'); await sleep(150);
  const afterCancel = await state(p10); const afterCancelStored = await stored(p10);
  await p10.click('#backupRestoreBtn'); await sleep(150);
  await Promise.all([p10.waitForNavigation(), p10.click('#confirmOkBtn')]); await ready(p10);
  const afterOlder = await state(p10); const afterOlderFull = await full(p10);

  // ---- 7. invalid backups over a valid save ---------------------------------------------------------------------
  const p11 = await newPage();
  await seed(p11); const valid = await state(p11);
  await p11.evaluate(() => persistSave()); await p11.reload(); await ready(p11);   // so the last-good copy exists
  await openBackup(p11);
  const validStored = await stored(p11);   // after opening the dialog (which saves the current progress)
  const invalid = [];
  const b64 = s => Buffer.from(s).toString('base64');
  const texts = ['hello', code.slice(0, 60), code.slice(0, code.length - 1) + '!!', 'RINGSHIFT-SAVE-1:', 'RINGSHIFT-SAVE-1:' + b64('hello'),
    'RINGSHIFT-SAVE-1:' + b64('{"progress":{}}'), '{"progress":{}}', '{"progress":{"easy":[],"normal":[]}}', 'null', '[]', '42', '"save"',
    '{"ringshiftBackup":1,"save":null}', '   '];
  for (const t of texts) {
    await p11.fill('#backupCode', t); await p11.click('#backupRestoreBtn'); await sleep(80);
    const r = { what: 'code ' + JSON.stringify(t.slice(0, 30)), msg: await p11.textContent('#backupStatus'), err: await p11.evaluate(() => document.getElementById('backupStatus').classList.contains('err')), confirm: await confirmShown(p11) };
    if (r.confirm) await p11.click('#confirmCancelBtn');
    invalid.push(r);
  }
  const files = [['junk.json', 'not json at all'], ['empty.json', ''], ['other.json', '{"name":"some other game","progress":[1,2,3]}'],
    ['cut.json', fs.readFileSync(filePath, 'utf8').slice(0, 300)], ['big.json', 'x'.repeat(2 * 1024 * 1024 + 10)]];
  for (const [n, t] of files) {
    await p11.setInputFiles('#backupFileInput', writeTmp(n, t)); await sleep(250);
    const r = { what: 'file ' + n, msg: await p11.textContent('#backupStatus'), err: await p11.evaluate(() => document.getElementById('backupStatus').classList.contains('err')), confirm: await confirmShown(p11) };
    if (r.confirm) await p11.click('#confirmCancelBtn');
    invalid.push(r);
  }
  const afterInvalid = await state(p11); const afterInvalidStored = await stored(p11);

  // ---- 4. phone layout of the dialog ----------------------------------------------------------------------------
  const p4 = await newPage({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true }); await openBackup(p4);
  const reach = await p4.evaluate(async () => { const bad = [];
    for (const b of document.querySelectorAll('#backupModal button, #backupModal textarea')) { b.scrollIntoView({ block: 'center' }); await new Promise(r => requestAnimationFrame(r));
      const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (r.left < 0 || r.right > innerWidth + 1 || !(hit === b || b.contains(hit))) bad.push(b.id || b.textContent.trim()); }
    return { bad, sideways: document.documentElement.scrollWidth > innerWidth + 1 }; });

  // ---- 9. the whole flow by touch on an emulated phone ------------------------------------------------------------
  const touch = [];
  for (const dev of ['iPhone SE', 'Pixel 5']) {
    const d = devices[dev];
    const pa = await newPage({ ...d, acceptDownloads: true }); await seed(pa); const want = await state(pa);
    await pa.evaluate(() => goModeSelect()); await pa.tap('#optionsBtn'); await sleep(250);
    await pa.evaluate(() => document.getElementById('backupOpenBtn').scrollIntoView({ block: 'center' })); await pa.tap('#backupOpenBtn'); await sleep(250);
    await pa.tap('#backupCopyBtn'); await sleep(250); const cm = await pa.textContent('#backupStatus');
    const dlp = pa.waitForEvent('download', { timeout: 3000 }).catch(() => null);
    await pa.tap('#backupSaveFileBtn'); const dlx = await dlp; const fm = await pa.textContent('#backupStatus');
    const tcode = await pa.inputValue('#backupCode');
    const pb = await newPage({ ...d });
    await pb.evaluate(() => goModeSelect()); await pb.tap('#optionsBtn'); await sleep(250);
    await pb.evaluate(() => document.getElementById('backupOpenBtn').scrollIntoView({ block: 'center' })); await pb.tap('#backupOpenBtn'); await sleep(250);
    await pb.tap('#backupCode'); await pb.fill('#backupCode', tcode);
    await pb.evaluate(() => document.getElementById('backupRestoreBtn').scrollIntoView({ block: 'center' })); await pb.tap('#backupRestoreBtn'); await sleep(250);
    const okBox = await pb.evaluate(() => { const r = document.getElementById('confirmOkBtn').getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.width > 40 && r.height >= 30; });
    await Promise.all([pb.waitForNavigation(), pb.tap('#confirmOkBtn')]); await ready(pb);
    const got = await state(pb);
    touch.push({ dev, copy: cm, file: dlx ? 'downloaded ' + dlx.suggestedFilename() : fm, okBox, same: JSON.stringify(got) === JSON.stringify(want) });
    await pa.context().close(); await pb.context().close();
  }
  await browser.close();

  test('backup code restores the same progress into an empty browser, after a confirm that names both sides',
    () => { H.assert(empty.wins === 0, 'second browser was not empty');
      H.assert(code.startsWith('RINGSHIFT-SAVE-1:'), 'code prefix: ' + code.slice(0, 20));
      H.assert(/15 levels won/.test(confirmText) && /0 levels won/.test(confirmText), 'confirm text: ' + confirmText);
      H.assert(JSON.stringify(afterCode) === JSON.stringify(before), 'restored ' + JSON.stringify(afterCode) + ' vs ' + JSON.stringify(before)); });
  test('backup file (download, then LOAD BACKUP FILE) restores the same progress',
    () => { H.assert(fileObj.ringshiftBackup === 1 && fileObj.code === code && fileObj.wins === 15, 'file content');
      H.assert(JSON.stringify(afterFile) === JSON.stringify(before), 'restored from file ' + JSON.stringify(afterFile)); });
  test('COPY BACKUP CODE puts the exact code on the clipboard and updates "Last backup"',
    () => { H.assert(/copied/.test(copyMsg), 'copy: ' + copyMsg); H.assert(clip === code, 'clipboard holds ' + String(clip).slice(0, 40));
      H.assert(!/never/.test(hint), 'hint still says never: ' + hint); });
  test('a wrong or cut-off code is refused with a message and changes nothing',
    () => { H.assert(/not a Ringshift backup/.test(badMsg) && !badConfirm, 'bad code: ' + badMsg);
      H.assert(/incomplete|not a Ringshift/.test(cutMsg), 'cut code: ' + cutMsg);
      H.assert(stillEmpty.wins === 0, 'progress changed by a bad code'); });
  test(`${invalid.length} invalid backups (codes, non-save JSON, junk / empty / cut / 2 MB files) over a valid save: refused with a message, no confirm, save and last-good copy byte-identical`,
    () => { const bad = invalid.filter(r => r.confirm || !r.err || !r.msg.trim());
      H.assert(!bad.length, JSON.stringify(bad));
      H.assert(JSON.stringify(afterInvalid) === JSON.stringify(valid), 'progress changed: ' + JSON.stringify(afterInvalid));
      H.assert(afterInvalidStored[0] === validStored[0] && afterInvalidStored[1] === validStored[1], 'stored save changed'); });
  test('restoring an OLDER backup: confirm shows both counts and warns; CANCEL keeps the newer save; CONFIRM gives exactly the older progress',
    () => { H.assert(newer.wins === older.wins + 5, 'setup');
      H.assert(/20 levels won/.test(olderConfirm) && /15 levels won/.test(olderConfirm) && /FEWER/.test(olderConfirm), 'confirm: ' + olderConfirm);
      H.assert(JSON.stringify(afterCancel) === JSON.stringify(newer) && afterCancelStored[0] === newerStored[0], 'cancel changed something');
      H.assert(JSON.stringify(afterOlder) === JSON.stringify(older), 'older restore gave ' + JSON.stringify(afterOlder));
      const A = JSON.parse(afterOlderFull), B = JSON.parse(olderFull);
      const diff = [...new Set([...Object.keys(A), ...Object.keys(B)])].filter(k => canon(A[k]) !== canon(B[k]));
      H.assert(!diff.length, 'fields differ: ' + diff.map(k => k + ' ' + canon(B[k]).slice(0, 120) + ' -> ' + canon(A[k]).slice(0, 120)).join(' | ')); });
  // v0.44: the Powers equip screen is gone, so `powers` ({equipped}) is dropped on load, and `hintTime` (5-minute hint
  // clock per level) is new and starts empty. Every other field must come through unchanged.
  const V44_SHAPE = { powers: undefined, hintTime: {} };
  test('v0.41 save (full playthrough, all gifts): this build loads it to the identical save (every field, every value; v0.44: powers dropped, hintTime added empty)',
    () => { const a = JSON.parse(v41loaded), b = Object.assign(JSON.parse(V41), V44_SHAPE);
      for (const k of Object.keys(V44_SHAPE)) if (V44_SHAPE[k] === undefined) delete b[k];
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) H.assert(canon(a[k]) === canon(b[k]), 'field differs: ' + k);
      H.assert(v41stats.wins === 75 && v41stats.unlocked.every(Boolean), 'stats ' + JSON.stringify(v41stats));
      H.assert(v41lastGood === V41, 'last-good copy not written from the v0.41 save'); });
  test('v0.41 save restores through the backup dialog: pasted raw, as a file, and as the code this build makes from it',
    () => { H.assert(/75 levels won/.test(v41confirm), 'confirm ' + v41confirm);
      for (const [n, s] of [['raw', v41fromRaw], ['file', v41fromFile], ['code', v41fromCode]]) H.assert(s === v41loaded, n + ' restore differs'); });
  test('a damaged save falls back to the last save that loaded cleanly (no silent new game)',
    () => H.assert(afterDamage.wins === before.wins && afterDamage.prog === before.prog, 'after damage ' + JSON.stringify(afterDamage)));
  test('damage cases: damaged value kept aside, next write is a good save, a "null" save also falls back',
    () => { H.assert(damagedKept === 200, 'damaged copy length ' + damagedKept); H.assert(rewritten === 12, 'rewritten save has ' + rewritten + ' Easy wins');
      H.assert(afterNull.wins === before.wins, 'null save gave ' + afterNull.wins + ' wins'); });
  test('damage with no last-good copy: new game without errors, damaged value kept aside, menus work',
    () => H.assert(noBackup.wins === 0 && /^\{"totalCoins":12/.test(noBackup.kept || '') && noBackupMenu === 'modeScreen', JSON.stringify(noBackup) + ' ' + noBackupMenu));
  test('the backup dialog fits a 360x640 phone: every button and the code box reachable, no sideways scroll',
    () => H.assert(!reach.bad.length && !reach.sideways, JSON.stringify(reach)));
  test('touch flow on emulated iPhone SE and Pixel 5: Options -> BACK UP -> copy, save file -> paste -> restore -> confirm, all by taps',
    () => { for (const t of touch) H.assert(t.same && t.okBox && /copied|copy it by hand/.test(t.copy) && /downloaded|Saved|shared/.test(t.file), JSON.stringify(t)); });
  test('no page errors', () => H.assert(!errors.length, errors.slice(0, 3).join(' | ')));
  process.exitCode = finish() ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

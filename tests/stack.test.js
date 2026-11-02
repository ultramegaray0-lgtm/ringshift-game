// Stacked pieces (v0.39): when two pieces of one ring land on the same slot the engine keeps only one of them
// (buildLiveContentMap). The board must show exactly that: the covered piece drawn faded (.stackedOut), the piece in
// play drawn normally, and a Black Hole whose twin is covered marked as unlinked (.loneHole).
//   node tests/stack.test.js          Node part always runs; browser part needs Playwright + Chromium (skips without)
// Checked for EVERY rotation of EVERY level in which any stack occurs, plus every level's start position.
'use strict';
const path = require('path');
const H = require('./harness');
const { test, finish } = H.runner('STACKED PIECES  (' + path.basename(H.gameFile()) + ')');

const fs = require('fs');
function loadEngine() {   // the harness loader plus stackedOutKeys
  const L = fs.readFileSync(H.gameFile(), 'utf8').split('\n');
  const find = (re, from = 0) => { for (let i = from; i < L.length; i++) if (re.test(L[i])) return i; throw new Error('marker ' + re); };
  const e0 = find(/^function slotToAngle\(/), e1 = find(/^const EMITTER_BOUNCES/), l0 = find(/^const ORCHESTRA_MOVEMENTS = \[/), lv = find(/^const LEVELS = \{/), l1 = find(/^\};/, lv);
  return new Function('optScale', 'gstate', 'save', L.slice(e0, e1 + 1).join('\n') + '\n' + L.slice(l0, l1 + 1).join('\n') +
    '\nreturn {traceAllBeams,buildLiveContentMap,stackedOutKeys,LEVELS};')(() => 1, {}, undefined);
}
const E = loadEngine();
const typeOf = H.typeOf;
const pinnedOf = raw => { const t = typeOf(raw); return (typeof raw === 'object' && raw.fixed === true) || t === 'bell' || t === 'ufo' || (t === 'echo_portal' && !(typeof raw === 'object' && raw.moving === true)); };

// Every (level, rotation) where some ring has two pieces on one live slot.
const jobs = [];
let stackedPositions = 0, coveredPieces = 0;
for (const L of H.allLevels(E)) {
  const l = L.l, n = l.slots, idx = +L.id.split('#')[1] - 1, rots = [];
  for (const rot of H.rotations(n, l.rings.length)) {
    const any = l.rings.some((ring, ri) => E.stackedOutKeys(ring, rot[ri], n).size > 0);
    if (any) { rots.push(rot); stackedPositions++; }
  }
  const start = l.rings.map(r => r.initialRotation || 0);
  jobs.push({ id: L.id, mode: L.mode, idx, rots: [start, ...rots.filter(r => r.join() !== start.join())] });
}

test('stackedOutKeys names exactly the pieces the engine ignores (every rotation of every level)', () => {
  const bad = [];
  for (const L of H.allLevels(E)) {
    const l = L.l, n = l.slots;
    for (const rot of H.rotations(n, l.rings.length)) l.rings.forEach((ring, ri) => {
      const map = E.buildLiveContentMap(ring, rot[ri], n, false), out = E.stackedOutKeys(ring, rot[ri], n);
      for (const [k, raw] of Object.entries(ring.gimmicks || {})) {
        if (typeOf(raw) === 'coin') continue;
        const live = pinnedOf(raw) ? +k : (+k + rot[ri]) % n, c = map.get(live);
        const inPlay = !!c && c.src === k;
        if (inPlay === out.has(k)) bad.push(`${L.id} rot ${rot} R${ri + 1} s${k}: inPlay=${inPlay} covered=${out.has(k)}`);
        if (out.has(k)) { coveredPieces++;   // a covered piece always shares its slot with the piece in play
          const owner = c && Object.keys(ring.gimmicks).find(o => o === c.src);
          if (!owner) bad.push(`${L.id} rot ${rot} R${ri + 1} s${k}: covered, but no piece of this ring owns live slot ${live}`); }
      }
    });
  }
  H.assert(!bad.length, bad.slice(0, 8).join('\n        '));
  console.log(`        (${stackedPositions} stacked positions in ${jobs.filter(j => j.rots.length > 1).length} levels, ${coveredPieces} covered-piece cases)`);
});

let chromium;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch (e) { /* next */ } }
(async () => {
  if (!chromium) { console.log('  browser part SKIPPED: playwright not installed'); process.exitCode = finish() ? 1 : 0; return; }
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.log('  browser part SKIPPED: Chromium unavailable'); process.exitCode = finish() ? 1 : 0; return; }
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + H.gameFile());
  const res = await page.evaluate(jobs => {
    const out = { positions: 0, faded: 0, lone: 0, problems: [] };
    showScreen('gameScreen');
    const P = document.getElementById('puzzle');
    for (const j of jobs) {
      currentMode = j.mode; currentLevelIdx = j.idx; loadLevel(j.mode, j.idx);
      const lvl = gstate.level, n = lvl.slots;
      for (const rot of j.rots) {
        gstate.rotations = rot.slice(); recomputeFlow(); renderPuzzle(); out.positions++;
        const where = `${j.id} rot ${rot}`;
        // which keys are drawn faded, per ring
        const fadedDrawn = new Set();
        P.querySelectorAll('.stackedOut').forEach(e => { const r = e.getAttribute('data-ring');
          (e.getAttribute('data-keys') || e.getAttribute('data-key') || '').split(',').filter(Boolean).forEach(k => fadedDrawn.add(r + ':' + k)); });
        const loneDrawn = new Set([...P.querySelectorAll('.loneHole')].map(e => e.getAttribute('data-ring') + ':' + e.getAttribute('data-key')));
        const lone = rpLoneHoles(lvl);
        lvl.rings.forEach((ring, r) => {
          const cov = stackedOutKeys(ring, rot[r], n);
          Object.keys(ring.gimmicks || {}).forEach(k => {
            const raw = ring.gimmicks[k], t = typeof raw === 'string' ? raw : raw.type; if (t === 'coin') return;
            const isFaded = fadedDrawn.has(r + ':' + k);
            if (cov.has(k) && !isFaded) out.problems.push(`${where}: covered ${t} R${r + 1} s${k} drawn as active`);
            if (!cov.has(k) && isFaded) out.problems.push(`${where}: ${t} R${r + 1} s${k} is in play but drawn faded`);
            if (cov.has(k)) out.faded++;
            if (t === 'portal' && !cov.has(k) && lone.has(r + ':' + k) !== loneDrawn.has(r + ':' + k)) out.problems.push(`${where}: Black Hole R${r + 1} s${k} unlinked=${lone.has(r + ':' + k)} but marked=${loneDrawn.has(r + ':' + k)}`);
            if (loneDrawn.has(r + ':' + k)) out.lone++;
          });
        });
        // a lone hole really is a dead end in the engine: its id has exactly one mouth in play
        lone.forEach(x => { const [r, k] = x.split(':'); const id = lvl.rings[+r].gimmicks[k].id; let inPlay = 0;
          lvl.rings.forEach((ring, ri) => { const cov = stackedOutKeys(ring, rot[ri], n);
            Object.keys(ring.gimmicks || {}).forEach(kk => { const g = ring.gimmicks[kk]; if (typeof g === 'object' && g.type === 'portal' && g.id === id && !cov.has(kk)) inPlay++; }); });
          if (inPlay !== 1) out.problems.push(`${where}: Black Hole ${id} marked unlinked but has ${inPlay} mouths in play`); });
      }
    }
    return out;
  }, jobs);
  test(`every covered piece is drawn faded and every piece in play is not (${res.positions} positions rendered)`, () => {
    H.assert(res.faded > 0, 'no covered pieces were found to check');
    H.assert(!res.problems.length, `${res.problems.length} problems, e.g.\n        ` + res.problems.slice(0, 8).join('\n        '));
    console.log(`        (${res.faded} faded pieces checked, ${res.lone} unlinked Black Hole marks)`);
  });
  // A covered piece changes the board key, so the board is rebuilt mid-drag; a touch drag must survive that.
  const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const tp = await tctx.newPage(); tp.on('pageerror', e => errors.push(e.message));
  await tp.goto('file://' + H.gameFile());
  await tp.evaluate(() => { save.tutorialSeen = true; goGame('easy', 19);
    gstate.rotations = [7, 0, 2]; gstate.selectedRing = 1; recomputeFlow(); renderPuzzle(); });   // Easy 20: ring 2's Block reaches the pinned Black Hole at rotation 2
  await tp.waitForTimeout(700);   // let the screen's entrance animation settle before touching the board
  const box = await tp.evaluate(() => { const b = document.getElementById('puzzle').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, s: b.width / 520 }; });
  const cdp = await tctx.newCDPSession(tp), P = a => ({ x: box.x + Math.cos(a) * 154 * box.s, y: box.y + Math.sin(a) * 154 * box.s });
  const a0 = Math.PI / 2 + 0.3; const seen = [];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [P(a0)] });
  for (let k = 1; k <= 24; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [P(a0 + (Math.PI / 6) * 4 * k / 24)] }); await tp.waitForTimeout(30); seen.push(await tp.evaluate(() => gstate.rotations[1])); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await tp.waitForTimeout(200);
  const end = await tp.evaluate(() => ({ rot: gstate.rotations[1], on: _drag.on, moves: gstate.moves }));
  test('a touch drag keeps tracking through a board rebuild caused by pieces stacking (Easy 20, 0 -> 4 slots)', () => {
    H.assert(seen.includes(2), 'drag never reached the stacked rotation: ' + seen.join(' '));
    H.assert(end.rot === 4 && !end.on && end.moves === 4, `drag ended at rotation ${end.rot} (want 4), still dragging=${end.on}, moves=${end.moves}; path ${seen.join(' ')}`);
  });
  test('no page errors while rendering stacked positions', () => H.assert(!errors.length, errors.slice(0, 3).join(' | ')));
  await browser.close();
  process.exitCode = finish() ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

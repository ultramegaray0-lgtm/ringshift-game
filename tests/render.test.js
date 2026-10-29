// Browser check: what the player SEES agrees with the engine. Needs Playwright + Chromium; skips cleanly without them.
//   node tests/render.test.js [--shots <dir>]
// For every mirror level (Easy / Normal / Hard / Challenge) at its start and at every winning rotation:
//   1. each drawn mirror bar is the classic slash (same size/stroke as v0.35) and lies at exactly the angle the
//      tracer reflects off;
//   2. every drawn beam that reaches a mirror's slot is drawn running into that mirror's drawn centre, and the
//      drawn beam leaving it starts there -- no bounce in empty track, no gap.
'use strict';
const path = require('path'), fs = require('fs');
const H = require('./harness');
let chromium;
for (const p of ['playwright', '/opt/npm-tools/node_modules/playwright']) { try { ({ chromium } = require(p)); break; } catch (e) { /* try next */ } }
if (!chromium) { console.log('render test SKIPPED: playwright not installed'); process.exit(0); }

const shotsDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const { test, finish } = H.runner('RENDER vs ENGINE  (' + path.basename(H.gameFile()) + ', headless Chromium)');

(async () => {
  const E = H.load();
  const golden = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'level-wins.json'), 'utf8')).levels;
  const jobs = H.allLevels(E).filter(L => ['easy', 'normal', 'hard', 'challenge'].includes(L.mode) && H.hasMirror(L.l)).map(L => {
    const idx = +L.id.split('#')[1] - 1, start = L.l.rings.map(r => r.initialRotation || 0);
    const wins = (golden[L.id] ? golden[L.id].wins : []).map(w => w.split('|')[0].split(',').map(Number));
    return { id: L.id, mode: L.mode, idx, rots: [start, ...wins] };
  });
  let browser;
  try { browser = await chromium.launch(); }
  catch (e) { console.log('render test SKIPPED: Chromium unavailable (' + e.message.split('\n')[0] + ')'); process.exit(0); }
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + H.gameFile());
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' }); // no idle tilt
  const res = await page.evaluate(jobs => {
    const out = { glyphs: 0, bounces: 0, approaches: 0, problems: [], shapes: new Set(), stacked: new Set() };
    const P = document.getElementById('puzzle'), B = document.getElementById('puzzleBeams');
    // compose the SVG transform ATTRIBUTES from the element up to #puzzle (the geometry the renderer authors; CSS
    // effects such as the intro zoom or the idle tilt are presentation only)
    const toWorld = (elm, x, y) => { let m = new DOMMatrix();
      for (let e = elm; e && e !== P; e = e.parentNode) { const c = e.transform && e.transform.baseVal.consolidate(); if (c) m = new DOMMatrix([c.matrix.a, c.matrix.b, c.matrix.c, c.matrix.d, c.matrix.e, c.matrix.f]).multiply(m); }
      const q = m.transformPoint(new DOMPoint(x, y)); return { x: q.x, y: q.y }; };
    showScreen('gameScreen');
    for (const j of jobs) {
      currentMode = j.mode; currentLevelIdx = j.idx; loadLevel(j.mode, j.idx);
      const lvl = gstate.level, n = lvl.slots;
      for (const rot of j.rots) {
        gstate.rotations = rot.slice(); recomputeFlow(); renderPuzzle(); renderBeams(true);
        // ---- drawn mirrors ----
        const drawn = [];
        P.querySelectorAll('g.gm-mirror_l, g.gm-mirror_r').forEach(g => {
          const type = g.classList.contains('gm-mirror_l') ? 'mirror_l' : 'mirror_r', lines = g.querySelectorAll('line'), disc = g.querySelector('circle');
          const bar = lines[lines.length - 1], a = toWorld(bar, +bar.getAttribute('x1'), +bar.getAttribute('y1')), b = toWorld(bar, +bar.getAttribute('x2'), +bar.getAttribute('y2'));
          out.shapes.add([lines.length, lines[0].getAttribute('stroke-width'), bar.getAttribute('stroke-width'), disc && disc.getAttribute('r'), disc && disc.getAttribute('stroke-width'), Math.hypot(b.x - a.x, b.y - a.y).toFixed(2)].join('/'));
          const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, ang = ((Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI) % 180 + 180) % 180;
          const r = Math.hypot(cx, cy), ri = lvl.rings.findIndex((_, i) => Math.abs(ringRadius(i) - r) < 0.05), slot = angleToNearestSlot(Math.atan2(cy, cx), n);
          drawn.push({ type, cx, cy, ang, ri, slot });
          out.glyphs++;
          if (ri < 0) { out.problems.push(`${j.id} rot ${rot}: mirror drawn off every ring (r=${r.toFixed(2)})`); return; }
          const live = buildLiveContentMap(lvl.rings[ri], rot[ri], n, false).get(slot);
          if (!live || live.kind !== type) {
            // KNOWN, PRE-EXISTING: another piece of the same ring sits on this live slot, and the engine keeps only one
            // piece per slot (buildLiveContentMap: last one wins). Counted and reported, not a mirror-maths problem.
            if (live) { out.stacked.add(`${j.id} R${ri + 1}·s${slot} (${type} under ${live.kind})`); return; }
            out.problems.push(`${j.id} rot ${rot}: drawn ${type} at R${ri + 1}·s${slot} but engine has nothing there`); return; }
          const eng = ((live.bar * 180 / Math.PI) % 180 + 180) % 180, d = Math.min(Math.abs(eng - ang), 180 - Math.abs(eng - ang));
          if (d > 0.01) out.problems.push(`${j.id} rot ${rot}: R${ri + 1}·s${slot} drawn bar ${ang.toFixed(2)}°, engine reflects off ${eng.toFixed(2)}°`);
        });
        // ---- drawn beams vs drawn mirrors ----
        // every drawn beam segment is a 'M x1 y1 L x2 y2' path (each drawn in several glow layers): dedupe, keep order
        const seenD = new Set(), segs = [];
        B.querySelectorAll('path').forEach(p => { const d = p.getAttribute('d') || '', m = d.match(/^M\s*(-?[\d.e-]+)\s+(-?[\d.e-]+)\s*L\s*(-?[\d.e-]+)\s+(-?[\d.e-]+)\s*$/);
          if (m && !seenD.has(d)) { seenD.add(d); segs.push(m.slice(1).map(Number)); } });
        for (let i = 0; i < segs.length; i++) {
          const [, , x2, y2] = segs[i], r = Math.hypot(x2, y2);
          const ri = lvl.rings.findIndex((_, k) => Math.abs(ringRadius(k) - r) < 0.15); if (ri < 0) continue;
          const slot = angleToNearestSlot(Math.atan2(y2, x2), n), live = buildLiveContentMap(lvl.rings[ri], rot[ri], n, false).get(slot);
          if (!live || !/^mirror_/.test(live.kind)) continue;
          const m = drawn.find(q => q.ri === ri && q.slot === slot);
          if (!m) { out.problems.push(`${j.id} rot ${rot}: beam hits R${ri + 1}·s${slot} where no mirror is drawn`); continue; }
          if (Math.hypot(x2 - m.cx, y2 - m.cy) < 0.15) {
            out.bounces++;
            const nx = segs[i + 1];
            const branchEnd = !nx || !segs.slice(i + 1).some(s => Math.hypot(s[0] - m.cx, s[1] - m.cy) < 0.15);
            if (nx && Math.hypot(nx[0] - m.cx, nx[1] - m.cy) > 0.15 && !branchEnd) out.problems.push(`${j.id} rot ${rot}: beam leaves R${ri + 1}·s${slot} away from the drawn mirror`);
          } else {
            const nx = segs[i + 1];
            if (!nx || Math.hypot(nx[0] - x2, nx[1] - y2) > 0.15 || Math.hypot(nx[2] - m.cx, nx[3] - m.cy) > 0.15) out.problems.push(`${j.id} rot ${rot}: beam turns ${Math.hypot(x2 - m.cx, y2 - m.cy).toFixed(1)} units away from the drawn mirror at R${ri + 1}·s${slot}`);
            else out.approaches++;
          }
        }
      }
    }
    out.shapes = [...out.shapes]; out.stacked = [...out.stacked];
    return out;
  }, jobs);

  test(`mirror artwork unchanged: classic slash disc, same strokes and bar length as v0.35 (${res.glyphs} glyphs)`, () => {
    // [lines, under-stroke width, bar width, disc r, disc stroke, bar length in world units = 2*10.5*sqrt2*MECH_SCALE(1.3)]
    H.assert(res.shapes.length === 1 && res.shapes[0] === '2/5.6/3.4/9/1.9/38.61', 'glyph shapes: ' + JSON.stringify(res.shapes));
  });
  test('every drawn mirror bar lies exactly at the angle the engine reflects off, and every beam that reaches a mirror is drawn into it and out of it', () => {
    H.assert(res.bounces > 50, 'too few drawn bounces: ' + res.bounces);
    H.assert(!res.problems.length, `${res.problems.length} problems, e.g.\n        ` + res.problems.slice(0, 8).join('\n        '));
    console.log(`        (${jobs.length} levels, ${jobs.reduce((a, j) => a + j.rots.length, 0)} positions, ${res.glyphs} drawn mirrors, ${res.bounces} drawn bounces, ${res.approaches} off-centre slot crossings drawn into the mirror)`);
  });
  if (res.stacked.length) console.log(`  NOTE (known, pre-existing): ${res.stacked.length} drawn mirror(s) share their slot with another piece of the same ring in a tested position, so the engine ignores them there: ${res.stacked.join('; ')}`);
  test('no page errors while loading and rendering', () => H.assert(!errors.length, errors.slice(0, 3).join(' | ')));

  if (shotsDir) { // screenshots of Easy 3 at each winning rotation, for a human look
    fs.mkdirSync(shotsDir, { recursive: true });
    const L3 = jobs.find(j => j.id === 'easy#3');
    for (const [k, rot] of L3.rots.entries()) {
      await page.evaluate(([j, rot]) => { showScreen('gameScreen'); currentMode = j.mode; loadLevel(j.mode, j.idx); gstate.rotations = rot; recomputeFlow(); renderPuzzle(); renderBeams(true); }, [L3, rot]);
      await page.locator('#stage').screenshot({ path: path.join(shotsDir, `easy3-${k === 0 ? 'start' : 'win' + k}.png`) });
    }
  }
  await browser.close();
  process.exitCode = finish() ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

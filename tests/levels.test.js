// Whole-game regression: every level, every rotation, through the real tracer.
//   node tests/levels.test.js            check against tests/golden/level-wins.json
//   node tests/levels.test.js --update   rewrite the golden file (only after a DELIBERATE level/engine change)
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./harness');
const E = H.load();
const { test, finish } = H.runner('LEVELS  (' + path.basename(E.file) + ')');
const { assert } = H;
const GOLDEN = path.join(__dirname, 'golden', 'level-wins.json');
const levels = H.allLevels(E);

const sigs = {};
for (const L of levels) sigs[L.id] = { name: L.name, wins: H.winSignature(E, L.l) };

if (process.argv.includes('--update')) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify({ gameFile: path.basename(E.file), note: 'Every winning rotation per level as "r1,r2,..|lit coin locks". Regenerate only after a deliberate change.', levels: sigs }, null, 1) + '\n');
  console.log('golden file written:', path.relative(H.ROOT, GOLDEN), '(' + levels.length + ' levels)');
  process.exit(0);
}

// ---------- 1. every level's puzzle is exactly what was verified ----------
const golden = fs.existsSync(GOLDEN) ? JSON.parse(fs.readFileSync(GOLDEN, 'utf8')).levels : {};
test(`win sets match the golden file for all ${levels.length} levels`, () => {
  const bad = [];
  for (const L of levels) {
    const g = golden[L.id];
    if (!g) { bad.push(`${L.id} missing from golden`); continue; }
    if (g.name !== L.name) bad.push(`${L.id} renamed ${g.name} -> ${L.name}`);
    if (JSON.stringify(g.wins) !== JSON.stringify(sigs[L.id].wins)) bad.push(`${L.id} ${L.name}: golden ${JSON.stringify(g.wins)} now ${JSON.stringify(sigs[L.id].wins)}`);
  }
  assert(Object.keys(golden).length === levels.length, `golden has ${Object.keys(golden).length} levels, game has ${levels.length}`);
  assert(!bad.length, bad.slice(0, 8).join('\n        '));
});
test('no level starts already solved', () => {
  const bad = levels.filter(L => { const t = E.traceAllBeams(L.l, L.l.rings.map(r => r.initialRotation || 0));
    return L.l.lockSlots.length && L.l.lockSlots.every(s => t.litLocks.has(s)); }).map(L => L.id);
  assert(!bad.length, bad.join(', '));
});
test('every Challenge level has exactly one winning rotation', () => {
  const bad = levels.filter(L => L.mode === 'challenge' && sigs[L.id].wins.length !== 1).map(L => `${L.id}: ${sigs[L.id].wins.length}`);
  assert(!bad.length, bad.join(', '));
});

// ---------- 2. mirrors: connection + direction, checked on the rendered path of every rotation ----------
// Independent of the engine's helpers: the bar angle is rebuilt from level data the way the artwork draws it
// (╲ 45°, ╱ 135°; an unpinned mirror's bar turns with its ring), and the path is read from the same segments the
// renderer draws.
const D = Math.PI / 180;
test('every mirror bounce, in every rotation of every level, happens at the mirror centre and turns the way its drawn bar faces', () => {
  let bounces = 0, approaches = 0, budgetCut = 0; const bad = [];
  for (const L of levels) {
    const l = L.l, n = l.slots;
    if (!H.hasMirror(l)) continue;
    const mirrorsAt = rot => { const m = new Map();
      l.rings.forEach((R, ri) => Object.keys(R.gimmicks || {}).forEach(k => { const g = R.gimmicks[k], t = H.typeOf(g);
        if (!/^mirror_[lr]$/.test(t)) return;
        const pinned = typeof g === 'object' && g.fixed === true, live = pinned ? +k : (+k + rot[ri]) % n;
        const a = E.slotToAngle(live, n), r = E.ringRadius(ri);
        m.set(ri + ':' + live, { t, cx: Math.cos(a) * r, cy: Math.sin(a) * r, bar: ((t === 'mirror_l' ? 45 : 135) + (pinned ? 0 : rot[ri] * 360 / n)) * D }); }));
      // a spoke or later gimmick on the same live slot hides the mirror (same precedence as the engine)
      return m; };
    for (const rot of H.rotations(n, l.rings.length)) {
      const M = mirrorsAt(rot), live = l.rings.map((R, ri) => E.buildLiveContentMap(R, rot[ri], n, false));
      for (const b of E.traceAllBeams(l, rot).beamResults) {
        const S = b.result.segments;
        for (let i = 0; i < S.length; i++) {
          const s = S[i], rad = Math.hypot(s.x2, s.y2);
          const ri = l.rings.findIndex((_, j) => Math.abs(rad - E.ringRadius(j)) < 1e-6); if (ri < 0) continue;
          const slot = E.angleToNearestSlot(Math.atan2(s.y2, s.x2), n), c = live[ri].get(slot);
          if (!c || !/^mirror_[lr]$/.test(c.kind)) continue;
          const m = M.get(ri + ':' + slot); if (!m) continue;
          const atCentre = Math.hypot(s.x2 - m.cx, s.y2 - m.cy) < 1e-6;
          const where = `${L.id} rot ${rot} R${ri + 1}·s${slot}`;
          if (!atCentre) { // must be an approach: the very next segment carries the beam from here into the centre
            const nx = S[i + 1];
            if (!nx || Math.hypot(nx.x1 - s.x2, nx.y1 - s.y2) > 1e-6 || Math.hypot(nx.x2 - m.cx, nx.y2 - m.cy) > 1e-6) { bad.push(where + ': bounce away from the mirror'); continue; }
            approaches++; continue;
          }
          bounces++;
          const out = S[i + 1];
          if (!out || Math.hypot(out.x1 - m.cx, out.y1 - m.cy) > 1e-3) {
            // The only legitimate way for a branch to end here: the tracer's shared bounce budget (runaway guard) ran out
            // on this very turn. Then nothing ever leaves this point, and the next segment (if any) is a sibling Prism
            // branch that starts somewhere ALREADY on this beam's path.
            const leavesLater = S.slice(i + 1).some(q => Math.hypot(q.x1 - m.cx, q.y1 - m.cy) < 1e-3);
            const siblingBranch = !out || S.slice(0, i + 1).some(q => Math.hypot(q.x2 - out.x1, q.y2 - out.y1) < 1e-3);
            if (!leavesLater && siblingBranch) { budgetCut++; continue; }
            bad.push(where + ': outgoing beam does not start at the mirror'); continue;
          }
          // incoming direction = the segment before any approach
          const inc = (i > 0 && Math.hypot(S[i].x1 - S[i - 1].x2, S[i].y1 - S[i - 1].y2) < 1e-6 && Math.hypot(S[i - 1].x2 - S[i].x1, S[i - 1].y2 - S[i].y1) < 1e-6 &&
            Math.abs(Math.hypot(S[i - 1].x2, S[i - 1].y2) - E.ringRadius(ri)) < 1e-6) ? S[i - 1] : s;
          const di = { x: inc.x2 - inc.x1, y: inc.y2 - inc.y1 }, Li = Math.hypot(di.x, di.y);
          const dout = { x: out.x2 - out.x1, y: out.y2 - out.y1 }, Lo = Math.hypot(dout.x, dout.y);
          if (Li < 1e-9 || Lo < 1e-9) continue;
          const u = { x: di.x / Li, y: di.y / Li }, o = { x: dout.x / Lo, y: dout.y / Lo };
          if (Math.abs(u.x * o.x + u.y * o.y) > 1e-6) { bad.push(where + ': turn is not 90°'); continue; }
          const bx = Math.cos(m.bar), by = Math.sin(m.bar), side = (u.x * bx + u.y * by) * (u.x * by - u.y * bx);
          const cw = u.x * o.y - u.y * o.x > 0;
          if (Math.abs(side) > 1e-9 ? cw !== side > 0 : cw !== (m.t === 'mirror_l')) bad.push(where + ': turned against its drawn bar');
        }
      }
    }
  }
  assert(bounces > 1000, 'too few bounces exercised: ' + bounces);
  assert(!bad.length, `${bad.length} problems, e.g.\n        ` + bad.slice(0, 6).join('\n        '));
  console.log(`        (${bounces} mirror bounces checked; ${approaches} reached through an off-centre slot crossing; ${budgetCut} Prism branches ended by the bounce budget exactly at a mirror)`);
});

process.exitCode = finish() ? 1 : 0;

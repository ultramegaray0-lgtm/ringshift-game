// Design rules for the bonus modes (Meteor Attack, Space Orchestra, Rocket Attack) and Challenge, checked through the
// real tracer. These guard what the golden file can't: the golden file only records what a level does, so a level whose
// featured gimmick quietly stopped mattering (after an engine change) still "passes" it.
//   node tests/design.test.js
'use strict';
const H = require('./harness');
const E = H.load();
const { test, finish } = H.runner('DESIGN  (bonus modes + Challenge)');
const { assert, typeOf } = H;

const clone = x => JSON.parse(JSON.stringify(x));
const dist = (a, b, n) => { const d = ((a - b) % n + n) % n; return Math.min(d, n - d); };
const isPinned = g => (typeof g === 'object' && g.fixed === true) || ['bell', 'ufo'].includes(typeOf(g)) || (typeOf(g) === 'echo_portal' && !(typeof g === 'object' && g.moving === true));
const family = g => { const t = typeOf(g); return t === 'mirror_l' || t === 'mirror_r' ? 'mirror' : t; };
const giftLocks = (mode, l) => mode === 'rocket' ? [...new Set([...l.lockSlots, ...(l.bonusLockSlots || [])])] : l.lockSlots;
const lights = (l, locks, rot) => { const t = E.traceAllBeams({ ...l, lockSlots: locks }, rot).litLocks; return locks.every(s => t.has(s)); };
const winsOf = (l, locks) => [...H.rotations(l.slots, l.rings.length)].filter(r => lights(l, locks, r));
const winsMoreThanOne = (l, locks) => { let c = 0; for (const r of H.rotations(l.slots, l.rings.length)) if (lights(l, locks, r) && ++c > 1) return true; return false; };
function without(l, ri, s) {
  const c = clone(l), g = l.rings[ri].gimmicks[s]; delete c.rings[ri].gimmicks[s];
  if (typeOf(g) === 'portal') c.rings.forEach(R => Object.keys(R.gimmicks).forEach(k => { const h = R.gimmicks[k]; if (typeOf(h) === 'portal' && h.id === g.id) delete R.gimmicks[k]; }));
  return c;
}
const levelsOf = mode => E.LEVELS[mode].map((l, i) => ({ id: `${mode}#${i + 1}`, mode, l, locks: giftLocks(mode, l) }));
const BONUS = [...levelsOf('special'), ...levelsOf('orchestra'), ...levelsOf('rocket'), ...levelsOf('challenge')];
const WINS = new Map(BONUS.map(L => [L.id, winsOf(H.wallsDown(L.l), L.locks)]));

// The gimmick each level is built around. Every winning rotation must depend on at least one of each listed kind:
// remove it and none of the level's answers works any more.
const FEATURED = {
  'special#3': ['mirror'], 'special#4': ['mirror'], 'special#5': ['mirror', 'portal'], 'special#6': ['mirror'], 'special#7': ['amp', 'portal'],
  'special#8': ['prism', 'mirror'], 'special#9': ['echo_portal', 'portal'], 'special#10': ['mirror', 'prism', 'amp', 'portal'],
  'orchestra#3': ['mirror'], 'orchestra#4': ['mirror'], 'orchestra#5': ['portal'], 'orchestra#6': ['amp'], 'orchestra#7': ['prism'],
  'orchestra#8': ['echo_portal'], 'orchestra#9': ['amp'], 'orchestra#10': ['mirror', 'prism', 'echo_portal', 'portal', 'amp'],
  'rocket#2': ['amp'], 'rocket#3': ['prism'], 'rocket#4': ['mirror'], 'rocket#5': ['echo_portal'], 'rocket#6': ['portal'], 'rocket#7': ['mirror', 'amp'],
  'rocket#8': ['prism'], 'rocket#9': ['echo_portal'], 'rocket#10': ['prism', 'mirror', 'amp'],
  'challenge#1': ['mirror'], 'challenge#3': ['portal'], 'challenge#4': ['prism'], 'challenge#5': ['echo_portal'],
};

test('every bonus-mode and Challenge level can be won (all its gift locks lit at once)', () => {
  const bad = BONUS.filter(L => !WINS.get(L.id).length).map(L => `${L.id} ${L.l.name}`);
  assert(!bad.length, bad.join(', '));
});

test('each level’s featured gimmick is needed by every answer', () => {
  const bad = [];
  for (const L of BONUS) for (const kind of FEATURED[L.id] || []) {
    const wins = WINS.get(L.id), cands = [];
    L.l.rings.forEach((R, ri) => Object.keys(R.gimmicks || {}).forEach(s => { if (family(R.gimmicks[s]) === kind) cands.push([ri, s]); }));
    const needed = cands.some(([ri, s]) => { const c = without(H.wallsDown(L.l), ri, s); return wins.every(w => !lights(c, L.locks, w)); });
    if (!needed) bad.push(`${L.id} ${L.l.name}: no ${kind} is needed (${cands.length} on the board)`);
  }
  assert(!bad.length, bad.join('\n        '));
});

// One-Way Street's Half-Blocks work both ways: the answer passes through some (a full Block there breaks it),
// and others stop wrong rotations (remove one and a second rotation wins).
test('One-Way Street: 3+ Half-Blocks are passed through on the answer and 2+ stop a wrong rotation', () => {
  const L = BONUS.find(x => x.id === 'challenge#2'), w = WINS.get(L.id)[0]; let passed = 0, traps = 0;
  L.l.rings.forEach((R, ri) => Object.keys(R.gimmicks).forEach(s => { if (typeOf(R.gimmicks[s]) !== 'half_block') return;
    const c = clone(L.l); c.rings[ri].gimmicks[s] = 'block'; if (!lights(c, L.locks, w)) passed++;
    if (winsMoreThanOne(without(L.l, ri, s), L.locks)) traps++; }));
  assert(passed >= 3 && traps >= 2, `${passed} passed through, ${traps} stopping a wrong rotation`);
});

test('no ring in a bonus-mode or Challenge level is idle (turning it changes what the beams reach)', () => {
  const bad = [];
  for (const L of BONUS) {
    const l = L.l, n = l.slots, all = { ...l, lockSlots: [...Array(n).keys()] };
    l.rings.forEach((_, k) => {
      let moves = false;
      for (const r of H.rotations(n, l.rings.length)) { if (r[k] || moves) continue;
        const base = [...E.traceAllBeams(all, r).litLocks].sort().join();
        for (let v = 1; v < n && !moves; v++) { const r2 = r.slice(); r2[k] = v; if ([...E.traceAllBeams(all, r2).litLocks].sort().join() !== base) moves = true; }
        if (moves) break; }
      if (!moves) bad.push(`${L.id} ring ${k + 1}`);
    });
  }
  assert(!bad.length, bad.join(', '));
});

test('Meteor Attack: 1-2 answers per level, and a meteor freezing any ring at the start costs at least one lock', () => {
  const bad = [];
  for (const L of BONUS.filter(x => x.mode === 'special')) {
    const wins = WINS.get(L.id), start = L.l.rings.map(r => r.initialRotation || 0);
    if (wins.length > 2) bad.push(`${L.id}: ${wins.length} answers`);
    L.l.rings.forEach((_, k) => { if (wins.some(w => w[k] === start[k])) bad.push(`${L.id}: ring ${k + 1} starts in its answer position, so losing its power costs nothing`); });
    if ((L.l.elecLocks || []).length !== L.l.rings.length) bad.push(`${L.id}: needs one Electricity Lock per ring`);
    if ((L.l.elecLocks || []).some(s => L.l.lockSlots.includes(s))) bad.push(`${L.id}: an Electricity Lock sits on a gift lock`);
  }
  assert(!bad.length, bad.join('\n        '));
});

test('Challenge: a real route (6+ gimmick touches), landing squarely on the Lock, from a start that lights nothing', () => {
  const bad = [];
  for (const L of BONUS.filter(x => x.mode === 'challenge')) {
    const l = L.l, n = l.slots, [w] = WINS.get(L.id), start = l.rings.map(r => r.initialRotation || 0);
    const live = l.rings.map((R, ri) => E.buildLiveContentMap(R, w[ri], n, false));
    let touches = 0, landing = null;
    for (const b of E.traceAllBeams(l, w).beamResults) for (const s of b.result.segments) {
      const rad = Math.hypot(s.x2, s.y2), ang = Math.atan2(s.y2, s.x2), slot = E.angleToNearestSlot(ang, n);
      const off = Math.abs(((ang - E.slotToAngle(slot, n)) * 180 / Math.PI + 540) % 360 - 180);
      if (rad > E.RIM_R - 1e-6) { if (l.lockSlots.includes(slot)) landing = off; continue; }
      const ri = l.rings.findIndex((_, j) => Math.abs(rad - E.ringRadius(j)) < 1e-6);
      if (ri < 0) { touches++; continue; }                                   // entered a Black Hole
      const c = live[ri].get(slot); if (c && !(/^mirror/.test(c.kind) && off > 1e-6)) touches++;
    }
    if (touches < 6) bad.push(`${L.id}: route has ${touches} touches`);
    if (landing === null || landing > 5) bad.push(`${L.id}: beam lands ${landing === null ? '?' : landing.toFixed(1)}° from the Lock`);
    if (lights(l, l.lockSlots, start)) bad.push(`${L.id}: start is solved`);
    if (start.some((s, k) => dist(s, w[k], n) < 3)) bad.push(`${L.id}: a ring starts within 2 steps of its answer`);
  }
  assert(!bad.length, bad.join('\n        '));
});

test('moving Satellites appear only in Challenge levels', () => {
  const bad = [];
  for (const mode of Object.keys(E.LEVELS)) if (mode !== 'challenge') E.LEVELS[mode].forEach((l, i) => l.rings.forEach(R => Object.values(R.gimmicks || {}).forEach(g => {
    if (typeOf(g) === 'echo_portal' && typeof g === 'object' && g.moving) bad.push(`${mode}#${i + 1}`); })));
  assert(!bad.length, bad.join(', '));
  assert(!isPinned({ type: 'echo_portal', moving: true }) && isPinned({ type: 'echo_portal' }), 'pinning rule');
});

// v0.38 walled gift locks: for every 2 gift locks, 1 sits behind a wall a rocket has to destroy first.
test('Rocket Attack: 1 wall per 2 gift locks; walls must be destroyed to win, can be hit cleanly, and the start aims at none', () => {
  const bad = [];
  for (const L of BONUS.filter(x => x.mode === 'rocket')) {
    const l = L.l, G = L.locks, W = Object.keys(l.lockGuards || {}).map(Number), elec = l.elecLocks || [];
    const start = l.rings.map(r => r.initialRotation || 0), up = { ...l, lockSlots: G };
    if (W.length !== Math.floor(G.length / 2)) bad.push(`${L.id}: ${W.length} walls for ${G.length} gift locks`);
    W.forEach(s => { const g = l.lockGuards[s];
      if (!G.includes(s)) bad.push(`${L.id}: wall at ${s} is not in front of a gift lock`);
      if (!(typeOf(g) === 'block' || (typeOf(g) === 'half_block' && g.side === 'out'))) bad.push(`${L.id}: wall at ${s} would not stop light heading into its lock`); });
    const clean = new Set();
    for (const r of H.rotations(l.slots, l.rings.length)) {
      const t = E.traceAllBeams(up, r), ends = t.beamResults.flatMap(b => b.result.ends);
      const lit = W.filter(s => t.litLocks.has(s));
      if (lit.length) { bad.push(`${L.id}: walled lock ${lit} lights at ${r} with its wall up`); break; }
      const rim = ends.filter(e => e.kind === 'rim').map(e => e.slot), hit = ends.filter(e => e.kind === 'guard').map(e => e.slot);
      if (hit.length && !rim.some(s => G.includes(s) || elec.includes(s))) hit.forEach(s => clean.add(s));
      if (r.join() === start.join()) {
        if (hit.length) bad.push(`${L.id}: the start already aims a rocket at a wall`);
        if (rim.some(s => G.includes(s) || elec.includes(s))) bad.push(`${L.id}: the start aims a rocket at a lock`);
      }
    }
    W.filter(s => !clean.has(s)).forEach(s => bad.push(`${L.id}: wall at ${s} can't be hit without also aiming at a gift or Electricity Lock`));
    if (W.length && winsOf(up, G).length) bad.push(`${L.id}: can be won with the walls up`);
  }
  assert(!bad.length, bad.join('\n        '));
});

process.exitCode = finish() ? 1 : 0;

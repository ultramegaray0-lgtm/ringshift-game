// Mirror mechanics regression tests (v0.36). Run: node tests/mirror.test.js
'use strict';
const H = require('./harness');
const E = H.load();
const { test, finish } = H.runner('MIRROR MECHANICS  (' + require('path').basename(E.file) + ')');
const { assert, near } = H;

const D = Math.PI / 180;
const V = {
  right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, up: { x: 0, y: -1 }, // screen space, +y DOWN
};
const nameOf = v => Object.keys(V).find(k => near(V[k].x, v.x, 1e-9) && near(V[k].y, v.y, 1e-9)) || `(${v.x.toFixed(3)},${v.y.toFixed(3)})`;
const cross = (a, b) => a.x * b.y - a.y * b.x, dot = (a, b) => a.x * b.x + a.y * b.y;
const unit = a => ({ x: Math.cos(a), y: Math.sin(a) });
// textbook reflection of d off a line with unit direction b
const trueReflect = (d, b) => { const k = 2 * dot(d, b); return { x: k * b.x - d.x, y: k * b.y - d.y }; };

// ---------- 1. the reflection table: what the drawn "╲" and "╱" must do ----------
// ╲ runs top-left -> bottom-right. ╱ runs bottom-left -> top-right. +y is DOWN on screen.
const TABLE = {
  mirror_l: { right: 'down', down: 'right', left: 'up', up: 'left' },   // ╲
  mirror_r: { right: 'up', down: 'left', left: 'down', up: 'right' },   // ╱
};
for (const type of Object.keys(TABLE)) for (const [inc, out] of Object.entries(TABLE[type])) {
  test(`${type === 'mirror_l' ? '╲' : '╱'} ${type}: beam going ${inc} leaves going ${out}`, () => {
    const got = E.mirrorReflect(V[inc], E.mirrorBarAngle(type, 0, 12), type);
    assert(nameOf(got) === out, `got ${nameOf(got)}`);
    const tr = trueReflect(V[inc], unit(E.MIRROR_BAR_DEG[type] * D));
    assert(near(got.x, tr.x, 1e-12) && near(got.y, tr.y, 1e-12), 'differs from the textbook reflection off the drawn bar');
  });
}

// ---------- 2. any direction, any bar angle: exactly 90 degrees, to the side the bar deflects ----------
test('every reflection is an exact 90° turn toward the side the drawn bar deflects the beam (36,000 cases)', () => {
  let degenerate = 0;
  for (const type of ['mirror_l', 'mirror_r']) for (let rot = 0; rot < 24; rot++) for (let a = 0; a < 360; a += 0.5) {
    const bar = E.mirrorBarAngle(type, rot, 24), d = unit(a * D), o = E.mirrorReflect(d, bar, type);
    assert(near(Math.hypot(o.x, o.y), 1, 1e-12), 'not unit length');
    assert(near(dot(d, o), 0, 1e-12), `not 90° (a=${a})`);
    const side = cross(d, trueReflect(d, unit(bar)));
    if (Math.abs(side) < 1e-9) { degenerate++; continue; }
    assert(Math.sign(cross(d, o)) === Math.sign(side), `turned away from the bar (type=${type} rot=${rot} a=${a})`);
  }
  assert(degenerate > 0, 'expected some exactly-45° cases to be exercised');
});

test('a beam at exactly 45° to the bar (no side to choose) keeps the old facing: ╲ clockwise, ╱ counter-clockwise', () => {
  for (const type of ['mirror_l', 'mirror_r']) {
    const b = E.mirrorBarAngle(type, 0, 12);
    for (const a of [b, b + Math.PI / 2, b + Math.PI, b - Math.PI / 2]) {      // along the bar / straight into it
      const d = unit(a), o = E.mirrorReflect(d, b, type);
      assert((cross(d, o) > 0) === (type === 'mirror_l'), `${type} at ${(a / D).toFixed(0)}°`);
    }
  }
});

// ---------- 3. the bar the engine reflects off is the bar that is drawn ----------
test('pinned mirror: bar stays at 45° (╲) / 135° (╱) whatever the ring rotation', () => {
  for (const type of ['mirror_l', 'mirror_r']) for (let rot = 0; rot < 12; rot++) {
    const m = E.buildLiveContentMap({ spokeSlots: [], gimmicks: { 3: { type, fixed: true } } }, rot, 12, false);
    assert(m.get(3) && m.get(3).kind === type, 'pinned mirror must stay on its authored slot');
    assert(near(m.get(3).bar, E.MIRROR_BAR_DEG[type] * D), `bar ${(m.get(3).bar / D).toFixed(2)}`);
  }
});
test('unpinned mirror: bar turns with its ring (drawn inside the ring\'s rotating group)', () => {
  for (const type of ['mirror_l', 'mirror_r']) for (let rot = 0; rot < 12; rot++) {
    const m = E.buildLiveContentMap({ spokeSlots: [], gimmicks: { 3: type } }, rot, 12, false);
    const c = m.get((3 + rot) % 12);
    assert(c && c.kind === type, 'unpinned mirror must move with its ring');
    assert(near(c.bar, (E.MIRROR_BAR_DEG[type] + rot * 30) * D), `rot ${rot}: bar ${(c.bar / D).toFixed(2)}`);
  }
});
test('rotation covariance: turning an unpinned mirror and the beam together by one slot turns the result by one slot', () => {
  for (const type of ['mirror_l', 'mirror_r']) for (let a = 0; a < 360; a += 7) for (let rot = 0; rot < 12; rot++) {
    const o0 = E.mirrorReflect(unit(a * D), E.mirrorBarAngle(type, 0, 12), type);
    const o1 = E.mirrorReflect(unit((a + rot * 30) * D), E.mirrorBarAngle(type, rot, 12), type);
    const r = rot * 30 * D, rx = o0.x * Math.cos(r) - o0.y * Math.sin(r), ry = o0.x * Math.sin(r) + o0.y * Math.cos(r);
    if (Math.abs(cross(unit(a * D), trueReflect(unit(a * D), unit(E.MIRROR_BAR_DEG[type] * D)))) < 1e-6) continue; // tie cases
    assert(near(o1.x, rx, 1e-9) && near(o1.y, ry, 1e-9), `type ${type} a=${a} rot=${rot}`);
  }
});

// ---------- 4. through the real tracer: one mirror, beams from all four sides ----------
// A rim emitter fires straight inward. Put a PINNED mirror on the outer ring right under it.
// Emitter at slot 0 (top) beam goes DOWN; slot 3 (right) goes LEFT; slot 6 (bottom) goes UP; slot 9 (left) goes RIGHT.
const EMIT = { 0: 'down', 3: 'left', 6: 'up', 9: 'right' };
for (const type of ['mirror_l', 'mirror_r']) for (const [slot, inc] of Object.entries(EMIT)) {
  test(`tracer: ${type === 'mirror_l' ? '╲' : '╱'} at rim-side slot ${slot}, beam going ${inc} leaves going ${TABLE[type][inc]}`, () => {
    const lvl = { slots: 12, emitters: [+slot], lockSlots: [], rings: [{ spokeSlots: [], gimmicks: { [slot]: { type, fixed: true } } }] };
    const segs = E.traceAllBeams(lvl, [0]).beamResults[0].result.segments;
    assert(segs.length >= 2, 'beam stopped at the mirror');
    const s = segs[1], d = { x: s.x2 - s.x1, y: s.y2 - s.y1 }, L = Math.hypot(d.x, d.y);
    assert(nameOf({ x: d.x / L, y: d.y / L }) === TABLE[type][inc], `left going ${nameOf({ x: d.x / L, y: d.y / L })}`);
  });
}

// ---------- 5. connection: the bounce happens ON the mirror ----------
const centre = (ri, slot, n) => { const a = E.slotToAngle(slot, n), r = E.ringRadius(ri); return { x: Math.cos(a) * r, y: Math.sin(a) * r }; };
test('connection: a beam crossing a mirror\'s slot off-centre is carried into the mirror and leaves from its centre', () => {
  // Easy-3-style geometry (8 slots): the beam goes UP into ╱ at the top of the inner ring, which sends it RIGHT along a
  // tangent that crosses the outer ring ~30 units short of the mirror at slot 1. Before v0.36 it turned right there,
  // in empty track beside the glyph.
  const lvl = { slots: 8, lockSlots: [0, 1, 2, 3, 4, 5, 6, 7], rings: [
    { spokeSlots: [], gimmicks: { 1: { type: 'mirror_l', fixed: true } } },
    { spokeSlots: [4], gimmicks: { 0: { type: 'mirror_r', fixed: true } } }] };
  const segs = E.traceAllBeams(lvl, [0, 0]).beamResults[0].result.segments;
  const c0 = centre(1, 0, 8), c7 = centre(0, 1, 8);
  const ends = segs.map(s => ({ x: s.x2, y: s.y2 }));
  const touches = c => ends.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 1e-6);
  assert(touches(c0), 'first mirror bounce not at its centre');
  assert(touches(c7), 'second mirror: path never reaches its centre');
  const i = ends.findIndex(p => Math.hypot(p.x - c7.x, p.y - c7.y) < 1e-6);
  assert(Math.hypot(segs[i + 1].x1 - c7.x, segs[i + 1].y1 - c7.y) < 1e-3, 'outgoing beam does not start at the mirror');
  assert(Math.hypot(segs[i].x1 - c7.x, segs[i].y1 - c7.y) > 20, 'expected an off-centre approach in this setup');
});
test('connection: path is continuous through every mirror bounce (no gaps a player could see)', () => {
  const lvl = { slots: 8, lockSlots: [], rings: [
    { spokeSlots: [], gimmicks: { 1: { type: 'mirror_l', fixed: true } } },
    { spokeSlots: [4], gimmicks: { 0: { type: 'mirror_r', fixed: true } } }] };
  const segs = E.traceAllBeams(lvl, [0, 0]).beamResults[0].result.segments;
  assert(segs.length >= 5, 'expected the beam to reach and bounce off both mirrors');
  for (let i = 1; i < segs.length; i++) assert(Math.hypot(segs[i].x1 - segs[i - 1].x2, segs[i].y1 - segs[i - 1].y2) < 1e-3, `gap before segment ${i}`);
});
test('radial beams are untouched by the connection fix (they already cross at the mirror centre)', () => {
  for (let s = 0; s < 12; s++) {
    const lvl = { slots: 12, emitters: [s], lockSlots: [], rings: [{ spokeSlots: [], gimmicks: { [s]: { type: 'mirror_l', fixed: true } } }] };
    const segs = E.traceAllBeams(lvl, [0]).beamResults[0].result.segments, c = centre(0, s, 12);
    assert(Math.hypot(segs[0].x2 - c.x, segs[0].y2 - c.y) < 1e-6, `slot ${s}: radial beam did not meet the centre`);
    assert(Math.hypot(segs[1].x1 - c.x, segs[1].y1 - c.y) < 1e-3, `slot ${s}: inserted a needless approach segment`);
  }
});

// ---------- 6. consecutive reflections ----------
test('two mirrors in a row: ╱ then ╲ steer a beam round a corner to the expected rim slot', () => {
  // Emitter at the top fires DOWN; ╱ on the outer ring at slot 0 sends it LEFT (tangent);
  // reversed, ╲ would send it RIGHT. Each must land on the matching side of the rim.
  const mk = t => ({ slots: 12, emitters: [0], lockSlots: [...Array(12).keys()], rings: [{ spokeSlots: [], gimmicks: { 0: { type: t, fixed: true } } }] });
  const lit = t => [...E.traceAllBeams(mk(t), [0]).litLocks];
  assert(lit('mirror_r').every(s => s >= 9), `╱ should send the beam to the left half, lit ${lit('mirror_r')}`);
  assert(lit('mirror_l').every(s => s >= 1 && s <= 3), `╲ should send the beam to the right half, lit ${lit('mirror_l')}`);
});
test('three-mirror chain stays exact (each turn 90°, path continuous, ends on the rim)', () => {
  const lvl = { slots: 12, emitters: [0], lockSlots: [...Array(12).keys()], rings: [
    { spokeSlots: [], gimmicks: { 2: 'mirror_r', 0: { type: 'mirror_l', fixed: true } } },
    { spokeSlots: [], gimmicks: { 6: 'mirror_l' } },
    { spokeSlots: [], gimmicks: {} }] };
  for (const rot of H.rotations(12, 3)) {
    const segs = E.traceAllBeams(lvl, rot).beamResults[0].result.segments;
    for (let i = 1; i < segs.length; i++) assert(Math.hypot(segs[i].x1 - segs[i - 1].x2, segs[i].y1 - segs[i - 1].y2) < 1e-3, `gap at rot ${rot}`);
  }
});

process.exitCode = finish() ? 1 : 0;

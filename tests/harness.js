// Loads the REAL engine and level data straight out of the shipped game file, so the tests exercise
// exactly the code players run. The game file is the one named by GAME_FILE in the Pages workflow.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function gameFile() {
  if (process.env.RINGSHIFT_GAME_FILE) return path.resolve(process.env.RINGSHIFT_GAME_FILE);
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  const m = wf.match(/^\s*GAME_FILE:\s*(.+?)\s*$/m);
  if (!m) throw new Error('GAME_FILE not found in .github/workflows/pages.yml');
  return path.join(ROOT, m[1].replace(/^["']|["']$/g, ''));
}

// Engine = from `function slotToAngle(` to `const EMITTER_BOUNCES`; level data = from
// `const ORCHESTRA_MOVEMENTS = [` to the end of `const LEVELS = {`. Both are self-contained.
function load(file = gameFile()) {
  const L = fs.readFileSync(file, 'utf8').split('\n');
  const find = (re, from = 0) => {
    for (let i = from; i < L.length; i++) if (re.test(L[i])) return i;
    throw new Error('marker not found in game file: ' + re);
  };
  const e0 = find(/^function slotToAngle\(/), e1 = find(/^const EMITTER_BOUNCES/);
  const l0 = find(/^const ORCHESTRA_MOVEMENTS = \[/), lv = find(/^const LEVELS = \{/), l1 = find(/^\};/, lv);
  const names = ['traceAllBeams', 'buildLiveContentMap', 'slotToAngle', 'angleToNearestSlot', 'ringRadius', 'RIM_R',
    'mirrorReflect', 'mirrorBarAngle', 'mirrorTurnsClockwise', 'MIRROR_BAR_DEG', 'LEVELS'];
  const code = L.slice(e0, e1 + 1).join('\n') + '\n' + L.slice(l0, l1 + 1).join('\n') + '\nreturn {' + names.join(',') + '};';
  // optScale/gstate/save are render-side globals some engine helpers mention; the tracer never needs them.
  const E = new Function('optScale', 'gstate', 'save', code)(() => 1, {}, undefined);
  E.file = file;
  return E;
}

// Every playable level, in a stable order, with a readable id.
function allLevels(E) {
  const out = [];
  for (const mode of Object.keys(E.LEVELS)) E.LEVELS[mode].forEach((l, i) => out.push({ id: `${mode}#${i + 1}`, name: l.name, mode, l }));
  return out;
}
function* rotations(n, k) {
  const r = new Array(k).fill(0);
  while (true) {
    yield r.slice();
    let i = 0;
    while (i < k) { r[i]++; if (r[i] < n) break; r[i] = 0; i++; }
    if (i === k) return;
  }
}
// A level's puzzle signature: every winning rotation, plus which coin locks that rotation also lights.
function winSignature(E, l) {
  const out = [], bonus = l.bonusLockSlots || [];
  for (const rot of rotations(l.slots, l.rings.length)) {
    const t = E.traceAllBeams(l, rot);
    if (l.lockSlots.length && l.lockSlots.every(s => t.litLocks.has(s))) out.push(rot.join(',') + '|' + bonus.filter(s => t.litLocks.has(s)).join(','));
  }
  return out;
}
const typeOf = g => (typeof g === 'string' ? g : g.type);
const hasMirror = l => l.rings.some(r => Object.values(r.gimmicks || {}).some(g => /^mirror_[lr]$/.test(typeOf(g))));

// Tiny test runner: test(name, fn) where fn throws on failure.
function runner(title) {
  const results = [];
  const test = (name, fn) => {
    const t0 = Date.now();
    try { fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); }
    catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, err: e && e.message ? e.message : String(e) }); }
  };
  const finish = () => {
    console.log(`\n${title}`);
    for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n        ' + r.err}  (${r.ms} ms)`);
    const bad = results.filter(r => !r.ok).length;
    console.log(`  ${results.length - bad}/${results.length} passed`);
    return bad;
  };
  return { test, finish };
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function near(a, b, eps = 1e-9) { return Math.abs(a - b) <= eps; }

module.exports = { ROOT, gameFile, load, allLevels, rotations, winSignature, typeOf, hasMirror, runner, assert, near };

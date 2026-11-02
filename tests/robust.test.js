// Cross-browser robustness: Math.sin / cos / atan2 / sqrt / hypot may differ in the last bits between JavaScript
// engines (V8, JavaScriptCore, SpiderMonkey). No level's outcome may depend on that. This loads the engine a second
// time with those functions perturbed by a tiny relative error (1e-13, about 1000x a real last-bit difference) and
// checks that every rotation of every level lights exactly the same Locks (gift Locks included).
//   node tests/robust.test.js [trials]
// Before v0.39 Challenge 5's only answer depended on a tangent crossing and Hard 18 on a 45-degree Satellite tie.
'use strict';
const fs = require('fs'), path = require('path');
const H = require('./harness');
const { test, finish, } = H.runner('FLOAT ROBUSTNESS  (' + path.basename(H.gameFile()) + ')');

function loadWith(MathObj) {
  const L = fs.readFileSync(H.gameFile(), 'utf8').split('\n');
  const find = (re, from = 0) => { for (let i = from; i < L.length; i++) if (re.test(L[i])) return i; throw new Error('marker ' + re); };
  const e0 = find(/^function slotToAngle\(/), e1 = find(/^const EMITTER_BOUNCES/), l0 = find(/^const ORCHESTRA_MOVEMENTS = \[/), lv = find(/^const LEVELS = \{/), l1 = find(/^\};/, lv);
  const code = L.slice(e0, e1 + 1).join('\n') + '\n' + L.slice(l0, l1 + 1).join('\n') + '\nreturn {traceAllBeams,LEVELS};';
  return new Function('optScale', 'gstate', 'save', 'Math', code)(() => 1, {}, undefined, MathObj);
}
function noisyMath(eps, seed) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 - 0.5; };
  const M = Object.create(Math);
  for (const f of ['sin', 'cos', 'atan2', 'sqrt', 'hypot']) M[f] = (...a) => Math[f](...a) * (1 + eps * rnd());
  return M;
}
const key = t => [...t.litLocks].sort((a, b) => a - b).join(',');
const trials = +process.argv[2] || 1;
const base = loadWith(Math);
const levels = H.allLevels(base);
let positions = 0;
test(`every rotation of every level lights the same Locks under last-bit float noise (${trials} trial(s), relative 1e-13)`, () => {
  const bad = [];
  for (let tr = 0; tr < trials; tr++) {
    const P = loadWith(noisyMath(1e-13, 7919 * tr + 1));
    for (const L of levels) {
      const idx = +L.id.split('#')[1] - 1;
      const lb = H.withBonusTargets(H.wallsDown(L.l)), lp = H.withBonusTargets(H.wallsDown(P.LEVELS[L.mode][idx]));
      for (const rot of H.rotations(lb.slots, lb.rings.length)) {
        positions++;
        const a = key(base.traceAllBeams(lb, rot)), b = key(P.traceAllBeams(lp, rot));
        if (a !== b) bad.push(`${L.id} rot ${rot}: lit [${a}] vs [${b}] with noise`);
      }
    }
  }
  H.assert(!bad.length, bad.length + ' position(s) depend on float noise:\n        ' + bad.slice(0, 8).join('\n        '));
});
const failed = finish();
console.log(`        (${positions} positions traced twice)`);
process.exit(failed ? 1 : 0);

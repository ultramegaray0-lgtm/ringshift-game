// Runs every engine test. Exit code is non-zero if anything fails.  Usage: node tests/run.js
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
let failed = 0;
for (const t of ['mirror.test.js', 'levels.test.js']) {
  const r = spawnSync(process.execPath, [path.join(__dirname, t)], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} test file(s) FAILED` : '\nAll engine tests passed');
process.exit(failed ? 1 : 0);

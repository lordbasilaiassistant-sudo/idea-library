#!/usr/bin/env node
/**
 * check.mjs — the one command. `npm run check`.
 *
 * This is EXACTLY what CI runs, so a contributor never gets a CI failure they could
 * not have seen locally. It needs no `npm install` — the repo has zero runtime
 * dependencies on purpose, so there is never a reason to skip the gate.
 */

import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const steps = [
  ['scrub',     'scripts/scrub.mjs',    'secrets, personal data, un-allowlisted addresses'],
  ['validate',  'scripts/validate.mjs', 'schema, vocabulary, quotability, measured numbers'],
  ['build',     'scripts/build.mjs',    'regenerate every navigable surface'],
  ['scoreboard','scripts/scoreboard.mjs','rank every idea, explainably and reproducibly'],
];

let failed = null;

for (const [name, script, what] of steps) {
  process.stdout.write(`\n── ${name} — ${what}\n`);
  try {
    execFileSync(process.execPath, [script], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    failed = name;
    break;
  }
}

if (!failed) {
  // build must be idempotent: generated files are committed so the repo is usable
  // without running anything, and a stale generated file is a silent lie.
  process.stdout.write('\n── build-idempotent — generated files match their sources\n');
  let dirty = '';
  try {
    dirty = execSync('git status --porcelain -- index.json llms.txt llms-full.txt LESSONS.md FAILURES.md WORKED.md OPEN-QUESTIONS.md STATUS.md SCOREBOARD.md data/scoreboard.json sitemap.xml robots.txt feed.xml README.md ideas',
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { /* not a git repo yet */ }

  if (dirty && process.env.CI) {
    console.log('\nbuild-idempotent: FAIL — generated files are out of date:\n');
    console.log(dirty);
    console.log('\n→ Run `npm run build` and commit the result.');
    failed = 'build-idempotent';
  } else if (dirty) {
    console.log('build-idempotent: generated files changed — commit them:\n');
    console.log(dirty);
  } else {
    console.log('build-idempotent: clean');
  }
}

if (failed) {
  console.log(`\ncheck: FAILED at \`${failed}\`. Nothing merges while this is red.`);
  process.exit(1);
}
console.log('\ncheck: all green.');

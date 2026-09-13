#!/usr/bin/env node
/**
 * check.mjs — the one command. `npm run check`.
 *
 * This is EXACTLY what CI runs, so a contributor never gets a CI failure they could
 * not have seen locally. It needs no `npm install` — the repo has zero runtime
 * dependencies on purpose, so there is never a reason to skip the gate.
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const steps = [
  ['vote-integrity','scripts/vote-integrity.mjs','prevent ballot history rollback and trust-key substitution'],
  ['tests', '--test', 'security and malformed contribution regressions', ...readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.test.mjs')).map(f => `tests/${f}`)],
  ['scale', 'scripts/scale.mjs', '10000 synthetic ideas through the production catalog generator'],
  ['scrub',     'scripts/scrub.mjs',    'secrets, personal data, un-allowlisted addresses'],
  ['validate',  'scripts/validate.mjs', 'schema, vocabulary, quotability, measured numbers'],
  ['build',     'scripts/build.mjs',    'regenerate every navigable surface'],
  ['scoreboard','scripts/scoreboard.mjs','rank every idea, explainably and reproducibly'],
  ['wiki', 'scripts/wiki.mjs', 'regenerate the wiki from source'],
  ['site', 'scripts/site.mjs', 'build every public page'],
  ['size', 'scripts/size.mjs', 'cap source files and allow named bulk exports'],
  ['postbuild-scrub', 'scripts/scrub.mjs', 'scan generated public files'],
  ['site-scrub', 'scripts/scrub.mjs', 'scan deployable output', 'site/dist'],
];

let failed = null;

for (const [name, script, what, ...args] of steps) {
  process.stdout.write(`\n── ${name} — ${what}\n`);
  try {
    execFileSync(process.execPath, [script, ...args], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    failed = name;
    break;
  }
}

const generated = ['index.json', 'llms.txt', 'llms-full.txt', 'LESSONS.md', 'FAILURES.md', 'WORKED.md', 'OPEN-QUESTIONS.md', 'STATUS.md', 'SCOREBOARD.md', 'data/scoreboard.json', 'sitemap.xml', 'robots.txt', 'feed.xml', 'README.md', 'ideas', 'catalog', 'docs/wiki', 'site/dist'];
function snapshot() {
  const files = new Map();
  function visit(path) {
    const full = join(ROOT, path);
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) for (const name of readdirSync(full).sort()) visit(`${path}/${name}`);
    else files.set(path, createHash('sha256').update(readFileSync(full)).digest('hex'));
  }
  generated.forEach(visit);
  return JSON.stringify([...files]);
}
if (!failed) {
  process.stdout.write('\n── deterministic-build — repeated generation is byte-identical\n');
  const before = snapshot();
  try {
    for (const script of ['build', 'scoreboard', 'wiki', 'site']) execFileSync(process.execPath, [`scripts/${script}.mjs`], { cwd: ROOT, stdio: 'pipe' });
    if (before !== snapshot()) throw new Error('Repeated generation changed output');
    console.log('deterministic-build: clean');
  } catch (error) { console.error(error.message); failed = 'deterministic-build'; }
}
if (!failed) {
  // build must be idempotent: generated files are committed so the repo is usable
  // without running anything, and a stale generated file is a silent lie.
  process.stdout.write('\n── build-idempotent — generated files match their sources\n');
  let dirty = '';
  try {
    dirty = execFileSync('git', ['status', '--porcelain', '--', ...generated.filter(p => p !== 'site/dist')],
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

#!/usr/bin/env node
/**
 * commitlint.mjs — conventional commits, our subset.
 *
 *   node scripts/commitlint.mjs <base-sha> <head-sha>   # CI: a PR's commits
 *   node scripts/commitlint.mjs --file .git/COMMIT_EDITMSG   # the commit-msg hook
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TYPES = ['idea', 'lesson', 'evidence', 'taxonomy', 'docs', 'chore', 'fix', 'feat', 'ci', 'refactor', 'test'];
const RE = new RegExp(`^(${TYPES.join('|')})(\\([a-z0-9-]+\\))?: .{6,}$`);

const argv = process.argv.slice(2);
let subjects = [];

if (argv[0] === '--file') {
  const msg = readFileSync(argv[1], 'utf8');
  subjects = [msg.split('\n')[0]];
} else if (argv.length >= 2 && argv[0] && argv[1]) {
  const out = execSync(`git log --format=%s ${argv[0]}..${argv[1]}`, { cwd: ROOT }).toString();
  subjects = out.split('\n').filter(Boolean);
} else {
  try {
    const out = execSync('git log --format=%s -20', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    subjects = out.split('\n').filter(Boolean);
  } catch {
    console.log('commitlint: no commits yet — nothing to lint');
    process.exit(0);
  }
}

const bad = subjects.filter((s) => !RE.test(s) && !/^Merge /.test(s) && !/^Revert /.test(s));

if (bad.length === 0) {
  console.log(`commitlint: ${subjects.length} commit(s) ok`);
  process.exit(0);
}

console.log('commitlint: these subjects do not match the convention:\n');
for (const s of bad) console.log(`  ✖ ${s}`);
console.log(`
Expected:  <type>: <what changed>

  types: ${TYPES.join(', ')}

  idea: add jobboard-api-scrape
  idea: update multicall-batch-reads outcome shipped -> partial
  lesson: add rate-limit finding to bankr-launcher
  taxonomy: add mechanic tag \`moderation-gap\`

Put the EVIDENCE in the body — what you measured, when, and where. The diff already
shows what changed; the body is for why anyone should believe it.`);
process.exit(1);

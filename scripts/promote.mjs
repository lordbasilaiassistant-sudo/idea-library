#!/usr/bin/env node
/**
 * promote.mjs — move a finished draft out of staging and into the public library.
 *
 *   node scripts/promote.mjs <slug> [--category <category>]
 *
 * This is the ONLY door between _inbox/ (gitignored, raw, private) and ideas/ (public).
 * It refuses to open unless:
 *   1. the draft scrubs clean,
 *   2. no TODO markers or import-note blocks survive,
 *   3. the result passes the full validator.
 *
 * Files under code/ are copied ONE AT A TIME and scrubbed individually — never as a
 * directory copy. A whole-tree copy is how a .env or a key-bearing config rides along
 * inside something that looked like source.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, loadTaxonomy } from './lib/ideas.mjs';
import { parseFile } from './lib/frontmatter.mjs';

const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith('--'));
const args = new Map();
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
}

const tax = loadTaxonomy();

if (!slug) {
  console.error('usage: node scripts/promote.mjs <slug> [--category <category>]');
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) die('draft slug must be kebab-case');

const srcDir = join(ROOT, '_inbox', 'drafts', slug);
const srcFile = join(srcDir, 'idea.md');
if (!existsSync(srcFile)) die(`no draft at _inbox/drafts/${slug}/idea.md`);

const text = readFileSync(srcFile, 'utf8');

// --- 1. no unfinished scaffolding survives ---------------------------------
if (/\bTODO\b/.test(text)) {
  die('the draft still contains TODO markers', 'Finish it. A half-written entry is worse than none.');
}
if (/<!--\s*\n?IMPORT NOTES/.test(text) || text.includes('IMPORT NOTES')) {
  die('the import-notes comment block is still in the draft',
    'That block is raw extracted material from private notes. Delete it before promoting.');
}

// --- 2. category ------------------------------------------------------------
let data;
try { ({ data } = parseFile(text)); } catch (e) { die(`frontmatter does not parse: ${e.message}`); }

const category = args.get('category') || data.category;
if (!tax.categoryIds.has(category)) {
  die(`unknown category \`${category}\``, `categories: ${[...tax.categoryIds].join(', ')}`);
}
if (data.id !== slug) die(`the draft's id is \`${data.id}\` but the folder is \`${slug}\``, 'They must match — the folder name is the public URL.');

const destDir = join(ROOT, 'ideas', category, slug);
if (existsSync(destDir)) die(`ideas/${category}/${slug}/ already exists`, 'Update that entry instead of promoting a second copy.');

// --- 3. the gate, on the draft, before anything is copied -------------------
console.log('promote: scrubbing the draft…');
if (!scrubClean([relative(ROOT, srcDir).split(sep).join('/')], true)) {
  die('the draft does not scrub clean', 'Nothing moves while the gate is red. Redact and re-scan.');
}

// --- 4. copy, file by file --------------------------------------------------
mkdirSync(destDir, { recursive: true });
const written = [];

const finalText = text.replace(/^category: .*$/m, `category: ${category}`);
writeFileSync(join(destDir, 'idea.md'), finalText, 'utf8');
written.push('idea.md');

for (const bucket of ['code', 'evidence', 'assets']) {
  const from = join(srcDir, bucket);
  if (!existsSync(from)) continue;
  for (const rel of walk(from, from)) {
    const srcPath = join(from, rel);
    // one file at a time, scrubbed on its own — never a directory copy
    if (!scrubClean([relative(ROOT, srcPath).split(sep).join('/')], true)) {
      console.log(`promote: ABORTED — ${bucket}/${rel} does not scrub clean.`);
      rmSync(destDir, { recursive: true, force: true });
      console.log('promote: rolled back; nothing was published.');
      process.exit(1);
    }
    const destPath = join(destDir, bucket, rel);
    mkdirSync(join(destPath, '..'), { recursive: true });
    writeFileSync(destPath, readFileSync(srcPath));
    written.push(`${bucket}/${rel}`);
  }
}

// --- 5. the promoted result must pass the full validator --------------------
console.log('promote: validating the promoted entry…');
try {
  execFileSync(process.execPath, ['scripts/validate.mjs'], { cwd: ROOT, stdio: 'inherit' });
} catch {
  rmSync(destDir, { recursive: true, force: true });
  console.log('\npromote: rolled back — the promoted entry does not validate. Fix the draft and retry.');
  process.exit(1);
}

console.log(`\npromote: published ideas/${category}/${slug}/ (${written.length} file(s))`);
for (const w of written) console.log(`  + ${w}`);
console.log('\nNext: npm run build && git add … && git commit -m "idea: add ' + slug + '"');
console.log(`The draft is still in _inbox/drafts/${slug}/ — delete it once you are satisfied.`);

// ---------------------------------------------------------------------------

function scrubClean(paths, inbox) {
  try {
    execFileSync(process.execPath, ['scripts/scrub.mjs', ...(inbox ? ['--inbox'] : []), ...paths], { cwd: ROOT, stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
}

function walk(dir, base, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join('/'));
  }
  return out;
}

function die(msg, fix) {
  console.error(`promote: ${msg}`);
  if (fix) console.error(`→ ${fix}`);
  process.exit(1);
}

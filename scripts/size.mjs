#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMIT = 2 * 1024 * 1024;
const bulk = new Set(['index.json', 'llms-full.txt', 'LESSONS.md', 'FAILURES.md',
  'WORKED.md', 'OPEN-QUESTIONS.md', 'STATUS.md', 'SCOREBOARD.md', 'data/scoreboard.json',
  'README.md', 'sitemap.xml', 'feed.xml']);

export function checkSizes(root) {
  const categories = JSON.parse(readFileSync(join(root, 'data/taxonomy.json'), 'utf8')).categories;
  const allowed = new Set([...bulk, ...categories.map(c => `ideas/${c.id}/README.md`)]);
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
  const failures = [];
  for (const file of new Set(files)) {
    let size;
    try { size = statSync(join(root, file)).size; } catch { continue; }
    if (size > LIMIT && !allowed.has(file)) failures.push({ file, bytes: size });
  }
  return failures;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const failures = checkSizes(fileURLToPath(new URL('..', import.meta.url)));
  for (const f of failures) console.error(`size: ${f.file} exceeds 2 MiB (${f.bytes} bytes)`);
  console.log(`size: ${failures.length ? 'FAIL' : 'clean'} — only named generated bulk exports may exceed 2 MiB`);
  process.exitCode = failures.length ? 1 : 0;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { checkSizes, LIMIT } from '../scripts/size.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'idea-gates-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  cpSync(join(root, 'data'), join(dir, 'data'), { recursive: true });
  return dir;
}
function run(dir, script, args = []) {
  return spawnSync(process.execPath, [join(dir, 'scripts', script), ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, SCRUB_DENYLIST: join(dir, 'absent-private.json') },
  });
}
test('public scrub works without private secrets and scans every byte of large and marked lines', t => {
  const dir = fixture(t);
  cpSync(join(root, 'scripts/scrub.mjs'), join(dir, 'scripts/scrub.mjs'));
  const target = join(dir, 'candidate.txt');
  writeFileSync(target, 'Ordinary public evidence.');
  assert.equal(run(dir, 'scrub.mjs', [target, '--json']).status, 0);
  const fake = ['ghp', '_', 'A'.repeat(36)].join('');
  for (const content of [
    'x'.repeat(LIMIT + 1) + '\n' + fake,
    'x'.repeat(6000) + ' ' + fake,
    fake + ' // scrub-ignore-line',
    '/* scrub-ignore-begin */\n' + fake + '\n/* scrub-ignore-end */',
    String.fromCharCode(0) + ' ' + fake,
  ]) {
    writeFileSync(target, content);
    const result = run(dir, 'scrub.mjs', [target, '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert(JSON.parse(result.stdout).findings.some(f => f.rule === 'github-token'));
    assert(!result.stdout.includes(fake), 'never print the full secret');
  }
  writeFileSync(join(dir, 'data/denylist.public.json'), '{"terms":[]}');
  writeFileSync(target, 'Ordinary public evidence.');
  assert.equal(run(dir, 'scrub.mjs', [target]).status, 1, 'public denylist must remain mandatory');
});

test('size gate permits named bulk output and rejects GENERATED banner bypass', t => {
  const dir = fixture(t);
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  const large = 'GENERATED\n' + 'x'.repeat(LIMIT);
  writeFileSync(join(dir, 'index.json'), large);
  writeFileSync(join(dir, 'arbitrary.md'), large);
  assert.deepEqual(checkSizes(dir).map(f => f.file), ['arbitrary.md']);
});

test('forced staging cannot publish ignored private intake or local denylist', t => {
  const dir = fixture(t);
  cpSync(join(root, 'scripts/scrub.mjs'), join(dir, 'scripts/scrub.mjs'));
  execFileSync('git', ['init', '--quiet'], { cwd: dir });
  mkdirSync(join(dir, '_inbox'));
  writeFileSync(join(dir, '.gitignore'), '_inbox/\nscripts/denylist.local.json\n');
  writeFileSync(join(dir, '_inbox/inventory.json'), '{}');
  writeFileSync(join(dir, 'scripts/denylist.local.json'), '{"terms":[]}');
  assert.equal(run(dir, 'scrub.mjs').status, 0);
  execFileSync('git', ['add', '-f', '_inbox/inventory.json', 'scripts/denylist.local.json'], { cwd: dir });
  const result = run(dir, 'scrub.mjs', ['--json']);
  assert.equal(result.status, 1);
  const hits = JSON.parse(result.stdout).findings.filter(f => f.rule === 'private-tracked-path');
  assert.equal(hits.length, 2);
});

test('validator accepts real baseline and rejects malformed contribution fields', t => {
  const dir = fixture(t);
  cpSync(join(root, 'scripts/lib'), join(dir, 'scripts/lib'), { recursive: true });
  cpSync(join(root, 'scripts/validate.mjs'), join(dir, 'scripts/validate.mjs'));
  cpSync(join(root, 'ideas'), join(dir, 'ideas'), { recursive: true });
  assert.equal(run(dir, 'validate.mjs').status, 0);
  const catalog = JSON.parse(readFileSync(join(root, 'index.json'), 'utf8'));
  const entry = (catalog.ideas || catalog)[0];
  const path = join(dir, 'ideas', entry.category, entry.id, 'idea.md');
  const baseline = readFileSync(path, 'utf8');
  const cases = [
    [text => text.replace(/^confidence:.*$/m, 'confidence: imaginary'), /unknown confidence/],
    [text => text.replace(/^category:.*$/m, 'category: absent-category'), /unknown category/],
    [text => text.replace(/^revenue_usd:.*$/m, 'revenue_usd: -1'), /finite and nonnegative/],
    [text => text.replace(/^## What we tried$/m, '## Different section'), /missing the/],
  ];
  for (const [mutate, expected] of cases) {
    const changed = mutate(baseline);
    assert.notEqual(changed, baseline, 'fixture mutation must apply');
    writeFileSync(path, changed);
    const result = run(dir, 'validate.mjs');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, expected);
  }
});

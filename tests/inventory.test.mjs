import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

test('private inventory preserves review decisions and rejects invalid dispositions', () => {
  const tempRoot = resolve(tmpdir());
  const fixture = mkdtempSync(join(tempRoot, 'idea-inventory-test-'));
  try {
    mkdirSync(join(fixture, 'scripts', 'lib'), { recursive: true });
    for (const file of ['inventory.mjs', 'lib/ideas.mjs', 'lib/frontmatter.mjs']) {
      copyFileSync(join(root, 'scripts', file), join(fixture, 'scripts', file));
    }
    const actors = join(fixture, 'actors.json');
    writeFileSync(actors, JSON.stringify([{ id: 'fixture-actor', name: 'Fixture actor' }]));
    const ledgerFile = join(fixture, '_inbox', 'inventory.json');
    const ledger = () => JSON.parse(readFileSync(ledgerFile, 'utf8'));
    const run = (...args) => spawnSync(process.execPath, [join(fixture, 'scripts', 'inventory.mjs'), ...args], {
      cwd: fixture, encoding: 'utf8', timeout: 10000,
    });
    const pass = (...args) => {
      const result = run(...args);
      assert.equal(result.status, 0, result.stderr || String(result.error));
      return JSON.parse(result.stdout);
    };
    const reject = (expected, ...args) => {
      const before = readFileSync(ledgerFile, 'utf8');
      const result = run(...args);
      assert.equal(result.status, 1, result.stderr || String(result.error));
      assert.match(result.stderr, expected);
      assert.equal(readFileSync(ledgerFile, 'utf8'), before, 'rejection must not modify the ledger');
      assert.equal(existsSync(join(fixture, '_inbox', 'inventory.lock')), false, 'rejection releases its lock');
    };

    assert.equal(pass('--actors', actors).total_candidates, 1);
    const discovered = ledger().candidates[0];
    assert.equal(discovered.state, 'discovered');
    const decide = ['--decide', discovered.id];
    reject(/Claim a review owner/, ...decide, '--state', 'reviewing', '--reason', 'Inspect evidence');
    reject(/decision reason is required/, ...decide, '--state', 'reviewing', '--owner', 'fixture-reviewer');
    pass(...decide, '--state', 'reviewing', '--owner', 'fixture-reviewer', '--reason', 'Inspect evidence');
    const reviewing = ledger().candidates[0];
    assert.equal(reviewing.owner, 'fixture-reviewer');
    assert.equal(reviewing.reason, 'Inspect evidence');
    assert.equal(reviewing.history.length, 1);
    assert.equal(reviewing.history[0].from, 'discovered');
    assert.equal(reviewing.history[0].to, 'reviewing');

    writeFileSync(actors, JSON.stringify([{ id: 'fixture-actor', name: 'Renamed fixture actor' }]));
    assert.equal(pass('--actors', actors).last_run.added, 0);
    const repeated = ledger().candidates[0];
    assert.equal(ledger().candidates.length, 1);
    assert.equal(repeated.name, 'Renamed fixture actor');
    for (const key of ['id', 'first_seen', 'state', 'owner', 'reason', 'history', 'ideas']) {
      assert.deepEqual(repeated[key], reviewing[key], `rediscovery preserves ${key}`);
    }
    reject(/requires existing idea IDs/, ...decide, '--state', 'duplicate', '--reason', 'Same question');
    reject(/Linked idea does not exist/, ...decide, '--state', 'duplicate', '--reason', 'Same question', '--ideas', 'missing-idea');
    reject(/Choose one operation/, '--unknown-operation');
    reject(/Choose one operation/, '--report', '--actors', actors);
    reject(/Unknown state/, ...decide, '--state', 'invented', '--reason', 'Invalid state');

    const ideaDir = join(fixture, 'ideas', 'tooling-infra', 'fixture-idea');
    mkdirSync(ideaDir, { recursive: true });
    writeFileSync(join(ideaDir, 'idea.md'), '---\nid: fixture-idea\n---\nFixture catalog entry.\n');
    pass(...decide, '--state', 'duplicate', '--reason', 'Same question', '--ideas', 'fixture-idea');
    assert.equal(ledger().candidates[0].state, 'duplicate');
    assert.deepEqual(ledger().candidates[0].ideas, ['fixture-idea']);
    assert.equal(ledger().candidates[0].history.length, 2);
  } finally {
    const child = relative(tempRoot, resolve(fixture));
    assert.ok(child && !child.startsWith('..') && !isAbsolute(child), 'cleanup stays in the temporary directory');
    rmSync(fixture, { recursive: true, force: true });
  }
});

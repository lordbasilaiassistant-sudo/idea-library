import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProjects } from '../scripts/lib/projects.mjs';

test('empty registry and public identities are valid', () => {
  assert.deepEqual(validateProjects({ projects: [] }).errors, []);
  const result = validateProjects({ projects: [{ id: 'sample-project', label: 'Sample Project', aliases: ['Former Name'], links: { repo: 'https://example.org/project' } }] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.ids.has('sample-project'));
});

test('identity collisions include IDs, labels and case-folded aliases', () => {
  const result = validateProjects({ projects: [
    { id: 'first', label: 'First', aliases: [' Former Name '] },
    { id: 'second', label: 'Second', aliases: ['former name'] },
    { id: 'first', label: 'Third' },
  ] });
  assert.ok(result.errors.some(e => e.includes('collides')));
  assert.ok(result.errors.some(e => e.includes('duplicate id')));
  assert.ok(validateProjects({ projects: [{ id: 'first', label: 'First', aliases: [' FIRST '] }] }).errors.some(e => e.includes('redundant')));
});

test('private intake and outcome fields cannot become project metadata', () => {
  const result = validateProjects({ projects: [{ id: 'sample', label: 'Sample', outcome: 'revenue', revenue_usd: 1, source_key: 'private' }] });
  assert.equal(result.errors.filter(e => e.includes('unsupported field')).length, 3);
});

test('reject malformed metadata and credential-bearing or non-HTTPS links', () => {
  for (const entry of [null, { id: 'Bad ID', label: '' }, { id: 'a', label: 'A', aliases: [1] }, { id: 'a', label: 'A', links: [] }]) {
    assert.ok(validateProjects({ projects: [entry] }).errors.length);
  }
  for (const url of ['http://example.org', 'https://', 'https://user:password@example.org']) {
    assert.ok(validateProjects({ projects: [{ id: 'a', label: 'A', links: { home: url } }] }).errors.length);
  }
});

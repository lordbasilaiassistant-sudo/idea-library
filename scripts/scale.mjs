#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { generateCatalog, digest, PAGE_SIZE } from './lib/catalog.mjs';

const started = performance.now();
const entries = Array.from({ length: 10000 }, (_, n) => ({
  id: `scale-${String(n).padStart(5, '0')}`, title: `Synthetic question ${n}`,
  category: `category-${n % 13}`, outcome: `outcome-${n % 8}`,
  tags: [`domain-${n % 17}`, `mechanic-${n % 31}`, 'stage-tested'],
  projects: [`project-${n % 107}`, `project-${(n + 1) % 107}`],
  description: 'Synthetic scale fixture, never imported into the public corpus.',
}));
const output = new Map();
const manifest = generateCatalog(entries, (path, text) => {
  assert(!output.has(path), `duplicate output ${path}`);
  output.set(path, text);
});
const traverse = (pages) => pages.flatMap(page => {
  const text = output.get(page.path);
  assert.equal(digest(text), page.sha256);
  assert.equal(Buffer.byteLength(text), page.bytes);
  const rows = JSON.parse(text).ideas;
  assert(rows.length > 0 && rows.length <= 100);
  assert.equal(rows.length, page.count);
  return rows.map(row => row.id);
});
assert.equal(PAGE_SIZE, 100);
assert.equal(manifest.count, 10000);
assert.deepEqual(traverse(manifest.pages), entries.map(e => e.id));
for (const [axis, facets] of Object.entries(manifest.facets)) {
  const values = row => axis === 'tag' ? row.tags : axis === 'project' ? row.projects : [row[axis]];
  const expectedKeys = [...new Set(entries.flatMap(values))].sort();
  assert.deepEqual(Object.keys(facets).sort(), expectedKeys);
  for (const [value, facet] of Object.entries(facets)) {
    const expected = entries.filter(e => values(e).includes(value)).map(e => e.id);
    assert.equal(facet.count, expected.length);
    assert.deepEqual(traverse(facet.pages), expected);
  }
}
for (const entry of entries) assert.deepEqual(JSON.parse(output.get(`catalog/ideas/${entry.id}.json`)), entry);
let repeated = 0;
generateCatalog([...entries].reverse(), (path, text) => {
  assert.equal(text, output.get(path), `nondeterministic output ${path}`);
  repeated++;
});
assert.equal(repeated, output.size);
console.log(`scale: PASS — 10000 ideas, ${manifest.pages.length} complete pages, all four facets, per-idea retrieval and deterministic hashes; ${output.size} outputs; ${Math.round(performance.now() - started)} ms`);

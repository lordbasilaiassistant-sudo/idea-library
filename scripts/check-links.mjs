#!/usr/bin/env node
/**
 * check-links.mjs — every external URL in the library still resolves.
 *
 * Link rot silently turns a cited claim into an unverifiable one, which is the whole
 * thing this library is trying not to be. Run weekly by the Verifier role; advisory
 * on PRs (a third party's outage is not a contributor's fault).
 */

import { loadIdeas } from './lib/ideas.mjs';

const ideas = loadIdeas().filter((i) => !i._error);
const targets = [];

for (const i of ideas) {
  for (const [k, v] of Object.entries(i.links ?? {})) {
    if (typeof v === 'string' && v.startsWith('https://')) targets.push({ url: v, where: `${i.id}.links.${k}` });
  }
  const body = i._body ?? '';
  for (const m of body.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)) {
    targets.push({ url: m[1], where: `${i.id} body` });
  }
}

if (targets.length === 0) {
  console.log('links: no external links to check');
  process.exit(0);
}

const seen = new Map();
const dead = [];

async function probe(url) {
  if (seen.has(url)) return seen.get(url);
  const p = (async () => {
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await fetch(url, {
          method,
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
          headers: { 'user-agent': 'idea-library link checker (+https://ideas.broke2builtai.com)' },
        });
        if (res.status < 400) return { ok: true, status: res.status };
        if (method === 'GET') return { ok: false, status: res.status };
      } catch (e) {
        if (method === 'GET') return { ok: false, status: e.name === 'TimeoutError' ? 'timeout' : String(e.message).slice(0, 60) };
      }
    }
    return { ok: false, status: 'unknown' };
  })();
  seen.set(url, p);
  return p;
}

const results = await Promise.all(targets.map(async (t) => ({ ...t, ...(await probe(t.url)) })));
for (const r of results) if (!r.ok) dead.push(r);

console.log(`links: checked ${seen.size} unique URL(s) across ${targets.length} reference(s)`);

if (dead.length) {
  console.log(`\nlinks: ${dead.length} dead:\n`);
  for (const d of dead) console.log(`  ✖ ${d.status}  ${d.url}\n       referenced by ${d.where}`);
  console.log('\nA cited source that no longer resolves makes the claim unverifiable.');
  console.log('Either point at an archived copy, or move the material into evidence/ and cite that.');
  process.exit(1);
}
console.log('links: all resolve');

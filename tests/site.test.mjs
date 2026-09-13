import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, readFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
test('production site handles page two, safe metadata, evidence, sitemap and withdrawal', t => {
  const dir = mkdtempSync(join(tmpdir(), 'idea-site-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const name of ['scripts', 'data', 'site', 'docs']) cpSync(join(root, name), join(dir, name), {
    recursive: true,
    filter: path => !['denylist.local.json', 'dist'].includes(basename(path)),
  });
  for (const name of ['AGENTS.md', 'CONTRIBUTING.md', 'README.md']) cpSync(join(root, name), join(dir, name));
  const config = JSON.parse(readFileSync(join(dir, 'data/site.json'), 'utf8'));
  config.site = 'https://example.org';
  writeFileSync(join(dir, 'data/site.json'), JSON.stringify(config));
  const tax = JSON.parse(readFileSync(join(dir, 'data/taxonomy.json'), 'utf8'));
  const category = tax.categories[0].id;
  const tags = ['domain', 'mechanic', 'stage'].map(axis => tax.tags[axis][0].id);
  const dangerousTitle = 'Can metadata contain </script><script>injected()</script>?';
  const ideaDir = id => join(dir, 'ideas', category, id);
  for (let n = 0; n < 101; n++) {
    const id = `fixture-${String(n).padStart(3, '0')}`;
    mkdirSync(join(ideaDir(id), 'evidence'), { recursive: true });
    const fields = {
      id, title: n === 0 ? dangerousTitle : `Synthetic question ${n}`,
      description: 'Synthetic fixture checks the published catalog across a page boundary without publishing experimental records.',
      category, outcome: n === 100 ? 'parked' : 'shipped', confidence: 'medium', effort: 'hours',
      verdict: 'The fixture exercises real output generation at a catalog page boundary.',
      source: 'community', tags, lessons: ['Synthetic examples exercise a boundary without making production claims.'],
      evidence: ['evidence/observation.txt'], projects: n === 100 ? ['withdrawn-project'] : [],
      reviewed: '2026-09-13', cost_usd: null, revenue_usd: null,
    };
    const yaml = Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
    const body = ['What we tried', 'Why we thought it would work', 'What actually happened',
      'Why it worked / why it failed', 'What you would need to change', 'What to reuse']
      .map(heading => `## ${heading}\n\nSynthetic observation for testing the public renderer.\n`).join('\n');
    writeFileSync(join(ideaDir(id), 'idea.md'), `---\n${yaml}\n---\n\n${body}`);
    writeFileSync(join(ideaDir(id), 'evidence/observation.txt'), 'Synthetic observation, not a payment or production claim.');
  }
  mkdirSync(join(dir, '_inbox'));
  const privateMarker = 'PRIVATE-INVENTORY-MUST-NOT-SHIP';
  writeFileSync(join(dir, '_inbox/inventory.json'), JSON.stringify({ privateMarker, source: dir }));
  const run = () => {
    for (const script of ['build', 'site']) {
      const result = spawnSync(process.execPath, [join(dir, 'scripts', `${script}.mjs`)], { cwd: dir, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stdout + result.stderr);
    }
  };
  run();
  const out = join(dir, 'site/dist');
  for (const file of ['docs/ORGANIZATION.md', 'docs/EVIDENCE.md']) assert(existsSync(join(out, file)), `missing contribution guidance ${file}`);
  const html = path => readFileSync(join(out, path, 'index.html'), 'utf8');
  const home = html('');
  assert.equal([...home.matchAll(/class="experiment"/g)].length, 12, 'initial catalog stays bounded');
  assert(!home.includes('<script>injected()'), 'home escapes repository text');
  assert(!home.includes('{{'), 'all homepage template slots populated');
  const searchManifest = () => JSON.parse(readFileSync(join(out, 'explore.json'), 'utf8'));
  const searchBefore = searchManifest();
  assert.equal(searchBefore.count, 101);
  assert.equal(searchBefore.pages.length, 2);
  const searchRecords = searchBefore.pages.flatMap(p => JSON.parse(readFileSync(join(out,p.path), 'utf8')));
  assert.equal(searchRecords.length, 101);
  assert(searchBefore.pages.every(p => p.count <= 100));
  assert.equal(searchRecords.find(i=>i.id==='fixture-000').title,dangerousTitle);
  assert(searchRecords.every(i=>!('_body' in i)&&!('dir' in i)), 'search ships only explicit public fields');
  for (const base of ['browse', `ideas/${category}`]) {
    assert(html(base).includes(`href="/${base}/page/2/">Next</a>`));
    const second = html(`${base}/page/2`);
    assert(second.includes(`<link rel="canonical" href="${config.site}/${base}/page/2/">`));
    assert(second.includes(`href="/${base}/">Previous</a>`));
    assert(second.includes('Page 2 of 2'));
    assert.equal([...second.matchAll(/<li><a href="\/ideas\//g)].length, 1);
  }
  const first = html(`ideas/${category}/fixture-000`);
  const ld = first.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(ld, 'structured metadata exists');
  assert.equal(JSON.parse(ld[1]).headline, dangerousTitle);
  assert(ld[1].includes('\\u003c/script>'));
  assert(!first.includes('<script>injected()'));
  assert(first.includes(`${config.repo}/blob/main/ideas/${category}/fixture-000/evidence/observation.txt`));
  const locations = [...readFileSync(join(out, 'sitemap.xml'), 'utf8').matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(locations).size, locations.length);
  assert.equal(locations.length, 108);
  for (const location of locations) assert(existsSync(join(out, new URL(location).pathname, 'index.html')), `missing sitemap target ${location}`);
  const inspect = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const file = join(path, entry.name);
      if (entry.isDirectory()) inspect(file);
      else {
        const text = readFileSync(file, 'utf8');
        assert(!text.includes(privateMarker), 'private inventory escaped');
        assert(!text.includes(dir) && !text.includes(dir.replaceAll('\\', '/')), 'private fixture path escaped');
      }
    }
  };
  inspect(out);
  const withdrawnFiles = ['catalog/pages/00002.json', 'catalog/project/withdrawn-project/00001.json',
    'catalog/outcome/parked/00001.json', 'catalog/ideas/fixture-100.json'];
  for (const file of withdrawnFiles) assert(existsSync(join(dir, file)));
  rmSync(ideaDir('fixture-100'), { recursive: true, force: true });
  run();
  assert.equal(searchManifest().count,100,'withdrawals update homepage search');
  for(const p of searchBefore.pages)assert(!existsSync(join(out,p.path)),'old search shards removed');
  assert(!readFileSync(join(out,'index.html'),'utf8').includes('101 experiments'),'homepage count follows source');
  for (const file of withdrawnFiles) {
    assert(!existsSync(join(dir, file)), `stale source catalog ${file}`);
    assert(!existsSync(join(out, file)), `stale deployed catalog ${file}`);
  }
  for (const path of ['browse/page/2', `ideas/${category}/page/2`, `ideas/${category}/fixture-100`]) {
    assert(!existsSync(join(out, path, 'index.html')), `stale HTML ${path}`);
  }
});

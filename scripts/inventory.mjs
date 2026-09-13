/** Private source inventory. Metadata only; no verdicts or automatic publication. */
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync, openSync, closeSync, unlinkSync, renameSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, loadIdeas } from './lib/ideas.mjs';

const args = {};
for (let n = 2; n < process.argv.length; n++) {
  const key = process.argv[n];
  if (!key.startsWith('--')) throw new Error('Use named arguments; see --help');
  args[key.slice(2)] = process.argv[n + 1] && !process.argv[n + 1].startsWith('--') ? process.argv[++n] : true;
}
if (args.help) {
  console.log(`Metadata discovery (private, resumable; never publishes):
  npm run inventory -- --github <public-owner>
  npm run inventory -- --local <directory> [--depth 3]
  npm run inventory -- --registry <registry.md>
  npm run inventory -- --actors <actor-metadata.json>
  npm run inventory -- --list [--state discovered] [--limit 20]
  npm run inventory -- --decide <candidate-id> --state <state> --reason "why" [--ideas id,id] [--owner role]
  npm run inventory -- --report
States: discovered, reviewing, drafted, published, duplicate, excluded, blocked.
Actor input: array or {data:{items:[...]}} with id, name, username only.
All metadata and decisions stay in ignored _inbox/inventory.json.`);
  process.exit(0);
}
const dir = join(ROOT, '_inbox');
mkdirSync(dir, { recursive: true });
const file = join(dir, 'inventory.json');
const lock = join(dir, 'inventory.lock');
let fd;
try { fd = openSync(lock, 'wx'); } catch { throw new Error('Inventory is locked; wait for its owner. Inspect an abandoned lock before removing it.'); }
try {
  const ledger = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { schema_version: 1, runs: [], candidates: [] };
  const now = new Date().toISOString();
  const byKey = new Map(ledger.candidates.map(c => [c.source_key, c]));
  const found = [];
  const failures = [];
  let scope = null;
  const keyHash = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
  const add = (source, sourceKey, name, locator) => found.push({ source, source_key: sourceKey, name, locator });
  const modes = ['github', 'local', 'registry', 'actors', 'decide', 'list', 'report'].filter(k => args[k]);
  if (modes.length !== 1) throw new Error('Choose one operation; see --help');
  if (args.github) {
    if (!/^[a-zA-Z0-9-]+$/.test(args.github)) throw new Error('Invalid GitHub owner');
    scope = `github:${args.github.toLowerCase()}`;
    for (let page = 1; ; page++) {
      const response = await fetch(`https://api.github.com/users/${args.github}/repos?type=owner&sort=full_name&per_page=100&page=${page}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'idea-library-inventory' }, signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) { failures.push(`GitHub page ${page}: HTTP ${response.status}`); break; }
      const repos = await response.json();
      for (const r of repos) if (!r.private) add('public-repos', `github:${r.id}`, r.full_name, r.html_url);
      if (repos.length < 100) break;
    }
  }
  if (args.local) {
    const root = realpathSync(resolve(args.local));
    const depth = Number(args.depth || 3);
    if (!Number.isInteger(depth) || depth < 1 || depth > 6) throw new Error('depth must be 1-6');
    scope = `local:${keyHash(root)}`;
    const skip = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build', '.venv', 'venv', '.cache', '_inbox']);
    function visit(path, level) {
      let children;
      try { children = readdirSync(path, { withFileTypes: true }); } catch { failures.push(`Unreadable directory: ${keyHash(path)}`); return; }
      const names = new Set(children.map(e => e.name));
      const marker = ['.git', 'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'wrangler.toml', 'requirements.txt'].some(n => names.has(n));
      if (level > 0 && (level === 1 || marker)) add('working-directories', `local:${keyHash(path)}`, basename(path), path);
      if (level >= depth) return;
      for (const e of children) if (e.isDirectory() && !e.isSymbolicLink() && !skip.has(e.name) && !e.name.startsWith('.')) visit(join(path, e.name), level + 1);
    }
    visit(root, 0);
  }
  if (args.registry) {
    const path = realpathSync(resolve(args.registry));
    scope = `registry:${keyHash(path)}`;
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(/^### (.+?)(?:\s*·\s*`[a-z]+`)?\s*$/gm)) {
      const name = m[1].trim();
      add('project-registry', `${scope}:${keyHash(name.toLowerCase())}`, name, path);
    }
  }
  if (args.actors) {
    scope = 'listings:apify';
    const raw = JSON.parse(readFileSync(resolve(args.actors), 'utf8'));
    const actors = Array.isArray(raw) ? raw : raw.data?.items;
    if (!Array.isArray(actors)) throw new Error('Expected an actor metadata array');
    for (const a of actors) {
      if (typeof a.id !== 'string' || typeof a.name !== 'string') throw new Error('Actor id and name required');
      add('listings', `apify:${a.id}`, a.name, typeof a.username === 'string' ? `https://apify.com/${encodeURIComponent(a.username)}/${encodeURIComponent(a.name)}` : null);
    }
  }
  let added = 0;
  for (const item of found) {
    const existing = byKey.get(item.source_key);
    if (existing) Object.assign(existing, item, { last_seen: now });
    else {
      const candidate = { id: `candidate-${keyHash(item.source_key)}`, ...item, first_seen: now, last_seen: now, state: 'discovered', owner: null, ideas: [], reason: null, history: [] };
      ledger.candidates.push(candidate); byKey.set(item.source_key, candidate); added++;
    }
  }
  if (scope) ledger.runs.push({ scope, at: now, status: failures.length ? 'partial' : 'complete', discovered: found.length, added, failures });
  if (args.decide) {
    const candidate = ledger.candidates.find(c => c.id === args.decide);
    if (!candidate) throw new Error('Unknown candidate');
    if (!['discovered', 'reviewing', 'drafted', 'published', 'duplicate', 'excluded', 'blocked'].includes(args.state)) throw new Error('Unknown state');
    if (typeof args.reason !== 'string' || !args.reason.trim()) throw new Error('A decision reason is required');
    const ids = typeof args.ideas === 'string' ? args.ideas.split(',') : candidate.ideas;
    const published = new Set(loadIdeas().map(i => i.id));
    if (ids.some(id => !published.has(id))) throw new Error('Linked idea does not exist');
    if (['published', 'duplicate'].includes(args.state) && !ids.length) throw new Error('This disposition requires existing idea IDs');
    if (args.state === 'reviewing' && !args.owner && !candidate.owner) throw new Error('Claim a review owner');
    candidate.history.push({ at: now, from: candidate.state, to: args.state, reason: args.reason, owner: args.owner || candidate.owner, ideas: ids });
    Object.assign(candidate, { state: args.state, reason: args.reason, owner: args.owner || candidate.owner, ideas: ids });
  }
  if (scope || args.decide) {
    const temp = file + '.tmp';
    writeFileSync(temp, JSON.stringify(ledger, null, 2) + '\n');
    renameSync(temp, file);
  }
  const counts = {};
  for (const c of ledger.candidates) counts[c.state] = (counts[c.state] || 0) + 1;
  if (args.list) {
    const limit = Number(args.limit || 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('limit must be 1-100');
    console.log(JSON.stringify(ledger.candidates.filter(c => !args.state || c.state === args.state).slice(0, limit).map(({ id, name, source, state, ideas, owner }) => ({ id, name, source, state, ideas, owner })), null, 2));
  } else console.log(JSON.stringify({ total_candidates: ledger.candidates.length, by_state: counts, last_run: ledger.runs.at(-1) || null }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { closeSync(fd); unlinkSync(lock); }

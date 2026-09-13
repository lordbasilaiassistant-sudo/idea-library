#!/usr/bin/env node
/**
 * import.mjs — turn a private project-registry entry into a DRAFT idea.
 *
 *   node scripts/import.mjs --from <path-to-registry.md> --dig projects-md [--only <Name>] [--limit 10]
 *
 * Drafts land in _inbox/drafts/ — which is gitignored — and NEVER directly in ideas/.
 * That is the whole point: the private→public transition is the highest-risk operation
 * in this repo, so it goes through a staging area with a hard gate in the middle.
 *
 *   _inbox/drafts/<slug>/idea.md
 *        ↓  node scripts/scrub.mjs --inbox     # hard fail on any hit; nothing moves while red
 *        ↓  a human or a model writes the verdict and the lessons  ← cannot be automated
 *        ↓  node scripts/promote.mjs <slug> --category <cat>
 *   ideas/<category>/<slug>/
 *
 * What this script CAN do: extract structure, dedupe against index.json, guess a category,
 * and strip the obvious secrets-bearing fields.
 * What it deliberately does NOT do: write a verdict. A verdict is a public judgement about
 * why something worked or failed, and a regex has no business making one. Every draft it
 * produces is intentionally invalid until a person or a model fills that in.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadTaxonomy, loadIdeas, loadSources } from './lib/ideas.mjs';

const args = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const k = argv[i].slice(2);
    args.set(k, argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
  }
}

const from = args.get('from');
const dig = args.get('dig') || 'project-registry';
const limit = Number(args.get('limit') || 0);
const only = args.get('only');

if (!from) {
  console.error('usage: node scripts/import.mjs --from <registry.md> --dig <dig-id> [--only <Name>] [--limit N]');
  process.exit(1);
}

const tax = loadTaxonomy();
if (!loadSources().digs.some(d => d.id === dig)) throw new Error('Unknown source dig');
const existing = new Set(loadIdeas().map((i) => i.id));

// ---------------------------------------------------------------------------
// Fields in the private registry that must never survive the import. We drop the
// whole line rather than try to redact inside it — a partially redacted line is
// the shape that gets through.
// ---------------------------------------------------------------------------
const DROP_LINE = [
  /secrets?\s*:/i,
  /\.env\b/,
  /private[_ ]?key/i,
  /api[_ ]?key/i,
  /\bwallet\b/i,
  /0x[a-fA-F0-9]{20,}/,
  /deploy(ed)?\s*(to|via)?\s*:.*mainnet.*0x/i,
];

// Category guesses. Deliberately coarse — a wrong guess is cheap to fix, and the
// draft is reviewed anyway.
const CATEGORY_HINTS = [
  ['crypto-onchain', /\b(token|erc-?20|on-?chain|mainnet|contract|wallet|defi|liquidity|mev|chain|launchpad)\b/i],
  ['ai-agents', /\b(agent|autonomous|multi-agent|harness|persona)\b/i],
  ['ml-research', /\b(llm|model|training|fine-?tun|benchmark|eval|embedding|transformer)\b/i],
  ['security-audit', /\b(audit|exploit|vulnerab|scanner|spoof|security)\b/i],
  ['games', /\b(game|osrs|runelite|roblox|plugin|worldbox|dreambot)\b/i],
  ['content-media', /\b(video|blog|wordpress|publish|content|youtube|image)\b/i],
  ['web-saas', /\b(saas|web app|dashboard|landing|site|frontend|react)\b/i],
  ['automation-ops', /\b(cron|scheduled|scrape|automation|pipeline|worker|bot)\b/i],
  ['tooling-infra', /\b(cli|mcp|tool|sdk|deploy|infra|server|api)\b/i],
];

const STATUS_TO_OUTCOME = {
  shipped: 'shipped',
  active: 'active',
  paused: 'parked',
  experiment: 'inconclusive',
  archived: 'abandoned',
  unknown: 'inconclusive',
};

const src = readFileSync(from, 'utf8');

// Entries look like:  ### Name  · `status`
const entryRe = /^### (.+?)\s*(?:·\s*`([a-z]+)`)?\s*$/gm;
const matches = [...src.matchAll(entryRe)];

const drafts = [];
for (let i = 0; i < matches.length; i++) {
  const m = matches[i];
  const name = m[1].trim();
  const status = (m[2] || 'unknown').trim();
  const bodyRaw = src.slice(m.index + m[0].length, i + 1 < matches.length ? matches[i + 1].index : undefined);

  if (only && !name.toLowerCase().includes(only.toLowerCase())) continue;

  const slug = slugify(name);
  if (existing.has(slug)) {
    drafts.push({ slug, name, skipped: 'already in the library — update it instead of re-importing' });
    continue;
  }

  const lines = bodyRaw.split('\n').map((l) => l.trim()).filter(Boolean)
    .filter((l) => !DROP_LINE.some((re) => re.test(l)));

  const summary = (lines.find((l) => l.startsWith('- ')) || '').replace(/^-\s*/, '').trim();
  const facts = lines.filter((l) => /^[-⚠]/.test(l)).map((l) => l.replace(/^[-⚠]\s*/, '').trim());
  const frictions = bodyRaw.split('\n').filter((l) => l.includes('⚠')).map((l) => l.replace(/^.*⚠\s*/, '').trim())
    .filter((l) => !DROP_LINE.some((re) => re.test(l)));

  drafts.push({
    slug, name, status, summary,
    category: guessCategory(name + ' ' + bodyRaw),
    outcome: STATUS_TO_OUTCOME[status] || 'inconclusive',
    facts: facts.slice(0, 12),
    frictions: frictions.slice(0, 6),
  });

  if (limit && drafts.filter((d) => !d.skipped).length >= limit) break;
}

const outRoot = join(ROOT, '_inbox', 'drafts');
mkdirSync(outRoot, { recursive: true });

let written = 0, skipped = 0;
for (const d of drafts) {
  if (d.skipped) { skipped++; continue; }
  const dir = join(outRoot, d.slug);
  if (existsSync(join(dir, 'idea.md'))) { skipped++; continue; }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'idea.md'), renderDraft(d, dig), 'utf8');
  written++;
}

console.log(`import: ${written} draft(s) written to _inbox/drafts/, ${skipped} skipped`);
console.log('');
console.log('These drafts are INVALID on purpose — every one needs a verdict, lessons, and tags');
console.log('written by a person or a model. A regex cannot judge why something failed.');
console.log('');
console.log('Next:');
console.log('  1. node scripts/scrub.mjs --inbox      # hard gate. nothing moves while this is red.');
console.log('  2. Fill in verdict / lessons / tags / what_would_settle_it.');
console.log('  3. node scripts/promote.mjs <slug> --category <category>');

// ---------------------------------------------------------------------------

function slugify(s) {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function guessCategory(text) {
  for (const [cat, re] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return 'experiments';
}

function yamlBlock(key, value) {
  if (!value) return `${key}: `;
  return `${key}: >-\n  ${String(value).replace(/\s+/g, ' ').trim()}`;
}

function renderDraft(d, dig) {
  return `---
id: ${d.slug}
title: TODO — rewrite as the question a searcher would type, not the internal codename "${d.name}"
${yamlBlock('description', 'TODO — 80-200 chars: what it was and how it ended.')}
category: ${d.category}
outcome: ${d.outcome}
${yamlBlock('verdict', 'TODO — one sentence naming the CAUSE. This is the whole point of the entry.')}
${d.outcome === 'inconclusive' ? yamlBlock('what_would_settle_it', 'TODO — the measurement that would decide it.') + '\n' : ''}confidence: low
effort: days
cost_usd: null
revenue_usd: null
stack: []
tags: []
lessons: []
source: ${dig}
links: {}
evidence: []
---

<!--
IMPORT NOTES — delete this block before promoting.

Imported from the private registry as \`${d.name}\` with status \`${d.status}\`.
Everything below is raw extracted material, not publishable prose. Secrets-bearing
lines were dropped at import; that is not a substitute for reading what remains.

Original summary:
  ${d.summary || '(none found)'}

Recorded facts:
${d.facts.length ? d.facts.map((f) => `  - ${f}`).join('\n') : '  (none)'}

Recorded frictions (these are usually the lessons):
${d.frictions.length ? d.frictions.map((f) => `  - ${f}`).join('\n') : '  (none)'}

TODO before promoting:
  [ ] verdict names a cause, not a symptom
  [ ] tags: >=1 domain, >=1 MECHANIC, exactly 1 stage
  [ ] lessons name their own subject and survive being quoted alone
  [ ] every number measured or null
  [ ] no internal codenames, no private business detail, no identifying information
  [ ] this comment block deleted
-->

## What we tried

TODO

## Why we thought it would work

TODO

## What actually happened

TODO

## Why it worked / why it failed

TODO

## What you would need to change

TODO

## What to reuse

TODO
`;
}

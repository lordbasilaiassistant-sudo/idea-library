#!/usr/bin/env node
/**
 * scoreboard.mjs — score every idea, explainably and reproducibly.
 *
 *   node scripts/scoreboard.mjs [--votes data/votes.jsonl]
 *
 * Two rules govern this file:
 *
 * 1. EVERY SCORE IS EXPLAINABLE. No entry gets a mystery number. Each one ships
 *    its component breakdown, so a reader can disagree with a specific part rather
 *    than with the total.
 *
 * 2. THE BOARD IS RECOMPUTABLE. Scores are a pure function of index.json plus the
 *    append-only vote log. Delete data/scoreboard.json, run this, and get a
 *    byte-identical file back. That is what makes a discovered vote-fraud attack
 *    reversible: we recompute with the bad rows excluded rather than guess at a
 *    correction. If we cannot reproduce the board, it is not a board.
 *
 * REALITY OUTRANKS OPINION. An idea that actually shipped or earned beats one that
 * merely scored well, always. A board that rewards a beautiful idea that lost is
 * worse than no board.
 */

import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadIdeas, loadTaxonomy, readJSON, GENERATED_BANNER } from './lib/ideas.mjs';

const args = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args.set(argv[i].slice(2), argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
}

const tax = loadTaxonomy();
const site = readJSON('data/site.json');
const ideas = loadIdeas().filter((i) => !i._error);

// ---------------------------------------------------------------------------
// Component 1 — REALITY. What actually happened, which dominates everything else.
// ---------------------------------------------------------------------------
const REALITY = {
  revenue: 40,       // somebody who is not us paid
  shipped: 28,       // real, reachable, used
  partial: 18,       // the mechanic worked; something specific capped it
  active: 12,        // running, no verdict yet
  inconclusive: 10,  // honest uncertainty, with a stated test — respected, not punished
  parked: 6,
  failed: 6,         // a known cause is worth more than an untested idea
  abandoned: 3,
};

// ---------------------------------------------------------------------------
// Component 2 — EVIDENCE. Can a stranger check this?
// ---------------------------------------------------------------------------
const CONFIDENCE = { high: 12, medium: 7, low: 3 };

function evidenceScore(i) {
  let s = CONFIDENCE[i.confidence] ?? 0;
  const parts = [`confidence:${i.confidence} +${CONFIDENCE[i.confidence] ?? 0}`];

  const files = (i.evidence ?? []).length;
  if (files) { s += Math.min(8, files * 4); parts.push(`evidence files:${files} +${Math.min(8, files * 4)}`); }

  const measured = ['cost_usd', 'revenue_usd'].filter((k) => typeof i[k] === 'number').length;
  if (measured) { s += measured * 3; parts.push(`measured numbers:${measured} +${measured * 3}`); }

  if (Object.keys(i.links ?? {}).length) { s += 3; parts.push('public link +3'); }
  if ((i.reusable ?? []).length) { s += 4; parts.push(`reusable artifact +4`); }

  return { score: s, parts };
}

// ---------------------------------------------------------------------------
// Component 3 — TRANSFER. How much does this teach somebody who is not us?
// This is the whole product, so it is weighted like it.
// ---------------------------------------------------------------------------
function transferScore(i) {
  const parts = [];
  let s = 0;

  const lessons = (i.lessons ?? []).length;
  const l = Math.min(20, lessons * 4);
  s += l; parts.push(`lessons:${lessons} +${l}`);

  const mechanics = (i.tags ?? []).filter((t) => tax.tagDefs.get(t)?.axis === 'mechanic');
  const m = Math.min(8, mechanics.length * 4);
  s += m; parts.push(`mechanic tags:${mechanics.length} +${m}`);

  // An inconclusive entry that names its deciding measurement hands somebody a task.
  if (i.what_would_settle_it) { s += 6; parts.push('states what would settle it +6'); }

  // Cross-referenced ideas compound; isolated ones do not.
  const rel = (i.related ?? []).length;
  if (rel) { s += Math.min(4, rel * 2); parts.push(`related ideas:${rel} +${Math.min(4, rel * 2)}`); }

  return { score: s, parts };
}

// ---------------------------------------------------------------------------
// Component 4 — VOTES. Absent until the vote endpoint exists. Deliberately capped
// low: a popularity number must never outweigh what actually happened.
// ---------------------------------------------------------------------------
const votesFile = args.get('votes') || 'data/votes.jsonl';
const voteRows = [];
if (existsSync(join(ROOT, votesFile))) {
  for (const line of readFileSync(join(ROOT, votesFile), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { voteRows.push(JSON.parse(line)); } catch { /* a malformed row is dropped, never guessed at */ }
  }
}

const VOTE_CAP = 15;
const votesById = new Map();
let discarded = 0;
for (const v of voteRows) {
  if (!v || !v.idea || typeof v.weight !== 'number') { discarded++; continue; }
  if (v.discarded) { discarded++; continue; }
  votesById.set(v.idea, (votesById.get(v.idea) ?? 0) + v.weight);
}

function voteScore(id) {
  const raw = votesById.get(id) ?? 0;
  // Diminishing returns: the hundredth vote must be worth far less than the first,
  // so a successful flood buys almost nothing even before fraud controls apply.
  const s = raw <= 0 ? 0 : Math.min(VOTE_CAP, Math.round(Math.log2(raw + 1) * 3));
  return { score: s, raw, parts: raw ? [`votes:${raw} +${s} (log-scaled, cap ${VOTE_CAP})`] : [] };
}

// ---------------------------------------------------------------------------
// Component 5 — PENALTIES. Things that make an entry less trustworthy.
// ---------------------------------------------------------------------------
function penalties(i) {
  const parts = [];
  let s = 0;
  if (i.outcome !== 'active' && !i.verdict) { s -= 15; parts.push('no verdict -15'); }
  if (i.outcome === 'inconclusive' && !i.what_would_settle_it) { s -= 10; parts.push('inconclusive with no deciding test -10'); }
  if ((i._body ?? '').trim().length < 800) { s -= 4; parts.push('thin body -4'); }
  if (i.confidence === 'low' && (i.evidence ?? []).length === 0) { s -= 3; parts.push('low confidence, no evidence -3'); }
  return { score: s, parts };
}

// ---------------------------------------------------------------------------
const scored = ideas.map((i) => {
  const reality = REALITY[i.outcome] ?? 0;
  const ev = evidenceScore(i);
  const tr = transferScore(i);
  const vo = voteScore(i.id);
  const pen = penalties(i);
  const total = reality + ev.score + tr.score + vo.score + pen.score;

  return {
    id: i.id,
    title: i.title,
    category: i.category,
    outcome: i.outcome,
    total,
    components: {
      reality: { score: reality, parts: [`outcome:${i.outcome} +${reality}`] },
      evidence: ev,
      transfer: tr,
      votes: vo,
      penalties: pen,
    },
  };
});

scored.sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
scored.forEach((s, n) => { s.rank = n + 1; });

const board = {
  generated_note: 'GENERATED by scripts/scoreboard.mjs. Recomputable from index.json + the vote log.',
  repo: site.repo,
  method: {
    reality: 'What actually happened. Dominates every other component — a board that rewards a beautiful idea that lost is worse than no board.',
    evidence: 'Whether a stranger can check the claim: confidence, evidence files, measured numbers, public links, reusable artifacts.',
    transfer: 'How much it teaches somebody who is not us: quotable lessons, mechanic tags, a stated deciding test, cross-references.',
    votes: 'Public votes, log-scaled and hard-capped, so popularity can never outweigh what happened.',
    penalties: 'Missing verdict, missing deciding test, thin body, unevidenced low confidence.',
  },
  vote_audit: {
    rows_read: voteRows.length,
    rows_counted: voteRows.length - discarded,
    rows_discarded: discarded,
    note: 'Discarded rows stay in the append-only log. Scores are recomputed from the log rather than corrected in place, which is what makes a discovered attack reversible.',
  },
  ideas: scored,
};

writeFileSync(join(ROOT, 'data/scoreboard.json'), JSON.stringify(board, null, 2) + '\n', 'utf8');

// ---------------------------------------------------------------------------
const esc = (s) => String(s).replace(/\|/g, '\\|');
const md = [
  GENERATED_BANNER, '',
  '# Scoreboard',
  '',
  'Every idea, ranked. **Every score is explainable** — each row shows its component breakdown,',
  'so you can disagree with a specific part rather than with a number.',
  '',
  '**Reality outranks opinion.** What actually happened dominates; votes are log-scaled and',
  `capped at ${VOTE_CAP} points so popularity can never outweigh an outcome.`,
  '',
  '| # | Idea | Outcome | Total | Reality | Evidence | Transfer | Votes | Penalties |',
  '|---|---|---|---|---|---|---|---|---|',
  ...scored.map((s) =>
    `| ${s.rank} | [${esc(s.title)}](${site.repo}/tree/main/ideas/${s.category}/${s.id}) | \`${s.outcome}\` | **${s.total}** | ${s.components.reality.score} | ${s.components.evidence.score} | ${s.components.transfer.score} | ${s.components.votes.score} | ${s.components.penalties.score} |`),
  '',
  '## How to move up this board',
  '',
  'Not by writing more. By making an entry more checkable and more useful to somebody else:',
  '',
  '- **Add evidence.** A log, a transaction hash, a captured response. Raises `evidence`, and',
  '  lets `confidence` go to `high` honestly.',
  '- **Measure a number you left as `null`** — but only by measuring it.',
  '- **Write a lesson that survives being quoted alone.** Raises `transfer`, which is the',
  '  heaviest non-reality component because teaching somebody else is the whole product.',
  '- **Settle an open question.** Moves an idea off `inconclusive` and onto a real outcome.',
  '- **Ship a `reusable` artifact** somebody can lift today.',
  '',
  '## Vote audit',
  '',
  `Rows read: ${board.vote_audit.rows_read} · counted: ${board.vote_audit.rows_counted} · discarded: ${board.vote_audit.rows_discarded}`,
  '',
  voteRows.length === 0
    ? '_No votes yet — the vote endpoint is not live. Scores are currently reality, evidence and transfer only._'
    : 'Discarded rows remain in the append-only log; the board is recomputed from the log rather than corrected in place.',
  '',
].join('\n');

writeFileSync(join(ROOT, 'SCOREBOARD.md'), md, 'utf8');

console.log(`scoreboard: ranked ${scored.length} ideas · top: ${scored[0]?.id} (${scored[0]?.total})`);
console.log(`scoreboard: votes read ${voteRows.length}, discarded ${discarded}`);

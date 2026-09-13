#!/usr/bin/env node
/**
 * validate.mjs — schema + vocabulary + quality checks on every idea.md.
 *
 * Structural rules are checked here and documented in AGENTS.md. Evidence truth,
 * licensing permission, and reviewer independence still require review. Diagnostics
 * identify the file, the broken rule, and how to fix it.
 */

import { ROOT, loadIdeas, loadTaxonomy, loadSources, readJSON } from './lib/ideas.mjs';
import { validateProjects } from './lib/projects.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const tax = loadTaxonomy();
const sources = loadSources();
const sourceIds = new Set(sources.digs.map((d) => d.id));
const ideas = loadIdeas();
const ideaIds = new Set(ideas.map(i => i.id));

const errors = [];
const warnings = [];

const err = (where, msg, fix) => errors.push({ where, msg, fix });
const warn = (where, msg, fix) => warnings.push({ where, msg, fix });

const REQUIRED = [
  'id', 'title', 'description', 'category', 'outcome', 'verdict',
  'confidence', 'effort', 'tags', 'lessons', 'source',
];

const NO_VERDICT_OUTCOMES = new Set(['active']);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const projectRegistry = validateProjects(readJSON('data/projects.json'));
for (const message of projectRegistry.errors) err('data/projects.json', message, 'Use public identities only; see docs/ORGANIZATION.md.');

const BODY_SECTIONS = [
  'What we tried',
  'Why we thought it would work',
  'What actually happened',
  'Why it worked / why it failed',
  'What you would need to change',
  'What to reuse',
];

const SHINY = [
  /\bup to\b/i,
  /\bas low as\b/i,
  /\bindustry[- ]standard\b/i,
  /\bbest[- ]in[- ]class\b/i,
  /\bworld[- ]class\b/i,
  /\bcutting[- ]edge\b/i,
  /\bgame[- ]chang/i,
  /\brevolutionary\b/i,
  /\bseamless(ly)?\b/i,
  /\beffortless(ly)?\b/i,
  /\bunlimited\b/i,
];

// Phrases that only exist in templates/idea.md. If one survives into an idea, the
// file was scaffolded and never filled in.
const PLACEHOLDERS = [
  /80-200 characters/i,
  /One sentence naming the cause/i,
  /Required only for `?outcome: inconclusive`?/i,
  /Name the subject in every lesson/i,
  /What was actually built or run\. Concrete:/i,
  /The reasoning at the time\. Write the honest version/i,
  /The measurement\. Numbers, error strings, dates/i,
  /The mechanism, not the symptom\./i,
  /The counterfactual\. What would make this work/i,
  /Point at files in `?code\/`?, and say what state/i,
];

const seenIds = new Map();

for (const [name, rows] of Object.entries({ categories: tax.raw.categories, outcomes: tax.raw.outcomes,
  confidence: tax.raw.confidence, effort: tax.raw.effort, tags: Object.values(tax.raw.tags).filter(Array.isArray).flat(), sources: sources.digs })) {
  const ids = new Set();
  for (const row of rows) {
    if (!SLUG_RE.test(row.id) || ids.has(row.id)) err(`data/${name}`, `invalid or duplicate ID ${row.id}`, 'Use unique kebab-case IDs.');
    ids.add(row.id);
  }
}
for (const [alias, target] of Object.entries(tax.aliases)) {
  if (tax.tagDefs.has(alias) || !tax.tagDefs.has(target)) err('data/taxonomy.json', `invalid alias ${alias}`, 'Alias must resolve directly to a canonical tag and cannot shadow one.');
}

for (const idea of ideas) {
  const where = idea.file || idea.dir;

  if (idea._error) {
    err(where, idea._error, 'Fix the frontmatter. See templates/idea.md for a valid file.');
    continue;
  }

  // ---- required fields -----------------------------------------------------
  for (const key of REQUIRED) {
    if (key === 'verdict' && NO_VERDICT_OUTCOMES.has(idea.outcome)) continue;
    const v = idea[key];
    const empty = v === undefined || v === null || v === '' ||
      (Array.isArray(v) && v.length === 0);
    if (empty) err(where, `missing required field \`${key}\``, `Add \`${key}:\` to the frontmatter.`);
  }

  for (const key of ['title', 'description', 'category', 'outcome', 'confidence', 'effort', 'source']) {
    if (typeof idea[key] !== 'string') err(where, `${key} must be a string`, 'Use a text value.');
  }
  for (const key of ['tags', 'lessons', 'related', 'supersedes', 'evidence', 'reusable', 'projects', 'aliases', 'stack']) {
    if (key in idea && (!Array.isArray(idea[key]) || idea[key].some(v => typeof v !== 'string'))) {
      err(where, `${key} must be a list of strings`, 'Use a YAML list.');
      idea[key] = [];
    }
    if (Array.isArray(idea[key]) && new Set(idea[key]).size !== idea[key].length) err(where, `${key} has duplicates`, 'Remove repeated values.');
  }
  for (const project of idea.projects || []) {
    if (!SLUG_RE.test(project)) err(where, 'projects must contain public kebab-case IDs', 'Use a stable public project identifier.');
    else if (!projectRegistry.ids.has(project)) err(where, `unknown project ${project}`, 'Register its public identity in data/projects.json, or use the existing canonical ID.');
  }
  if (idea.reviewed != null && (!/^\d{4}-\d{2}-\d{2}$/.test(idea.reviewed) || !Number.isFinite(Date.parse(idea.reviewed)) || new Date(idea.reviewed).toISOString().slice(0, 10) !== idea.reviewed)) {
    err(where, 'reviewed must be a real YYYY-MM-DD date or null', 'Use the actual review date, never a build timestamp.');
  }

  // ---- id / folder agreement ----------------------------------------------
  if (idea.id) {
    if (!SLUG_RE.test(idea.id)) {
      err(where, `id \`${idea.id}\` is not a kebab-case slug`, 'Use lowercase letters, digits and single hyphens.');
    }
    if (idea.id !== idea.slugDir) {
      err(where, `id \`${idea.id}\` does not match its folder name \`${idea.slugDir}\``,
        'The folder name IS the public URL. Rename one so they agree.');
    }
    if (seenIds.has(idea.id)) {
      err(where, `duplicate id \`${idea.id}\` (also in ${seenIds.get(idea.id)})`,
        'Ids are unique repo-wide. Merge the two ideas, or rename one and set `supersedes:`.');
    } else {
      seenIds.set(idea.id, where);
    }
  }

  // ---- enums ---------------------------------------------------------------
  if (idea.category) {
    if (!tax.categoryIds.has(idea.category)) {
      err(where, `unknown category \`${idea.category}\``,
        `Use one of: ${[...tax.categoryIds].join(', ')} — or add yours to data/taxonomy.json in this PR.`);
    } else if (idea.category !== idea.catDir) {
      err(where, `category \`${idea.category}\` does not match its folder \`ideas/${idea.catDir}/\``,
        'Move the folder, or fix the field.');
    }
  }
  if (idea.outcome && !tax.outcomes.has(idea.outcome)) {
    err(where, `unknown outcome \`${idea.outcome}\``, `Use one of: ${[...tax.outcomes].join(', ')}`);
  }
  if (idea.effort && !tax.effort.has(idea.effort)) {
    err(where, `unknown effort \`${idea.effort}\``, `Use one of: ${[...tax.effort].join(', ')}`);
  }
  if (idea.confidence && !tax.confidence.has(idea.confidence)) {
    err(where, `unknown confidence \`${idea.confidence}\``, `Use one of: ${[...tax.confidence].join(', ')}`);
  }
  if (idea.source && !sourceIds.has(idea.source)) {
    err(where, `unknown source dig \`${idea.source}\``,
      `Use one of: ${[...sourceIds].join(', ')} — or register the dig in data/sources.json.`);
  }

  // ---- description (SEO: it becomes the meta description) ------------------
  if (typeof idea.description === 'string') {
    const n = idea.description.length;
    if (n < 80 || n > 200) {
      err(where, `description is ${n} chars; needs 80-200`,
        'It becomes the search snippet and the JSON-LD abstract. Say what it is and how it ended.');
    }
  }

  // ---- verdict -------------------------------------------------------------
  if (idea.outcome && !NO_VERDICT_OUTCOMES.has(idea.outcome)) {
    if (!idea.verdict) {
      err(where, `outcome \`${idea.outcome}\` requires a verdict`,
        'An outcome with no reason is not a contribution. One sentence: why did it land there?');
    } else if (idea.verdict.length < 40) {
      err(where, 'verdict is too short to carry a reason', 'One full sentence naming the cause.');
    }
  }
  // `high` is DEFINED in taxonomy.json as "we measured it; there is evidence in the folder".
  // An audit found every entry claiming high with an empty evidence list, so the
  // definition is now enforced rather than trusted.
  if (idea.confidence === 'high' && !(Array.isArray(idea.evidence) && idea.evidence.length)) {
    err(where, '`confidence: high` with no evidence files',
      'high means there is evidence in the folder. Add files under evidence/ and list them, or use medium.');
  }
  if (idea.outcome === 'inconclusive' && !idea.what_would_settle_it) {
    err(where, '`inconclusive` requires `what_would_settle_it:`',
      'Name the measurement that would decide it. That turns our ignorance into a public task.');
  }

  // ---- tags ----------------------------------------------------------------
  if (Array.isArray(idea.tags)) {
    const axes = new Set();
    for (const t of idea.tags) {
      if (tax.aliases[t]) {
        err(where, `tag \`${t}\` is an alias`, `Use \`${tax.aliases[t]}\` instead.`);
        continue;
      }
      const def = tax.tagDefs.get(t);
      if (!def) {
        err(where, `unknown tag \`${t}\``, suggest(t));
        continue;
      }
      axes.add(def.axis);
    }
    for (const axis of ['domain', 'mechanic', 'stage']) {
      if (!axes.has(axis)) {
        err(where, `no \`${axis}\` tag`,
          axis === 'mechanic'
            ? 'The mechanic tag is the point of this library — what made it work or fail?'
            : `Add at least one ${axis} tag from data/taxonomy.json.`);
      }
    }
    const stages = idea.tags.filter((t) => tax.tagDefs.get(t)?.axis === 'stage');
    if (stages.length > 1) err(where, `${stages.length} stage tags (${stages.join(', ')})`, 'Exactly one stage tag.');
  }

  // ---- lessons: the payload. Each must survive being quoted alone. ---------
  if (Array.isArray(idea.lessons)) {
    idea.lessons.forEach((l, i) => {
      const s = String(l);
      if (s.length < 25) {
        err(where, `lesson ${i + 1} is too short to be useful`, 'Write it as a standalone, quotable claim.');
      }
      if (/^(it|this|they|that|we did|there)\b/i.test(s.trim())) {
        err(where, `lesson ${i + 1} opens with a pronoun: "${s.slice(0, 40)}…"`,
          'Answer engines lift lessons out of context. Name the subject: "The deploy endpoint returns 403 when the key header is capitalised…", not "It…".');
      }
      if (!/[.!?]$/.test(s.trim())) {
        warn(where, `lesson ${i + 1} does not end in punctuation`, 'Write lessons as full sentences.');
      }
    });
  }

  // ---- numbers are measured, or null. Never prose. ------------------------
  for (const key of ['cost_usd', 'revenue_usd']) {
    if (key in idea && idea[key] !== null && typeof idea[key] !== 'number') {
      err(where, `${key} must be a number or null, got ${JSON.stringify(idea[key])}`,
        'If you did not measure it, write `null`. A remembered number is a hypothesis, not a measurement.');
    }
  }
  if (idea.outcome === 'revenue' && !(typeof idea.revenue_usd === 'number' && idea.revenue_usd > 0)) {
    err(where, '`outcome: revenue` with no measured revenue_usd > 0',
      'Revenue means a verified, source-checked payment. Choose the non-revenue outcome supported by evidence; shipped also requires deployment and usage.');
  }
  if (idea.outcome === 'revenue' && !idea.evidence?.length) err(where, 'revenue requires evidence files', 'Attach a sanitized, dated payment observation with period and payer exclusions.');
  for (const key of ['cost_usd', 'revenue_usd']) if (typeof idea[key] === 'number' && (!Number.isFinite(idea[key]) || idea[key] < 0)) err(where, `${key} must be finite and nonnegative`, 'Use null for unmeasured amounts.');

  // ---- dates ---------------------------------------------------------------
  for (const key of ['started', 'ended']) {
    if (idea[key] != null && !/^\d{4}(-\d{2}){0,2}$/.test(String(idea[key]))) {
      err(where, `${key} must be YYYY, YYYY-MM or YYYY-MM-DD`, 'Absolute dates only — never "last month".');
    }
  }

  // ---- cross-references ----------------------------------------------------
  for (const key of ['related', 'supersedes']) {
    if (Array.isArray(idea[key])) {
      for (const ref of idea[key]) {
        if (!ideaIds.has(ref)) {
          err(where, `${key} points at unknown idea id \`${ref}\``, 'Reference an id that exists, or drop it.');
        }
        if (ref === idea.id) err(where, `${key} references itself`, 'Remove it.');
      }
    }
  }

  // ---- declared files must exist ------------------------------------------
  for (const key of ['reusable', 'evidence']) {
    if (Array.isArray(idea[key])) {
      for (const p of idea[key]) {
        const bucket = String(p).split('/')[0];
        const restPath = String(p).slice(bucket.length + 1);
        const list = idea.assets?.[bucket];
        if (bucket !== (key === 'evidence' ? 'evidence' : 'code')) err(where, `${key} must point inside its own folder`, 'Use evidence/ for observations and code/ for reusable code.');
        if (!list || !list.includes(restPath)) {
          err(where, `${key} lists \`${p}\` but that file is not in the idea folder`,
            'Commit the file, or remove the reference. A dangling citation is worse than none.');
        }
        else if (!readFileSync(join(ROOT, idea.dir, p)).length) err(where, `${key} file is empty`, 'Attach the actual observation or artifact.');
      }
    }
  }

  // ---- links are public URLs only -----------------------------------------
  if (idea.links && typeof idea.links === 'object') {
    for (const [k, v] of Object.entries(idea.links)) {
      let valid = false;
      try { const url = new URL(v); valid = typeof v === 'string' && url.protocol === 'https:' && !url.username && !url.password; } catch { /* invalid URL */ }
      if (!valid) {
        err(where, `links.${k} must be an https:// URL`, 'Public URLs only — no local paths, no http.');
      }
    }
  }

  // ---- body structure (retrieval chunks arrive pre-labelled) --------------
  const body = idea._body || '';
  if (/\bTODO\b|IMPORT NOTES/.test(body)) err(where, 'unfinished draft or private import notes remain', 'Finish the entry and remove private staging notes before publication.');
  const headings = [...body.replace(/```[^\n]*\n[\s\S]*?```/g, '').matchAll(/^## (.+)\s*$/gm)].map(m => m[1].trim());
  for (const [n, section] of BODY_SECTIONS.entries()) {
    if (headings[n] !== section) {
      err(where, `body is missing the \`## ${section}\` section`,
        'The fixed sections make every page comparable and make retrieved chunks self-labelling. Copy templates/idea.md.');
    }
  }
  if (headings.length !== BODY_SECTIONS.length) err(where, 'body must have exactly six level-two sections', 'Use level-three headings for subsections.');
  if (body.trim().length < 400) {
    warn(where, 'body is very short', 'The frontmatter is the data; the body is the story. Tell it.');
  }

  // ---- unfilled template ---------------------------------------------------
  // A scaffold that validates clean is a scaffold somebody will ship by accident.
  const whole = [idea.title, idea.description, idea.verdict, idea.what_would_settle_it,
    ...(idea.lessons || []), body].filter(Boolean).join('\n');
  for (const ph of PLACEHOLDERS) {
    if (ph.test(whole)) {
      err(where, `template placeholder text is still in the file: "${whole.match(ph)[0].slice(0, 50)}…"`,
        'Replace the scaffolding from templates/idea.md with your own content.');
      break;
    }
  }
  if (idea.id === 'my-idea-slug' || idea.title?.startsWith('A title that reads like')) {
    err(where, 'this is still the unmodified template', 'Fill it in.');
  }

  // ---- shiny words ---------------------------------------------------------
  const prose = [idea.title, idea.description, idea.verdict, ...(idea.lessons || []), body].join('\n');
  for (const re of SHINY) {
    const m = prose.match(re);
    if (m) {
      err(where, `unfalsifiable marketing phrase: "${m[0]}"`,
        'Literally-true-and-empty phrasing is banned here. Give the number instead.');
    }
  }
}

function suggest(tag) {
  const all = [...tax.tagDefs.keys()];
  const near = all.filter((t) => t.includes(tag) || tag.includes(t) || lev(t, tag) <= 2);
  return near.length
    ? `Did you mean ${near.slice(0, 3).map((t) => `\`${t}\``).join(' / ')}? Otherwise add it to data/taxonomy.json in this PR.`
    : 'Tags are a controlled vocabulary. Pick one from data/taxonomy.json, or add yours there in this PR with a definition.';
}

function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

// ---------------------------------------------------------------------------
console.log(`validate: ${ideas.length} idea(s)`);
for (const w of warnings) {
  console.log(`  WARN  ${w.where}\n        ${w.msg}\n        → ${w.fix}`);
}
if (errors.length === 0) {
  console.log(`validate: clean — 0 errors${warnings.length ? `, ${warnings.length} warning(s)` : ''}`);
  process.exit(0);
}
console.log(`\nvalidate: ${errors.length} error(s)\n`);
for (const e of errors) {
  console.log(`  ERROR ${e.where}`);
  console.log(`        ${e.msg}`);
  console.log(`        → ${e.fix}\n`);
}
process.exit(1);

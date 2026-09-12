#!/usr/bin/env node
/**
 * site.mjs — assemble the deployable site.
 *
 * The site is a pure CONSUMER of the repository's data. It never becomes a
 * second source of truth: the data files are copied in beside the static assets,
 * and every per-idea page is rendered from the same idea.md the repo holds.
 *
 * Per-idea pages exist because index.json's `url` field promises them. The first
 * version of this script shipped only the single-page app, which would have made
 * every canonical idea URL a 404 — the same class of error as inventing a domain
 * that did not exist. If a URL is generated, something must answer it.
 */

import { copyFileSync, mkdirSync, existsSync, readdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadIdeas, loadTaxonomy, readJSON } from './lib/ideas.mjs';

const OUT = join(ROOT, 'site', 'dist');
mkdirSync(OUT, { recursive: true });

const site = readJSON('data/site.json');
const SITE = site.site;
const HAS_SITE = typeof SITE === 'string' && SITE.startsWith('https://');
const BASE = HAS_SITE ? SITE : '';
const tax = loadTaxonomy();
const ideas = loadIdeas().filter((i) => !i._error);

/* ---------------------------------------------------------------- statics */
const staticFiles = readdirSync(join(ROOT, 'site')).filter((f) => /\.(html|css|js|svg|png|webp|woff2?)$/.test(f));
const dataFiles = ['index.json', 'llms.txt', 'llms-full.txt', 'sitemap.xml', 'robots.txt', 'feed.xml'];

for (const f of staticFiles) copyFileSync(join(ROOT, 'site', f), join(OUT, f));
for (const f of dataFiles) if (existsSync(join(ROOT, f))) copyFileSync(join(ROOT, f), join(OUT, f));
copyFileSync(join(ROOT, 'data', 'scoreboard.json'), join(OUT, 'scoreboard.json'));

/* ------------------------------------------------------- tiny md renderer */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}

/** Only the subset an idea body uses: h2, paragraphs, lists, fenced code. */
function markdown(md) {
  const out = [];
  const lines = md.split(/\r?\n/);
  let para = [], list = null, fence = null;

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`); list = null; } };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (fence !== null) {
      if (/^```/.test(line)) { out.push(`<pre><code>${esc(fence.join('\n'))}</code></pre>`); fence = null; }
      else fence.push(raw);
      continue;
    }
    if (/^```/.test(line)) { flushPara(); flushList(); fence = []; continue; }
    if (/^\s*<!--/.test(line)) continue;

    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) { flushPara(); flushList(); const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }

    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { flushPara(); (list ||= []).push(li[1]); continue; }

    if (line.trim() === '') { flushPara(); flushList(); continue; }
    para.push(line.trim());
  }
  flushPara(); flushList();
  return out.join('\n');
}

/* ------------------------------------------------------- per-idea pages */
const OUTCOME_COLOR = {
  revenue: '#e8c547', shipped: '#4a9d7f', partial: '#c98b3a', failed: '#d9544d',
  abandoned: '#6b7280', inconclusive: '#5b8dd9', active: '#7c9ed9', parked: '#8b7fa8',
};

function ideaPage(i) {
  const url = `${BASE}/ideas/${i.category}/${i.id}/`;
  const cat = tax.categoryMeta.get(i.category);
  const oc = tax.outcomeMeta.get(i.outcome);
  const color = OUTCOME_COLOR[i.outcome] || '#6b7280';

  // JSON-LD so an answer engine can attribute the claim rather than paraphrase it.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: i.title,
    abstract: i.description,
    articleSection: cat?.label ?? i.category,
    keywords: (i.tags ?? []).join(', '),
    datePublished: i.started ?? undefined,
    dateModified: i.ended ?? i.started ?? undefined,
    url,
    isPartOf: { '@type': 'Collection', name: 'idea-library', url: BASE || site.repo },
    author: { '@type': 'Organization', name: 'Broke to Built' },
    license: 'https://creativecommons.org/licenses/by/4.0/',
    about: (i.tags ?? []).map((t) => ({ '@type': 'Thing', name: t })),
  };

  const num = (v) => (typeof v === 'number' ? `$${v}` : '<em>not measured</em>');

  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(i.title)} — idea-library</title>
<meta name="description" content="${esc(i.description)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(i.title)}">
<meta property="og:description" content="${esc(i.description)}">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<link rel="icon" href="/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,900&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/idea.css">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="idea-page">
<div class="grain" aria-hidden="true"></div>

<header class="topbar">
  <a class="brand" href="/">
    <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    <span class="brand-text">idea<span>·</span>library</span>
  </a>
  <nav>
    <a href="/#catalog">Catalog</a>
    <a href="/#mechanics">Mechanics</a>
    <a class="ghost" href="${site.repo}/tree/main/ideas/${i.category}/${i.id}">Source ↗</a>
  </nav>
</header>

<article>
  <p class="crumb"><a href="/#catalog">${esc(cat?.label ?? i.category)}</a></p>
  <h1>${esc(i.title)}</h1>

  <p class="verdict-lead" style="--oc:${color}">
    <span class="oc-badge">${esc(i.outcome)}</span>
    ${esc(i.verdict || i.description)}
  </p>
  <p class="oc-def">${esc(oc?.definition ?? '')} <span>Our confidence in this verdict: <b>${esc(i.confidence)}</b>.</span></p>

  ${i.what_would_settle_it ? `<aside class="settle">
    <h2>What would settle it</h2>
    <p>${esc(i.what_would_settle_it)}</p>
    <p class="settle-cta">If you run this, <a href="${site.repo}/issues/new?template=settle-a-question.yml">tell us what you measured</a> — settling an open question is worth more here than a new idea.</p>
  </aside>` : ''}

  <dl class="facts">
    <div><dt>Effort</dt><dd>${esc(i.effort)}</dd></div>
    <div><dt>Ran</dt><dd>${esc(i.started ?? '—')}${i.ended && i.ended !== i.started ? ` → ${esc(i.ended)}` : ''}</dd></div>
    <div><dt>Cost</dt><dd>${num(i.cost_usd)}</dd></div>
    <div><dt>Revenue</dt><dd>${num(i.revenue_usd)}</dd></div>
  </dl>

  ${(i.lessons ?? []).length ? `<section class="lessons">
    <h2>Lessons</h2>
    <p class="lessons-note">Written to survive being quoted on their own.</p>
    <ol>${i.lessons.map((l, n) => `<li id="lesson-${n + 1}">${inline(l)} <a class="anchor" href="#lesson-${n + 1}" aria-label="Link to this lesson">#</a></li>`).join('')}</ol>
  </section>` : ''}

  <section class="body">${markdown(i._body || '')}</section>

  <section class="meta">
    <h2>Tags</h2>
    ${['mechanic', 'domain', 'stage'].map((axis) => {
      const ts = (i.tags ?? []).filter((t) => tax.tagDefs.get(t)?.axis === axis);
      if (!ts.length) return '';
      return `<p class="axis"><span class="axis-name">${axis}</span>${ts.map((t) => `<span class="tag" title="${esc(tax.tagDefs.get(t)?.definition ?? '')}">${esc(t)}</span>`).join('')}</p>`;
    }).join('')}
    ${(i.stack ?? []).length ? `<p class="axis"><span class="axis-name">stack</span>${i.stack.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</p>` : ''}
  </section>

  ${(i.related ?? []).length ? `<section class="related">
    <h2>Related</h2>
    <ul>${i.related.map((r) => {
      const o = ideas.find((x) => x.id === r);
      return o ? `<li><a href="/ideas/${o.category}/${o.id}/">${esc(o.title)}</a> <span class="tag">${esc(o.outcome)}</span></li>` : '';
    }).join('')}</ul>
  </section>` : ''}

  <footer class="idea-foot">
    <p><b>Think this verdict is wrong?</b> We are wrong about some of our own outcomes and would rather find out.
    <a href="${site.repo}/issues/new?template=correct-an-outcome.yml">Open a correction</a> — that is the reason this is public.</p>
    <p class="cite">Cite as: ${esc(site.attribution)}, ${esc(i.title)}, ${url} · prose CC-BY-4.0</p>
  </footer>
</article>
</body>
</html>
`;
}

let pages = 0;
for (const i of ideas) {
  const dir = join(OUT, 'ideas', i.category, i.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), ideaPage(i), 'utf8');
  pages++;
}

/* category index pages, because /ideas/<cat>/ is in the sitemap */
for (const cat of tax.categories) {
  const rows = ideas.filter((i) => i.category === cat.id);
  if (!rows.length) continue;
  const dir = join(OUT, 'ideas', cat.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), `<!doctype html>
<html lang="en" data-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cat.label)} — idea-library</title>
<meta name="description" content="${esc(cat.definition)}">
<link rel="canonical" href="${BASE}/ideas/${cat.id}/">
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/idea.css">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
</head><body class="idea-page">
<div class="grain" aria-hidden="true"></div>
<header class="topbar"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="brand-text">idea<span>·</span>library</span></a>
<nav><a href="/#catalog">Catalog</a><a class="ghost" href="${site.repo}">Repository ↗</a></nav></header>
<article>
<h1>${esc(cat.label)}</h1>
<p class="verdict-lead" style="--oc:#e8c547">${esc(cat.definition)}</p>
<section class="related"><h2>${rows.length} idea${rows.length === 1 ? '' : 's'}</h2><ul>
${rows.map((i) => `<li><a href="/ideas/${i.category}/${i.id}/">${esc(i.title)}</a> <span class="tag">${esc(i.outcome)}</span><br><span class="oc-def">${esc(i.verdict || i.description)}</span></li>`).join('')}
</ul></section>
</article></body></html>
`, 'utf8');
  pages++;
}

/* favicon as a real file so idea pages can reference it */
writeFileSync(join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="#0b0d10"/><rect x="5" y="6" width="22" height="3" fill="#e8c547"/><rect x="5" y="12" width="22" height="3" fill="#6b7280"/><rect x="5" y="18" width="22" height="3" fill="#d9544d"/><rect x="5" y="24" width="22" height="3" fill="#4a9d7f"/></svg>\n`,
  'utf8');

console.log(`site: assembled ${staticFiles.length + dataFiles.length + 2} root files and ${pages} generated pages into site/dist`);
if (!HAS_SITE) console.log('site: no canonical host configured (data/site.json) — internal links are root-relative.');

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { tallyVotes } from "./votes.mjs";

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const label = (s) => s.replaceAll("-", " ");
const path = (i) => `/ideas/${i.category}/${i.id}/`;
export function resultRow(i, n, tax) {
  return `<li class="experiment"><span class="experiment-number">${String(n + 1).padStart(2, "0")}</span><div><div class="record-meta"><span class="status ${esc(i.outcome)}">${esc(i.outcome)}</span><span>${esc(tax.categoryMeta.get(i.category)?.label || i.category)}</span><span>${esc(i.confidence)} confidence</span></div><h3><a href="${path(i)}">${esc(i.title)}</a></h3><p>${esc(i.verdict || i.description)}</p><div class="record-tags"><span>${i.lessons.length} lessons</span><span>${esc(i.effort)} of work</span></div></div><span class="record-arrow" aria-hidden="true">↗</span></li>`;
}
export function buildHome({ root, out, ideas, tax, site }) {
  const sorted = [...ideas].sort((a, b) =>
    a.title.localeCompare(b.title, "en"),
  );
  const scores = JSON.parse(
    readFileSync(join(root, "data/scoreboard.json"), "utf8"),
  ).ideas;
  const scoreMap = new Map(scores.map((i) => [i.id, i.total]));
  const ledger = JSON.parse(
    readFileSync(join(root, "data/ballots.json"), "utf8"),
  );
  const community = tallyVotes(
    ledger.records,
    readFileSync(join(root, "data/vote-public-key.pem"), "utf8"),
    new Set(ideas.map((i) => i.id)),
    ledger.as_of,
  );
  writeFileSync(join(out, "community.json"), JSON.stringify(community));
  const picked = scores
    .filter((s) => ideas.some((i) => i.id === s.id))
    .slice(0, 5);
  const communityPicks = Object.entries(community.counts)
    .filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([id, count]) => ({ ...ideas.find((i) => i.id === id), count }));
  writeFileSync(
    join(out, "featured.json"),
    JSON.stringify({
      library: picked.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        score: i.total,
      })),
      community: communityPicks.map((i) => ({
        id: i.id,
        title: i.title,
        category: i.category,
        count: i.count,
      })),
      as_of: community.as_of,
      valid_until: community.valid_until,
    }),
  );
  const counts = new Map(
    tax.categories.map((c) => [
      c.id,
      ideas.filter((i) => i.category === c.id).length,
    ]),
  );
  const mechanisms = [...tax.tagDefs]
    .filter(([id, t]) => t.axis === "mechanic")
    .map(([id, t]) => ({
      ...t,
      id,
      count: ideas.filter((i) => i.tags.includes(id)).length,
    }))
    .filter((t) => t.count)
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  // Small searchable records, 100 per file; never ship raw source or private intake.
  const records = sorted.map((i) => ({
    id: i.id,
    title: i.title,
    category: i.category,
    outcome: i.outcome,
    confidence: i.confidence,
    effort: i.effort,
    verdict: i.verdict || i.description,
    tags: i.tags,
    lessons: i.lessons,
    aliases: i.aliases || [],
    projects: i.projects || [],
    score: scoreMap.get(i.id) || 0,
  }));
  mkdirSync(join(out, "search"), { recursive: true });
  const pages = [];
  for (let start = 0; start < records.length; start += 100) {
    const body = JSON.stringify(records.slice(start, start + 100));
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 16);
    const file = `search/${String(start / 100 + 1).padStart(5, "0")}-${hash}.json`;
    writeFileSync(join(out, file), body);
    pages.push({ path: file, count: Math.min(100, records.length - start) });
  }
  writeFileSync(
    join(out, "explore.json"),
    JSON.stringify({
      count: ideas.length,
      pages,
      categories: Object.fromEntries(
        tax.categories.map((c) => [c.id, c.label]),
      ),
      mechanisms: Object.fromEntries(
        mechanisms.map((m) => [m.id, label(m.id)]),
      ),
    }),
  );
  const categories = [
    { id: "", label: "All experiments" },
    ...tax.categories.filter((c) => counts.get(c.id)),
  ]
    .map(
      (c) =>
        `<a data-category="${c.id}" href="${c.id ? `/ideas/${c.id}/` : "/browse/"}" aria-current="${!c.id}">${esc(c.label)}<span>${c.id ? counts.get(c.id) : ideas.length}</span></a>`,
    )
    .join("");
  const outcomes = [
    { id: "", label: "All" },
    ...tax.raw.outcomes
      .filter((o) => ideas.some((i) => i.outcome === o.id))
      .map((o) => ({ id: o.id, label: label(o.id) })),
  ]
    .map(
      (o) =>
        `<a data-outcome="${o.id}" href="/?outcome=${o.id}#catalog" aria-current="${!o.id}">${esc(o.label)}</a>`,
    )
    .join("");
  const questions = ideas.filter((i) => i.what_would_settle_it);
  // Deterministic, distinct categories and short original lessons. No invented endorsements.
  const noteIdeas = [];
  const seen = new Set();
  for (const i of [...sorted].sort(
    (a, b) => (a.lessons[0]?.length || 10000) - (b.lessons[0]?.length || 10000),
  )) {
    if (i.lessons.length && !seen.has(i.category)) {
      noteIdeas.push(i);
      seen.add(i.category);
    }
    if (noteIdeas.length === 2) break;
  }
  const tokens = {
    BASE: esc(site.site || ""),
    REPO: esc(site.repo),
    COUNT: ideas.length,
    LESSONS: ideas.reduce((n, i) => n + i.lessons.length, 0),
    FEATURED: picked[0]
      ? `<a id="featured-link" href="${path(picked[0])}">${esc(picked[0].title)} ↗</a>`
      : "No recorded experiments yet.",
    FEATURED_SCORE: picked[0] ? `${picked[0].total} calculated points` : "",
    CATEGORIES: categories,
    OUTCOMES: outcomes,
    RESULT_COUNT: `${Math.min(12, ideas.length)} of ${ideas.length} experiments`,
    RESULTS: sorted
      .slice(0, 12)
      .map((i, n) => resultRow(i, n, tax))
      .join(""),
    MECHANISMS_OPTIONS: mechanisms
      .map((m) => `<option value="${m.id}">${esc(label(m.id))}</option>`)
      .join(""),
    MECHANISMS: mechanisms
      .slice(0, 8)
      .map(
        (m) =>
          `<a href="/?mechanism=${m.id}#catalog" title="${esc(m.definition)}"><span>${esc(label(m.id))}</span><small>${m.count} ↗</small></a>`,
      )
      .join(""),
    NOTES: noteIdeas
      .map(
        (i) =>
          `<blockquote><p>“${esc(i.lessons[0])}”</p><footer><a href="${path(i)}#lesson-1">${esc(i.title)} ↗</a></footer></blockquote>`,
      )
      .join(""),
    OPEN_COUNT: questions.length,
    QUESTIONS:
      questions
        .slice(0, 3)
        .map(
          (i) =>
            `<article><span class="status ${esc(i.outcome)}">${esc(i.outcome)}</span><h3><a href="${path(i)}">${esc(i.title)} ↗</a></h3><details><summary>What would settle it?</summary><p>${esc(i.what_would_settle_it)}</p><a href="${site.repo}/issues/new?template=settle-a-question.yml">Share a measurement ↗</a></details></article>`,
        )
        .join("") +
      (questions.length > 3
        ? '<a href="/OPEN-QUESTIONS.md">All unanswered questions ↗</a>'
        : ""),
    SCORES: scores
      .slice(0, 5)
      .filter((i) => ideas.some((o) => o.id === i.id))
      .map(
        (i) =>
          `<li><a href="${path(i)}">${esc(i.title)}</a><span>${i.total} points</span></li>`,
      )
      .join(""),
  };
  const template = readFileSync(join(root, "site/index.html"), "utf8");
  writeFileSync(
    join(out, "index.html"),
    template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => tokens[key] ?? ""),
  );
}

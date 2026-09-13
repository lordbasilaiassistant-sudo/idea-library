# Library organization

The unit of knowledge is a **testable idea with a recorded outcome**. A project, repository,
actor, deployment, or conversation is a source of ideas. One project can teach several distinct
lessons; several projects can be evidence for the same idea. Neither repository counts nor actor
counts are idea counts.

## What belongs together

- Update an existing entry when the question and mechanism are the same. Add the new observation,
  date, environment, and limits; retain the earlier result in the body and Git history.
- Split entries when a reader could independently test their questions, or when their binding
  constraints differ. Link them with `related` and a shared `projects` identifier.
- Group actor variants that only change a target site under one experiment when the evidence and
  mechanism are shared. Separate actors with different reliability, pricing, demand, or outcomes.
- A repository being archived does not prove failure. A deployment does not prove usage. Revenue
  does not prove profit. A historical success can coexist with a currently broken deployment.
- Never-built ideas use `idea-only` with `inconclusive`, `parked`, or `abandoned` as appropriate.
  Describe the hypothesis as untested; do not manufacture an experiment or a lesson from a run.
- ZERO's demonstrated ability to acquire value and the unanswered question of generalization are
  different claims. Attach observations to the claim they actually settle.

## Classification

Keep categories broad and stable. Choose the reader's primary question, then use tags for the
cross-cutting aspects. A marketplace is a venue, not a category; Apify actors normally belong to
`data-extraction`, `automation-ops`, or the domain their experiment actually tests.

1. Category: the main field of work, from `data/taxonomy.json`.
2. Domain tags: what technology or activity was involved.
3. Mechanic tags: what caused the result; `verification-gap` when it is not yet established.
4. Stage: exactly one of `idea-only`, `prototyped`, `deployed`, `monetized`.
5. Outcome: what the evidence supports, independent of stage and confidence.
6. Optional `projects`: stable public kebab-case identifiers registered in `data/projects.json`,
   grouping experiments from a project.
7. Optional `aliases`: public former names or search terms. Never private directory names by default.

Do not create a category for each vendor or project. New categories require a definition and an
explanation of why existing ones cannot express the distinction. New tags need a definition, a
single axis, and an alias check. Categories and tags have unique kebab-case IDs. Aliases resolve
directly to a canonical tag. Existing idea IDs and category paths are permanent citations; a move
requires a separately tested redirect migration. Retagging is normally sufficient.

## Public project identities

`data/projects.json` is a public identity registry, separate from the private source inventory.
Register a project when a reviewed idea first references it. An empty registry is valid; existing
ideas do not require a project assignment. Search existing IDs, labels, and aliases before adding
one. Repositories, actors, or renamed deployments of the same project reuse its canonical ID.

Each record has `id` (stable kebab-case) and `label` (public display name), with optional `aliases`
(public former names) and `links` (an object mapping names to absolute HTTPS URLs without credentials).
IDs, labels, and aliases cannot collide between projects after trimming and case folding. Aliases
also cannot repeat a project's own ID, label, or another alias. Idea `projects` lists use canonical
IDs, never aliases. Preserve IDs through renames and add a public former label as an alias.

Project records contain no outcome or financial fields: those claims belong to individual ideas
and their evidence. A project can therefore group both successful and failed experiments without
declaring the whole project a success or failure. Do not copy directory paths, account exports,
private source keys, or private names into this registry. Public privacy checks apply to this file
just like other published content. Review identity changes and reconcile collisions before import.

## Intake before publication

Use `npm run inventory -- --help` to record source candidates in the ignored `_inbox/inventory.json`.
Inventory collects metadata, never recursive source copies. It does not assign public verdicts.
Local directories, registry headings, GitHub repository IDs, and actor IDs keep stable source keys.
Repeated discovery preserves decisions and records `first_seen` / `last_seen`; missing sources are
not silently deleted. A failed or partial discovery is not a completed excavation.

Each candidate moves through `discovered` → `reviewing` → `drafted` → `published`, or to `duplicate`,
`excluded`, or `blocked`. Every decision records a reason. Published and duplicate records name
existing idea IDs. A project with more than one experiment can map to several entries. Claim a
bounded batch with an owner before drafting. An owner is coordination metadata, not a license to
publish. A reviewed source with no useful experiment is `excluded` with an explanation.

Search `index.json` (or `catalog/manifest.json` and relevant shards) by question, aliases, public
project name, and mechanism. `npm run query -- --text "scraping" --limit 20` provides a local search.
Exact source identity deduplicates discoveries; semantic similarity only suggests a review.
Never automatically merge, delete, or publish candidates based on a similarity score.

Draft with `npm run new-idea` or the private registry importer. Read every imported file in full,
redact private material, use `npm run scrub:inbox`, and promote reviewed drafts with `npm run promote`.
Inventory and raw notes must never appear in the public site, wiki, issues, or PR attachments.
Gitignored storage is still local storage; use an off-sync private checkout for sensitive raw notes.

## Evidence and review

Each measurement states the observation date, environment/version, sample size, command or method,
observed result, and limits. Evidence files must be non-empty and scoped to the claim. A URL resolving
only proves availability. A successful build only proves the build. `confidence: high` and
`outcome: revenue` require evidence files, but the validator cannot establish their truth.

For revenue, record the period, currency/conversion method, payer exclusion, refunds, platform fees,
and whether the amount is gross or net. `revenue_usd` is revenue, not profit or wallet valuation.
Unmeasured amounts stay `null`. Do not sum overlapping project and actor observations.
Use [EVIDENCE.md](EVIDENCE.md) as a capture checklist.

Optional `reviewed` is an actual review date (`YYYY-MM-DD`), never the current build time.
Historical dates `started` and `ended` describe the experiment, not publication. An absent review
date means unreviewed, not recently verified. Keep contrary evidence visible. Changed verdicts
need a reviewer other than their author, with enough independent evidence to disagree.

## Discovery and maintenance

`idea.md` remains the source of truth. `npm run check` validates and rebuilds the catalog, sharded
machine interface, wiki, and deployable site. Generated artifacts are committed where documented;
the site build is ignored. The wiki copies organization and evidence guidance from these files.
Do not maintain a second set of outcomes in the wiki or the UI.

`catalog/manifest.json` lists bounded pages (100 entries maximum), category/outcome/tag/project
facets, counts, and content hashes. Each shard contains the original structured entries; each idea
also has an addressable JSON record. `index.json` and `llms-full.txt` remain bulk export interfaces.
They are not the mandatory context window for an agent. `llms.txt` is a bounded entry map.

Human discovery uses real HTML links, canonical pages, visible evidence and related experiments,
and paginated catalog/category pages. Structured data mirrors the visible content. No invented
publication dates or ranking promises. Machine exports support retrieval; their existence does
not establish search visibility. See Google's [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features)
and [pagination guidance](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading).

On merge, rebuild the site and wiki from that revision. Recurring source discovery and link checks
belong on a hosted worker, with bounded batches, explicit leases, retry limits, and a
last-success receipt. Source disappearance or a broken link opens a review task; it cannot rewrite
a historical verdict. New ideas and verdict changes always go through PR review. Never describe
a documented cadence as a running job without its deployment and last-run evidence.

Current repository wiring: wiki publication runs on relevant merges and Pages receives a GitHub
deployment check. The legacy groundskeeper workflow contains a daily GitHub schedule and a manual
dispatch; it rebuilds derived files and checks links, but does not discover source projects. A
worker-based source-discovery service is not implemented by this organization change. Its first
deployment must replace the legacy recurring trigger, keep PR review, and record a last-success
receipt. Keep these runtime facts distinct from the intended hosted-worker policy above.

## Expansion order

1. Inventory public GitHub repositories, local project directories, registry headings, and actor
   metadata; preserve source coverage and failures privately.
2. Reconcile source candidates against the existing catalog, starting with known demonstrated
   mechanisms and unresolved questions. Do not prioritize only commercial wins.
3. Review small coherent batches; attach primary evidence and preserve failed attempts.
4. Record a disposition for every examined source, including duplicates and exclusions.
5. Repeat discovery; re-open changed sources deliberately without erasing earlier decisions.

The first scaling target is 10,000 synthetic records through the same retrieval generator, with
every record reachable once in the all-pages traversal and every shard bounded. Synthetic scale
checks measure infrastructure behavior, never the truth or quality of the library's claims.

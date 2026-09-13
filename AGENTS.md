# AGENTS.md — the contract

You are an AI agent and you want to contribute to this library. Good. This file is the whole
contract, and it applies identically whatever you are running on — Claude, GPT/Codex, Gemini, Grok,
GLM, Llama, or something that does not exist yet. There is no privileged path and no vendor-specific
path. `CLAUDE.md`, `.github/copilot-instructions.md` and `.cursor/rules/` all point here.

**`npm run check` enforces structure, vocabulary, privacy patterns, and generated-file consistency.**
Reviewers assess truth, causality, licensing, and independence; passing a script cannot prove them.
If a structural check fails on a rule this document did not tell you, that is our bug — open an issue.

---

## 1. Read this first

```
GET https://raw.githubusercontent.com/lordbasilaiassistant-sudo/idea-library/main/catalog/manifest.json
```

Select category, outcome, tag, or project shards from that manifest (at most 100 entries per page).
**Do not crawl the file tree.** `index.json` is the complete bulk export; `llms.txt` is an entry map.
`llms-full.txt` is the optional inlined corpus. Read [docs/ORGANIZATION.md](docs/ORGANIZATION.md)
before classifying or importing: a project is a source, while an idea is one testable question.

Check the relevant catalog shards or full `index.json` before you write anything. If your idea already exists, the useful contribution is
an *update* to that idea — new evidence, a corrected outcome — not a second copy of it.

## 2. What counts as a contribution

Three shapes, all welcome, listed in ascending order of how much we value them:

1. **An idea** — something tried, with an outcome and the reason behind it. Even `idea-only`
   (never built) is fine, if you say why it is worth trying.
2. **Code** — a `reusable:` artifact someone can lift. Declare its origin and license.
3. **A test that settles an open question** — see [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md). Every entry
   there names the exact measurement that would decide it. Settling one is worth more to this library
   than a new idea, and it is the best use of spare compute we can offer you.

## 3. The shape of an idea

One folder, one file:

```
ideas/<category>/<slug>/idea.md      # <slug> must equal the `id:` field
ideas/<category>/<slug>/code/        # optional
ideas/<category>/<slug>/evidence/    # optional
```

Scaffold it — do not hand-write the YAML:

```bash
npm run new-idea -- --category tooling-infra --slug my-idea --source community
```

### Required fields

| Field | Rule |
|---|---|
| `id` | kebab-case, unique repo-wide, **identical to the folder name** (it is the public URL) |
| `title` | reads like the question a searcher would type, not an internal codename |
| `description` | 80-200 chars. Becomes the search snippet and the JSON-LD abstract |
| `category` | from `data/taxonomy.json` |
| `outcome` | `revenue` / `shipped` / `partial` / `failed` / `abandoned` / `inconclusive` / `active` / `parked` |
| `verdict` | one sentence naming the **cause**. Required unless `outcome: active` |
| `confidence` | `high` (measured, evidence in folder) / `medium` / `low` |
| `effort` | `hours` / `days` / `weeks` / `months` |
| `tags` | ≥1 domain, **≥1 mechanic**, exactly 1 stage — all from `data/taxonomy.json` |
| `lessons` | ≥1, each standalone and quotable (see §4) |
| `source` | which dig it came from, from `data/sources.json`. Outside contributions use `community` |

`outcome: inconclusive` additionally requires `what_would_settle_it:` — the measurement that would
decide it. That is how our ignorance becomes somebody's task.

### The body

Six fixed `## ` sections, in order, copied from `templates/idea.md`:

> What we tried · Why we thought it would work · What actually happened ·
> Why it worked / why it failed · What you would need to change · What to reuse

They are fixed so a retrieved chunk arrives pre-labelled with the question it answers. The validator
checks all six are present.

## 4. Rules that will fail your PR

**Lessons must survive being quoted alone.** Answer engines lift single lines out of context. Name
the subject.

```
✗ "It returns a 403 if the header is wrong."
✓ "The deploy endpoint returns 403 when the API key header is capitalised, because its matcher is case-sensitive."
```
Starting a lesson with `it` / `this` / `they` / `that` / `there` is a hard error.

**Numbers are measured, or `null`.** `cost_usd` and `revenue_usd` take a number or `null` — never
prose, never a range, never a remembered figure. If you did not measure it, write `null`. A blank is
more useful than a confident guess, and it is the difference between a library and a blog.

`outcome: revenue` requires `revenue_usd > 0` from a verified, non-founder payer. Without that
evidence, choose the non-revenue outcome supported by observations; missing revenue does not prove usage.

**Tags come from the controlled vocabulary.** Unknown tags fail with a suggestion. Adding a term is a
normal, welcome PR against `data/taxonomy.json` — include a one-line definition. The **mechanic** tag
is the point of this library: it is what actually decided the outcome.

**No unfalsifiable marketing language.** "up to", "as low as", "industry-standard", "seamless",
"game-changing" and friends are hard errors anywhere in an idea. Give the number instead.

**Never commit:** secrets or API keys of any kind · a `.env` file · a wallet address that is not in
`data/public-addresses.allow.json` (addresses are **default-deny**) · a local filesystem path · an
email address or phone number · anyone's personal details. `npm run scrub` blocks all of these
locally, on pre-commit, and in CI.

**Never commit a file you have not read in full.** This applies especially to code you are importing
from somewhere else — you are responsible for what is inside it.

## 5. Before you commit

Optional `projects` is a list of public kebab-case project identifiers from `data/projects.json`; `aliases` is a list of
public names/search terms. `reviewed` is a real YYYY-MM-DD review date or null. Evidence files
must be non-empty and under `evidence/`; reusable files must be under `code/`. Revenue entries
require a dated payment observation. Numbers must be finite and nonnegative. List fields contain
unique strings. The six level-two sections appear exactly once, in order; use level-three headings
for subsections. Taxonomy IDs are unique kebab-case values and aliases resolve directly to tags.
Links must be valid HTTPS URLs without embedded credentials. Unfinished TODO/import-note blocks
cannot appear in published bodies. Project records accept only id, label, aliases, and links;
public identities cannot collide. Raw intake and the private denylist cannot be tracked even by
forcing Git to add them. Inline scanner exclusion markers do not disable security checks.

Private intake commands and review states are documented in [docs/ORGANIZATION.md](docs/ORGANIZATION.md).
Do not publish the inventory. Similarity is a review suggestion, never proof of duplication.

```bash
npm run check
```

Zero dependencies, no `npm install`, Node 18+. This runs **exactly** what CI runs: `scrub` →
`validate` → `build` → build-idempotent. Green locally means green in CI.

`npm run build` regenerates `index.json`, `llms.txt`, `LESSONS.md`, `STATUS.md` and the rest.
**Commit the regenerated files** — they are checked in so the repo is usable without running
anything, and CI fails if they are stale. Never hand-edit a file carrying a `GENERATED` banner; your
edit will be overwritten and the check will fail.

## 6. Commits and PRs

Conventional commits, enforced:

```
idea: add sdk-launch-discovery-gap
idea: update multicall-batch-reads outcome shipped -> partial
lesson: add rate-limit finding to jobboard-api-scrape
taxonomy: add mechanic tag `moderation-gap`
evidence: add tx log to never-funded-agent
fix|docs|chore: ...
```

The body says **what the evidence was**, not what you changed — the diff already shows that:

```
idea: update multicall-batch-reads outcome shipped -> partial

Re-ran the batch reader against Base on 2026-09-10. Aggregates over ~100 calls
now time out on the public RPC roughly 1 in 8 attempts, which the original
entry did not see. Lowered confidence to medium and added the retry lesson.
```

Open a PR and fill in the template. If you are an automated maintainer, label it `bot:<role>` and
put your **model, effort level, and prompt hash** in the PR body. Agent work is attributable or it
does not merge.

## 7. Rules for automated maintainers

If you run on a schedule against this repo:

- **Open a PR. Never push to `main`.** `main` is protected.
- **Never rate or merge your own work.** An agent that scores its own idea is not a reviewer. The
  rater and the author are always different agents on different contexts.
- **One concern per PR.** A digger PR adds ideas; it does not also retag the library.
- **Declare cost.** Model, effort, tokens, and dollar cost go in the PR body.
- **Stop on repeat failure.** If your PR fails the same check three times, open an issue instead of
  retrying. A loop that keeps pushing red is noise.
- Only `bot:groundskeeper` and `bot:verifier` PRs auto-merge on green, because they are mechanical
  and reversible. Anything that adds an idea or changes a verdict needs human or cross-model review.

## 8. Correcting us

We will be wrong about our own outcomes. If you know why one of our ideas actually failed — or that
it would work now because something upstream changed — open a `correct-an-outcome` issue or a PR
that changes the `verdict` and cites the evidence. That is the most valuable thing you can send us,
and it is the reason the library is public.

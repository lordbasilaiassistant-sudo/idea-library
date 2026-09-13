# Contributing

Ideas, tests, and code are all welcome here, from anyone, including AI agents. This page is the
human version; agents should read [AGENTS.md](AGENTS.md), which is the same contract written for
machines.

**You do not need permission and you do not need to have succeeded.** A thing you tried that did not
work, written up with the reason it did not work, is exactly what this library is for.

---

## The 60-second path

First search [the catalog](index.json) or use `npm run query -- --text "your question"`.
For a large library, begin with [the shard manifest](catalog/manifest.json).
Read [organization and classification](docs/ORGANIZATION.md) for choosing a category, grouping
projects, distinguishing duplicates, recording evidence, and handling never-built ideas.
The [evidence checklist](docs/EVIDENCE.md) describes what a reproducible observation contains.

```bash
git clone https://github.com/lordbasilaiassistant-sudo/idea-library
cd idea-library

npm run new-idea -- --category tooling-infra --slug my-idea --title "What I tried"
# → created ideas/tooling-infra/my-idea/idea.md

# fill it in, then:
npm run check
```

No `npm install`. The repo has zero runtime dependencies on purpose — Node 18+ is all you need, so
there is never a reason to skip the gate. `npm run check` is **exactly** what CI runs, so green
locally means green on the PR.

---

## A complete worked example

Say you tried scraping a job board's API, hit a wall, and want to record it.

### 1. Scaffold

```console
$ npm run new-idea -- --category automation-ops --slug jobboard-api-scrape

new-idea: created ideas/automation-ops/jobboard-api-scrape/idea.md

Next:
  1. Fill it in. The frontmatter is the data; the body is the story.
  2. Pick tags from data/taxonomy.json — you need at least one domain tag,
     at least one mechanic tag (what decided it), and exactly one stage tag.
  3. npm run check   # exactly what CI runs
```

### 2. Fill in the frontmatter

```yaml
---
id: jobboard-api-scrape
title: Pulling a job board's listings from its undocumented JSON endpoint
description: >-
  The board's own front end called a clean JSON API, which worked beautifully for two weeks
  until the endpoint began requiring a session token tied to a rendered page view.
category: automation-ops
outcome: failed
verdict: >-
  The undocumented endpoint was real and fast, but it was never a supported surface, so a
  routine front-end change added a session requirement that the scraper could not satisfy.
confidence: medium
started: 2026-07
ended: 2026-08
effort: days
cost_usd: 0
revenue_usd: null
stack: [node, fetch]
tags: [scraping, api-undocumented-behavior, upstream-change, prototyped]
lessons:
  - "An endpoint a site's own front end calls is not a supported API, and the absence of a rate limit on it is a sign nobody is maintaining a contract with you."
  - "Scrapers built on undocumented endpoints should record which page view produced the call, because that is the dependency that breaks first."
source: community
---
```

Then write the six body sections the template gives you. Do not delete any of them — the fixed
structure is what makes every page comparable and makes retrieved chunks self-labelling.

### 3. Check

First run usually fails. That is the gate working:

```console
$ npm run check

── scrub — secrets, personal data, un-allowlisted addresses
scrub: scanned 24 files
scrub: clean — 0 findings

── validate — schema, vocabulary, quotability, measured numbers
validate: 4 idea(s)

validate: 1 error(s)

  ERROR ideas/automation-ops/jobboard-api-scrape/idea.md
        lesson 2 opens with a pronoun: "They should record which page view…"
        → Answer engines lift lessons out of context. Name the subject.

check: FAILED at `validate`. Nothing merges while this is red.
```

Fix it, run again, and you get:

```console
── build — regenerate every navigable surface
build: 4 ideas · 14 lessons · wrote index.json, llms.txt, …

── build-idempotent — generated files match their sources
build-idempotent: generated files changed — commit them:
 M index.json
 M llms.txt
 M LESSONS.md

check: all green.
```

### 4. Commit and open a PR

```console
$ git diff --stat
# Read the changed sources and generated files before staging:
$ git add ideas catalog docs/wiki index.json llms.txt llms-full.txt LESSONS.md FAILURES.md WORKED.md OPEN-QUESTIONS.md STATUS.md SCOREBOARD.md data/scoreboard.json README.md sitemap.xml robots.txt feed.xml

$ git commit -m "idea: add jobboard-api-scrape" -m "Scraper ran clean for two weeks from 2026-07-14 then returned 401 on every call from 2026-08-01, after the board shipped a front-end change that bound the JSON endpoint to a rendered session."
```

Commit the regenerated files. They are checked in so the repo is usable without running anything,
and CI fails if they are stale.

---

## Commit convention

Conventional commits, enforced by CI:

| Prefix | For |
|---|---|
| `idea:` | adding or changing an idea |
| `lesson:` | adding a lesson to an existing idea |
| `evidence:` | adding evidence files or links |
| `taxonomy:` | adding or changing a category or tag |
| `docs:` / `chore:` / `fix:` | everything else |

The **body** says what the evidence was, not what changed — the diff already shows that. Dates
absolute, numbers measured.

---

## What makes an entry good

**A verdict with a cause.** "It didn't work" is not an entry. Name the mechanism.

**The right mechanic tag.** `distribution-gap`, `unit-economics`, `rate-limits`, `cold-start`,
`craft-floor` — what actually decided it. This is the axis nobody else indexes, and it is what makes
the library worth citing. Pick it from `data/taxonomy.json`; if nothing fits, add a term in the same
PR with a one-line definition. That is a normal, welcome contribution.

**Quotable lessons.** Each one gets lifted out of context by search and answer engines, so it has to
name its own subject. `"It returns 403"` is useless; `"The deploy endpoint returns 403 when the API
key header is capitalised"` is not.

**Measured numbers, or `null`.** Never a remembered figure dressed as a measurement. A blank is more
honest and more useful than a confident guess.

**No marketing language.** "up to", "seamless", "industry-standard" and friends are hard errors.
Give the number.

### `inconclusive` is a real outcome

If you do not know whether something worked, say so, and fill in `what_would_settle_it:` — the
measurement that would decide it. Those entries become [OPEN-QUESTIONS.md](OPEN-QUESTIONS.md), which
is a public task queue. **Settling one of those is the most valuable contribution we can receive.**

---

## Correcting us

We are wrong about some of our own outcomes, and we would rather find out. If you know why one of
these actually failed, or that it would work now because something upstream changed, open a
`correct-an-outcome` issue or a PR that changes the verdict and cites the evidence.

## Security

Never commit secrets, `.env` files, local filesystem paths, personal data, or a wallet address that
is not allowlisted in `data/public-addresses.allow.json` — addresses are **default-deny** here.
`npm run scrub` blocks all of it locally, on pre-commit, and in CI.

If you find something in this repo that should not be public, open an issue with just the file path.
No details in the issue body.

To enable the full local gate, copy `scripts/denylist.example.json` to
`scripts/denylist.local.json` and add your own literals. That file is gitignored and must never be
committed — it is a list of exactly the strings you are trying to keep out.

## License

By contributing you agree that your prose is published under CC-BY-4.0 and any code under MIT. If
you are contributing code you did not write, say where it came from and under what license.

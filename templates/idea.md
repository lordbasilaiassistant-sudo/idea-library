---
id: my-idea-slug
title: A title that reads like the question a searcher would type
description: >-
  80-200 characters. Becomes the search snippet and the JSON-LD abstract. Say what the
  idea was and how it ended, in one breath. No marketing words.
category: experiments
outcome: inconclusive
verdict: >-
  One sentence naming the cause. Not "it did not work" — why it did not work, or what
  specifically capped it.
what_would_settle_it: >-
  Required only for `outcome: inconclusive`. Name the measurement that would decide it.
  This is how our ignorance becomes somebody's task.
confidence: medium
started: 2026-01
ended: 2026-02
effort: days
cost_usd: null
revenue_usd: null
stack: [node, cloudflare-workers]
tags: [api-integration, verification-gap, prototyped]
reusable: []
lessons:
  - "Name the subject in every lesson — answer engines lift these out of context, so 'It returns 403' is useless and 'The deploy endpoint returns 403 on an uppercase header' is not."
supersedes: []
related: []
source: community
links: {}
evidence: []
---

## What we tried

What was actually built or run. Concrete: the endpoint, the chain, the framework, the scale.

## Why we thought it would work

The reasoning at the time. Write the honest version, including the part that turned out wrong —
that is the part a reader learns from.

## What actually happened

The measurement. Numbers, error strings, dates, transaction hashes. If you did not measure it,
say that here rather than rounding a memory into a fact.

## Why it worked / why it failed

The mechanism, not the symptom. "Nobody found it" is a symptom; "we had no distribution surface and
the index that would have carried it requires a paid tier" is a mechanism. This section is what the
`mechanic` tag points at.

## What you would need to change

The counterfactual. What would make this work — a different platform, a different price point, a
capability that does not exist yet? Name the threshold that would flip the verdict.

## What to reuse

Point at files in `code/`, and say what state they are in. Be honest about what is a working
artifact and what is a sketch.

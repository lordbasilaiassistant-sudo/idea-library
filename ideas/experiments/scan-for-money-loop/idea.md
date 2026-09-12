---
id: scan-for-money-loop
title: We re-derived the same dead strategy across many sessions without noticing
description: >-
  An on-chain search strategy failed, and we kept coming back to it because each new session
  started without any record that the last one had already tried it.
category: experiments
outcome: abandoned
verdict: >-
  The strategy was dead after the first honest attempt, but nothing recorded that verdict where
  the next session would read it, so the same ground was re-excavated until a human intervened.
confidence: medium
started: 2026-04
ended: 2026-07
effort: months
cost_usd: null
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [onchain-data, agent-harness, wrong-abstraction, maintenance-cost, prototyped]
reusable: []
lessons:
  - "A strategy that failed is only abandoned if the verdict is written somewhere the next attempt will read before starting, otherwise a fresh session will rediscover the idea and find it appealing for the same reasons it originally did."
  - "Re-deriving a known-dead approach costs more than the original attempt, because the first attempt at least produced information and the repeats produce only the same information again."
  - "The cheapest fix for a repeated dead end is a written negative result with the reason, which is the entire premise of the library this entry appears in."
  - "A pattern of returning to the same failed idea is a symptom of missing recall rather than of poor judgement, so the fix belongs in the record-keeping and not in trying harder to remember."
  - "An operator noticing the loop from outside is the slowest and most expensive detector available, because by then the cost has already been paid several times over."
supersedes: []
related: [forty-three-services-no-customers, retail-arbitrage-is-closed]
source: project-registry
links: {}
evidence: []
---

## What we tried

A read-only on-chain search strategy that we expected to turn up something worth acting on. We
deliberately do not describe the strategy itself here: this entry is about the loop around it, and
the strategy was not the interesting failure.

## Why we thought it would work

The search was read-only, cost nothing but time, and appeared to have no downside beyond finding
nothing. On first inspection it looks like free optionality, which is exactly the property that
makes it easy to pick up again.

## What actually happened

It found nothing worth acting on.

The failure is not that. The failure is that we did it again, and again. Across multiple sessions
over several months, the same approach was proposed, built, run and found wanting — each time with
fresh enthusiasm, because each session began without the previous session's verdict in front of it.
It ended when the operator recognised the pattern from outside and said so directly.

## Why it worked / why it failed

The idea was mediocre. The process failure was serious, and it is why this entry exists.

A negative result only saves future effort if it is recorded where the future will look. Ours lived
in scattered per-session notes, which in practice meant it did not exist. So the idea presented
itself as new every time — and it is genuinely appealing at first glance, which is why it kept being
picked up.

The costs compound. The first attempt was a reasonable experiment that produced real information.
Every repeat produced the same information at the same cost, so the expected value of the work went
negative and stayed there.

The detector of last resort was a human noticing. That works, but it is the slowest mechanism
available and it only fires after the cost has been paid several times.

## What you would need to change

Write the verdict down where the next attempt will read it, with the reason attached. That is the
specific fix, and it is why this library exists in the form it does: a public record with a cause
attached to every outcome, indexed by the mechanic that killed it, readable in one fetch before work
begins. A negative result nobody can find is not a negative result.

## What to reuse

The diagnosis rather than any code. If something feels new and obvious at the same time, check
whether you have already tried it. That feeling is what a forgotten dead end looks like from the
inside.

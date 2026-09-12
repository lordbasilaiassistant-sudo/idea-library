---
id: safety-refusal-blocked-own-qa
title: Our own QA agents refused to test our platform because the task sounded like market manipulation
description: >-
  Asking agents to exercise a trading platform with coordinated orders read as a request to
  manipulate a market, so they declined, and the honest fix was to describe the work accurately.
category: ai-agents
outcome: shipped
verdict: >-
  The refusal was a correct response to how the task was worded rather than to what the task was,
  and rewriting the brief to describe platform QA on our own system resolved it without argument.
confidence: high
started: 2026-06
ended: 2026-06
effort: hours
cost_usd: null
revenue_usd: 0
stack: [claude, multi-agent]
tags: [multi-agent, agent-harness, prompt-engineering, tos-boundary, deployed]
reusable: []
lessons:
  - "A model refusing a task is often a judgement about the wording rather than the work, so the first diagnostic is to describe what is actually happening rather than to escalate or switch models."
  - "Words like coordinated trading carry a specific meaning about manipulating a market you do not own, and using them for load-testing your own platform invites exactly the reading you did not intend."
  - "If restating a task honestly makes it refusable, that is information about the task; if the honest restatement is accepted, the original wording was the problem."
  - "Reaching for a weaker or less aligned model to get past a refusal converts a wording problem into a judgement problem and removes the check that just fired."
supersedes: []
related: [autotrader-journal-hid-losses]
source: project-registry
links: {}
evidence: []
---

## What we tried

We wanted agents to exercise a trading platform we had built: place many orders across many
accounts, in patterns, to see how the matching and liquidity logic held up under load. The brief
described this as coordinated trading across a fleet of wallets.

## Why we thought it would work

It was our platform, our test tokens, and our money on both sides of every trade. From inside the
project it was obviously a load test, so the refusals were surprising.

## What actually happened

The agents declined. Not all of them, not always, but often enough to make the workflow unusable —
and inconsistently, which was worse than a flat refusal because it looked like flakiness.

Rewriting the brief fixed it completely. The new version said what was true: this is quality
assurance against a platform we operate, with accounts we control, to find failure modes in our own
matching engine. Same work, same actions, no refusals.

## Why it worked / why it failed

"Coordinated trading" describes a real category of market abuse, and a model reading that phrase has
no way to know from the phrase alone that the market belongs to the person asking. The refusal was
well-calibrated to the description it was given. Our brief was inaccurate — not dishonestly, but
lazily, using insider shorthand that had a specific adverse meaning outside the project.

The reason this is worth recording is the tempting wrong fix. When a model refuses, the reflex is to
route around it: try a different model, split the task so no single step looks bad, or wrap it in
framing designed to slip past. All of those degrade the signal. The check fired on a genuine
ambiguity in what we said, and the fix that costs nothing is to stop being ambiguous.

## What you would need to change

Nothing about the models. Write briefs that state the ownership and the purpose explicitly, because
a task's legitimacy usually lives in facts the wording omits — whose system, whose money, whose
consent. If you find yourself unable to write an accurate description that survives review, the
refusal has told you something useful and you should listen rather than route around it.

## What to reuse

The diagnostic order: rewrite honestly first, and only then conclude the model is wrong. In our case
the honest version was both shorter and more accurate, which is the usual outcome.

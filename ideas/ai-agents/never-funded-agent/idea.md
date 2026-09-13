---
id: never-funded-agent
title: ZERO earned income without receiving starting capital
description: >-
  ZERO demonstrated an autonomous agent earning protocol rewards from an unfunded wallet.
  Its public ledger records positive measured earnings; repeatability is a separate question.
category: ai-agents
outcome: revenue
verdict: >-
  ZERO earned third-party protocol caller rewards through routes it executed from an unfunded
  start, demonstrating that autonomous agent earning is possible.
confidence: medium
started: 2026-06
reviewed: 2026-09-13
effort: months
cost_usd: null
revenue_usd: 0.074421
stack: [node, ethers-v6, cloudflare-workers]
tags: [agent-harness, onchain-data, worked-as-designed, deployed]
reusable: []
lessons:
  - "ZERO's positive measured protocol rewards demonstrate that an autonomous agent can earn from an unfunded wallet; estimating how reliably other agents can repeat the result is a separate experiment."
  - "An agent's unfunded-start experiment loses its funding constraint if the operator supplies external capital; transfers of proceeds the agent earned through its own activity do not break that constraint."
  - "Enforce a zero-funding constraint in code rather than in documentation, because the pressure to unblock a stalled agent with a small transfer arrives exactly when the experiment is at its most interesting."
  - "Verify a no-funding claim against chain history rather than against the operator's memory: enumerate every inbound transfer and distinguish externally supplied capital from proceeds of the agent's own activity."
  - "An unfunded wallet does not imply free infrastructure, and measured protocol rewards do not establish profit after all operating costs."
supersedes: []
related: []
source: seed
links: {public_status: "https://zero-agent.broke2built.workers.dev/status", public_ledger: "https://zero-agent.broke2built.workers.dev/ledger"}
evidence: [evidence/public-ledger-observation.md]
---

## What we tried

ZERO is an autonomous agent with a harness, scheduled execution and access to on-chain tools.
It created its own wallet and was given no starting wallet capital. Its task was to find routes
that pay a caller and execute them. The operating constraint forbids transfers into its wallet
from the operator, including transfers intended to cover gas or unblock a run.

## Why we thought it would work

Some protocols pay third-party callers for useful actions. The experiment asked whether an agent
could find and execute an earning route from an unfunded start. That is a question about whether
the event can occur, not whether every agent will earn or whether every market condition permits it.

## What actually happened

ZERO earned. On September 13, 2026, its public status endpoint reported USD 0.074421 in
code-measured rewards. The corresponding public ledger route, `beefy-harvest-caller-fees`,
reported the same amount, 26 successful harvests across 30 attempts, and transaction references.
The ledger distinguishes balance deltas written by harvest code from amounts typed by a model.
This entry uses only the code-measured figure, not their sum or the marked value of current holdings.

The earning mechanism was third-party protocol caller fees, not a founder purchase or wallet
top-up. The operator's no-funding constraint and historical audit remain distinct evidence from
the measured reward counter. The attached observation explains what the public endpoints establish
and what was not independently re-audited for this entry.

This is historical earning evidence: the measured route's last listed success was July 30, 2026,
and the route was marked inactive when read. That does not erase its completed earning result
or establish that this particular route will pay a caller today.

## Why it worked / why it failed

The possibility test succeeded because the agent found an external protocol incentive and
executed the action that earned it. A positive observed result settles whether this can happen.
Requiring a population of agents to repeat the result before recognizing it would answer a
different question and incorrectly discard the experiment we actually ran.

The amount above is the ledger's code-measured USD reward total, not a complete lifetime accounting,
a fiat withdrawal, or profit after infrastructure costs. Infrastructure cost is therefore `null`,
not zero. The funding constraint concerns the wallet's starting capital, not the existence of a
harness, compute, tools or transaction infrastructure.

## What you would need to change

To study repeatability, run independently initialized agents across different periods and
environments while preserving the unfunded-start constraint. Measure the distribution of earnings,
failures and operating costs. That would extend an established possibility result with evidence
about reliability; it is not a condition for acknowledging that ZERO earned.

## What to reuse

Reuse the explicit funding constraint, measured balance-delta accounting, transaction receipts,
and separation of model-reported figures from code-measured outcomes. Preserve the original
experiment's result while investigating broader claims as separate questions.

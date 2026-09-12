---
id: never-funded-agent
title: Can an agent that is never given any starting capital find its own first income?
description: >-
  An on-chain agent created its own wallet, received no funding from us at any point, and
  accumulated value entirely from routes it found itself. Whether that generalises is unsettled.
category: ai-agents
outcome: inconclusive
verdict: >-
  The agent did accumulate value with a starting balance of zero and no transfer from us, but
  a single agent on a single chain over one period cannot distinguish a repeatable method from
  a favourable window.
what_would_settle_it: >-
  Running several independently seeded agents, on different chains and in different market
  conditions, each with a hard zero-funding constraint, and reporting the distribution of
  outcomes rather than the best one. A method should survive a bad month.
confidence: medium
started: 2026-06
effort: months
cost_usd: 0
revenue_usd: null
stack: [node, ethers-v6, cloudflare-workers, base]
tags: [agent-harness, onchain-data, capital-required, zero-marginal-cost, deployed]
reusable: []
lessons:
  - "An agent with a starting balance of zero has a denominator that no later funding can restore, so a single transfer in permanently destroys the result the experiment exists to produce."
  - "Enforce a zero-funding constraint in code rather than in documentation, because the pressure to unblock a stalled agent with a small transfer arrives exactly when the experiment is at its most interesting."
  - "Verify a no-funding claim against chain history rather than against the operator's memory: enumerate every inbound transfer and confirm each one is internally generated."
  - "When an agent looks capital-blocked, the honest responses are a cheaper route or more transaction capacity, and adding capital is the one response that answers a different question than the one being asked."
supersedes: []
related: []
source: seed
links: {}
evidence: []
---

## What we tried

We gave an autonomous agent a harness, a scheduled tick, and read access to a chain, and we
deliberately gave it no money. It generated its own wallet. The constraint was absolute: no transfer
in from us, not from another wallet we control, not to cover gas, not to unblock a stalled run. Its
task was to find routes that pay an arbitrary caller and to execute the ones that clear their own
costs.

## Why we thought it would work

Most claims about autonomous agents earning money quietly include a funded starting position, which
makes the result hard to read — you cannot tell the method from the stake. Removing the stake makes
the question sharp: with zero capital, does a competent agent find any route at all? If it does, the
result is unusually clean. If it does not, that is also informative and cheap to learn.

## What actually happened

The agent found and executed routes, and its balance grew from zero. Checking chain history rather
than our own notes, every inbound transfer to its address was a proceed of its own activity and none
originated outside its own operations. It has never been funded. We deliberately do not publish a
revenue figure here, because the interesting claim is the zero on the input side, and a headline
output number invites exactly the comparison that makes people fund the next one.

## Why it worked / why it failed

Neither, yet — hence `inconclusive`. The honest reading is that a zero-capital start is not
automatically fatal, which is weaker than "this is a repeatable way to make money" and stronger
than "impossible". The most instructive part was organisational rather than technical: the strongest
pressure on the experiment came from our own side, repeatedly, whenever the agent looked stalled and
a small transfer would obviously have unblocked it. That transfer would have deleted the only
property the experiment had.

## What you would need to change

Run it as a population rather than an anecdote. Several agents, seeded independently, on different
chains, across good and bad conditions, with the zero-funding rule enforced by the code that holds
the keys rather than by an operator's discipline. Report the whole distribution, including the ones
that found nothing. A method that only works in one window is a window, not a method.

## What to reuse

The constraint mechanism rather than the agent. Put the no-funding rule in the code path that can
send value, make it refuse rather than warn, and write the verification as a query over chain
history so the claim can be checked by somebody who does not trust you.

---
id: self-reported-rewards-vs-balance
title: A protocol reported claimable rewards that did not exist when claimed
description: >-
  A contract's view function showed a pending reward balance. Batch-claiming across many
  positions returned materially less than the sum it had reported.
category: security-audit
outcome: shipped
verdict: >-
  The reported figure was an estimate computed under assumptions that no longer held at claim
  time, so trusting it and batching on top of it spent gas on claims that returned nothing.
confidence: medium
started: 2026-05
ended: 2026-05
effort: hours
cost_usd: null
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [smart-contracts, onchain-data, verification-gap, silent-failure, deployed]
reusable: []
lessons:
  - "A view function reporting a pending or claimable amount is that contract's estimate under its own assumptions, and it is not a promise that the amount will arrive when claimed."
  - "Measure the actual balance delta across a claim - balance before, claim, balance after - and treat that difference as the only real number, especially before repeating the operation across many positions."
  - "Batching amplifies a wrong assumption instead of revealing it: fifty claims built on one bad estimate cost fifty times the gas and produce the same nothing."
  - "Simulate one claim and assert a positive balance delta before batching, because the cost of that single check is one transaction and the cost of skipping it scales with the batch."
supersedes: []
related: [autotrader-journal-hid-losses, hardcoded-event-topic-hash, fee-claim-needs-trading-first]
source: project-registry
links: {}
evidence: []
---

## What we tried

We held positions across a yield protocol and wanted to harvest accumulated rewards. The contracts
exposed a view function returning the pending reward for a position, so we summed it across every
position and wrote a batch claim to collect the total.

## Why we thought it would work

The view function is the protocol's own accounting, read directly from chain state with no
intermediary. If a contract says a position has rewards pending, that is about as authoritative a
source as exists — considerably better than a third-party dashboard.

## What actually happened

The claims returned materially less than the sum of what had been reported. Several returned
nothing at all while still consuming gas. Because the operation had been batched across many
positions, the shortfall was multiplied before anyone observed a single result.

## Why it worked / why it failed

`shipped` because the eventual method works and is now what we use; the first attempt failed.

The reported number was an estimate. Pending-reward views commonly compute a projection from an
accumulator, a last-updated timestamp and a rate, all of which can change between the read and the
claim — a rate adjustment, a rounding floor, a minimum threshold, or another party's interaction
touching shared state. The contract was not lying; it was answering a slightly different question
than the one we thought we had asked.

Batching is what turned a small wrong assumption into a real cost. A single claim would have shown
the discrepancy immediately for the price of one transaction. Instead the assumption was applied
across every position at once, so the first feedback we received was the aggregate outcome.

Confidence here is `medium` rather than `high`: we established that the reported figure and the
received amount diverged, and we did not isolate which of the several plausible mechanisms was
responsible.

## What you would need to change

Never treat a claimable figure as the amount. Read your balance, claim one position, read your
balance again, and use the difference. If the delta is zero or far below the estimate, stop — you
have learned the estimate is not load-bearing, at the cost of one transaction. Only then batch.

## What to reuse

The pattern, which applies to any harvest, sweep or claim: the ground-truth number is a balance
delta you measured yourself, not a figure any counterparty reported to you, however authoritative
its source. This is the same lesson as an automated trader's own journal being the wrong instrument
to grade it with, arriving from a different direction.

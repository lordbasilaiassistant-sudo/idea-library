---
id: synthetic-pool-chart-spoof
title: A liquidity pool that showed a price chart and held no liquidity
description: >-
  A price aggregator displayed a pool with a chart and a market. On chain there was no
  liquidity position to withdraw and never had been.
category: security-audit
outcome: shipped
verdict: >-
  The pool existed as a contract producing chart-shaped data without holding reserves, so the
  aggregator rendered a market that had nothing behind it.
confidence: high
started: 2026-06
ended: 2026-06
effort: hours
cost_usd: 0
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [onchain-data, smart-contracts, trading, verification-gap, worked-as-designed, deployed]
reusable: []
lessons:
  - "A price chart on an aggregator proves that something emitted events in the shape of trades, not that a pool holds reserves you could trade against."
  - "Verify a pool by reading its reserves and its token balances directly from the contract, because a chart is rendered from events and events can be produced without any backing value."
  - "Displayed liquidity and withdrawable liquidity are different quantities, and only the second one is yours."
  - "Read the pool contract's own state before planning any action that depends on a position existing, including the action of simply withdrawing what you believe you own."
supersedes: []
related: [indexer-pings-are-not-demand, self-reported-rewards-vs-balance, key-is-not-ownership]
source: project-registry
links: {}
evidence: []
---

## What we tried

We were locating our own liquidity positions in order to withdraw them. A price aggregator showed a
pool for a pair we were involved with, complete with a chart and an apparent market, so we set out
to find and withdraw that position.

## Why we thought it would work

The pool appeared on a well-known aggregator with a rendered price history. That is normally strong
evidence: aggregators index on-chain events, so a chart usually means real trades against real
reserves.

## What actually happened

There was no position. Reading the contract directly showed no meaningful reserves and no
liquidity-provider balance attributable to us. The pool was producing data in the shape of a market
without holding value behind it — the aggregator was faithfully charting events that did not
correspond to tradeable depth.

Nothing was lost, because nothing was ever there. The cost was the time spent looking for it.

## Why it worked / why it failed

`shipped` in the sense that the investigation reached a correct, useful conclusion cheaply and
closed a false lead.

The interesting part is the failure mode of the aggregator, which was not a bug. It indexes events
and renders them. If a contract emits swap-shaped events, a chart appears. The chart is an accurate
picture of the events and tells you nothing about reserves, because it was never measuring reserves.

We had used a rendering of a derived view as evidence about underlying state. The underlying state
was one contract call away the whole time.

## What you would need to change

Nothing here is recoverable; the finding is the outcome. Procedurally: before acting on a pool,
read its reserves and the relevant token balances from the pool contract itself. Treat aggregator
data as a discovery mechanism — good for finding out that something exists — and never as
confirmation of what it holds.

## What to reuse

The distinction, which is worth keeping in general: displayed and withdrawable are different
quantities. Anything presented to you through a chart, a dashboard or an API is a derived view, and
the only way to know what is actually there is to read the source of truth yourself.

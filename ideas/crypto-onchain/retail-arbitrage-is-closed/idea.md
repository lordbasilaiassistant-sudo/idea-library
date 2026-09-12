---
id: retail-arbitrage-is-closed
title: Cross-DEX arbitrage and DEX scalping are both closed to a small wallet
description: >-
  We tested two classic on-chain trading strategies from a tiny wallet on a fast L2. Both came out
  negative expected value, for structural reasons a better script cannot fix.
category: crypto-onchain
outcome: failed
verdict: >-
  Arbitrage fails on professional latency and scalping fails on a fee floor above the volatility
  being harvested, and neither cause is something a retail participant can change.
confidence: medium
started: 2026-03
ended: 2026-06
effort: months
cost_usd: null
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [trading, onchain-data, unit-economics, capital-required, deployed]
reusable: []
lessons:
  - "Simple cross-DEX arbitrage on a fast L2 is closed to anyone without professional latency, because the spread is captured within the same block by parties whose infrastructure is the entire product."
  - "DEX scalping on liquid tokens is negative expected value before it begins whenever the round-trip fee is larger than the moves being harvested, which in our runs it was."
  - "Compare the round-trip cost to the size of the move you are trying to capture before writing any strategy code; if fees exceed the move, no amount of signal quality rescues it."
  - "Flash loans remove the capital constraint and leave the opportunity constraint untouched, so a strategy that finds nothing with borrowed capital was never short of capital."
supersedes: []
related: [autotrader-journal-hid-losses]
source: project-registry
links: {}
evidence: []
---

## What we tried

Two strategies, run from a wallet holding a fraction of one ETH on a fast, low-fee L2:

1. **Cross-DEX arbitrage** — watch the same pair on several venues, buy the cheaper side and sell
   the more expensive side.
2. **Scalping** — take small positions in liquid, well-known tokens and exit on small moves.

We also tested whether flash loans changed the arbitrage picture, borrowing capital at zero fee to
remove the wallet's size as a variable.

## Why we thought it would work

Both are documented strategies with public write-ups. Fees on this chain are low enough that the
arithmetic looked survivable, and the wallet was small enough that being wrong was cheap. Flash
loans were appealing because they appeared to solve the only constraint we thought we had.

## What actually happened

Both came out negative.

Arbitrage found spreads that were already gone by the time a transaction could land. The parties
taking them run infrastructure whose whole purpose is winning that race, so we were reading state
they had already acted on.

Scalping lost money on arithmetic that was settled before the first trade. In our runs the
round-trip fee was roughly 3.6%, larger than the moves we were trying to capture, so the strategy
lost on average even when the direction was called correctly.

Flash loans changed nothing. With borrowed capital at zero fee, the arbitrage scan still found no
profitable route — because capital had never been what was missing.

These figures come from our own run notes rather than published transaction records, which is why
this entry is `medium` confidence.

## Why it worked / why it failed

Two structural causes, neither of them a code problem:

- arbitrage is a **latency** business, and we were not in it;
- scalping fails on **arithmetic** fixed by the venue's fees.

The flash-loan test was the most useful part, because it isolated the variable. We had assumed the
small wallet was the problem. Removing that constraint and still finding nothing showed the
opportunity was absent rather than out of reach — worth knowing, and cheap to establish.

## What you would need to change

For arbitrage: professional latency, which is not available to a retail participant. For scalping:
a venue whose round-trip cost sits below the volatility you are harvesting, which is a property of
the venue and not of your strategy. Compute the round trip first; if it exceeds the move, stop there.

## What to reuse

The isolation technique. When a strategy fails and you suspect capital is the reason, remove capital
as a variable cheaply — a simulation, a paper run, or borrowed capital — before raising or risking
any.

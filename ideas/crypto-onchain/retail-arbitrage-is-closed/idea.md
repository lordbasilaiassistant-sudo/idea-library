---
id: retail-arbitrage-is-closed
title: Cross-DEX arbitrage, sandwiching and scalping are all closed to a small wallet, with numbers
description: >-
  We measured three classic on-chain money strategies from a tiny wallet on a fast L2. All three
  are negative expected value for structural reasons, and the numbers say why.
category: crypto-onchain
outcome: failed
verdict: >-
  Each strategy fails to a different structural cause - professional latency, a private mempool,
  and a fee floor above the volatility - and none of the three can be fixed by a better script.
confidence: high
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
  - "Sandwich strategies do not work on a chain with a centralised sequencer and a private mempool: the pending transactions the strategy depends on seeing are not visible to you."
  - "Large-cap scalping on a DEX is negative expected value before it begins when round-trip fees are around 3.6% and the volatility being harvested is smaller than that."
  - "Compare the round-trip cost to the size of the move you are trying to capture before writing any strategy code; if fees exceed the move, no amount of signal quality rescues it."
  - "Flash loans remove the capital constraint and leave the opportunity constraint untouched - borrowing tens of thousands of ETH at zero fee still found no profitable route, because the routes were already taken."
  - "A liquidation opportunity is real but competitive and event-driven, so it rewards being permanently ready rather than being clever, which is a different kind of system than a trading bot."
supersedes: []
related: [autotrader-journal-hid-losses, key-is-not-ownership]
source: project-registry
links: {}
evidence: []
---

## What we tried

Three strategies, run from a wallet holding a fraction of one ETH, on a fast low-fee L2:

1. **Cross-DEX arbitrage** — watch the same pair on several venues, buy the cheap side, sell the
   expensive side.
2. **Sandwiching** — observe a pending swap and trade either side of it.
3. **Large-cap scalping** — harvest small moves on liquid, well-known tokens.

We also tested whether flash loans changed the picture, borrowing large amounts at zero fee to
remove capital as a variable.

## Why we thought it would work

Each is a documented strategy with public write-ups and visible historical profits. Fees on this
chain are low enough that the arithmetic looked survivable, and the wallet was small enough that
being wrong was cheap. The flash-loan angle was appealing precisely because it appeared to solve the
only constraint we thought we had.

## What actually happened

All three measured negative, each for a different reason.

Cross-DEX arbitrage found spreads that were already gone by the time a transaction could land. The
parties taking them operate infrastructure whose entire purpose is winning that race; we were
reading state they had already acted on.

Sandwiching required seeing pending transactions. On a chain with a centralised sequencer and a
private mempool, those are not observable, so the strategy has no input.

Scalping was the cleanest negative. Round-trip fees came to roughly 3.6%, and the moves we were
trying to capture were smaller than that. The strategy loses on average even when every directional
call is correct.

Flash loans changed nothing. Borrowing tens of thousands of ETH at zero fee, the scan
still found no profitable route — because capital had never been the binding constraint.

## Why it worked / why it failed

Three different structural causes, none of them a code problem:

- arbitrage is a **latency** business, and we were not in it;
- sandwiching needs **information** the chain does not publish;
- scalping fails on **arithmetic** that is fixed before the first trade.

The flash-loan test is the most useful part of the whole exercise, because it isolated the variable.
We had assumed a small wallet was the problem. Removing the constraint entirely and still finding
nothing proved the opportunity was absent rather than out of reach — which is a much more valuable
thing to know, and it took one afternoon to establish.

The one genuinely open door we found was liquidations: a large undercollateralised position needs
only a few percent of price movement to become profitable to close, and flash loans do supply the
capital for that. But it is event-driven and contested, so it rewards permanent readiness rather
than analysis, and that is a different system than the one we had built.

## What you would need to change

For arbitrage and sandwiching: nothing available to a retail participant. These are closed, and
recognising that is the finding. For scalping: the fee floor would have to drop below the volatility,
which is a property of the venue and not of your strategy. Compute the round trip first; if it
exceeds the move you are hunting, stop there.

## What to reuse

The isolation technique. When a strategy fails and you suspect capital is the reason, find a way to
remove capital as a variable cheaply — a flash loan, a simulation, a paper run at scale — before
raising or risking any. We learned more from one zero-cost test than from months of live attempts.

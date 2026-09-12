---
id: indexer-pings-are-not-demand
title: Fifty-one liquidity pools produced buy events that were not buyers
description: >-
  Creating small pools reliably triggered one or two buys each, which looked like the strategy
  working. The buys were indexers registering a new pool, not anybody trading.
category: crypto-onchain
outcome: partial
verdict: >-
  The mechanism really did fire on every pool, but the resulting buy events were automated
  indexers acknowledging a new market rather than economic demand, so the signal measured our
  own activity.
confidence: high
started: 2026-03
ended: 2026-04
effort: weeks
cost_usd: null
revenue_usd: 0
stack: [node, ethers-v6, base, multicall3]
tags: [token-launch, trading, onchain-data, verification-gap, silent-failure, deployed]
reusable: []
lessons:
  - "One or two buys arriving immediately after a new pool is created are almost always automated indexers registering the market, and they arrive whether or not a single human has seen the token."
  - "A buy event is not a buyer: classify inbound trades by whether the counterparty has any history before counting them as demand."
  - "A signal that fires reliably on every attempt and never varies with the quality of the attempt is measuring your own action rather than anybody's response."
  - "Tokens that already had markets elsewhere attracted an order of magnitude more activity than new ones under identical mechanics, which points at pre-existing distribution rather than at the mechanic."
  - "A high-volume trading address in a token's history is more often a shared router contract than a bot, and mistaking one for the other sends you hunting a whitelist that does not exist."
supersedes: []
related: [five-hundred-tokens-zero-volume, autotrader-journal-hid-losses, multicall-batch-reads]
source: project-registry
links: {}
evidence: []
---

## What we tried

We created fifty-one small liquidity pools pairing leftover token balances against a token we
wanted to generate activity for, on the theory that each new pool would draw attention to the main
market.

## Why we thought it would work

The early evidence was encouraging in the most convincing possible way: it was consistent. Every
pool we created was followed within minutes by one or two buys on the main pool. Fifty-one pools,
buy events on essentially all of them. A reproducible cause and effect.

## What actually happened

The buys were automated indexers. When a new pool appears, various services register the market,
and that registration shows up on chain as small trades. They arrive on schedule, at the same size,
from addresses with no history and no subsequent activity, and they would have arrived if nobody
anywhere had ever looked at the token.

The one case that produced real activity was a token that already had established markets
elsewhere. Under identical mechanics it drew roughly twenty times the activity of the new ones —
which located the cause in its pre-existing distribution rather than in anything we had done.

Separately, while investigating we spent significant time chasing what we believed was a
high-frequency bot dominating the trade history. It was the chain's shared router contract, through
which ordinary trades are routed. We had been hunting a whitelist that does not exist.

## Why it worked / why it failed

`partial` because the mechanism fired exactly as designed; what failed was the interpretation. The
signal was perfectly correlated with our own action and completely uncorrelated with anything we
cared about, which is the definition of measuring yourself.

Consistency is what made it persuasive. An intermittent signal invites scrutiny. A signal that fires
every single time reads as a discovered law, and we ran it fifty more times to confirm a
relationship we had never once questioned the direction of.

The check that would have ended it immediately: look at who bought. Same size every time, addresses
with no prior history, no follow-on trades, arriving on a fixed delay. None of that is what a human
or a trading strategy looks like, and all of it was visible from the first pool.

## What you would need to change

Classify counterparties before counting them. An inbound trade only counts as demand if it comes
from an address with a history that predates your token, or one that trades again afterwards. Under
that definition the strategy produced zero, and would have been abandoned after pool one.

## What to reuse

The habit: when a metric responds reliably to your own action, check whether it can respond to
anything else. A number that only ever goes up when you do something is telling you about you.

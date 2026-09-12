---
id: hardcoded-event-topic-hash
title: A single mistyped event hash made every scanner return zero results for weeks
description: >-
  Every token scanner we wrote reported nothing found. The filters were correct, the RPC was
  fine, and one hardcoded event topic hash had a typo in it.
category: tooling-infra
outcome: shipped
verdict: >-
  A copied-and-mistyped event topic hash matched nothing, so every log query returned an empty
  set and reported it as a clean result rather than as an error.
confidence: medium
started: 2026-02
ended: 2026-02
effort: weeks
cost_usd: 0
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [onchain-data, cli-tooling, silent-failure, verification-gap, deployed]
reusable: []
lessons:
  - "Derive an event topic hash in code with a helper such as ethers.id('Transfer(address,address,uint256)') rather than pasting a literal, because a wrong literal is indistinguishable from a correct one by eye."
  - "A log query with a topic filter that matches nothing returns an empty array, not an error, so a broken filter and a genuinely empty result are the same output."
  - "Any scanner that can legitimately return zero needs a positive control: point it at an address you know has activity and assert it finds something, or you cannot tell working from broken."
  - "Weeks of a scanner reporting nothing found is a suspicious result rather than a fact about the world; the second consecutive empty sweep should trigger a check of the query, not a wider search."
supersedes: []
related: [autotrader-journal-hid-losses, deploy-time-metadata-window]
source: project-registry
links: {}
evidence: []
---

## What we tried

We built a series of scanners to find token holdings, transfers and airdrops across a set of
wallets, by querying chain logs filtered on the standard ERC-20 `Transfer` event. The topic hash
for that event was hardcoded as a constant, as it appears in a hundred tutorials.

## Why we thought it would work

The `Transfer` topic hash is a fixed, well-known value. Hardcoding a constant that can never change
is ordinarily good practice — it avoids recomputing a hash on every call and makes the filter
explicit at the call site.

## What actually happened

Every scanner returned nothing. Across wallets, across time ranges, across rewrites. We assumed the
wallets were genuinely empty, then that the RPC was rate limiting, then that the block ranges were
wrong. We rewrote the scanners three times, each version producing the same clean, confident,
empty result.

The hardcoded hash had a typo in its tail. It was a valid 32-byte hex value that simply matched no
event that has ever been emitted. Every query was working perfectly and asking about an event that
does not exist.

## Why it worked / why it failed

This is the purest silent failure we have on record. A log query with a topic filter that matches
nothing does not error — it returns an empty array, because an empty result is a legitimate answer.
So the failure mode and the success-with-nothing-found mode produce byte-identical output, and no
amount of careful reading of the surrounding code will distinguish them.

The reason it survived three rewrites is that each rewrite carried the constant forward. We were
rewriting the part we could see was complicated and preserving the part that looked settled.

Two things would each have caught it in minutes. Deriving the hash in code —
`ethers.id('Transfer(address,address,uint256)')` — makes a typo impossible, because the string is
human-readable and a mistake in it is visible. And a positive control — run the scanner against an
address known to have thousands of transfers, assert it returns more than zero — turns "found
nothing" from a plausible result into a test failure.

## What you would need to change

Nothing about the approach; the scanners were fine. Derive every topic hash from its signature
string, and give any query that can legitimately return zero a known-positive fixture so that
silence becomes detectable.

## What to reuse

The general rule, which generalises well past chain data: when a query can return an empty set as a
valid answer, you have no signal from the empty case, so you must add one. Test that the thing finds
something, not only that it does not crash.

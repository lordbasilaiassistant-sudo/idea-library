---
id: fee-claim-needs-trading-first
title: A permissionless fee claim that pays nothing because no one has traded
description: >-
  The fee collection function was open to any caller and needed no API key, which felt like a
  found revenue rail until we noticed fees only exist once other people trade the token.
category: crypto-onchain
outcome: inconclusive
verdict: >-
  Fee collection really is permissionless and keyless, but it is gated on trading volume that we
  had no mechanism to create, so the open door led to an empty room.
what_would_settle_it: >-
  Launch a token where volume is produced by something other than us, then claim. Until the same
  claim path is exercised against real third-party trading, we have tested the plumbing and not
  the revenue.
confidence: high
started: 2026-04
effort: weeks
cost_usd: null
revenue_usd: 0
stack: [node, viem, base]
tags: [token-launch, trading, cold-start, distribution-gap, deployed]
reusable: []
lessons:
  - "A permissionless fee-collection function is a claim mechanism, not a revenue source; the revenue is the trading that produced the fees, and that is a different problem entirely."
  - "Removing an API key requirement removes a dependency, not a constraint, and confusing the two makes an unsolved problem look solved."
  - "When an integrator takes a percentage cut, that cut is usually fixed in the deploy transaction, so it is a deploy-time lever and cannot be renegotiated afterwards."
  - "Verify who is set as the integrator on a token deployed through somebody else's front end, because the front end commonly sets itself and that choice is permanent."
supersedes: []
related: [deploy-time-metadata-window, sdk-launch-discovery-gap]
source: project-registry
links: {}
evidence: []
---

## What we tried

We traced the fee path for tokens launched through a third-party front end and found that the
underlying fee manager exposed a `collectFees` call that any address could make. No sign-in, no API
key, no dashboard. We built the claim tooling and ran it on a schedule.

## Why we thought it would work

A permissionless function that moves money to a fee owner reads like a rail: no gatekeeper, no
account to get banned, nothing to rate limit. Compared to every other revenue path we had looked
at, the absence of an authentication step made it look unusually available.

## What actually happened

The claim worked. It claimed nothing, repeatedly, because fees accrue only when somebody swaps the
token, and nobody was swapping. We had built a correct, cheap, reliable mechanism for collecting a
number that was zero.

We also found that the front end used to deploy had written itself in as the integrator, taking a
percentage of fees that would have existed had there been any — a parameter fixed in the deploy
transaction and unchangeable afterwards.

## Why it worked / why it failed

Neither, which is why this is `inconclusive` rather than `failed`. The claim path is genuinely
sound and we would use it again. What we never tested is the thing it depends on. We had mistaken
the absence of an access barrier for the presence of an opportunity, and those look identical right
up until you measure the output.

The pattern generalises past crypto: any "free money if you just call this endpoint" is really a
question about who generates the underlying activity, and the answer is almost never you.

## What you would need to change

Produce, or borrow, real third-party volume first, and only then judge the claim path. The
threshold that would flip this to `shipped` is a single claim that returns more than the gas it
cost, paid for by trades we did not make. If you are launching through somebody else's interface,
inspect the integrator field before deploying, because it is your only chance to set it.

## What to reuse

The diagnostic question, which cost us weeks to learn to ask: when something is permissionless,
find out what it is gated on instead. Access and availability are not the same constraint, and the
binding one is rarely the one with a login form.

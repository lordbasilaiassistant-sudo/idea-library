---
id: sdk-launch-discovery-gap
title: Launching tokens through an SDK instead of the web UI, and losing every discovery hook
description: >-
  Batch-launching tokens programmatically worked and cost pennies, but SDK-deployed tokens
  never appeared in the trending feed the web UI populates, so nobody ever saw them.
category: crypto-onchain
outcome: failed
verdict: >-
  The SDK deploy produced identical on-chain state to a web-UI deploy but skipped the
  platform's server-side discovery hooks, so the launches were invisible and the cheap
  batch pipeline had nothing to feed.
confidence: high
started: 2026-05
ended: 2026-05
effort: weeks
cost_usd: 0.48
revenue_usd: 0
stack: [typescript, ethers, base, launchpad-sdk]
tags: [token-launch, smart-contracts, distribution-gap, api-undocumented-behavior, deployed]
reusable: []
lessons:
  - "A launchpad SDK and its web UI can produce identical on-chain state while the UI additionally fires server-side discovery hooks that the SDK cannot reach."
  - "Setting an `interface` or `referrer` field in SDK calldata to impersonate the web client does not reproduce the web client's discovery behaviour, because those hooks run on the platform's servers and never read calldata."
  - "Cheap batch deployment is worth nothing when the binding constraint is discovery; measure whether anyone can find the output before optimising the cost of producing it."
  - "A high-volume address in a token's trade history is more often a shared router contract than a bot, and mistaking one for the other sends you hunting a whitelist that does not exist."
supersedes: []
related: [multicall-batch-reads]
source: seed
links: {}
evidence: []
---

## What we tried

We built a batch launch pipeline against a Base launchpad's TypeScript SDK: generate art from a
keyless image endpoint, host it on a public repo, deploy through the SDK, repeat. Six launches ran
end to end for $0.48 total in gas and zero API spend. Mechanically the pipeline did exactly what it
was designed to do.

## Why we thought it would work

The launchpad's own web UI clearly produced tokens that got attention. The SDK was published by the
same team, deployed the same contracts, and emitted the same events. Our reasoning was that the UI
was a convenience wrapper over the SDK, so anything the UI could do, the SDK could do more cheaply
and forty times faster.

## What actually happened

Every SDK-deployed token landed on chain correctly and none of them appeared in the platform's
trending feed, social cast, or partner price-tracker ping. Tokens launched by hand through the web
UI in the same week did appear. We first suspected a bot whitelist, because one address dominated
the trade history of the tokens that did get traction — that address turned out to be the chain's
shared Universal Router, not a bot, and the whitelist we were hunting did not exist.

## Why it worked / why it failed

The on-chain deployment is only half of a launch. The other half is a set of server-side hooks the
platform fires when a launch originates from its own front end: feed insertion, a social post, and
a ping to an external price tracker. Those hooks are triggered by the platform's backend, not by the
transaction, so no amount of calldata shaping reaches them. We optimised the half we could see and
the invisible half was the one that mattered. This is the distribution gap in its purest form — the
mechanic worked perfectly and produced nothing, because volume at t=0 was never the constraint.

## What you would need to change

Either launch through the surface that owns the discovery hooks and accept the slower manual path,
or bring your own distribution so the platform's feed stops being load-bearing. Before either, run
the cheap test we skipped: deploy one token each way, then measure impressions rather than gas. The
threshold that would flip this verdict is any SDK-reachable path that inserts into the index — a
documented webhook, a partner endpoint, or a third-party indexer that watches the contract directly
rather than the platform's own feed.

## What to reuse

Nothing in the pipeline is worth lifting, and that is the finding. The transferable artifact is the
test order: confirm that the output can be found before you spend a week making the output cheaper.

---
id: deploy-time-metadata-window
title: Why a token's image and description cannot be fixed after deployment
description: >-
  Launchpad indexers snapshot a token's metadata once, at deploy time. Post-deploy update calls
  succeed on chain, change nothing anybody sees, and give you no error to debug.
category: crypto-onchain
outcome: failed
verdict: >-
  Metadata update calls after deployment succeed on chain but are never re-indexed, so every
  token launched with a placeholder image stayed placeholder forever with no failure signal.
confidence: high
started: 2026-04
ended: 2026-05
effort: weeks
cost_usd: null
revenue_usd: 0
stack: [ethers, viem, base, clanker-sdk]
tags: [token-launch, smart-contracts, silent-failure, api-undocumented-behavior, deployed]
reusable: []
lessons:
  - "Launchpad indexers snapshot token metadata at deploy time only; a later updateMetadata call changes contract state without changing anything a user or aggregator will ever see."
  - "A transaction that succeeds on chain is not evidence that the effect you wanted happened, because the part that mattered ran on an indexer that was never listening."
  - "The listing IS the product for a launched token: image, description and links are set in the deploy transaction or not at all."
  - "viem coerces a JavaScript object passed as a string argument into the literal text [object Object], so metadata must be JSON.stringify-ed before it goes into calldata."
supersedes: []
related: [sdk-launch-discovery-gap, fee-claim-needs-trading-first]
source: project-registry
links: {}
evidence: []
---

## What we tried

We deployed tokens quickly with placeholder metadata, intending to set the real image, description
and social links afterwards through the launchpad contract's `updateMetadata` and `updateImage`
functions. Those functions exist, are permissioned to the token admin, and were called successfully.

## Why we thought it would work

The functions are on the contract, they are documented, and they emit events. Every mental model
from ordinary web development says that a record you can update is a record that will display the
update. Deploying fast and polishing after is also the correct instinct almost everywhere else.

## What actually happened

The transactions succeeded. Contract state changed. Nothing visible changed — not on the launchpad's
own site, not in the trending feed, not on the price aggregators. The tokens kept the placeholder
image permanently. There was no error, no warning, and no failed transaction to investigate, which
is why it took multiple launches to notice rather than one.

A second, separate version of the same trap: passing a JavaScript object where the ABI expects a
string produced the literal text `[object Object]` in the deployed metadata, again with a
successful transaction.

## Why it worked / why it failed

The indexer that populates every user-visible surface reads the token's metadata once, when it first
sees the deployment, and never re-reads it. The update function is real and the event is real, but
nothing downstream subscribes to it. The on-chain write and the thing we actually wanted were two
different systems, and only one of them was listening.

This is the silent-failure shape at its purest: the feedback channel confirmed the part that did not
matter. A 2xx, a green transaction, or a state change is not evidence that the effect landed.

## What you would need to change

Set everything in the deploy transaction. Treat the deploy call as a one-shot publish with no edit
afterwards, and build the metadata — including the hosted image URL — before you deploy anything.
The verdict would only flip if an indexer began watching update events, which is a change on the
platform's side that no amount of client work can force.

## What to reuse

The habit rather than the code: after any write whose visible effect lives in somebody else's
system, go and look at that system. "The transaction succeeded" answers a question you were not
asking.

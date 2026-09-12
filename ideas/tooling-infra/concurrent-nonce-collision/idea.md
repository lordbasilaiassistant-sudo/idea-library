---
id: concurrent-nonce-collision
title: Why a wallet script kept failing when a live backend shared the same key
description: >-
  A consolidation script read the wallet nonce once and built its transactions from it, while a
  production backend was signing from the same key, so half the sends collided and vanished.
category: tooling-infra
outcome: shipped
verdict: >-
  Caching the nonce at startup is correct only for a key nobody else is using, and the fix was to
  refetch the pending nonce immediately before every single send.
confidence: medium
started: 2026-05
ended: 2026-05
effort: hours
cost_usd: null
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [smart-contracts, onchain-data, silent-failure, wrong-abstraction, deployed]
reusable: []
lessons:
  - "A transaction nonce is shared mutable state belonging to the account, not to your script, so any key a live service also signs with makes a cached nonce wrong the moment you read it."
  - "Refetch the pending nonce immediately before each send rather than incrementing a local counter, whenever there is any chance another process signs from the same key."
  - "A replaced transaction fails in a way that looks like a network problem rather than a logic problem, which sends you debugging the RPC instead of the assumption."
  - "An operational wallet used by a running backend should not also be the wallet your maintenance scripts sign from; the collision is a symptom of the key doing two jobs."
supersedes: []
related: [multicall-batch-reads]
source: project-registry
links: {}
evidence: []
---

## What we tried

We wrote a script to consolidate funds out of a wallet by sending a batch of transactions. The
standard pattern: read the account's transaction count once, then increment a local counter for
each transaction in the batch so they queue in order.

## Why we thought it would work

This is the textbook batching approach and it is correct in the ordinary case, where your script is
the only thing signing. Reading the nonce once avoids a network round trip per transaction, which
is exactly the kind of small optimisation that normally pays off.

## What actually happened

Roughly half the sends failed or were silently replaced. The failures looked like RPC flakiness —
timeouts, "replacement transaction underpriced", nothing that pointed at our logic — so the first
hour went into retry policy and provider configuration rather than into the actual cause.

The cause was that a production backend was signing transactions from the same wallet at the same
time. Every transaction it sent consumed a nonce our script believed it owned, and our carefully
sequenced batch was building on a number that had gone stale between reading it and using it.

## Why it worked / why it failed

The fix worked and is boring: refetch the pending nonce immediately before every send, accept the
extra round trip, and treat each transaction as independent. Throughput dropped and reliability went
to full.

The deeper failure was architectural rather than technical. One key was doing two jobs — serving a
live product and running maintenance — and a shared-mutable-state bug is the predictable result. The
nonce collision was the symptom that made an existing design problem visible.

## What you would need to change

If you control the architecture, separate the keys: a service key for the running backend and a
different key for operational scripts. If you cannot, refetch per send and never batch-increment.
The optimisation of reading once is only safe when you can prove sole ownership of the account, and
in a system with a live backend you usually cannot.

## What to reuse

The debugging lesson more than the fix. When an error surfaces at the transport layer, check whether
something upstream is sharing state with you before you spend time on the transport. The error
message names where the failure appeared, not where it came from.

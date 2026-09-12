---
id: multicall-batch-reads
title: Reading thousands of contract values through Multicall3 instead of a block explorer API
description: >-
  Replacing per-token explorer API calls with batched Multicall3 aggregates against a public
  RPC made bulk on-chain reads roughly two orders of magnitude faster and removed the API key.
category: tooling-infra
outcome: shipped
verdict: >-
  Batching reads into Multicall3 aggregates against a public RPC removed both the rate limit
  and the API key that made per-token explorer loops slow and fragile.
confidence: medium
started: 2026-04
effort: days
cost_usd: 0
revenue_usd: 0
stack: [node, ethers-v6, base, multicall3]
tags: [onchain-data, api-integration, zero-marginal-cost, rate-limits, deployed]
reusable: []
lessons:
  - "Multicall3 is deployed at the same address on every major EVM chain, so one batching implementation ports across chains without a per-chain address table."
  - "Block explorer APIs are built for single lookups, and using one in a per-item loop turns a rate limit into the dominant cost of a job that has no real reason to be slow."
  - "Batch size is the tuning knob that matters for aggregate calls: around one hundred calls per aggregate stays under typical public RPC response limits while keeping round trips low."
  - "A public RPC with your own retry and backoff removes an API key from the dependency list, which matters more than latency when the key is the thing that expires or gets rate limited."
supersedes: []
related: [sdk-launch-discovery-gap]
source: seed
links: {}
evidence: []
---

## What we tried

We needed to read balances, metadata, and pool configuration for a few thousand tokens on Base. The
first implementation looped over a block explorer's API, one HTTP request per token per field. We
replaced it with `aggregate3` calls to Multicall3 at
`0xcA11bde05977b3631167028862bE2a173976CA11` against a public Base RPC, batching roughly a hundred
calls per request, with our own retry and backoff around the transport.

## Why we thought it would work

The explorer API and the RPC ultimately read the same chain state. The explorer adds indexing,
authentication, and a rate limit we did not need for a read we could perform ourselves. Multicall3
exists specifically to collapse many view calls into one `eth_call`, so the round-trip count — the
thing actually costing us time — should collapse with it.

## What actually happened

The batched version completed jobs that had previously taken tens of minutes in well under a minute —
roughly one to two orders of magnitude faster, depending on the job shape, by our own before-and-after
timings. We have not published those timings, so treat the size of the gap as our report rather than
a benchmark. It also stopped failing on rate limits, and it dropped the explorer API key from
the dependency list entirely. Confidence here is `medium` rather than `high` because the comparison
was made against our own earlier implementation on live network conditions, not as a controlled
benchmark, and the spread across job shapes is wide.

## Why it worked / why it failed

The original cost was never computation, it was round trips and a rate limit. Multicall3 attacks
exactly that: one network round trip returns a hundred results, so the per-item cost approaches
zero and the rate limit stops being the binding constraint. This is the rare case where the obvious
tool is the correct tool and the only real work is batch sizing.

## What you would need to change

Very little for reads. This approach does not extend to writes, to historical state beyond what the
node retains, or to anything requiring the explorer's own indexes such as full transaction history
for an address. For those, the explorer API remains the right call — just not inside a loop.

## What to reuse

The pattern rather than our code: batch view calls into `aggregate3`, cap each batch near one
hundred calls, own your retry logic, and use the canonical Multicall3 address rather than a
per-chain lookup table.

---
id: forty-three-services-no-customers
title: We built forty-three paid micro-services and never found a single customer
description: >-
  Thirty-five working paid endpoints, eight broken, zero external buyers. The supply was real
  and the demand was never checked, which is the most expensive mistake in this library.
category: web-saas
outcome: failed
verdict: >-
  Every unit of effort went into supply and none into demand, so we ended with a catalogue of
  working services that nobody had ever asked for and no channel through which anyone could.
confidence: medium
started: 2026-03
ended: 2026-04
effort: months
cost_usd: null
revenue_usd: null
stack: [node, cloudflare-workers, x402, base]
tags: [payments, api-integration, marketplace, distribution-gap, oversaturated, deployed]
reusable: []
lessons:
  - "Counting shipped services measures effort, not progress; forty-three endpoints and zero customers is the same business as zero endpoints and zero customers, minus the months."
  - "Building the next service is always easier than finding the first customer, which is exactly why a builder will do it forty-three times instead of once."
  - "A machine-payable endpoint removes the friction of paying and does nothing about the absence of anyone who wants the thing, and those are unrelated problems."
  - "Revenue that arrives from a mechanism you already owned - in our case liquidity-pool fees - is not validation of the thing you spent the months building, and counting it as such hides the result."
  - "The question that would have ended this in week one is: who asked for this, and where would they encounter it? Neither had an answer at any point."
supersedes: []
related: [fee-claim-needs-trading-first, five-hundred-tokens-zero-volume]
source: project-registry
links: {}
evidence: []
---

## What we tried

We built a fleet of machine-payable micro-services — token deployment, contract scanning, batch
transfers, liquidity checks — each behind a per-call payment protocol so that an autonomous agent
could pay for a single request without an account or a subscription. By the time we stopped there
were forty-three of them. Thirty-five worked. Eight had broken at some point and nobody noticed,
which is its own signal.

## Why we thought it would work

The reasoning was that agents would increasingly need paid tools, that per-call payment removed the
friction of signing up, and that whoever had the broadest catalogue when that demand arrived would
capture it. Each individual service took a day or less, so the marginal cost of one more looked
trivially worth it.

## What actually happened

Zero external customers. Not a low number — zero, across the entire fleet, for the whole period.
The only revenue attached to the project — about thirty dollars, per our own notes rather than a record we can publish — came from liquidity-pool fees on an
unrelated mechanism we already owned, not from anybody buying a service. Eight services were broken
and their breakage had gone undetected because no traffic ever hit them.

## Why it worked / why it failed

Every unit of effort went into supply. None went into demand. We never found out where a potential
buyer would encounter these services, never listed them anywhere an agent would look, and never
spoke to a single person who wanted one. The catalogue was real; the market was assumed.

The trap is that building is legible and finding demand is not. Shipping service thirty-eight feels
like progress, produces a visible artifact, and can be done alone in an afternoon. Finding the first
customer is ambiguous, externally dependent, and can fail in ways that feel personal. So a builder
left alone will always choose the first, and the count of shipped things becomes a substitute for a
result.

That thirty dollars deserves its own note, because it was actively harmful. It let the project report
non-zero revenue. A number that arrives from somewhere you were not testing is worse than a zero,
because a zero is unambiguous.

## What you would need to change

Invert the order completely. Find where agents actually shop for paid tools — a registry, a
marketplace, an index — and list one service there before building the second. If no such surface
exists, that is the finding, and it is worth more than forty more endpoints. We had listed on none
of them.

## What to reuse

Nothing in the code. The reusable artifact is the stopping rule: if you cannot name the surface on
which a stranger would encounter what you are building, you are working on supply, and the count of
things you have shipped is not evidence of anything.

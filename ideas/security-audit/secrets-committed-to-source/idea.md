---
id: secrets-committed-to-source
title: An audit of our own app found hardcoded credentials that every prior read had missed
description: >-
  A multi-agent security pass over one of our shipped web apps found hardcoded credentials, an
  unauthenticated privileged endpoint, and a scheduled job that failed open.
category: security-audit
outcome: shipped
verdict: >-
  The findings were only surfaced because we ran a deliberate audit, which means the same class of
  mistake had been shipping unnoticed for as long as the app had existed.
confidence: medium
effort: days
cost_usd: null
revenue_usd: 0
stack: [web-app, database, smart-contracts]
tags: [smart-contracts, api-integration, verification-gap, worked-as-designed, deployed]
reusable: []
lessons:
  - "Hardcoded credentials survive in a codebase because nothing routine ever looks for them; every commit hook, test and code review we had passed them without comment."
  - "A scheduled job that fails open turns an outage in one dependency into an authorisation bypass, so cron and webhook handlers should deny by default when a check cannot complete."
  - "An endpoint that triggers a privileged action needs authentication even when it is undocumented, because obscurity of a route is not a control over it."
  - "Error handlers that return the raw exception message leak schema names, file paths and query fragments to anyone who can provoke a failure."
  - "A payment or claim flow needs a database-level uniqueness constraint rather than an application-level check, because two concurrent requests will both pass the check before either writes."
  - "Removing a credential from the current code does not remove it from version history, so a leaked secret has to be rotated, not just deleted."
supersedes: []
related: [autotrader-journal-hid-losses]
source: project-registry
links: {}
evidence: []
---

## What we tried

A deliberate security pass over a live web application and its contracts, using several agents
working in parallel on different surfaces — contracts, backend, frontend, infrastructure — rather
than a single reviewer.

We have intentionally left out which application, when, and its exact stack. The lessons do not
depend on those details, and publishing them would point readers at a specific codebase.

## Why we thought it would work

We did not expect much. The app worked, had been running for a while, and had been read many times
during development. The audit was scheduled as diligence rather than because anything looked wrong,
which turned out to be the point.

## What actually happened

It found credentials hardcoded in committed source. It found an endpoint that triggered a privileged
operation with no authentication. It found a scheduled job that, when its verification step errored,
proceeded as though verification had passed. It found a claim flow where two concurrent requests
could both succeed, and many places where a raw exception message was returned to the caller.

None of it had been noticed across every prior read of the same code.

## Why it worked / why it failed

The audit worked because it was a different activity from development, run by readers whose only job
was to look for this class of problem. Ordinary development attention slides past a hardcoded
credential, because when you read for behaviour, a working credential looks like working code.

The honest finding is not the list of bugs. It is that the list existed in a codebase we believed we
knew, and that our normal process had no step that would ever have surfaced it. The fix is mechanical
detection that runs whether or not anyone is paying attention — which is why this library ships a
blocking secret scanner rather than a code-review guideline.

## What you would need to change

Move each of these from "someone should notice" to "something always checks": a secret scanner in
the commit hook and in CI, a test asserting that an unauthenticated request to a privileged route is
rejected, and a default-deny branch in every handler where a verification step can throw. Rotate any
credential that was ever committed — deleting it from the current code leaves it in history. An audit
is a snapshot; a check is a ratchet.

## What to reuse

Run the audit as a separate activity with its own readers, and treat anything it finds as evidence
about your process rather than about that one bug. The question to ask afterwards is not "how did this
get in" but "what would have caught it, and why was that not running".

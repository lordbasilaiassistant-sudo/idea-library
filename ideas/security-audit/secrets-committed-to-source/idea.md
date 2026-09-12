---
id: secrets-committed-to-source
title: An audit of our own app found a database password, an auth secret and an admin key in the source
description: >-
  A four-agent security pass over a shipped web app turned up three hardcoded credentials, an
  unauthenticated treasury endpoint, and a cron that failed open instead of closed.
category: security-audit
outcome: shipped
verdict: >-
  Nothing was exploited, but the findings were only found because we ran a deliberate audit, which
  means the same class of mistake had been shipping unnoticed for as long as the app had existed.
confidence: high
started: 2026-02
ended: 2026-02
effort: days
cost_usd: null
revenue_usd: 0
stack: [nextjs, postgres, solidity, base]
tags: [smart-contracts, api-integration, verification-gap, worked-as-designed, deployed]
reusable: []
lessons:
  - "Hardcoded credentials survive in a codebase because nothing routine ever looks for them; every commit hook, test and code review we had passed them without comment."
  - "A scheduled job that fails open turns an outage in one dependency into an authorisation bypass, so cron and webhook handlers should deny by default when a check cannot complete."
  - "An endpoint that triggers a treasury action needs authentication even when it is undocumented, because obscurity of a route is not a control over it."
  - "Error handlers that return the raw exception message leak schema names, file paths and query fragments to anyone who can provoke a failure."
  - "A payment or claim flow needs a database-level uniqueness constraint rather than an application-level check, because two concurrent requests will both pass the check before either writes."
supersedes: []
related: [autotrader-journal-hid-losses]
source: project-registry
links: {}
evidence: []
---

## What we tried

We ran a deliberate security pass over a live web application and its contracts, using several
agents working in parallel on different surfaces — contracts, backend, frontend, infrastructure —
rather than a single review. Roughly thirty distinct tasks came out of it.

## Why we thought it would work

We did not expect much. The app worked, had been running for a while, and had been read many times
during development. The audit was scheduled as diligence rather than because anything looked wrong,
which turned out to be the point.

## What actually happened

It found a database password, an authentication secret, and an admin key hardcoded in committed
source. It found an endpoint that triggered a treasury operation with no authentication at all. It
found a scheduled job that, when its verification step errored, proceeded as though verification had
passed. It found a claim flow where two concurrent requests could both succeed, and more than twenty
places where a raw exception message was returned to the caller.

All of it was fixed. None of it had been exploited as far as we could tell. But none of it had been
noticed either, across every prior read of the same code.

## Why it worked / why it failed

The audit worked because it was a different activity from development, run by readers whose only
job was to look for this class of thing. Ordinary development attention slides straight past a
hardcoded password, because when you are reading for behaviour, a working credential looks like
working code.

The honest finding is not the list of bugs. It is that the list existed at all in a codebase we
believed we knew, and that our normal process had no step that would ever have surfaced it. The
fix for that is mechanical detection that runs whether or not anyone is paying attention — which is
why this library itself ships a blocking secret scanner rather than a code review guideline.

## What you would need to change

Move every one of these from "someone should notice" to "something always checks": a secret scanner
in the commit hook and in CI, a test that asserts an unauthenticated request to a privileged route
is rejected, and a default-deny branch in every handler where a verification step can throw. An
audit is a snapshot; a check is a ratchet.

## What to reuse

Run the audit as a separate activity with its own readers, and treat anything it finds as evidence
about your process rather than about that one bug. The question worth asking afterwards is not
"how did this get in" but "what would have caught it, and why was that not running".

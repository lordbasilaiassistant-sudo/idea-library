---
id: circular-api-key-registration
title: A registration flow where you need the API key to retrieve the API key
description: >-
  Registering an agent returned a key exactly once, every later command required that key, and
  re-registering the same wallet failed as already registered. Losing the key locked us out.
category: automation-ops
outcome: partial
verdict: >-
  Every command including the one that shows your credentials required the key that registration
  returned once, so an unsaved key left the account permanently unreachable through the CLI.
confidence: high
started: 2026-04
ended: 2026-04
effort: hours
cost_usd: 0
revenue_usd: 0
stack: [node, cli, base]
tags: [api-integration, cli-tooling, token-launch, api-undocumented-behavior, deployed]
reusable: []
lessons:
  - "Treat any credential a registration flow prints as unrecoverable and write it to storage in the same step that creates it, before doing anything else with the response."
  - "A CLI whose status command requires the credential it would help you find has a genuine bootstrap cycle, and the only exit is the copy you kept at registration time."
  - "Re-registering with the same wallet or identity commonly fails as already registered rather than reissuing credentials, so the retry path you expect to exist frequently does not."
  - "A CLI that defaults to a testnet will happily report success for work that never touched the network you meant, so pass the network explicitly on every command rather than trusting the default."
  - "Passing a credential through an unset shell variable expands to an empty string, and the request then fails as unauthenticated rather than as malformed, which sends you debugging the wrong layer."
supersedes: []
related: [deploy-time-metadata-window]
source: project-registry
links: {}
evidence: []
---

## What we tried

We registered an automated agent with a third-party launch service through its CLI, intending to
drive it on a schedule. Registration succeeded and printed an API key.

## Why we thought it would work

Standard shape: register, get a key, use the key. We expected a dashboard, a re-issue command, or at
minimum a way to read the key back from the account we had just created.

## What actually happened

The key was printed once. Every subsequent command — including the status command that reports your
agent's configuration — required it as an argument. Attempting to register again with the same
wallet returned "already registered" rather than reissuing, so there was no path back to a key we
had not saved.

Two smaller traps sat alongside it. The CLI defaulted to a testnet, so commands appeared to succeed
while operating on a network we did not care about, and had to be given the network explicitly every
time. And passing the key through a shell variable that was not set expanded to an empty string,
producing an authentication failure that looked like a bad key rather than a missing one.

## Why it worked / why it failed

`partial` because the service worked once configured; what failed was everything around obtaining
and holding the credential. The bootstrap cycle is real and has no software workaround: the only
copy of the key is the one you captured at the moment it was issued.

None of these are exotic. They are the ordinary texture of integrating against a young tool, and the
reason they cost hours rather than minutes is that each one fails in a way that points somewhere
else — the testnet default looks like success, the empty variable looks like a rejected key, and the
re-registration error looks like the account already being set up correctly.

## What you would need to change

On our side: capture credentials to persistent storage inside the same step that creates them, and
never let a registration response pass through a terminal as its only home. On the service's side,
a re-issue path would remove the cycle entirely.

## What to reuse

A habit for any new CLI or API: assume a printed credential is issued exactly once, assume the
default network or environment is not the one you want, and echo the variable you are about to
interpolate before you interpolate it.

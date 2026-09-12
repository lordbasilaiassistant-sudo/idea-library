---
id: autotrader-journal-hid-losses
title: An automated trading fleet that reported itself as roughly break-even while losing money
description: >-
  The fleet's own journal was the only record of its performance, and an audit found it was
  accounting for about a third of the actual loss.
category: ai-agents
outcome: failed
verdict: >-
  The fleet lost money and its self-reported journal showed roughly a third of that loss, because
  the journal recorded the events the code knew how to write down rather than the money that moved.
confidence: high
started: 2026-05
ended: 2026-06
effort: weeks
cost_usd: null
revenue_usd: 0
stack: [node, ethers-v6, base]
tags: [agent-harness, trading, verification-gap, silent-failure, deployed]
reusable: []
lessons:
  - "An automated system's own log is a record of what its authors anticipated, so using it as the performance measurement means grading the system with a ruler it cut itself."
  - "Reconcile an automated trader against wallet balance change over the period, because balance is the only number that cannot be shaped by a bug in the code that reports it."
  - "Costs that arrive through paths the journal has no writer for - failed transactions, slippage, gas on reverts, dust left in intermediate tokens - are exactly the costs that go unrecorded."
  - "A high request rate against several endpoints is concentration of activity rather than evidence of volume, and reading it as traction inverts what the number means."
supersedes: []
related: [secrets-committed-to-source, never-funded-agent]
source: project-registry
links: {}
evidence: []
---

## What we tried

We ran a fleet of automated trading agents and instrumented them to write a journal of every action:
entries, exits, sizes, outcomes. The journal was the dashboard, the debugging surface, and the
performance record.

## Why we thought it would work

Instrumenting your own system is standard practice, and the journal was detailed. It had per-trade
records and rolled up cleanly. There was no reason on the face of it to distrust it — it was written
by the same careful process as the trading logic.

## What actually happened

An audit that reconciled the journal against actual wallet balances found the fleet had lost
meaningfully more than it reported. The journal captured roughly a third of the real loss.

Nothing in it was falsified. It recorded, accurately, every event for which somebody had written a
recording path. What it missed were the costs with no writer: reverted transactions that consumed
gas, slippage between the quoted and executed price, dust stranded in intermediate tokens, and
retries that each cost something. Every one of those is a real debit and none of them looked like a
"trade" to the code.

We had also been reading a high request rate across several RPC endpoints as a sign of activity.
It was concentration — the same work hitting more endpoints — not more work.

## Why it worked / why it failed

The failure was epistemic, not financial. The money was gone either way; what made it a compound
failure is that our measurement instrument was built by the same process as the thing being
measured, and shared its blind spots exactly. A bug in the trading logic and a gap in the journal
have a common cause, so the journal is least trustworthy precisely when it matters most.

The general form: any system that grades itself will pass. This is the same reason a test you wrote
for your own code proves less than one written by somebody who has not seen it.

## What you would need to change

Measure with something the system does not control. Wallet balance at the start of the period versus
balance at the end, net of deposits, is crude, complete, and impossible for a logging bug to distort.
Use the journal for diagnosis — it is genuinely good at telling you why — but never for scoring. If
the two disagree, the balance is right.

## What to reuse

The reconciliation habit. For anything automated that touches money, define the ground-truth number
before you build the instrumentation, and make it a number that comes from outside the system.

---
id: five-hundred-tokens-zero-volume
title: Five hundred tokens, one hundred and forty generic names, and zero trading volume
description: >-
  Deploys were free and gas was sponsored, so we launched at volume to see whether quantity
  could substitute for narrative. It cannot, and the result was unambiguous.
category: crypto-onchain
outcome: failed
verdict: >-
  Launch quantity has no relationship to trading volume, because a token with no narrative, no
  distinctive art and no community signal gives a buyer nothing to act on however many exist.
confidence: medium
started: 2026-02
ended: 2026-05
effort: months
cost_usd: null
revenue_usd: 0
stack: [base, solana, canvas, launchpad-sdk]
tags: [token-launch, trading, oversaturated, craft-floor, distribution-gap, deployed]
reusable: []
lessons:
  - "Free deploys and sponsored gas remove the cost of launching and change nothing about the cost of being worth buying, which is why a launch count is not a strategy."
  - "A token's name alone moves nothing: one hundred and forty single-word generic tokens produced zero volume between them, while the variable that separated the survivors was narrative, distinctive art and a visible community signal."
  - "Fee revenue on a swap fee is a fraction of volume, so at zero volume every fee tier is worth the same amount - nothing - and comparing platforms on their fee split before you have volume is a wasted comparison."
  - "Text on a gradient reads as a placeholder to the exact audience being courted; the launches with hand-made or generated art were the only ones that drew any attention at all."
  - "When a platform advertises a daily deploy limit, treat the limit as a hint about what the platform expects to be spam rather than as a target to reach."
supersedes: []
related: [forty-three-services-no-customers, sdk-launch-discovery-gap, deploy-time-metadata-window]
source: project-registry
links: {}
evidence: []
---

## What we tried

Two campaigns, running on the same premise. On one chain we deployed roughly five hundred tokens
through a launchpad that sponsored the gas, making each deploy free. On another we launched a
smaller batch of memecoins by hand. A separate earlier run had already put out about one hundred and
forty tokens with generic single-word names — animals, mythological creatures, nouns.

The premise was that deployment was free, fee capture was automatic, and therefore the expected
value of one more launch was positive as long as any of them eventually caught.

## Why we thought it would work

The fee mechanics genuinely favour the creator: a percentage of every swap, routed automatically,
with no claiming required. The arithmetic said that a thousand dollars of daily volume on a token
returned a few dollars a day, and a hundred thousand returned several hundred. With deploys free,
the only question appeared to be how many lottery tickets we could hold.

## What actually happened

Zero volume. Not thin volume — effectively none, across five hundred tokens, none of which
graduated, with no claimable fees at the end of it. The portfolio value attached to the whole
campaign was under fifteen dollars. The one hundred and forty generically-named tokens from the
earlier run produced zero between them.

The handful of launches anywhere that did attract attention had three things in common, and none of
them was the name: real art rather than text on a gradient, a narrative tied to something happening
in the world, and some visible signal that other people were present.

## Why it worked / why it failed

The arithmetic was correct and irrelevant. It computed the revenue that follows from volume, and we
had treated volume as a thing that happens to tokens rather than a thing that has a cause. Free
deploys removed the cost of launching; they did not create a reason for anybody to buy. So we
industrialised the step that was already cheap.

The lottery-ticket framing is the specific error worth naming. A lottery ticket has a defined
non-zero probability. These launches had a probability indistinguishable from zero, because the
mechanism by which a stranger would ever see one did not exist. Multiplying zero by five hundred is
the whole result.

## What you would need to change

Make one launch that somebody would want, and measure whether anybody did, before making a second.
If the answer is no, the number of launches is not the variable. The threshold that would flip this
verdict is a single token that reached real third-party volume — and if you can produce that once,
you do not need five hundred.

## What to reuse

The negative result, which is the point of recording it: quantity does not substitute for craft or
narrative in a market where discovery is the constraint. Anyone considering an industrialised launch
strategy can read this and skip three months.

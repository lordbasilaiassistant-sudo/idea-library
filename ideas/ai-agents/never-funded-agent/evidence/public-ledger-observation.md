# Public ZERO earning observation

Observed on 2026-09-13 using read-only HTTPS requests to:

- https://zero-agent.broke2built.workers.dev/status
- https://zero-agent.broke2built.workers.dev/ledger

Both requests returned HTTP 200. No transaction was submitted and no funds were moved.

The status response contained `lifetime_earned.measured_usd = 0.074421` and listed
`beefy-harvest-caller-fees` under `measured_route_ids`. Its classification rule says
code-measured values are written by `harvest.mjs` from measured balance deltas.

The ledger's `routes["beefy-harvest-caller-fees"]` contained:

| Field | Observed value |
|---|---|
| attempts | 30 |
| successes | 26 |
| earned_usd | 0.074421 |
| last.at | 2026-07-30T05:28:55.294Z |
| last.outcome | success |
| dead | true |

The route notes include token reward deltas and transaction references. The protocol
caller-fee mechanism is the payer source, rather than an operator purchase. The status
response separately identifies model-reported values and a holdings-based estimator;
those values are excluded from this entry's revenue figure and are not summed.

## Scope and limits

This is a capture of public operational records, not an independent audit of the entire
chain history or the accounting implementation. The two endpoints belong to the same
operator, so agreement between them is not independent corroboration. Confidence remains
medium. The route is historical and marked inactive; this evidence does not promise
current availability, sustainable earnings, or profitability.

The recorded amount is the route's cumulative measured USD reward value, not a payout or
complete lifetime revenue. No full fee, refund, gas or infrastructure reconciliation was
performed for this entry; operating cost and net profit are not asserted.

The operator reaffirmed the unfunded-start experiment and its completed earning result
on 2026-09-13. This observation does not itself re-prove every historical funding event.
Wallet addresses and private operating records are intentionally not copied into the library.

The original entry already stated that the agent earned but labeled the result inconclusive
because general repeatability was unknown. This correction separates demonstrated earning
from the further research question of how consistently other agents can repeat it.

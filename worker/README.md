# Vote API

A Cloudflare Worker that accepts votes on library ideas and appends them to a log.

**Not deployed yet.** These files are the implementation; nothing is live, and the
scoreboard currently runs on reality, evidence and transfer only. See
`data/scoreboard.json` for what is actually being scored today.

## Why a log rather than a counter

The board's authority comes from being auditable, not from being unhackable. Every
accepted vote is appended with the signals that justified accepting it, and the
scoreboard is recomputed from the log. A fraud campaign discovered a month later is
therefore reversible: mark the rows, recompute, done.

A score nobody can reproduce is a rumour. `scripts/scoreboard.mjs` regenerates
`data/scoreboard.json` byte-identically from the same inputs, and that property is
what the whole design protects.

## Controls

| Layer | Catches |
|---|---|
| Turnstile | the trivially scripted flood |
| HMAC'd IP identity | repeat voting — **without storing any IP address** |
| Rate limits at IP / subnet / ASN | botnets spread across a /24 that a per-IP limit cannot see |
| Hosting-ASN weighting | datacenter and VPN votes, counted at reduced weight and labelled |
| Proof of work | volume; a few hundred ms once, expensive ten thousand times |
| Velocity decay | spikes on a single idea, which dilute automatically |
| Signed agent votes | agents voting as themselves rather than imitating browsers |
| Public anomaly report | everything above, visibly |

The salt rotates daily, so yesterday's identity hashes cannot be linked to today's.
A fraud control that becomes a tracking database is not a win.

## Deploying

```bash
wrangler kv namespace create VOTES      # put the id in wrangler.toml
wrangler secret put IP_SALT
wrangler secret put CHALLENGE_SECRET
wrangler secret put TURNSTILE_SECRET
wrangler deploy
```

## Before trusting it

Run the fraud drill and watch each control fire: a scripted flood from one IP, from
a /24, and from a hosting range. Each must be caught or diluted, and each must appear
in `/api/anomalies`. A gate nobody has watched fail is decoration — that applies here
exactly as it does to the secret scanner.

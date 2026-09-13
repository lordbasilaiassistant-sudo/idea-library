## What this adds

<!-- One or two sentences. If it adds an idea, name the idea and its outcome. -->

## Checklist

- [ ] `npm run check` is green locally (it is exactly what CI runs)
- [ ] No secrets, `.env` files, local paths, emails, phone numbers, or personal data
- [ ] Any wallet address is allowlisted in `data/public-addresses.allow.json` with a reason
- [ ] Every number in `cost_usd` / `revenue_usd` was **measured**, or is `null` — no remembered figures
- [ ] The verdict is one sentence naming a **cause**, not a symptom
- [ ] Each lesson names its own subject and survives being quoted out of context
- [ ] Tags exist in `data/taxonomy.json`, including at least one **mechanic** tag
- [ ] All six body sections are present
- [ ] Regenerated files are committed (`index.json`, `llms.txt`, `LESSONS.md`, …)

## Evidence

<!-- What did you measure, when, and where? Tx hashes, logs, curl output, dates.
     "It worked for me" is not evidence; "ran 2026-09-10, 40/40 succeeded, log attached" is. -->

## If you are an AI agent

- Model:
- Effort / reasoning level:
- Prompt hash (SHA-256 of the task prompt, no private prompt text):
- Tokens (measured, or unavailable):
- Cost of this PR:
- Did you write and also rate this content? (If yes, say so — we route it to a different reviewer.)

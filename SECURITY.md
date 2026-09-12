# Security

## Found something private in this repo?

Open an issue with **only the file path**. Do not paste the content, do not describe what it is.
We will rotate, scrub, and rewrite history as needed.

This library is assembled in part from private working notes, so leakage is the failure mode we
design against rather than hope to avoid.

## How the gate works

`scripts/scrub.mjs` runs in three independent places — `npm run build`, the `pre-commit` hook, and
GitHub Actions — because a gate with one chokepoint is a gate with one bypass.

- **Generic patterns**: private keys, PEM blocks, seed phrases, JWTs, and the key shapes of the
  common API providers; any `.env` file; any `*_KEY=` / `*_SECRET=` / `*_TOKEN=` with a real value;
  local filesystem paths; email addresses; phone numbers; street addresses.
- **A private denylist** of specific personal literals, held in a repo secret and never committed.
  CI **fails** if it is not loaded — Class B silently off is exactly how this gate would rot.
- **Wallet addresses are default-deny.** Any `0x`-prefixed 40-hex string fails unless it is listed
  in `data/public-addresses.allow.json` with a reason. A leak by omission is the failure an
  allowlist prevents and a denylist does not.

Code is imported into `ideas/**/code/` **file by file**, never by copying a directory, and each file
is scanned individually. A file that fails is redacted and re-scanned, or left out.

## Verifying the gate yourself

Do not trust it because we say it works. Run the drill and watch it fail:

```bash
node scripts/canary.mjs
```

It plants a fake secret of every class the gate claims to catch into `_inbox/`, runs the scrub,
reports CAUGHT or MISSED per class, removes the file, and confirms the tree is clean again. Any
MISSED line is a hole in the gate and a bug worth reporting.

A gate nobody has watched fail is decoration.

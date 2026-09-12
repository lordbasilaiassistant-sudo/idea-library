# Copilot instructions

Read [AGENTS.md](../AGENTS.md). It is the single contract for every agent contributing to this
repository, regardless of vendor. Nothing here overrides it.

- `index.json` is the full catalog in one fetch — read it before writing anything.
- Run `npm run check` before committing; it is exactly what CI runs and needs no install.
- Never hand-edit a file carrying a `GENERATED` banner.
- Never commit secrets, `.env` files, local paths, personal data, or a wallet address that is not
  allowlisted in `data/public-addresses.allow.json`.

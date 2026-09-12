# CLAUDE.md

Read [AGENTS.md](AGENTS.md). It is the single contract for every agent contributing to this
repository, regardless of vendor or harness. Nothing in this file overrides it.

Quick orientation:
- `index.json` is the whole catalog in one fetch. Read it before writing anything; do not crawl the tree.
- `npm run check` is exactly what CI runs. Zero dependencies, no install step.
- Generated files carry a `GENERATED` banner. Never hand-edit one.
- Wallet addresses are default-deny. Secrets, PII and local paths are blocked by `npm run scrub`.

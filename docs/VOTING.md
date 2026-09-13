# Community voting

A vote means an experiment is worth learning from. It does not verify the verdict,
declare a project profitable, or authorize changing its outcome.

## Cast a vote

Use **Vote for this experiment** on its page. GitHub handles account sign-in and
ballot submission. Your ballot is public: name a specific useful lesson, result or
question, without posting personal information. A reviewer checks its substance
before an approved, signed receipt is merged into this repository. This is reviewed
voting, not an instant like button. Pending submissions do not affect the banner.

- Accounts must be at least 90 days old when the ballot is submitted.
- One counted vote per GitHub account per experiment; five active choices per account.
- A reviewer cannot approve their own vote. Repository maintainer votes do not count.
- Duplicate ballots and choices beyond the first five are excluded deterministically,
  ordered by submission time and issue number. Close an earlier ballot to withdraw it.
- Editing the ballot invalidates its approval at the next reconciliation. Review binds
  the complete ballot body to a cryptographic hash, not merely an acceptance label.
- Public receipts expire 30 days after their last reconciliation. Closing a ballot
  requests withdrawal; it takes effect when the next reconciliation PR is merged.
  Receipts and the displayed tally date make this delay visible.

The featured banner uses community order only for experiments with at least five
distinct counted voters. Until that threshold is met it explicitly shows **Library
score** picks. Community counts never enter the calculated evidence score.

## What the protection does—and does not—prove

The system rejects unsigned counts, arbitrary vote weights, duplicate identities,
self approval and changed ballot content. Only the off-repository signing key can
produce receipts that the build accepts. Visitors cannot write counts through a
browser endpoint. Required PR checks preserve existing receipts as an immutable
ordered prefix, preventing deletion of withdrawal events. Public data contains pseudonymous account hashes and issue numbers,
not email addresses, IP addresses or account profiles.

GitHub hosts ballot submission and its abuse controls. This site has no anonymous
vote-writing endpoint and does not collect voter IPs. IP-based limits can slow floods,
but a shared network is not a shared person, and VPNs can evade an IP block. If direct
voting is added later, apply server-side IP throttling as an additional signal,
not proof of a unique voter or a blanket household ban.

No public voting system can guarantee distinct humans. Coordinated aged accounts,
compromised accounts, dishonest reviewers and a stolen signing key remain risks.
Reviewers must reject copied rationales, paid votes and coordinated campaigns.
Moderation and the account-age rule add friction for legitimate new contributors;
they may still submit corrections and experiments without voting eligibility.

## Maintainer workflow

1. Read the ballot and the cited experiment in full. Check that the reason is specific
   and independently useful, and investigate signs of coordination. Never fetch
   arbitrary evidence links automatically or execute their contents.
2. Run `node scripts/votes.mjs approve ISSUE --reviewed` after substantive review.
   The tool verifies GitHub identity and eligibility and signs the exact ballot body.
3. Run `node scripts/votes.mjs sync` before publishing a voting update. This reconciles
   closures and edits against GitHub; failed requests abort without a partial write.
4. Run `npm run check`, review the receipts, and publish through a PR. Deployments
   regenerate the tally and banner from that approved repository state.

The signing key is generated once with `node scripts/votes.mjs init` and stays in
the operator's private secrets directory. It is never available to PR CI or Pages.
The public verification key lives in `data/vote-public-key.pem`; changes to that key,
the ledger or verification rules require security review. `sync` does not approve new
votes. No unattended moderation or periodic reconciliation service is deployed.

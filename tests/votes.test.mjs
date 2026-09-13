import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  hash,
  payload,
  tallyVotes,
  eligibility,
  assertAppendOnly,
} from "../scripts/lib/votes.mjs";
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const date = "2026-09-13T12:00:00Z";
const ideas = new Set(Array.from({ length: 7 }, (_, n) => `idea-${n}`));
function receipt(issue, idea = "idea-0", voter = "voter", overrides = {}) {
  const r = {
    version: 1,
    issue,
    idea,
    voter: hash(voter),
    reviewer: hash("reviewer"),
    body_hash: hash("reviewed body"),
    account_age_days: 100,
    status: "accepted",
    submitted_at: "2026-09-12T00:00:00Z",
    checked_at: date,
    ...overrides,
  };
  r.signature = sign(null, Buffer.from(payload(r)), privateKey).toString(
    "base64",
  );
  return r;
}
test("only trusted, unmodified signed ballots count", () => {
  const r = receipt(1);
  assert.equal(tallyVotes([r], publicKey, ideas, date).accepted, 1);
  assert.throws(
    () => tallyVotes([{ ...r, idea: "idea-1" }], publicKey, ideas, date),
    /signature/,
  );
  const attacker = generateKeyPairSync("ed25519");
  const forged = { ...r };
  forged.signature = sign(
    null,
    Buffer.from(payload(forged)),
    attacker.privateKey,
  ).toString("base64");
  assert.throws(
    () => tallyVotes([forged], publicKey, ideas, date),
    /signature/,
  );
  assert.throws(
    () => tallyVotes([receipt(2, "unknown")], publicKey, ideas, date),
    /Invalid/,
  );
  assert.throws(
    () =>
      tallyVotes([receipt(2, "idea-0", "reviewer")], publicKey, ideas, date),
    /Invalid/,
  );
});
test("a signed withdrawal cannot be removed or reordered in the ledger", () => {
  const a = receipt(1),
    b = receipt(1, "idea-0", "voter", { status: "withdrawn" });
  const before = { as_of: date, records: [a, b] };
  assert.throws(
    () => assertAppendOnly(before, { as_of: date, records: [a] }),
    /cannot/,
  );
  assert.throws(
    () => assertAppendOnly(before, { as_of: date, records: [b, a] }),
    /cannot/,
  );
  assert.throws(
    () => assertAppendOnly(before, { as_of: "2025-01-01", records: [a, b] }),
    /backwards/,
  );
  assertAppendOnly(before, { as_of: date, records: [a, b, receipt(2)] });
});
test("duplicates, five-choice budgets, withdrawals and expiry are deterministic", () => {
  const rows = [
    receipt(1),
    receipt(2),
    ...Array.from({ length: 6 }, (_, n) => receipt(n + 3, `idea-${n + 1}`)),
  ];
  assert.equal(tallyVotes(rows, publicKey, ideas, date).accepted, 5);
  assert.deepEqual(
    tallyVotes([...rows].reverse(), publicKey, ideas, date).counts,
    tallyVotes(rows, publicKey, ideas, date).counts,
  );
  const close = receipt(1, "idea-0", "voter", {
    status: "withdrawn",
    checked_at: "2026-09-14T00:00:00Z",
  });
  assert.equal(
    tallyVotes([receipt(1), close], publicKey, ideas, close.checked_at)
      .accepted,
    0,
  );
  assert.equal(
    tallyVotes([receipt(1)], publicKey, ideas, "2026-10-15T00:00:00Z").accepted,
    0,
  );
  assert.throws(
    () => tallyVotes([receipt(1)], publicKey, ideas, "2026-09-01T00:00:00Z"),
    /Invalid/,
  );
});
test("approval checks real identity, account age, author separation and content", () => {
  const issue = {
    number: 12,
    state: "open",
    labels: [{ name: "community-vote" }],
    user: { id: 42 },
    created_at: "2026-09-12T00:00:00Z",
    body: "### Idea ID\n\nidea-0\n\n### Why this deserves a vote\n\nThe experiment describes a specific failure in verification and explains the measurement needed to reproduce that failure.",
  };
  const account = {
    id: 42,
    type: "User",
    login: "fixture-user",
    created_at: "2025-01-01T00:00:00Z",
  };
  const reviewer = { id: 99 };
  assert.equal(
    eligibility(issue, account, reviewer, ideas, date).idea,
    "idea-0",
  );
  assert.throws(
    () => eligibility(issue, account, { id: 42 }, ideas, date),
    /Self approval/,
  );
  assert.throws(
    () => eligibility(issue, { ...account, id: 43 }, reviewer, ideas, date),
    /identity/,
  );
  assert.throws(
    () =>
      eligibility(
        issue,
        { ...account, created_at: "2026-09-01T00:00:00Z" },
        reviewer,
        ideas,
        date,
      ),
    /90 days/,
  );
  assert.throws(
    () =>
      eligibility(
        {
          ...issue,
          body: issue.body.replace(/The experiment[\s\S]*/, "great"),
        },
        account,
        reviewer,
        ideas,
        date,
      ),
    /80/,
  );
  assert.throws(
    () =>
      eligibility(
        { ...issue, state: "closed" },
        account,
        reviewer,
        ideas,
        date,
      ),
    /open/,
  );
  assert.throws(
    () =>
      eligibility(
        { ...issue, pull_request: {} },
        account,
        reviewer,
        ideas,
        date,
      ),
    /open/,
  );
  const changed = { ...issue, body: issue.body + " More text." };
  assert.notEqual(
    eligibility(changed, account, reviewer, ideas, date).body_hash,
    eligibility(issue, account, reviewer, ideas, date).body_hash,
  );
});

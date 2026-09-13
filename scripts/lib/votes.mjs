import { verify, createHash } from "node:crypto";

export const VOTE_LIMIT = 5;
export const MIN_ACCOUNT_DAYS = 90;
export const VOTE_TTL_DAYS = 30;
export const MAINTAINER_ID = 236287904;
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const payload = (record) =>
  JSON.stringify(
    Object.fromEntries(
      Object.entries(record)
        .filter(([k]) => k !== "signature")
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
export function assertAppendOnly(before, after) {
  if (
    after.records.length < before.records.length ||
    before.records.some(
      (r, n) => JSON.stringify(r) !== JSON.stringify(after.records[n]),
    )
  )
    throw Error(
      "Existing ballot receipts cannot be removed, reordered or changed",
    );
  if (Date.parse(after.as_of) < Date.parse(before.as_of))
    throw Error("Ballot checkpoint cannot move backwards");
}

export function parseBallot(body) {
  const field = (heading) =>
    body
      .match(
        new RegExp(`(?:^|\\n)### ${heading}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`),
      )?.[1]
      ?.trim();
  const idea = field("Idea ID");
  const reason = field("Why this deserves a vote");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(idea || ""))
    throw Error("Ballot needs one canonical idea ID");
  if (!reason || reason.length < 80 || reason.length > 4000)
    throw Error("Ballot reason must be 80–4000 characters");
  return { idea, reason };
}

export function eligibility(issue, account, reviewer, knownIdeas, now) {
  const ballot = parseBallot(issue.body || "");
  if (
    issue.pull_request ||
    issue.state !== "open" ||
    !issue.labels.some((l) => l.name === "community-vote")
  )
    throw Error("Not an open community ballot");
  if (!knownIdeas.has(ballot.idea)) throw Error("Unknown idea");
  if (account.type !== "User" || account.id !== issue.user.id)
    throw Error("Account identity mismatch");
  if (account.id === reviewer.id) throw Error("Self approval is forbidden");
  // The owner administers the archive and does not supply community votes.
  if (account.id === MAINTAINER_ID)
    throw Error("Maintainer votes are excluded");
  const age =
    (Date.parse(issue.created_at) - Date.parse(account.created_at)) / 86400000;
  if (!Number.isFinite(age) || age < MIN_ACCOUNT_DAYS)
    throw Error("Account was younger than 90 days when submitted");
  if (
    !Number.isFinite(Date.parse(now)) ||
    Date.parse(issue.created_at) > Date.parse(now)
  )
    throw Error("Invalid submission time");
  return {
    idea: ballot.idea,
    voter: hash(`github:${account.id}`),
    reviewer: hash(`github:${reviewer.id}`),
    body_hash: hash(issue.body),
    account_age_days: Math.floor(age),
  };
}

export function tallyVotes(records, publicKey, knownIdeas, asOf) {
  const at = Date.parse(asOf);
  if (!Number.isFinite(at)) throw Error("Invalid tally date");
  const latest = new Map();
  for (const r of records) {
    if (
      r.version !== 1 ||
      !Number.isSafeInteger(r.issue) ||
      r.issue < 1 ||
      !knownIdeas.has(r.idea) ||
      !["accepted", "withdrawn"].includes(r.status) ||
      !Number.isInteger(r.account_age_days) ||
      r.account_age_days < MIN_ACCOUNT_DAYS ||
      !["voter", "reviewer", "body_hash"].every((k) =>
        /^[a-f0-9]{64}$/.test(r[k] || ""),
      ) ||
      r.voter === r.reviewer ||
      !Number.isFinite(Date.parse(r.checked_at)) ||
      !Number.isFinite(Date.parse(r.submitted_at)) ||
      Date.parse(r.checked_at) < Date.parse(r.submitted_at) ||
      Date.parse(r.checked_at) > at
    )
      throw Error("Invalid ballot receipt");
    if (
      typeof r.signature !== "string" ||
      !verify(
        null,
        Buffer.from(payload(r)),
        publicKey,
        Buffer.from(r.signature, "base64"),
      )
    )
      throw Error("Untrusted ballot signature");
    if (
      !latest.has(r.issue) ||
      Date.parse(r.checked_at) >= Date.parse(latest.get(r.issue).checked_at)
    )
      latest.set(r.issue, r);
  }
  const pairs = new Set(),
    budgets = new Map(),
    counts = {},
    receipts = {};
  let expired = 0,
    limited = 0;
  for (const r of [...latest.values()].sort(
    (a, b) => a.submitted_at.localeCompare(b.submitted_at) || a.issue - b.issue,
  )) {
    if (r.status !== "accepted") continue;
    if (at - Date.parse(r.checked_at) > VOTE_TTL_DAYS * 86400000) {
      expired++;
      continue;
    }
    const pair = `${r.voter}:${r.idea}`;
    if (pairs.has(pair) || (budgets.get(r.voter) || 0) >= VOTE_LIMIT) {
      limited++;
      continue;
    }
    pairs.add(pair);
    budgets.set(r.voter, (budgets.get(r.voter) || 0) + 1);
    counts[r.idea] = (counts[r.idea] || 0) + 1;
    (receipts[r.idea] ||= []).push(r.issue);
  }
  const expiries = [...latest.values()]
    .filter((r) => r.status === "accepted")
    .map((r) => Date.parse(r.checked_at) + VOTE_TTL_DAYS * 86400000)
    .filter((t) => t > at);
  return {
    counts,
    receipts,
    accepted: Object.values(counts).reduce((a, b) => a + b, 0),
    expired,
    limited,
    as_of: asOf,
    valid_until: new Date(
      expiries.length ? Math.min(...expiries) : at + VOTE_TTL_DAYS * 86400000,
    ).toISOString(),
    expires_days: VOTE_TTL_DAYS,
  };
}

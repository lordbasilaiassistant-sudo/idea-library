#!/usr/bin/env node
/** Maintainer-only review tool. No network call is made by site builds. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, sign, createPublicKey } from "node:crypto";
import { ROOT, loadIdeas } from "./lib/ideas.mjs";
import {
  eligibility,
  hash,
  payload,
  tallyVotes,
  MAINTAINER_ID,
} from "./lib/votes.mjs";
const dir = join(homedir(), ".codex", "secrets");
const keyFile = join(dir, "idea-library-votes.private.pem");
const publicFile = join(ROOT, "data/vote-public-key.pem");
const ledgerFile = join(ROOT, "data/ballots.json");
const action = process.argv[2];
const gh = (path) =>
  JSON.parse(
    execFileSync("gh", ["api", path], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
const repo = "repos/lordbasilaiassistant-sudo/idea-library";
const known = new Set(
  loadIdeas()
    .filter((i) => !i._error)
    .map((i) => i.id),
);
if (action === "init") {
  if (existsSync(publicFile) || existsSync(keyFile))
    throw Error("A voting key already exists; refusing to replace it");
  mkdirSync(dir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  writeFileSync(keyFile, privateKey.export({ type: "pkcs8", format: "pem" }), {
    mode: 0o600,
    flag: "wx",
  });
  writeFileSync(publicFile, publicKey.export({ type: "spki", format: "pem" }), {
    flag: "wx",
  });
  console.log(
    "Voting signing key initialized outside the repository. Only the public key is publishable.",
  );
} else if (action === "approve" || action === "sync") {
  if (action === "approve" && !process.argv.includes("--reviewed"))
    throw Error(
      "Read the complete ballot and evidence first; --reviewed attests independent substantive review",
    );
  const privateKey = readFileSync(keyFile, "utf8"),
    publicKey = readFileSync(publicFile, "utf8");
  if (
    createPublicKey(privateKey).export({ type: "spki", format: "pem" }) !==
    publicKey
  )
    throw Error("Signer does not match public key");
  const ledger = JSON.parse(readFileSync(ledgerFile, "utf8"));
  const now = new Date().toISOString();
  const reviewer = gh("user");
  if (reviewer.id !== MAINTAINER_ID)
    throw Error("Only the designated repository maintainer can sign receipts");
  const latest = new Map(ledger.records.map((r) => [r.issue, r]));
  const issueNumber = Number(process.argv[3]);
  if (
    action === "approve" &&
    (!Number.isSafeInteger(issueNumber) || issueNumber < 1)
  )
    throw Error("Provide a GitHub issue number");
  const numbers =
    action === "approve"
      ? [issueNumber]
      : [...latest.values()]
          .filter((r) => r.status === "accepted")
          .map((r) => r.issue);
  const staged = [];
  for (const number of numbers) {
    const issue = gh(`${repo}/issues/${number}`);
    let fields,
      status = "accepted";
    if (action === "approve")
      fields = eligibility(
        issue,
        gh(`users/${issue.user.login}`),
        reviewer,
        known,
        now,
      );
    else {
      const prior = latest.get(number);
      fields = {
        idea: prior.idea,
        voter: prior.voter,
        reviewer: hash(`github:${reviewer.id}`),
        body_hash: prior.body_hash,
        account_age_days: prior.account_age_days,
      };
      if (
        issue.state !== "open" ||
        hash(issue.body || "") !== prior.body_hash ||
        hash(`github:${issue.user.id}`) !== prior.voter ||
        !issue.labels.some((l) => l.name === "community-vote")
      )
        status = "withdrawn";
    }
    const record = {
      version: 1,
      issue: number,
      ...fields,
      status,
      submitted_at: issue.created_at,
      checked_at: now,
    };
    record.signature = sign(
      null,
      Buffer.from(payload(record)),
      privateKey,
    ).toString("base64");
    staged.push(record);
  }
  const next = {
    version: 1,
    as_of: now,
    records: [...ledger.records, ...staged],
  };
  const tally = tallyVotes(next.records, publicKey, known, now);
  writeFileSync(ledgerFile, JSON.stringify(next, null, 2) + "\n");
  console.log(
    JSON.stringify({
      receipts_written: staged.length,
      active_votes: tally.accepted,
      limited: tally.limited,
      expired: tally.expired,
    }),
  );
  console.log(
    "Review the public diff, run npm run check, and merge through a PR. No vote is published by this command.",
  );
} else if (action === "check") {
  const ledger = JSON.parse(readFileSync(ledgerFile, "utf8"));
  console.log(
    JSON.stringify(
      tallyVotes(
        ledger.records,
        readFileSync(publicFile, "utf8"),
        known,
        ledger.as_of,
      ),
    ),
  );
} else
  throw Error("Use votes.mjs init | approve ISSUE --reviewed | sync | check");

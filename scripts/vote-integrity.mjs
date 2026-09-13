import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib/ideas.mjs";
import { assertAppendOnly } from "./lib/votes.mjs";
const git = (args) =>
  execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
let base = "HEAD";
if (
  process.env.GITHUB_EVENT_PATH &&
  existsSync(process.env.GITHUB_EVENT_PATH)
) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  base = event.pull_request?.base?.sha || event.before || "HEAD^";
} else if (process.env.CF_PAGES) base = "HEAD^";
try {
  git(["rev-parse", "--verify", base]);
} catch {
  if (process.env.GITHUB_EVENT_PATH)
    throw Error("Required ballot baseline is unavailable");
  console.log(
    "vote-integrity: history comparison unavailable here; required PR check enforces it",
  );
  process.exit(0);
}
try {
  git(["cat-file", "-e", `${base}:data/ballots.json`]);
} catch {
  console.log("vote-integrity: first ledger introduction");
  process.exit(0);
}
const before = JSON.parse(git(["show", `${base}:data/ballots.json`]));
const after = JSON.parse(readFileSync(join(ROOT, "data/ballots.json"), "utf8"));
assertAppendOnly(before, after);
const oldKey = git(["show", `${base}:data/vote-public-key.pem`]);
if (
  oldKey !== readFileSync(join(ROOT, "data/vote-public-key.pem"), "utf8").trim()
)
  throw Error(
    "Voting trust-key rotation requires a separate security migration",
  );
console.log("vote-integrity: existing receipts and trust key unchanged");

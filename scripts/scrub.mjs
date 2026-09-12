#!/usr/bin/env node
/**
 * scrub.mjs — the blocking security gate.
 *
 * Scans every tracked-or-stageable file in the repo (plus, with --inbox, the
 * gitignored _inbox/ staging area) for secrets, personal data, and un-allowlisted
 * wallet addresses. Exits non-zero on ANY hit.
 *
 * Runs in three independent places: `npm run build`, the git pre-commit hook,
 * and GitHub Actions. A gate with one chokepoint is a gate with one bypass.
 *
 *   node scripts/scrub.mjs            # scan the repo
 *   node scripts/scrub.mjs --inbox    # also scan _inbox/
 *   node scripts/scrub.mjs <path...>  # scan specific paths
 *   node scripts/scrub.mjs --json     # machine-readable findings
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, extname, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const argv = process.argv.slice(2);
const FLAGS = new Set(argv.filter((a) => a.startsWith('--')));
const TARGETS = argv.filter((a) => !a.startsWith('--'));

// ---------------------------------------------------------------------------
// What we never walk into.
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['.git', 'node_modules', '.cache', 'dist', 'build']);
const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar', '.woff', '.woff2', '.ttf',
  '.otf', '.eot', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.exe', '.dll',
  '.so', '.dylib', '.wasm', '.node', '.lnk',
]);
const MAX_BYTES = 2 * 1024 * 1024;

// Path-level exemptions are kept as small as possible. This file is deliberately NOT
// one of them: an audit pointed out that scrub.mjs is the single file a developer is
// most likely to paste a real key into — while tuning a regex to confirm it matches —
// and a blanket path exemption meant the gate would never read it. Only the pattern
// table below is skipped, via a pair of region sentinels, so every other
// line of this file is scanned like any other.
//
// The three that remain are exempt because their entire purpose is to hold the
// literals the gate matches on, and each is small enough to review by eye:
//   denylist.local.json    — gitignored, never published
//   denylist.example.json  — fabricated placeholders only
//   public-addresses.allow.json — the allowlist itself
const SELF_EXEMPT = new Set([
  ['scripts', 'denylist.example.json'].join(sep),
  ['scripts', 'denylist.local.json'].join(sep),
  ['data', 'public-addresses.allow.json'].join(sep),
  ['data', 'denylist.public.json'].join(sep),
]);

// ---------------------------------------------------------------------------
// Class A — generic secret patterns.
// ---------------------------------------------------------------------------
/* scrub-ignore-begin — the pattern table itself. Everything OUTSIDE this block,
   including anything you paste in below it while testing, IS scanned. */
const PATTERNS = [
  { id: 'private-key-hex', severity: 'critical',
    why: 'looks like a 64-hex private key',
    re: /\b(?:0x)?[a-fA-F0-9]{64}\b/g,
    // tx hashes and content hashes are also 64 hex; require key-ish context
    context: /(priv|secret|key|mnemonic|seed|wallet)/i },

  { id: 'pem-block', severity: 'critical',
    why: 'PEM private key block',
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },

  { id: 'mnemonic', severity: 'critical',
    why: 'looks like a BIP-39 seed phrase (12+ lowercase words in a row)',
    re: /\b(?:[a-z]{3,8}\s+){11,}[a-z]{3,8}\b/g,
    context: /(mnemonic|seed\s*phrase|recovery\s*phrase)/i },

  { id: 'jwt', severity: 'critical', why: 'JWT',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },

  { id: 'anthropic-key', severity: 'critical', why: 'Anthropic API key',
    re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai-key', severity: 'critical', why: 'OpenAI API key',
    re: /\bsk-(?:proj-)?[A-Za-z0-9]{32,}/g },
  { id: 'groq-key', severity: 'critical', why: 'Groq API key',
    re: /\bgsk_[A-Za-z0-9]{40,}/g },
  { id: 'stripe-key', severity: 'critical', why: 'Stripe secret/live key',
    re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { id: 'aws-key', severity: 'critical', why: 'AWS access key id',
    re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g },
  { id: 'github-token', severity: 'critical', why: 'GitHub token',
    re: /\bgh[pousr]_[A-Za-z0-9]{30,}/g },
  { id: 'slack-token', severity: 'critical', why: 'Slack token',
    re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { id: 'google-key', severity: 'critical', why: 'Google API key',
    re: /\bAIza[A-Za-z0-9_-]{35}\b/g },
  { id: 'zai-key', severity: 'critical', why: 'Z.ai / GLM key shape',
    re: /\b[a-f0-9]{32}\.[A-Za-z0-9]{16}\b/g },

  { id: 'assigned-secret', severity: 'critical',
    why: 'a *_KEY / *_SECRET / *_TOKEN / *_PASSWORD assigned a real value',
    re: /\b[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE)\s*[:=]\s*["']?(?!["'\s]|<|\$\{|process\.env|null|undefined|xxx|YOUR_|REDACTED|EXAMPLE)[A-Za-z0-9_\-./+=]{12,}/g },

  { id: 'secrets-path', severity: 'critical',
    why: 'reference to the local secrets store',
    re: /(?:~|\$HOME|[A-Za-z]:\\Users\\[^\\\s"']+)[\\/]\.claude[\\/]secrets/gi },

  { id: 'windows-userpath', severity: 'high',
    why: 'absolute local Windows user path (leaks the machine username)',
    re: /[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+/g },

  { id: 'unix-homepath', severity: 'high',
    why: 'absolute local home path',
    re: /\/(?:home|Users)\/[a-z][a-z0-9_.-]{1,30}\//g },

  { id: 'email', severity: 'high',
    why: 'email address — use an @broke2builtai.com role address or none',
    re: /\b[A-Za-z0-9._%+-]+@(?!broke2builtai\.com|example\.(?:com|org)|users\.noreply\.github\.com|noreply\.anthropic\.com|anthropic\.com|example-mail\.test)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },

  { id: 'phone', severity: 'high',
    why: 'looks like a phone number',
    re: /\b(?:\+1[-. ]?)?\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4}\b/g },

  { id: 'street-address', severity: 'high',
    why: 'looks like a street address',
    re: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place)\b\.?/g },
];
/* scrub-ignore-end */

// ---------------------------------------------------------------------------
// Class C — wallet addresses are DEFAULT-DENY.
// ---------------------------------------------------------------------------
const ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;

function loadJSON(p, fallback) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}

const allowFile = join(ROOT, 'data', 'public-addresses.allow.json');
const allowRaw = loadJSON(allowFile, { addresses: [] });
const ALLOWED_ADDRESSES = new Set(
  (allowRaw.addresses || []).map((a) => String(a.address || a).toLowerCase())
);

// ---------------------------------------------------------------------------
// Class B — the denylist, in two halves.
//   public  (data/denylist.public.json)  operational literals, committed, always on
//   private (scripts/denylist.local.json or $SCRUB_DENYLIST) personal literals, never committed
// Both load if both are present. Which layers are active is always reported: a gate
// that quietly runs at half strength is worse than one that does not run at all.
// ---------------------------------------------------------------------------
const RE_SPECIALS = /[.*+?^${}()|[\]\\]/g;
function escapeRegExp(s) {
  return s.replace(RE_SPECIALS, '\\$&');
}

function compileTerms(raw, layer) {
  if (!raw || !Array.isArray(raw.terms)) return [];
  return raw.terms
    .filter((t) => t && t.value)
    .map((t) => ({
      layer,
      why: t.why || 'denylisted term',
      severity: t.severity || 'critical',
      re: new RegExp(
        escapeRegExp(String(t.value)),
        t.caseSensitive ? 'g' : 'gi'
      ),
    }));
}

const publicDenyFile = join(ROOT, 'data', 'denylist.public.json');
const PUBLIC_DENY = compileTerms(loadJSON(publicDenyFile, null), 'public');
const publicLoaded = PUBLIC_DENY.length > 0;

const denyFile = process.env.SCRUB_DENYLIST || join(ROOT, 'scripts', 'denylist.local.json');
const PRIVATE_DENY = existsSync(denyFile) ? compileTerms(loadJSON(denyFile, null), 'private') : [];
const denyLoaded = PRIVATE_DENY.length > 0;

const DENY = [...PUBLIC_DENY, ...PRIVATE_DENY];

// ---------------------------------------------------------------------------
// Walk + scan.
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (e.name === '_inbox' && !FLAGS.has('--inbox')) continue;
      walk(full, out);
    } else if (e.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function isBinary(file) {
  return BINARY_EXT.has(extname(file).toLowerCase());
}

const findings = [];

function report(file, line, col, rule, match) {
  findings.push({
    file: relative(ROOT, file).split(sep).join('/'),
    line, col,
    rule: rule.id || rule.why,
    severity: rule.severity || 'critical',
    why: rule.why,
    sample: redact(match),
  });
}

function redact(s) {
  const str = String(s);
  if (str.length <= 12) return str[0] + '*'.repeat(Math.max(0, str.length - 2)) + str.slice(-1);
  return str.slice(0, 6) + '…' + '*'.repeat(6) + '…' + str.slice(-4);
}

function scanFile(file) {
  const rel = relative(ROOT, file);
  if (SELF_EXEMPT.has(rel)) return;

  const base = basename(file).toLowerCase();
  if (base === '.env' || base.startsWith('.env.') || base.endsWith('.env')) {
    if (base !== '.env.example') {
      report(file, 1, 1, { id: 'env-file', severity: 'critical', why: 'a .env file must never be in the repo' }, base);
      return;
    }
  }
  if (isBinary(file)) return;

  let size = 0;
  try { size = statSync(file).size; } catch { return; }
  if (size > MAX_BYTES) return;

  let text;
  try { text = readFileSync(file, 'utf8'); } catch { return; }
  if (text.includes(String.fromCharCode(0))) return; // binary we did not know about

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 5000) continue;
    if (/scrub-ignore-line/.test(line)) continue;

    for (const rule of PATTERNS) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        if (rule.context && !rule.context.test(line)) continue;
        report(file, i + 1, m.index + 1, rule, m[0]);
      }
    }

    ADDRESS_RE.lastIndex = 0;
    let a;
    while ((a = ADDRESS_RE.exec(line)) !== null) {
      if (!ALLOWED_ADDRESSES.has(a[0].toLowerCase())) {
        report(file, i + 1, a.index + 1, {
          id: 'wallet-address',
          severity: 'critical',
          why: 'wallet address not in data/public-addresses.allow.json (addresses are default-deny)',
        }, a[0]);
      }
    }

    for (const term of DENY) {
      term.re.lastIndex = 0;
      let d;
      while ((d = term.re.exec(line)) !== null) {
        report(file, i + 1, d.index + 1, { id: 'denylist', severity: term.severity, why: term.why }, d[0]);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------
// An explicit target may live outside the repo — the commit-msg hook passes the
// path of .git/COMMIT_EDITMSG. Resolve absolute paths as given; a target that does
// not resolve is a hard error, never a silent zero-file "clean" run.
const files = TARGETS.length
  ? TARGETS.flatMap((t) => {
      const p = isAbsolute(t) ? t : join(ROOT, t);
      if (!existsSync(p)) {
        console.error(`scrub: FAIL - target does not exist: ${t}`);
        process.exit(2);
      }
      return statSync(p).isDirectory() ? walk(p) : [p];
    })
  : walk(ROOT);

if (TARGETS.length && files.length === 0) {
  console.error('scrub: FAIL - targets resolved to zero files. Refusing to report clean.');
  process.exit(2);
}

for (const f of files) scanFile(f);

if (FLAGS.has('--json')) {
  console.log(JSON.stringify({ denylistLoaded: denyLoaded, scanned: files.length, findings }, null, 2));
} else {
  console.log(`scrub: scanned ${files.length} files`);
  console.log(`scrub: layers — patterns ON · addresses default-deny · denylist.public ${publicLoaded ? 'ON (' + PUBLIC_DENY.length + ' terms)' : 'MISSING'} · denylist.private ${denyLoaded ? 'ON (' + PRIVATE_DENY.length + ' terms)' : 'off'}`);
  if (!denyLoaded) {
    console.log('scrub:           the personal-literals layer is not loaded. Copy scripts/denylist.example.json');
    console.log('scrub:           to scripts/denylist.local.json (gitignored) to enable it locally.');
  }
  if (findings.length === 0) {
    console.log('scrub: clean — 0 findings');
  } else {
    console.log(`\nscrub: ${findings.length} finding(s)\n`);
    for (const f of findings) {
      console.log(`  ${f.severity.toUpperCase().padEnd(8)} ${f.file}:${f.line}:${f.col}`);
      console.log(`           ${f.rule} — ${f.why}`);
      console.log(`           sample: ${f.sample}`);
    }
    console.log('\nNothing moves while this is red. Redact, then re-scan — never delete the key and keep the file unscanned.');
    console.log('False positive? Add `scrub-ignore-line` to that line, or allowlist the address in data/public-addresses.allow.json.');
  }
}

// A missing denylist is itself a failure in CI — Class B silently off is the
// exact way this gate would rot.
if (findings.length > 0) process.exit(1);
if (!publicLoaded) {
  console.error('scrub: FAIL — data/denylist.public.json is missing or empty. That file is committed');
  console.error('scrub:        and must always load; a missing Class B is how this gate would rot.');
  process.exit(1);
}

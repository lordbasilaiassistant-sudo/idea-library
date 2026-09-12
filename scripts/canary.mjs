#!/usr/bin/env node
/**
 * canary.mjs — prove the gate actually blocks, by watching it fail.
 *
 *   node scripts/canary.mjs
 *
 * Writes a file into _inbox/ containing a planted fake secret of every class we claim
 * to catch, runs the scrub, asserts that each class was caught, then removes the file
 * and asserts the tree is clean again.
 *
 * The secrets are ASSEMBLED AT RUNTIME rather than written literally, so this file can
 * itself pass the scrub. (The first version of this drill lived as literal text in
 * SECURITY.md and the gate blocked our own documentation — which was the gate working,
 * and is why the drill lives here instead.)
 */

import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './lib/ideas.mjs';

const hex = (n, c = 'a') => c.repeat(n);
const j = (...parts) => parts.join('');

// Each entry: the rule id we expect to fire, and a line that should trip it.
const PLANTS = [
  ['private-key-hex', j('PRIV', 'ATE_KEY=0x', hex(64, 'b'))],
  ['anthropic-key', j('sk-', 'ant-', 'api03-', hex(24, 'A'))],
  ['openai-key', j('sk-', hex(40, 'B'))],
  ['aws-key', j('AK', 'IA', hex(16, 'C'))],
  ['github-token', j('gh', 'p_', hex(36, 'D'))],
  ['jwt', j('ey', 'J', hex(20, 'e'), '.', hex(20, 'f'), '.', hex(20, 'g'))],
  ['pem-block', j('-----BE', 'GIN RSA PRI', 'VATE KEY-----')],
  ['wallet-address', j('0x', hex(40, '1'))],
  ['secrets-path', j('~/', '.clau', 'de/secr', 'ets/example.env')],
  ['windows-userpath', j('C:', '\\Us', 'ers\\somebody\\Desktop')],
  ['email', j('someone', '@', 'example-mail.test')],
  ['phone', j('607', '-', '555', '-', '0123')],
  ['street-address', j('1 Imaginary', ' Str', 'eet')],
];

const file = join(ROOT, '_inbox', 'canary.md');
mkdirSync(join(ROOT, '_inbox'), { recursive: true });
writeFileSync(file, ['# canary — every line below must trip the gate', '', ...PLANTS.map(([, line]) => line), ''].join('\n'), 'utf8');

function scrub() {
  try {
    const out = execFileSync(process.execPath, ['scripts/scrub.mjs', '--inbox', '--json'], { cwd: ROOT }).toString();
    return JSON.parse(out);
  } catch (e) {
    return JSON.parse(e.stdout.toString());
  }
}

const result = scrub();
const caught = new Set(result.findings.map((f) => f.rule));

console.log(`canary: planted ${PLANTS.length} secret(s), scrub returned ${result.findings.length} finding(s)\n`);

let missed = 0;
for (const [rule] of PLANTS) {
  const ok = caught.has(rule);
  if (!ok) missed++;
  console.log(`  ${ok ? 'CAUGHT ' : 'MISSED '} ${rule}`);
}

if (!result.denylistLoaded) {
  console.log('\ncanary: NOTE — no local denylist, so Class B (our own PII literals) was not exercised.');
  console.log('        Copy scripts/denylist.example.json to scripts/denylist.local.json to test it.');
}

rmSync(file, { force: true });
const after = scrub();

console.log(`\ncanary: after removing the file, ${after.findings.length} finding(s) remain`);

if (missed > 0) {
  console.log(`\ncanary: FAIL — ${missed} planted secret(s) were not caught. The gate has a hole.`);
  process.exit(1);
}
if (after.findings.length > 0) {
  console.log('\ncanary: FAIL — the tree is not clean after removing the canary.');
  process.exit(1);
}
console.log('canary: PASS — every planted class was caught, and the tree is clean afterwards.');

#!/usr/bin/env node
/**
 * site.mjs — assemble the deployable site.
 *
 * The site is a pure CONSUMER of the repository's data. It never becomes a
 * second source of truth: this script copies index.json, scoreboard.json and
 * the llms files in beside the static assets, and that is the whole build.
 */

import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/ideas.mjs';

const OUT = join(ROOT, 'site', 'dist');
mkdirSync(OUT, { recursive: true });

const staticFiles = readdirSync(join(ROOT, 'site')).filter((f) => /\.(html|css|js|svg|png|webp|woff2?)$/.test(f));
const data = ['index.json', 'llms.txt', 'llms-full.txt'];

for (const f of staticFiles) copyFileSync(join(ROOT, 'site', f), join(OUT, f));
for (const f of data) if (existsSync(join(ROOT, f))) copyFileSync(join(ROOT, f), join(OUT, f));
copyFileSync(join(ROOT, 'data', 'scoreboard.json'), join(OUT, 'scoreboard.json'));

console.log(`site: assembled ${staticFiles.length + data.length + 1} files into site/dist`);

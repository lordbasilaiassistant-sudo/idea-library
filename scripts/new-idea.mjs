#!/usr/bin/env node
/**
 * new-idea.mjs — scaffold a valid idea folder.
 *
 *   npm run new-idea -- --category tooling-infra --slug my-idea --title "..."
 *
 * Produces a file that already has the right shape, so the first `npm run check`
 * failure is about your content and not about your YAML.
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadTaxonomy, loadSources, loadIdeas } from './lib/ideas.mjs';

const args = new Map();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) {
    const key = argv[i].slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    args.set(key, val);
  }
}

const tax = loadTaxonomy();
const sources = loadSources();

const category = args.get('category');
const slug = args.get('slug');
const title = args.get('title') || '';
const source = args.get('source') || 'community';

function die(msg, extra) {
  console.error(`new-idea: ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
}

if (!category || !slug) {
  die('usage: npm run new-idea -- --category <category> --slug <kebab-slug> [--title "..."] [--source <dig>]',
    `\ncategories: ${tax.categories.map((c) => c.id).join(', ')}\nsources:    ${sources.digs.map((d) => d.id).join(', ')}`);
}
if (!tax.categoryIds.has(category)) {
  die(`unknown category \`${category}\``,
    `categories: ${tax.categories.map((c) => c.id).join(', ')}\nAdding a new one is a normal PR against data/taxonomy.json.`);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) die(`slug \`${slug}\` must be kebab-case (lowercase, digits, single hyphens)`);
if (!sources.digs.some((d) => d.id === source)) {
  die(`unknown source \`${source}\``, `sources: ${sources.digs.map((d) => d.id).join(', ')}`);
}

const dir = join(ROOT, 'ideas', category, slug);
if (loadIdeas().some(i => i.id === slug)) die(`id ${slug} already exists in the library; update it instead`);
if (existsSync(dir)) die(`ideas/${category}/${slug}/ already exists`);

const template = readFileSync(join(ROOT, 'templates', 'idea.md'), 'utf8');
const filled = template
  .replace(/^id: .*$/m, `id: ${slug}`)
  .replace(/^category: .*$/m, `category: ${category}`)
  .replace(/^source: .*$/m, `source: ${source}`)
  .replace(/^title: .*$/m, title ? `title: ${title}` : '$&');

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'idea.md'), filled, 'utf8');

console.log(`new-idea: created ideas/${category}/${slug}/idea.md`);
console.log('');
console.log('Next:');
console.log(`  1. Fill it in. The frontmatter is the data; the body is the story.`);
console.log(`  2. Pick tags from data/taxonomy.json — you need at least one domain tag,`);
console.log(`     at least one mechanic tag (what decided it), and exactly one stage tag.`);
console.log(`  3. npm run check   # exactly what CI runs`);

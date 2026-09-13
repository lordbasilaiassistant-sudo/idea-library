import { readJSON } from './lib/ideas.mjs';

const argv = process.argv.slice(2);
const options = {};
for (let n = 0; n < argv.length; n += 2) {
  const key = argv[n]?.replace(/^--/, '');
  if (!['text', 'category', 'outcome', 'tag', 'project', 'limit', 'offset'].includes(key) || !argv[n + 1]) {
    throw new Error('Usage: npm run query -- --text "words" [--category ID] [--outcome ID] [--tag ID] [--project ID] [--limit N] [--offset N]');
  }
  options[key] = argv[n + 1];
}
const limit = Number(options.limit || 20), offset = Number(options.offset || 0);
if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) throw new Error('limit: 1-100; offset: nonnegative integer');
const words = (options.text || '').toLowerCase().split(/\s+/).filter(Boolean);
const rows = readJSON('index.json').ideas.filter(i => {
  if (options.category && i.category !== options.category) return false;
  if (options.outcome && i.outcome !== options.outcome) return false;
  if (options.tag && !i.tags.includes(options.tag)) return false;
  if (options.project && !(i.projects || []).includes(options.project)) return false;
  const hay = [i.id, i.title, i.description, i.verdict, ...(i.aliases || []), ...(i.projects || []), ...i.tags, ...i.lessons].join(' ').toLowerCase();
  return words.every(w => hay.includes(w));
});
console.log(JSON.stringify({ total: rows.length, offset, next_offset: offset + limit < rows.length ? offset + limit : null,
  ideas: rows.slice(offset, offset + limit).map(i => ({ id: i.id, title: i.title, outcome: i.outcome, confidence: i.confidence, url: i.url, record: `catalog/ideas/${i.id}.json` })) }, null, 2));

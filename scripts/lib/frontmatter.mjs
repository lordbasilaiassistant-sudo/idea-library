/**
 * frontmatter.mjs — a deliberately small, deliberately strict YAML-subset parser.
 *
 * Zero dependencies is a feature: a contributor (human or agent) clones the repo and
 * runs `npm run check` with no install step, so there is no reason to skip the gate.
 *
 * The supported subset is exactly the idea.md schema and nothing more:
 *
 *   key: scalar                  # string, number, true/false, null
 *   key: "quoted scalar"
 *   key: >-                      # folded block scalar (newlines become spaces)
 *     line one
 *     line two
 *   key: |                       # literal block scalar (newlines kept)
 *     line one
 *   key: [a, b, c]               # inline list
 *   key: []
 *   key:                         # block list
 *     - item
 *     - "item with: colon"
 *   key: { a: 1, b: "x" }        # inline map (one level)
 *
 * Anything else throws with a line number. Being told "line 12: unsupported nesting"
 * beats silently parsing into a shape the validator then misreports.
 */

export class FrontmatterError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message);
    this.name = 'FrontmatterError';
    this.line = line;
  }
}

const DELIM = /^---\s*$/;

/** Split a file into { data, body, frontmatterLines }. */
export function parseFile(text) {
  const lines = text.split(/\r?\n/);
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  if (!DELIM.test(lines[start] ?? '')) {
    throw new FrontmatterError('file must open with a `---` frontmatter delimiter', start + 1);
  }
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (DELIM.test(lines[i])) { end = i; break; }
  }
  if (end === -1) throw new FrontmatterError('frontmatter is never closed with `---`');

  const fmLines = lines.slice(start + 1, end);
  const data = parseBlock(fmLines, start + 2);
  return { data, body: lines.slice(end + 1).join('\n'), frontmatterStart: start + 2 };
}

function scalar(raw, lineNo) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"') && s.length > 1) ||
      (s.startsWith("'") && s.endsWith("'") && s.length > 1)) {
    const inner = s.slice(1, -1);
    return s[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\n/g, '\n') : inner.replace(/''/g, "'");
  }
  if (s.startsWith('#')) return null;
  // strip a trailing unquoted comment
  const hash = s.indexOf(' #');
  return hash >= 0 ? s.slice(0, hash).trim() : s;
}

function splitInline(s, lineNo) {
  // split on commas that are not inside quotes
  const out = [];
  let cur = '';
  let quote = null;
  for (const ch of s) {
    if (quote) {
      cur += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch; cur += ch;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  if (quote) throw new FrontmatterError('unterminated quote', lineNo);
  if (cur.trim() !== '') out.push(cur);
  return out;
}

function parseBlock(lines, firstLineNo) {
  const data = {};
  let i = 0;

  while (i < lines.length) {
    const lineNo = firstLineNo + i;
    const raw = lines[i];

    if (raw.trim() === '' || /^\s*#/.test(raw)) { i++; continue; }
    if (/^\s/.test(raw)) {
      throw new FrontmatterError(`unexpected indentation (top-level keys must start at column 1)`, lineNo);
    }

    const m = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
    if (!m) throw new FrontmatterError(`expected \`key: value\`, got: ${raw.slice(0, 60)}`, lineNo);

    const key = m[1];
    let rest = m[2];
    if (key in data) throw new FrontmatterError(`duplicate key \`${key}\``, lineNo);
    i++;

    // block scalar
    if (rest === '>-' || rest === '>' || rest === '|' || rest === '|-') {
      const buf = [];
      while (i < lines.length && (lines[i].trim() === '' || /^\s+/.test(lines[i]))) {
        buf.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      while (buf.length && buf[buf.length - 1] === '') buf.pop();
      data[key] = rest.startsWith('>') ? buf.join(' ').trim() : buf.join('\n');
      continue;
    }

    // inline list
    if (rest.startsWith('[')) {
      if (!rest.endsWith(']')) throw new FrontmatterError('inline list must close on the same line', lineNo);
      const inner = rest.slice(1, -1).trim();
      data[key] = inner === '' ? [] : splitInline(inner, lineNo).map((v) => scalar(v, lineNo));
      continue;
    }

    // inline map
    if (rest.startsWith('{')) {
      if (!rest.endsWith('}')) throw new FrontmatterError('inline map must close on the same line', lineNo);
      const inner = rest.slice(1, -1).trim();
      const obj = {};
      if (inner !== '') {
        for (const pair of splitInline(inner, lineNo)) {
          const pm = pair.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
          if (!pm) throw new FrontmatterError(`bad inline map entry: ${pair.trim()}`, lineNo);
          obj[pm[1]] = scalar(pm[2], lineNo);
        }
      }
      data[key] = obj;
      continue;
    }

    // block list
    if (rest === '') {
      const items = [];
      while (i < lines.length && /^\s*-\s/.test(lines[i])) {
        items.push(scalar(lines[i].replace(/^\s*-\s/, ''), firstLineNo + i));
        i++;
      }
      if (items.length === 0) {
        // a key with nothing after it is an explicit null
        data[key] = null;
      } else {
        data[key] = items;
      }
      continue;
    }

    data[key] = scalar(rest, lineNo);
  }

  return data;
}

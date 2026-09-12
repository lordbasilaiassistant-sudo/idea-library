/* =========================================================================
   idea-library — site behaviour
   Everything on this page is rendered from index.json, the same file the
   agents read. There is no second source of truth and no hand-written list.
   ========================================================================= */

const OUTCOME_COLOR = {
  revenue: '#e8c547', shipped: '#4a9d7f', partial: '#c98b3a', failed: '#d9544d',
  abandoned: '#6b7280', inconclusive: '#5b8dd9', active: '#7c9ed9', parked: '#8b7fa8',
};
const EFFORT_WEIGHT = { hours: 1, days: 2, weeks: 3.2, months: 5 };

const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let DATA = null;
let BOARD = null;
const state = { q: '', outcomes: new Set(), mechanics: new Set() };

boot();

async function boot() {
  try {
    DATA = await (await fetch('index.json')).json();
  } catch {
    document.body.insertBefore(
      el('p', 'load-error', 'Could not load index.json — the catalog is unavailable.'),
      document.body.firstChild
    );
    return;
  }
  try { BOARD = await (await fetch('scoreboard.json')).json(); } catch { BOARD = null; }

  renderCounts();
  renderLegend();
  renderColumn();
  renderMechanics();
  renderFilters();
  renderCards();
  renderQuestions();
  renderBoard();
  initCore();
}

/* ------------------------------------------------------------------ counts */
function renderCounts() {
  const c = DATA.counts;
  const pending = (DATA.digs || []).filter((d) => d.status === 'pending').length;
  const items = [
    [c.total, 'ideas recorded'],
    [c.lessons, 'lessons'],
    [c.by_outcome.failed + c.by_outcome.abandoned + c.by_outcome.partial, 'that did not fully work'],
    [c.open_questions, 'open questions'],
    [pending, 'passes still to dig'],
  ];
  const wrap = $('#counts');
  for (const [n, label] of items) {
    const d = el('div');
    d.append(el('b', null, String(n)), el('span', null, label));
    wrap.append(d);
  }
}

/* ------------------------------------------------------------------ legend */
function renderLegend() {
  const wrap = $('#legend');
  for (const o of DATA.taxonomy.outcomes) {
    if (!DATA.counts.by_outcome[o.id]) continue;
    const s = el('span');
    const i = el('i');
    i.style.background = OUTCOME_COLOR[o.id] || 'var(--line)';
    s.append(i, document.createTextNode(`${o.id} (${DATA.counts.by_outcome[o.id]})`));
    s.title = o.definition;
    wrap.append(s);
  }
}

/* ------------------------------ the core sample: one band per idea -------- */
function renderColumn() {
  const wrap = $('#column');
  const sorted = [...DATA.ideas].sort(
    (a, b) => (EFFORT_WEIGHT[b.effort] ?? 1) - (EFFORT_WEIGHT[a.effort] ?? 1)
  );
  for (const i of sorted) {
    const a = el('a', 'band');
    a.href = i.url;
    a.style.minHeight = `${38 + (EFFORT_WEIGHT[i.effort] ?? 1) * 7}px`;

    const sw = el('div', 'swatch');
    sw.style.background = OUTCOME_COLOR[i.outcome] || 'var(--line)';

    const body = el('div', 'band-body');
    body.append(el('div', 'band-title', i.title), el('div', 'band-verdict', i.verdict || ''));

    const meta = el('div', 'band-meta');
    for (const t of i.tags_by_axis?.mechanic ?? []) meta.append(el('span', 'tag', t));
    meta.append(el('span', 'tag', i.effort));

    a.append(sw, body, meta);
    wrap.append(a);
  }
}

/* --------------------------------------------------------------- mechanics */
function renderMechanics() {
  const wrap = $('#mechGrid');
  const counted = DATA.taxonomy.tags.mechanic
    .map((m) => ({ ...m, n: DATA.ideas.filter((i) => i.tags.includes(m.id)).length }))
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n);

  for (const m of counted) {
    const d = el('div', 'mech');
    d.append(
      el('b', null, m.id),
      el('p', null, m.definition),
      el('div', 'n', `${m.n} idea${m.n === 1 ? '' : 's'}`)
    );
    d.style.cursor = 'pointer';
    d.addEventListener('click', () => {
      state.mechanics.clear();
      state.mechanics.add(m.id);
      syncChips();
      renderCards();
      $('#catalog').scrollIntoView({ behavior: 'smooth' });
    });
    wrap.append(d);
  }
}

/* ----------------------------------------------------------------- filters */
function renderFilters() {
  const oc = $('#outcomeChips');
  for (const o of DATA.taxonomy.outcomes) {
    const n = DATA.counts.by_outcome[o.id];
    if (!n) continue;
    const b = el('button', 'chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.outcome = o.id;
    b.title = o.definition;
    const dot = el('span', 'dot');
    dot.style.background = OUTCOME_COLOR[o.id];
    b.append(dot, document.createTextNode(`${o.id} ${n}`));
    b.addEventListener('click', () => toggle(state.outcomes, o.id, b));
    oc.append(b);
  }

  const mc = $('#mechChips');
  const mechs = DATA.taxonomy.tags.mechanic
    .map((m) => ({ id: m.id, n: DATA.ideas.filter((i) => i.tags.includes(m.id)).length }))
    .filter((m) => m.n > 0)
    .sort((a, b) => b.n - a.n);
  for (const m of mechs) {
    const b = el('button', 'chip');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.dataset.mech = m.id;
    b.textContent = `${m.id} ${m.n}`;
    b.addEventListener('click', () => toggle(state.mechanics, m.id, b));
    mc.append(b);
  }

  $('#q').addEventListener('input', (e) => { state.q = e.target.value.toLowerCase(); renderCards(); });
  $('#clearFilters').addEventListener('click', () => {
    state.outcomes.clear(); state.mechanics.clear(); state.q = '';
    $('#q').value = '';
    syncChips(); renderCards();
  });
}

function toggle(set, id, btn) {
  if (set.has(id)) set.delete(id); else set.add(id);
  btn.setAttribute('aria-pressed', set.has(id) ? 'true' : 'false');
  syncChips();
  renderCards();
}

function syncChips() {
  document.querySelectorAll('[data-outcome]').forEach((b) =>
    b.setAttribute('aria-pressed', state.outcomes.has(b.dataset.outcome) ? 'true' : 'false'));
  document.querySelectorAll('[data-mech]').forEach((b) =>
    b.setAttribute('aria-pressed', state.mechanics.has(b.dataset.mech) ? 'true' : 'false'));
  $('#clearFilters').hidden = !(state.outcomes.size || state.mechanics.size || state.q);
}

function matches(i) {
  if (state.outcomes.size && !state.outcomes.has(i.outcome)) return false;
  if (state.mechanics.size && !i.tags.some((t) => state.mechanics.has(t))) return false;
  if (state.q) {
    const hay = [i.title, i.description, i.verdict, ...(i.lessons || []), ...(i.tags || [])]
      .join(' ').toLowerCase();
    if (!hay.includes(state.q)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------- cards */
function renderCards() {
  const wrap = $('#cards');
  wrap.textContent = '';
  const hits = DATA.ideas.filter(matches);

  $('#resultCount').textContent =
    hits.length === DATA.ideas.length
      ? `all ${hits.length} ideas`
      : `${hits.length} of ${DATA.ideas.length} ideas`;

  if (!hits.length) {
    wrap.append(el('p', null, 'Nothing matches that. Clear a filter, or open an issue with the idea you were looking for.'));
    return;
  }

  for (const i of hits) {
    const a = el('a', 'card');
    a.href = i.url;
    a.style.setProperty('--oc', OUTCOME_COLOR[i.outcome] || 'var(--line)');

    const top = el('div', 'card-top');
    top.append(el('span', 'outcome', i.outcome), el('span', 'effort', i.effort));

    const tags = el('div', 'card-tags');
    for (const t of (i.tags_by_axis?.mechanic ?? []).concat(i.tags_by_axis?.domain?.slice(0, 2) ?? [])) {
      tags.append(el('span', 'tag', t));
    }

    a.append(top, el('h3', null, i.title), el('p', 'verdict', i.verdict || i.description), tags);
    wrap.append(a);
  }
}

/* --------------------------------------------------------------- questions */
function renderQuestions() {
  const wrap = $('#questions');
  const open = DATA.ideas.filter((i) => i.outcome === 'inconclusive');
  if (!open.length) {
    wrap.append(el('p', null, 'Nothing open right now.'));
    return;
  }
  for (const i of open) {
    const d = el('div', 'question');
    const h = el('h3');
    const a = el('a', null, i.title);
    a.href = i.url;
    h.append(a);

    const settle = el('div', 'settle');
    settle.append(el('b', null, 'What would settle it'), document.createTextNode(i.what_would_settle_it || ''));

    d.append(h, el('p', null, i.description), settle);
    wrap.append(d);
  }
}

/* -------------------------------------------------------------- scoreboard */
function renderBoard() {
  const wrap = $('#boardRows');
  if (!BOARD) { wrap.append(el('p', null, 'Scoreboard unavailable.')); return; }

  const COMP = {
    reality: '#e8c547', evidence: '#4a9d7f', transfer: '#5b8dd9',
    votes: '#8b7fa8', penalties: '#d9544d',
  };

  for (const row of BOARD.ideas) {
    const a = el('a', 'brow');
    const idea = DATA.ideas.find((i) => i.id === row.id);
    a.href = idea ? idea.url : BOARD.repo;

    a.append(el('div', 'rank', String(row.rank)));

    const mid = el('div');
    mid.append(el('div', 'bt', row.title));

    const bars = el('div', 'bars');
    const maxTotal = BOARD.ideas[0].total || 1;
    for (const [k, color] of Object.entries(COMP)) {
      const v = row.components[k]?.score ?? 0;
      if (v <= 0) continue;
      const i = el('i');
      i.style.background = color;
      i.style.width = `${(v / maxTotal) * 100}%`;
      i.title = `${k}: ${v}`;
      bars.append(i);
    }
    mid.append(bars);

    const parts = Object.entries(row.components)
      .filter(([, c]) => c.score)
      .map(([k, c]) => `${k} ${c.score > 0 ? '+' : ''}${c.score}`)
      .join('  ·  ');
    mid.append(el('div', 'parts', parts));

    a.append(mid, el('div', 'total', String(row.total)));
    wrap.append(a);
  }
}

/* =========================================================================
   The hero: a rotating core sample.

   Not decoration — it is the library's own data as geology. Each disc is one
   real idea, its thickness the effort spent and its colour the outcome, so the
   dark failure bands get exactly the same visual weight as the successes.
   That is the argument of the whole project, made before you read a word.
   ========================================================================= */
function initCore() {
  const canvas = $('#core');
  if (!canvas || typeof THREE === 'undefined') return;

  // Reduced motion means no MOTION, not no visual. An earlier version returned
  // early here and left everyone with that preference looking at an empty hero,
  // which is a worse experience than the one it was trying to protect. So the
  // column still renders — it just holds still.
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Depth: the column recedes into the page ground rather than being pasted on it.
  scene.fog = new THREE.Fog(0x0b0d10, 5.4, 12);

  const core = new THREE.Group();
  scene.add(core);

  const ideas = [...DATA.ideas].reverse();
  const R = 0.4;
  let y = 0;

  // Rock, not plastic. The outcome hue is a MINERAL TINT: mixed heavily toward a
  // cold slate base and darkened, so the column reads as stone you could hold and
  // the colour is a signal rather than a decoration. Fully saturated swatches made
  // it look like a stack of toy rings.
  const SLATE = new THREE.Color(0x2b313b);
  const tint = (hex, amount) => new THREE.Color(hex).lerp(SLATE, amount);

  for (const idea of ideas) {
    const h = 0.1 + (EFFORT_WEIGHT[idea.effort] ?? 1) * 0.055;

    // failures stay legible but sit deeper in the column's value range
    const dim = ['failed', 'abandoned'].includes(idea.outcome) ? 0.72 : 0.6;
    const color = tint(OUTCOME_COLOR[idea.outcome] || '#6b7280', dim);

    const geo = new THREE.CylinderGeometry(R, R, h, 72, 1, true);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.95,
      metalness: 0.02,
      flatShading: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y + h / 2;
    core.add(m);

    // a thin dark seam between strata — this is what makes it read as sediment
    const seam = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 1.006, R * 1.006, 0.008, 72, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x070a0e })
    );
    seam.position.y = y + h;
    core.add(seam);

    y += h + 0.008;
  }

  core.position.y = -y / 2;
  core.rotation.x = 0.035;   // a touch off-vertical, like a real sample in a rack

  // Taller than the frame on purpose: the sample continues past the top and
  // bottom edges and the canvas mask feathers it out, so it reads as a section
  // through something larger rather than a finished little object.
  core.scale.y = 1.55;

  // Lighting: one warm key high on the left gives the column a lit face; a cold
  // rim from behind right separates it from the background. No flat ambient wash.
  scene.add(new THREE.AmbientLight(0x8c99ad, 0.5));
  const key = new THREE.DirectionalLight(0xffe2ae, 1.25);
  key.position.set(-2.4, 3.2, 2.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x86a9d6, 1.0);
  rim.position.set(3.2, -0.6, -2.2);
  scene.add(rim);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;

    // The copy owns the left. The column lives in the right margin and must never
    // sit under a line of text, so it is placed from the measured copy width
    // rather than from a guess. Below 1040px there is no margin to spare and it
    // steps out entirely — an empty right edge beats a column behind a sentence.
    const copy = document.querySelector('.hero-copy > .lede');
    const copyRight = copy ? copy.getBoundingClientRect().right : 660;
    const room = w - copyRight;

    core.visible = room > 215;
    if (!core.visible) return;

    // Map the gap's centre into world space at the column's depth.
    const centreFrac = (copyRight + room / 2) / w;          // 0..1 across the viewport
    const halfWorld = Math.tan((camera.fov * Math.PI / 180) / 2) * 7.6 * camera.aspect;

    camera.position.set(0, 0.25, 7.6);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    core.position.x = (centreFrac - 0.5) * 2 * halfWorld;
  }
  resize();
  window.addEventListener('resize', resize);

  if (still) {
    // One frame, at a flattering angle, and nothing moves afterwards.
    core.rotation.y = 0.45;
    renderer.render(scene, camera);
    window.addEventListener('resize', () => { resize(); renderer.render(scene, camera); });
    return;
  }

  let pointer = 0;
  window.addEventListener('pointermove', (e) => {
    pointer = (e.clientX / window.innerWidth - 0.5) * 0.55;
  }, { passive: true });

  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; });

  const t0 = performance.now();
  (function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    const t = (now - t0) / 1000;
    core.rotation.y = t * 0.16 + pointer;
    core.rotation.z = Math.sin(t * 0.24) * 0.018;
    renderer.render(scene, camera);
  })(t0);
}

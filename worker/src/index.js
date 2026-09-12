/**
 * Vote API for the idea library.
 *
 * The board's authority comes from being AUDITABLE, not from being unhackable.
 * Every vote is appended to a log with the signals that justified accepting it,
 * and the scoreboard is recomputed from that log. So a fraud campaign discovered
 * next month is reversible: mark the rows, recompute, done. We never "correct" a
 * score by adjusting a number, because a number nobody can reproduce is a rumour.
 *
 * Layered controls, because no single mechanism survives a determined attacker:
 *
 *   1. Turnstile            kills the trivially scripted flood. Free, invisible.
 *   2. HMAC'd IP identity   one vote per IP WITHOUT STORING ANY IP. The fraud
 *                           control must not itself become the privacy leak.
 *   3. Three-scope limits   per IP hash, per /24 and /48 subnet, per ASN. A botnet
 *                           spread across a subnet is the common attack and a bare
 *                           per-IP limit cannot see it.
 *   4. ASN weighting        datacenter and VPN votes count, at reduced weight, and
 *                           labelled. Agents are welcome to vote; they do not get
 *                           to outvote the world silently.
 *   5. Proof of work        a few hundred ms for one honest voter; expensive at ten
 *                           thousand.
 *   6. Velocity decay       a sudden spike on one idea dilutes automatically, so a
 *                           successful flood buys very little.
 *   7. Signed agent votes   an agent votes with a registered key, not by pretending
 *                           to be a browser. Transparent agent votes are healthy;
 *                           laundered ones are fraud.
 *   8. Public anomaly report  /api/anomalies shows discarded and diluted counts.
 *                           Being visibly audited is the deterrent.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS },
  });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      switch (url.pathname) {
        case '/api/health':     return json({ ok: true });
        case '/api/challenge':  return challenge(request, env);
        case '/api/vote':       return request.method === 'POST' ? vote(request, env, ctx) : json({ error: 'POST only' }, 405);
        case '/api/tally':      return tally(request, env);
        case '/api/anomalies':  return anomalies(request, env);
        default:                return json({ error: 'not found' }, 404);
      }
    } catch (err) {
      // Never return the raw message — it leaks schema and query fragments.
      console.error(err);
      return json({ error: 'internal error' }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Identity WITHOUT storage: HMAC(rotating salt, IP). We can enforce one vote per
// IP and never hold anyone's IP address.
// ---------------------------------------------------------------------------
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Salt rotates daily: yesterday's hashes stop being linkable to today's. */
function saltFor(env, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  return `${env.IP_SALT}:${day}`;
}

/** The /24 (v4) or /48 (v6) the address sits in — the scope a botnet spreads across. */
function subnetOf(ip) {
  if (!ip) return 'unknown';
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::/48';
  return ip.split('.').slice(0, 3).join('.') + '.0/24';
}

// ---------------------------------------------------------------------------
// Proof of work. Free for one voter, costly at volume.
// ---------------------------------------------------------------------------
const POW_BITS = 18;

async function sha256hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function leadingZeroBits(hex) {
  let bits = 0;
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    if (v === 0) { bits += 4; continue; }
    bits += Math.clz32(v) - 28;
    break;
  }
  return bits;
}

async function challenge(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || '';
  const id = await hmac(saltFor(env), ip);
  const nonce = crypto.randomUUID();
  const issued = Date.now();
  const sig = await hmac(env.CHALLENGE_SECRET, `${nonce}.${issued}.${id}`);
  return json({ nonce, issued, sig, bits: POW_BITS,
    how: `find a suffix such that sha256(nonce + suffix) starts with ${POW_BITS} zero bits` });
}

// ---------------------------------------------------------------------------
async function vote(request, env, ctx) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'bad body' }, 400);

  const { idea, value, nonce, issued, sig, solution, turnstile, agentKey } = body;
  if (!idea || typeof idea !== 'string' || idea.length > 100) return json({ error: 'bad idea id' }, 400);
  if (value !== 1 && value !== -1) return json({ error: 'value must be 1 or -1' }, 400);

  const ip = request.headers.get('cf-connecting-ip') || '';
  const asn = request.cf?.asn ?? 0;
  const asOrg = request.cf?.asOrganization ?? '';
  const country = request.cf?.country ?? 'XX';
  const id = await hmac(saltFor(env), ip);
  const subnet = await hmac(saltFor(env), subnetOf(ip));

  const signals = { asn, country, turnstile: false, pow: false, agent: false };
  let weight = 1;
  const notes = [];

  // --- agent path: signed, declared, transparent -------------------------
  if (agentKey) {
    const known = await env.VOTES.get(`agent:${agentKey}`);
    if (!known) return json({ error: 'unknown agent key. Register it first — agents vote as themselves, not as browsers.' }, 403);
    signals.agent = true;
    weight = 0.5;
    notes.push('registered agent, weight 0.5');
  } else {
    // --- human path: Turnstile + proof of work ---------------------------
    if (!env.DISABLE_TURNSTILE) {
      const ok = await verifyTurnstile(env, turnstile, ip);
      if (!ok) return json({ error: 'turnstile failed' }, 403);
      signals.turnstile = true;
    }

    if (!nonce || !sig || !issued) return json({ error: 'get a challenge first' }, 400);
    const expect = await hmac(env.CHALLENGE_SECRET, `${nonce}.${issued}.${id}`);
    if (expect !== sig) return json({ error: 'challenge not issued to you' }, 403);
    if (Date.now() - Number(issued) > 10 * 60 * 1000) return json({ error: 'challenge expired' }, 403);

    const hash = await sha256hex(String(nonce) + String(solution ?? ''));
    if (leadingZeroBits(hash) < POW_BITS) return json({ error: 'proof of work insufficient' }, 403);
    signals.pow = true;
  }

  // --- one vote per identity per idea ------------------------------------
  const voteKey = `v:${idea}:${id}`;
  if (await env.VOTES.get(voteKey)) {
    return json({ error: 'already voted on this idea', counted: false }, 409);
  }

  // --- rate limits at three scopes ---------------------------------------
  const perIp = await bump(env, `rl:ip:${id}`, 3600);
  const perSubnet = await bump(env, `rl:net:${subnet}`, 3600);
  const perAsn = await bump(env, `rl:asn:${asn}`, 3600);

  if (perIp > 20) return json({ error: 'rate limit', scope: 'ip' }, 429);
  if (perSubnet > 60) { weight *= 0.25; notes.push('subnet is unusually active, weight x0.25'); }
  if (perAsn > 500) { weight *= 0.5; notes.push('ASN is unusually active, weight x0.5'); }

  // --- datacenter / VPN ASNs count, but less, and labelled ---------------
  if (isHostingAsn(asOrg)) { weight *= 0.35; notes.push('hosting/VPN network, weight x0.35'); }

  // --- velocity decay: a spike on one idea dilutes itself -----------------
  const recent = await bump(env, `vel:${idea}`, 900);
  if (recent > 25) {
    const factor = Math.max(0.1, 25 / recent);
    weight *= factor;
    notes.push(`velocity decay on this idea, weight x${factor.toFixed(2)}`);
  }

  weight = Math.round(weight * 1000) / 1000;

  const row = {
    ts: new Date().toISOString(),
    idea,
    value,
    weight: weight * value,
    id,          // rotating HMAC, not an IP
    subnet,      // rotating HMAC, not a subnet
    asn,
    country,
    signals,
    notes,
    discarded: false,
  };

  await env.VOTES.put(voteKey, '1', { expirationTtl: 60 * 60 * 24 * 365 });
  await env.VOTES.put(`log:${row.ts}:${crypto.randomUUID()}`, JSON.stringify(row));

  return json({ counted: true, weight: row.weight, notes });
}

async function bump(env, key, ttl) {
  const cur = Number(await env.VOTES.get(key)) || 0;
  const next = cur + 1;
  await env.VOTES.put(key, String(next), { expirationTtl: ttl });
  return next;
}

function isHostingAsn(org) {
  return /amazon|aws|google|microsoft|azure|digitalocean|linode|hetzner|ovh|vultr|oracle|cloudflare|contabo|choopa|leaseweb|scaleway|alibaba|tencent/i.test(org || '');
}

async function verifyTurnstile(env, token, ip) {
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

// ---------------------------------------------------------------------------
async function tally(request, env) {
  const list = await env.VOTES.list({ prefix: 'log:', limit: 1000 });
  const totals = {};
  for (const k of list.keys) {
    const row = JSON.parse((await env.VOTES.get(k.name)) || 'null');
    if (!row || row.discarded) continue;
    totals[row.idea] = (totals[row.idea] ?? 0) + row.weight;
  }
  return json({ totals, rows: list.keys.length, truncated: !list.list_complete });
}

/**
 * The anomaly report is PUBLIC on purpose. A board that hides how much it threw
 * away is asking to be trusted; one that shows it can be checked.
 */
async function anomalies(request, env) {
  const list = await env.VOTES.list({ prefix: 'log:', limit: 1000 });
  let counted = 0, discarded = 0, diluted = 0, agent = 0, hosting = 0;
  for (const k of list.keys) {
    const row = JSON.parse((await env.VOTES.get(k.name)) || 'null');
    if (!row) continue;
    if (row.discarded) { discarded++; continue; }
    counted++;
    if (row.notes?.length) diluted++;
    if (row.signals?.agent) agent++;
    if (row.notes?.some((n) => n.includes('hosting'))) hosting++;
  }
  return json({
    counted, discarded, diluted, agent_votes: agent, hosting_network_votes: hosting,
    note: 'Diluted votes were counted at reduced weight and the reason is recorded on each row. Discarded rows stay in the log so the board can be recomputed without them.',
  });
}

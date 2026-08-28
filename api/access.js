/* The request-access endpoint.

   GitHub Pages serves the site but cannot run anything, so this lives on
   Vercel and the form posts to it cross-origin. Its whole job is to take a
   request from the page, check it is one, and hand it to whatever is set up to
   alert someone — a Poke API key, or any other webhook URL.

   Nothing is stored here. If no destination is configured the request is
   refused rather than swallowed, so the page can tell the visitor the truth.

   What guards it: an Origin allowlist that a request must actually carry, a
   JSON-only content type so no cross-site form can reach it without a
   preflight, a body-size cap, a honeypot field, a per-instance rate limit, and
   a timeout on the call it makes outward. The API key lives only in the
   environment here and never reaches the page. */

const ALLOWED = [
  'https://getsoffo.com',
  'https://www.getsoffo.com'
];

const POKE_URL = 'https://poke.com/api/v1/inbound-sms/webhook';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const MAX_BODY = 4 * 1024;   // a name and an email, not an upload
const SEND_TIMEOUT_MS = 8000;

// crude, per-instance, and enough to stop someone holding down the button
const seen = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter(t => now - t < WINDOW_MS);

  hits.push(now);
  seen.set(ip, hits);

  if (seen.size > 500) seen.clear();

  return hits.length > MAX_PER_WINDOW;
}

function cors(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

module.exports = async (req, res) => {
  cors(req, res);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // the Origin has to be there and has to be ours. A missing one is not a pass:
  // browsers always send it on a cross-origin POST, so anything without one is
  // not the page this endpoint exists for.
  if (!ALLOWED.includes(req.headers.origin)) {
    return res.status(403).json({ error: 'origin not allowed' });
  }

  // JSON only. A cross-site <form> can only post text/plain, urlencoded or
  // multipart, none of which get past this, and asking for JSON forces a
  // preflight that the Origin check above then answers.
  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    return res.status(415).json({ error: 'json only' });
  }

  if (Number(req.headers['content-length'] || 0) > MAX_BODY) {
    return res.status(413).json({ error: 'too much' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'slow down' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : (req.body || {});

  const email = String(body.email || '').trim().slice(0, 200);
  const name = String(body.name || '').trim().slice(0, 120);
  const organization = String(body.organization || '').trim().slice(0, 160);

  // a bot filling every field it finds
  if (String(body.company || '').trim()) return res.status(200).json({ ok: true });

  if (!EMAIL.test(email)) return res.status(400).json({ error: 'a working email, please' });
  if (!name) return res.status(400).json({ error: 'a name, please' });

  const message =
    'New Soffo access request\n' +
    name + ' <' + email + '>' +
    (organization ? '\n' + organization : '');

  try {
    if (process.env.POKE_API_KEY) {
      await send(POKE_URL, { message }, {
        Authorization: 'Bearer ' + process.env.POKE_API_KEY
      });
    } else if (process.env.WEBHOOK_URL) {
      await send(process.env.WEBHOOK_URL, {
        text: message,
        email: email,
        name: name,
        organization: organization,
        at: new Date().toISOString()
      });
    } else {
      // no destination yet: say so rather than accept and lose it
      return res.status(503).json({ error: 'not accepting requests yet' });
    }
  } catch (err) {
    console.error('forward failed', err);
    return res.status(502).json({ error: 'could not pass that on' });
  }

  return res.status(200).json({ ok: true });
};

async function send(url, payload, extraHeaders) {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, extraHeaders || {}),
      body: JSON.stringify(payload),
      signal: stop.signal
    });

    // the status, never the body: an upstream error message is not ours to
    // repeat back to whoever is on the page
    if (!res.ok) throw new Error('upstream ' + res.status);
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}

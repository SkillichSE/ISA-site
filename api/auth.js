const crypto = require('crypto');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const COOKIE_NAME = 'isa_admin_session';

// quick and dirty rate limit, resets per instance so not bulletproof but better than nothing
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getClientId(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function isRateLimited(id) {
  const now = Date.now();
  const entry = attempts.get(id);
  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(id, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function getSecret() {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error('SESSION_SECRET (or ADMIN_PASSWORD) is not configured.');
  }
  return secret;
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

// Roles:
//   main   -> ADMIN_PASSWORD        (full access, can edit everything)
//   viewer -> ADMIN_VIEW_PASSWORD   (read-only, can look but not edit)
function createSessionToken(role) {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${role}.${expires}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

// returns 'main' | 'viewer' | null
function verifySessionToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [role, expires, sig] = parts;
  const payload = `${role}.${expires}`;
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;
  if (Date.now() > Number(expires)) return null;
  return role === 'main' || role === 'viewer' ? role : null;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').filter(Boolean).map((part) => {
      const idx = part.indexOf('=');
      const k = decodeURIComponent(part.slice(0, idx).trim());
      const v = decodeURIComponent(part.slice(idx + 1).trim());
      return [k, v];
    })
  );
}

function getRole(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

// Main admins only. Every endpoint that writes / uploads / posts to Discord
// uses this, so view-only admins can never reach them.
function isAuthenticated(req) {
  return getRole(req) === 'main';
}

// Any logged-in admin (main or view-only). Used for read-only access.
function canView(req) {
  return getRole(req) !== null;
}

function safeEqual(input, expected) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function setSessionCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const cookie = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    isProd ? 'Secure' : '',
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') { // who am I?
    const role = getRole(req);
    if (!role) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true, role });
  }

  if (req.method === 'GET') { // who am I?
    const role = getRole(req);
    if (!role) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true, role });
  }

  if (req.method === 'DELETE') { // logout
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).end();

  const clientId = getClientId(req);
  if (isRateLimited(clientId)) {
    return res.status(429).json({ ok: false, error: 'Too many attempts. Try again later.' });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Server is not configured (ADMIN_PASSWORD missing).' });
  }

  const { password } = req.body || {};
  if (!password) return res.status(400).json({ ok: false });

  let role = null;
  if (safeEqual(password, process.env.ADMIN_PASSWORD)) {
    role = 'main';
  } else if (process.env.ADMIN_VIEW_PASSWORD && safeEqual(password, process.env.ADMIN_VIEW_PASSWORD)) {
    role = 'viewer';
  }

  if (!role) {
    return res.status(401).json({ ok: false });
  }

  const token = createSessionToken(role);
  setSessionCookie(res, token);
  res.status(200).json({ ok: true, role });
};

module.exports.isAuthenticated = isAuthenticated;
module.exports.getRole = getRole;
module.exports.canView = canView;
module.exports.COOKIE_NAME = COOKIE_NAME;

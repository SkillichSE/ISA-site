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

function createSessionToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `admin.${expires}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [role, expires, sig] = parts;
  const payload = `${role}.${expires}`;
  const expected = sign(payload);
  const sigBuf = Buffer.from(sig, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expectedBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;
  if (Date.now() > Number(expires)) return false;
  return role === 'admin';
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

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE_NAME]);
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

  const a = Buffer.from(String(password));
  const b = Buffer.from(String(process.env.ADMIN_PASSWORD));
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!matches) {
    return res.status(401).json({ ok: false });
  }

  const token = createSessionToken();
  setSessionCookie(res, token);
  res.status(200).json({ ok: true });
};

module.exports.isAuthenticated = isAuthenticated;
module.exports.COOKIE_NAME = COOKIE_NAME;

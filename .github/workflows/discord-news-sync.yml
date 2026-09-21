const crypto = require('crypto');
const { runDiscordNewsSync } = require('../lib/discord-news-sync');

function isAuthorized(req) {
  const secret = String(process.env.NEWS_SYNC_SECRET || '').trim();
  if (!secret) return { ok: false, reason: 'NEWS_SYNC_SECRET is not configured on the server.' };

  const header = req.headers.authorization || '';
  // Strip a leading "Bearer " once or twice, in case the secret itself was
  // accidentally saved with "Bearer " already baked into its value.
  const provided = header
    .replace(/^Bearer\s+/i, '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!provided) return { ok: false, reason: 'No Authorization header was provided.' };

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  const matches = a.length === b.length && crypto.timingSafeEqual(a, b);
  return matches
    ? { ok: true }
    : { ok: false, reason: 'The provided credential does not match NEWS_SYNC_SECRET.' };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const auth = isAuthorized(req);
  if (!auth.ok) {
    return res.status(401).json({ ok: false, error: auth.reason });
  }

  try {
    const results = await runDiscordNewsSync(process.env);
    return res.status(200).json({ ok: true, results });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Sync failed.',
    });
  }
};

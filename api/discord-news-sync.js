const crypto = require('crypto');
const { runDiscordNewsSync } = require('../lib/discord-news-sync');

function isAuthorized(req) {
  const secret = process.env.NEWS_SYNC_SECRET;
  if (!secret) return false;

  const header = req.headers.authorization || '';
  const provided = header.replace(/^Bearer\s+/i, '').trim();
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
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

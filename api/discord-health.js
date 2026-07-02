const { checkDiscordSetup } = require('../lib/discord-launch');
const { isAuthenticated } = require('./auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // leaks bot/channel/guild ids, keep it behind auth
  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }

  try {
    const info = await checkDiscordSetup(process.env);
    return res.status(200).json({ ok: true, ...info });
  } catch (error) {
    return res.status(error.status || 502).json({
      ok: false,
      error: error.message || 'Discord check failed.',
    });
  }
};

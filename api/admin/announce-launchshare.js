// api/admin/announce-launchshare.js
//
// Called by admin.html's saveItem() right after a launch is newly marked
// "Launchshare" (see announceLaunchshare() in admin.html). Posts the
// "Launchshare slot open" embed to the Discord launch channel using the
// same webhook/bot config as the public booking form, via the
// announceLaunchshareSlot() helper in lib/discord-launch.js.
//
// Body: { name, date, orbit, volume, url }
// Response: { ok: true } | { ok: false, error }
//
// Auth follows the same pattern as the other /api/admin/* routes
// (api/admin/data.js, api/admin/upload.js): isAuthenticated() from
// api/auth.js, a synchronous check, not an async requireAdmin().
//
// Path note: this file lives at api/admin/announce-launchshare.js;
// discord-launch.js lives at lib/discord-launch.js, so it's '../../lib/...'
// from here (discord-launch.js itself then reaches launchshare/capacity.js
// via '../launchshare/capacity').
const { isAuthenticated } = require('../auth');
const { announceLaunchshareSlot } = require('../../lib/discord-launch');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { name, date, orbit, volume, url } = body;

    if (!name || !orbit || !volume) {
      return res.status(400).json({ ok: false, error: 'Missing name, orbit, or volume.' });
    }

    const vol = Number(volume);
    if (!Number.isFinite(vol) || vol <= 0) {
      return res.status(400).json({ ok: false, error: 'Volume must be a positive number.' });
    }

    await announceLaunchshareSlot({ name, date, orbit, volume: vol, url }, process.env);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('announce-launchshare failed:', e);
    return res.status(e.status || 500).json({ ok: false, error: e.message || 'Failed to announce.' });
  }
};

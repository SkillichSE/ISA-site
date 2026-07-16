const { isAuthenticated } = require('../auth');

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

function safeFilename() {
  const rand = require('crypto').randomBytes(8).toString('hex');
  return `${Date.now()}-${rand}`;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    throw Object.assign(new Error('Supabase is not configured on the server.'), { status: 500 });
  }
  return { url, serviceKey, anonKey };
}

// The file itself never touches this function. We just ask Supabase Storage
// for a one-time signed upload slot (service-role key, stays server-side)
// and hand the browser a token + the public anon key so it can PUT the
// bytes straight to Supabase, skipping the Vercel round-trip entirely.
module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let payload;
  try {
    payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body.' });
  }

  const { contentType } = payload;
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ ok: false, error: 'File type not allowed.' });
  }

  try {
    const { url, serviceKey, anonKey } = getSupabaseConfig();
    const filename = `${safeFilename()}.${EXT[contentType]}`;

    const r = await fetch(`${url}/storage/v1/object/upload/sign/images/${filename}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ ok: false, error: e.message || 'Failed to sign upload.' });
    }

    // Supabase returns { url: "/object/upload/sign/images/<file>?token=..." }
    const { url: signedPath } = await r.json();

    return res.status(200).json({
      ok: true,
      uploadUrl: `${url}/storage/v1${signedPath}`,
      apikey: anonKey,
      contentType,
      publicUrl: `${url}/storage/v1/object/public/images/${filename}`,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Server error.' });
  }
};
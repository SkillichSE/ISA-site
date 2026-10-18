const { isAuthenticated } = require('../auth');

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const VIDEO_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

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
  const isVideo = VIDEO_TYPES.has(contentType);
  if (!isVideo && !ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ ok: false, error: 'File type not allowed.' });
  }
  const bucket = isVideo ? 'videos' : 'images';

  try {
    const { url, serviceKey, anonKey } = getSupabaseConfig();
    const filename = `${safeFilename()}.${isVideo ? VIDEO_EXT[contentType] : EXT[contentType]}`;

    const r = await fetch(`${url}/storage/v1/object/upload/sign/${bucket}/${filename}`, {
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

    const { url: signedPath } = await r.json();

    return res.status(200).json({
      ok: true,
      uploadUrl: `${url}/storage/v1${signedPath}`,
      apikey: anonKey,
      contentType,
      publicUrl: `${url}/storage/v1/object/public/${bucket}/${filename}`,
    });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Server error.' });
  }
};
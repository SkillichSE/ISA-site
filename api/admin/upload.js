const { isAuthenticated } = require('../auth');

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function safeFilename() {
  const rand = require('crypto').randomBytes(8).toString('hex');
  return `${Date.now()}-${rand}`;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw Object.assign(new Error('Supabase is not configured on the server.'), { status: 500 });
  }
  return { url, key };
}

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const contentType = req.headers['content-type'] || 'application/octet-stream';
  if (!ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ ok: false, error: 'File type not allowed.' });
  }

  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[contentType];

  try {
    const bytes = await readRawBody(req);
    if (bytes.length > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: 'File is too large (max 5 MB).' });
    }

    const { url, key } = getSupabaseConfig();
    const filename = `${safeFilename()}.${ext}`;

    const r = await fetch(`${url}/storage/v1/object/images/${filename}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: bytes,
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ ok: false, error: e.message || 'Upload failed.' });
    }

    return res.status(200).json({ ok: true, url: `${url}/storage/v1/object/public/images/${filename}` });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Server error.' });
  }
};

module.exports.config = {
  api: { bodyParser: false },
};

const { isAuthenticated } = require('../auth');

const ALLOWED_TABLES = new Set(['missions', 'careers', 'launches', 'news']);
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

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

  let payload;
  try {
    payload = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body.' });
  }

  const { table, method = 'GET', body = null, filters = '' } = payload;

  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ ok: false, error: 'Unknown table.' });
  }
  if (!ALLOWED_METHODS.has(method)) {
    return res.status(400).json({ ok: false, error: 'Unsupported method.' });
  }
  // only allow the filter shapes the admin UI actually sends, block the rest
  if (filters && !/^\?(id=eq\.[\w-]+|order=[\w.]+)$/.test(filters)) {
    return res.status(400).json({ ok: false, error: 'Invalid filters.' });
  }

  try {
    const { url, key } = getSupabaseConfig();
    const r = await fetch(`${url}/rest/v1/${table}${filters}`, {
      method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
      },
      body: body ? JSON.stringify(body) : null,
    });

    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      return res.status(r.status).json({ ok: false, error: e.message || `HTTP ${r.status}` });
    }

    if (method === 'GET' || method === 'POST') {
      const data = await r.json().catch(() => null);
      return res.status(200).json({ ok: true, data });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message || 'Server error.' });
  }
};

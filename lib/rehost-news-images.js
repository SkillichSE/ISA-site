const { rehostImage, isDiscordCdnUrl } = require('./supabase-storage');

async function sbFetch(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

// Finds every `news` row still pointing at Discord's CDN for its image and
// re-hosts it in Supabase Storage, patching the row in place. Returns a
// summary so callers (CLI script or API route) can report on it however
// they like.
async function rehostExistingNewsImages(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Supabase is not configured on the server.');
    err.status = 503;
    throw err;
  }

  const res = await sbFetch(env, 'news?select=id,image&order=id.desc');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Failed to load news table: ${res.status} ${body}`);
    err.status = 502;
    throw err;
  }

  const rows = await res.json();
  const targets = rows.filter((row) => isDiscordCdnUrl(row.image));

  const results = { total: rows.length, candidates: targets.length, fixed: [], failed: [] };

  for (const row of targets) {
    try {
      const newUrl = await rehostImage(env, row.image);
      const patch = await sbFetch(env, `news?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ image: newUrl }),
      });
      if (!patch.ok) throw new Error(`PATCH ${patch.status}: ${await patch.text().catch(() => '')}`);
      results.fixed.push({ id: row.id, image: newUrl });
    } catch (err) {
      // Most likely cause: Discord's signed link already expired, so
      // there's nothing left to re-host for that item. Move on to the rest.
      results.failed.push({ id: row.id, error: err.message });
    }
  }

  return results;
}

module.exports = { rehostExistingNewsImages };

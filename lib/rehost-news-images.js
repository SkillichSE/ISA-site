const { rehostImage, isDiscordCdnUrl } = require('./supabase-storage');
const { cleanToken, firstImageAttachment, discordFetch, parseMessageUrl } = require('./discord-message-utils');

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
//
// The image URL saved on old rows is a signed Discord CDN link that's
// almost certainly expired by the time this runs, so fetching it directly
// 404s. Instead, for each candidate we re-fetch the original message from
// Discord (via its stored `link`), which hands back a freshly-signed
// attachment URL for the same file — that's what actually gets re-hosted.
async function rehostExistingNewsImages(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error('Supabase is not configured on the server.');
    err.status = 503;
    throw err;
  }

  const token = cleanToken(env.DISCORD_BOT_TOKEN);

  const res = await sbFetch(env, 'news?select=id,image,link&order=id.desc');
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
      let sourceUrl = row.image;

      // Try to get a fresh, still-valid attachment URL from Discord itself
      // rather than trusting the (likely expired) URL already in the row.
      const parsed = parseMessageUrl(row.link);
      if (parsed && token) {
        const message = await discordFetch(`/channels/${parsed.channelId}/messages/${parsed.messageId}`, token);
        const image = firstImageAttachment(message);
        if (image) sourceUrl = image.url;
      }

      const newUrl = await rehostImage(env, sourceUrl);
      const patch = await sbFetch(env, `news?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ image: newUrl }),
      });
      if (!patch.ok) throw new Error(`PATCH ${patch.status}: ${await patch.text().catch(() => '')}`);
      results.fixed.push({ id: row.id, image: newUrl });
    } catch (err) {
      // Most likely cause: the message or its attachment was deleted on
      // Discord's side, so there's genuinely nothing left to re-host.
      results.failed.push({ id: row.id, error: err.message });
    }
  }

  return results;
}

module.exports = { rehostExistingNewsImages };

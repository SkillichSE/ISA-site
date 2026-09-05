const {
  apiError,
  cleanToken,
  stripMentions,
  firstImageAttachment,
  buildTitle,
  toIsoDate,
  discordFetch,
  authorTag,
} = require('./discord-message-utils');

const DEFAULT_CHANNELS = [
  { id: '1523406946231910572', tag: 'Community' },
  { id: '1522187523869114409', tag: 'Community' },
  { id: '1525614919423103126', tag: 'Community' },
  { id: '1529209364618023114', tag: 'Community' },
];

function parseChannelConfig(env) {
  const raw = String(env.NEWS_SYNC_CHANNELS || '').trim();
  if (!raw) return DEFAULT_CHANNELS;

  return raw.split(',').map((entry) => {
    const [id, tag] = entry.split(':').map((s) => (s || '').trim());
    return { id, tag: tag || 'Community' };
  }).filter((c) => c.id);
}

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

async function getSyncState(env, channelId) {
  const res = await sbFetch(env, `discord_sync_state?channel_id=eq.${channelId}&select=last_message_id`);
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows[0] || null;
}

async function setSyncState(env, channelId, lastMessageId) {
  await sbFetch(env, 'discord_sync_state?on_conflict=channel_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ channel_id: channelId, last_message_id: lastMessageId }),
  });
}

async function insertNews(env, item) {
  const res = await sbFetch(env, 'news', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(item),
  });
  if (!res.ok && res.status !== 409) {
    const body = await res.json().catch(() => ({}));
    throw apiError(`Supabase insert failed: ${body.message || res.status}`, 502);
  }
}

async function syncChannel(env, token, channel) {
  const state = await getSyncState(env, channel.id);
  const isFirstRun = !state;

  const query = state
    ? `after=${state.last_message_id}&limit=100`
    : `limit=1`;

  const messages = await discordFetch(`/channels/${channel.id}/messages?${query}`, token);
  if (!Array.isArray(messages) || messages.length === 0) {
    return { channel: channel.id, published: 0 };
  }

  const ordered = [...messages].sort((a, b) => (a.id < b.id ? -1 : 1));

  let published = 0;

  if (!isFirstRun) {
    for (const message of ordered) {
      if (message.author?.bot) continue;

      const image = firstImageAttachment(message);
      const rawText = String(message.content || '').trim();
      if (!image || !rawText) continue;

      const cleanText = stripMentions(rawText);
      if (!cleanText) continue;

      await insertNews(env, {
        id: `discord-${message.id}`,
        tag: authorTag(message) || channel.tag,
        title: buildTitle(cleanText),
        date: toIsoDate(message.timestamp),
        body: cleanText,
        image: image.url,
        link: `https://discord.com/channels/${env.GUILD_ID || ''}/${channel.id}/${message.id}`,
        tags: ['Discord'],
      });
      published += 1;
    }
  }

  const newest = ordered[ordered.length - 1].id;
  await setSyncState(env, channel.id, newest);

  return { channel: channel.id, published };
}

async function runDiscordNewsSync(env) {
  const token = cleanToken(env.DISCORD_BOT_TOKEN);
  if (!token) throw apiError('DISCORD_BOT_TOKEN is not configured.', 503);
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw apiError('Supabase is not configured on the server.', 503);
  }

  const channels = parseChannelConfig(env);
  const results = [];
  for (const channel of channels) {
    try {
      results.push(await syncChannel(env, token, channel));
    } catch (err) {
      results.push({ channel: channel.id, error: err.message });
    }
  }
  return results;
}

module.exports = { runDiscordNewsSync };

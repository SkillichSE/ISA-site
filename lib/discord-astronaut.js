const {
  apiError,
  cleanToken,
} = require('./discord-message-utils');

const DISCORD_API = 'https://discord.com/api/v10';

function cleanWebhookUrl(raw) {
  return String(raw || '').trim().replace(/^["']|["']$/g, '');
}

function isValidWebhookUrl(url) {
  return /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+/.test(url);
}

function clip(text, max) {
  const value = String(text || '').trim() || '—';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

async function discordFetch(path, token, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bot ${token}`);
  headers.set('Content-Type', 'application/json');
  return fetch(`${DISCORD_API}${path}`, { ...init, headers });
}

async function readDiscordError(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  return {
    status: response.status,
    code: data.code,
    message: data.message || '',
  };
}

async function parseDiscordError(response) {
  const { status, code, message } = await readDiscordError(response);

  if (status === 401) {
    return 'Invalid bot token or webhook URL.';
  }
  if (status === 403) {
    if (code === 50001) {
      return 'Bot cannot see the astronaut applications channel. Ask the server owner to allow the bot in that channel.';
    }
    if (code === 50013) {
      return 'Bot cannot post in the channel. Easiest fix: use a Discord Webhook instead.';
    }
    return message
      ? `Discord access denied: ${message}${code ? ` (code ${code})` : ''}`
      : 'Discord denied access to the channel.';
  }
  if (status === 404) {
    return 'Channel or webhook not found. Check ASTRONAUT_CHANNEL_ID or DISCORD_WEBHOOK_URL.';
  }

  return message || `Discord returned error ${status}.`;
}

function buildEmbed(data) {
  const fields = [
    { name: 'Discord', value: clip(data.discord, 256), inline: true },
    { name: 'Age', value: clip(data.age, 32), inline: true },
    { name: 'Country', value: clip(data.country, 100), inline: true },
    { name: 'Motivation', value: clip(data.motivation, 1024) },
  ];

  if (data.experience) {
    fields.push({ name: 'Experience', value: clip(data.experience, 1024) });
  }

  return {
    title: clip(`New astronaut application: ${data.discord}`, 256),
    color: 0x2563eb,
    fields,
    footer: { text: 'Astronauts · ISA' },
    timestamp: new Date().toISOString(),
  };
}

function buildPlainMessage(data) {
  const lines = [
    `**New astronaut application: ${data.discord}**`,
    `Discord: ${data.discord}`,
    `Age: ${data.age}`,
    `Country: ${data.country}`,
    `Motivation: ${data.motivation || '—'}`,
  ];

  if (data.experience) {
    lines.push(`Experience: ${data.experience}`);
  }

  return lines.join('\n');
}

function withWebhookMeta(payload) {
  return { ...payload, username: 'ISA Astronauts' };
}

async function postWebhook(webhookUrl, payload) {
  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withWebhookMeta(payload)),
  });
}

async function postChannelMessage(channelId, token, payload) {
  return discordFetch(`/channels/${channelId}/messages`, token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function sendWithRetries(postFn, data) {
  const attempts = [
    { payload: { embeds: [buildEmbed(data)] } },
    { payload: { content: buildPlainMessage(data) } },
  ];

  let lastResponse = null;

  for (const attempt of attempts) {
    lastResponse = await postFn(attempt.payload);
    if (lastResponse.ok) return;

    const err = await readDiscordError(lastResponse);
    console.error('Discord post attempt failed:', err.status, err.code, err.message);

    if (err.status === 401 || err.status === 404 || err.code === 50001 || err.code === 50013) {
      break;
    }
  }

  throw apiError(await parseDiscordError(lastResponse), 502);
}

function validatePayload(data) {
  if (!data.discord || !data.age || !data.country || !data.motivation) {
    return 'Missing required fields.';
  }
  const ageNum = parseInt(data.age, 10);
  if (Number.isNaN(ageNum) || ageNum < 14) {
    return 'You must be at least 14 to apply.';
  }
  if (data.discord.length > 64 || data.country.length > 100) {
    return 'Discord username or country is too long.';
  }
  if (data.motivation.length > 1000) {
    return 'Motivation is too long.';
  }
  if (data.experience && data.experience.length > 1000) {
    return 'Experience is too long.';
  }
  return null;
}

async function processAstronautApplication(body, env) {
  const webhookUrl = cleanWebhookUrl(env.ASTRONAUT_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL);
  const token = cleanToken(env.DISCORD_BOT_TOKEN);
  const channelId = String(env.ASTRONAUT_CHANNEL_ID || env.LAUNCH_CHANNEL_ID || '').trim();

  if (!webhookUrl && !token) {
    throw apiError('Form is not connected to Discord yet. Set DISCORD_WEBHOOK_URL (or ASTRONAUT_WEBHOOK_URL) in Vercel.', 503);
  }

  if (webhookUrl && !isValidWebhookUrl(webhookUrl)) {
    throw apiError('DISCORD_WEBHOOK_URL looks invalid.', 503);
  }

  if (!webhookUrl && !channelId) {
    throw apiError('Set ASTRONAUT_CHANNEL_ID (or LAUNCH_CHANNEL_ID) in Vercel.', 503);
  }

  const data = {
    discord: String(body.discord || '').trim(),
    age: String(body.age || '').trim(),
    country: String(body.country || '').trim(),
    motivation: String(body.motivation || '').trim(),
    experience: String(body.experience || '').trim(),
  };

  const validationError = validatePayload(data);
  if (validationError) throw apiError(validationError);

  if (webhookUrl) {
    await sendWithRetries((payload) => postWebhook(webhookUrl, payload), data);
  } else {
    await sendWithRetries((payload) => postChannelMessage(channelId, token, payload), data);
  }

  return { ok: true };
}

module.exports = { processAstronautApplication };

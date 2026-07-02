const DISCORD_API = 'https://discord.com/api/v10';
const ASTRONAUT_CHANNEL_ID = '1518571452314550302';

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanToken(raw) {
  let token = String(raw || '').trim();
  token = token.replace(/^Bot\s+/i, '');
  token = token.replace(/^["']|["']$/g, '');
  return token;
}

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
  return fetch(`${DISCORD_API}${path}`, { ...init, headers });
}

async function readDiscordError(response) {
  let data = {};
  try { data = await response.json(); } catch { data = {}; }
  return { status: response.status, code: data.code, message: data.message || '' };
}

async function parseDiscordError(response) {
  const { status, code, message } = await readDiscordError(response);
  if (status === 401) return 'Invalid bot token or webhook URL.';
  if (status === 403) {
    if (code === 50001) return 'Bot cannot see the astronaut applications channel.';
    if (code === 50013) return 'Bot cannot post in the channel.';
    return message ? `Discord access denied: ${message}` : 'Discord denied access.';
  }
  if (status === 404) return 'Channel or webhook not found.';
  return message || `Discord returned error ${status}.`;
}

function buildEmbed(data) {
  return {
    title: clip(`New astronaut application: ${data.discord}`, 256),
    color: 0x2563eb,
    fields: [
      { name: 'Discord', value: clip(data.discord, 256), inline: true },
      { name: 'Age', value: clip(data.age, 256), inline: true },
      { name: 'Country', value: clip(data.country, 256), inline: true },
      { name: 'Motivation', value: clip(data.motivation, 1024), inline: false },
      { name: 'Experience', value: clip(data.experience || '—', 1024), inline: false },
    ],
    footer: { text: 'Astronaut Corps · ISA' },
    timestamp: new Date().toISOString(),
  };
}

function buildPlainMessage(data) {
  return [
    `**New astronaut application: ${data.discord}**`,
    `Discord: ${data.discord}`,
    `Age: ${data.age}`,
    `Country: ${data.country}`,
    `Motivation: ${data.motivation}`,
    `Experience: ${data.experience || '—'}`,
  ].join('\n');
}

function withWebhookMeta(payload) {
  return { ...payload, username: 'ISA Astronaut Corps' };
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
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function sendWithRetries(postFn, data) {
  const attempts = [
    { embeds: [buildEmbed(data)] },
    { content: buildPlainMessage(data) },
  ];

  let lastResponse = null;

  for (const payload of attempts) {
    lastResponse = await postFn(payload);
    if (lastResponse.ok) return;
    const err = await readDiscordError(lastResponse);
    console.error('Discord post attempt failed:', err.status, err.code, err.message);
    if (err.status === 401 || err.status === 404 || err.code === 50001 || err.code === 50013) break;
  }

  throw apiError(await parseDiscordError(lastResponse), 502);
}

function validatePayload(data) {
  if (!data.discord || !data.age || !data.country || !data.motivation) {
    return 'Missing required fields.';
  }
  if (isNaN(parseInt(data.age)) || parseInt(data.age) < 14) {
    return 'Applicant must be at least 14.';
  }
  if (data.discord.length > 64) return 'Discord username too long.';
  if (data.motivation.length > 800) return 'Motivation text too long.';
  if (data.experience && data.experience.length > 800) return 'Experience text too long.';
  return null;
}

async function processAstronautApplication(body, env) {
  const webhookUrl = cleanWebhookUrl(env.ASTRONAUT_WEBHOOK_URL || '');
  const token = cleanToken(env.DISCORD_BOT_TOKEN || '');
  const channelId = ASTRONAUT_CHANNEL_ID;

  if (!webhookUrl && !token) {
    throw apiError('Form is not connected to Discord yet. Set ASTRONAUT_WEBHOOK_URL or DISCORD_BOT_TOKEN in Vercel.', 503);
  }

  if (webhookUrl && !isValidWebhookUrl(webhookUrl)) {
    throw apiError('ASTRONAUT_WEBHOOK_URL looks invalid.', 503);
  }

  const data = {
    discord:    String(body.discord    || '').trim(),
    age:        String(body.age        || '').trim(),
    country:    String(body.country    || '').trim(),
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
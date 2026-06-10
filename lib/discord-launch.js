const { File } = require('node:buffer');

const DISCORD_API = 'https://discord.com/api/v10';
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.nbt', '.snbt', '.json', '.png', '.jpg', '.jpeg']);

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
      return 'Bot cannot see the launch channel. Ask the server owner to allow the bot in that channel (and its category).';
    }
    if (code === 50013) {
      return 'Bot cannot post in the channel. Easiest fix: use a Discord Webhook instead (see LAUNCHSHARE.md).';
    }
    return message
      ? `Discord access denied: ${message}${code ? ` (code ${code})` : ''}`
      : 'Discord denied access to the channel.';
  }
  if (status === 404) {
    return 'Channel or webhook not found. Check LAUNCH_CHANNEL_ID or DISCORD_WEBHOOK_URL.';
  }

  return message || `Discord returned error ${status}.`;
}

function formatMonth(value) {
  if (!value) return '—';
  const [year, month] = value.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[Number(month) - 1] || month} ${year}`;
}

function buildEmbed(data) {
  const windowText = data.launchDateMax
    ? `${formatMonth(data.launchDate)} – ${formatMonth(data.launchDateMax)}`
    : `No earlier than ${formatMonth(data.launchDate)}`;

  return {
    title: clip(`New launch request: ${data.satName}`, 256),
    color: 0x2563eb,
    fields: [
      { name: 'Discord', value: clip(data.discord, 256), inline: true },
      { name: 'Satellite', value: clip(data.satName, 256), inline: true },
      { name: 'Orbit', value: clip(data.orbit, 256), inline: true },
      { name: 'Launch window', value: clip(windowText, 1024), inline: false },
      { name: 'Mission description', value: clip(data.description, 1024) },
    ],
    footer: { text: 'Launchshare · ISA' },
    timestamp: new Date().toISOString(),
  };
}

function buildPlainMessage(data, attachmentName) {
  const windowText = data.launchDateMax
    ? `${formatMonth(data.launchDate)} – ${formatMonth(data.launchDateMax)}`
    : `No earlier than ${formatMonth(data.launchDate)}`;

  const lines = [
    `**New launch request: ${data.satName}**`,
    `Discord: ${data.discord}`,
    `Satellite: ${data.satName}`,
    `Orbit: ${data.orbit}`,
    `Launch window: ${windowText}`,
    `Description: ${data.description || '—'}`,
  ];

  if (attachmentName) {
    lines.push(`Attachment: ${attachmentName}`);
  }

  return lines.join('\n');
}

function withWebhookMeta(payload) {
  return { ...payload, username: 'ISA Launchshare' };
}

async function postWebhook(webhookUrl, payload, file) {
  if (file) {
    const body = new FormData();
    body.append('payload_json', JSON.stringify(withWebhookMeta(payload)));
    body.append('files[0]', new File([file.bytes], file.name, { type: file.type }));
    return fetch(webhookUrl, { method: 'POST', body });
  }

  return fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withWebhookMeta(payload)),
  });
}

async function postChannelMessage(channelId, token, payload, file) {
  if (file) {
    const body = new FormData();
    body.append('payload_json', JSON.stringify(payload));
    body.append('files[0]', new File([file.bytes], file.name, { type: file.type }));
    return discordFetch(`/channels/${channelId}/messages`, token, { method: 'POST', body });
  }

  return discordFetch(`/channels/${channelId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function validatePayload(data) {
  if (!data.discord || !data.satName || !data.orbit || !data.launchDate) {
    return 'Missing required fields.';
  }
  if (data.discord.length > 64 || data.satName.length > 80) {
    return 'Discord username or satellite name is too long.';
  }
  if (data.description && data.description.length > 800) {
    return 'Mission description is too long.';
  }
  return null;
}

function parseAttachment(file) {
  if (!file || !file.data) return null;

  const name = String(file.name || 'payload.bin');
  const ext = `.${name.split('.').pop().toLowerCase()}`;
  if (!ALLOWED_EXT.has(ext)) {
    throw apiError('File type not allowed.');
  }

  const bytes = Buffer.from(String(file.data), 'base64');
  if (bytes.length > MAX_FILE_BYTES) {
    throw apiError('File is too large. Max size is 3 MB.');
  }

  return {
    name,
    type: file.type || 'application/octet-stream',
    bytes,
  };
}

async function getBotUser(token) {
  const response = await discordFetch('/users/@me', token);
  if (!response.ok) {
    throw apiError(await parseDiscordError(response), 502);
  }
  return response.json();
}

async function getChannel(channelId, token) {
  const response = await discordFetch(`/channels/${channelId}`, token);
  if (!response.ok) {
    throw apiError(await parseDiscordError(response), 502);
  }
  return response.json();
}

async function sendWithRetries(postFn, data, attachment) {
  const attempts = [
    { payload: { embeds: [buildEmbed(data)] }, file: attachment },
    { payload: { embeds: [buildEmbed(data)] }, file: null },
    { payload: { content: buildPlainMessage(data, attachment?.name) }, file: attachment },
    { payload: { content: buildPlainMessage(data, attachment?.name) }, file: null },
  ];

  let lastResponse = null;

  for (const attempt of attempts) {
    lastResponse = await postFn(attempt.payload, attempt.file);
    if (lastResponse.ok) return;

    const err = await readDiscordError(lastResponse);
    console.error('Discord post attempt failed:', err.status, err.code, err.message);

    if (err.status === 401 || err.status === 404 || err.code === 50001 || err.code === 50013) {
      break;
    }
  }

  throw apiError(await parseDiscordError(lastResponse), 502);
}

async function sendViaWebhook(webhookUrl, data, attachment) {
  await sendWithRetries(
    (payload, file) => postWebhook(webhookUrl, payload, file),
    data,
    attachment
  );
}

async function sendViaBot(channelId, token, data, attachment) {
  await sendWithRetries(
    (payload, file) => postChannelMessage(channelId, token, payload, file),
    data,
    attachment
  );
}

async function checkDiscordSetup(env) {
  const webhookUrl = cleanWebhookUrl(env.DISCORD_WEBHOOK_URL);

  if (webhookUrl) {
    if (!isValidWebhookUrl(webhookUrl)) {
      throw apiError('DISCORD_WEBHOOK_URL looks invalid.', 503);
    }
    return { mode: 'webhook', webhook: 'configured' };
  }

  const token = cleanToken(env.DISCORD_BOT_TOKEN);
  const channelId = String(env.LAUNCH_CHANNEL_ID || '1514303404103700530').trim();

  if (!token) {
    throw apiError('Set DISCORD_WEBHOOK_URL (recommended) or DISCORD_BOT_TOKEN in Vercel.', 503);
  }

  const bot = await getBotUser(token);
  const channel = await getChannel(channelId, token);

  return {
    mode: 'bot',
    bot: `${bot.username} (${bot.id})`,
    channel: `#${channel.name || 'unknown'} (${channel.id})`,
    channelType: channel.type,
    guildId: channel.guild_id || null,
  };
}

async function processLaunchRequest(body, env) {
  const webhookUrl = cleanWebhookUrl(env.DISCORD_WEBHOOK_URL);
  const token = cleanToken(env.DISCORD_BOT_TOKEN);
  const channelId = String(env.LAUNCH_CHANNEL_ID || '1514303404103700530').trim();

  if (!webhookUrl && !token) {
    throw apiError('Form is not connected to Discord yet. Set DISCORD_WEBHOOK_URL in Vercel.', 503);
  }

  if (webhookUrl && !isValidWebhookUrl(webhookUrl)) {
    throw apiError('DISCORD_WEBHOOK_URL looks invalid.', 503);
  }

  const data = {
    discord: String(body.discord || '').trim(),
    satName: String(body.satName || '').trim(),
    orbit: String(body.orbit || '').trim(),
    launchDate: String(body.launchDate || '').trim(),
    launchDateMax: String(body.launchDateMax || '').trim(),
    description: String(body.description || '').trim(),
  };

  const validationError = validatePayload(data);
  if (validationError) throw apiError(validationError);

  const attachment = parseAttachment(body.file);

  if (webhookUrl) {
    await sendViaWebhook(webhookUrl, data, attachment);
  } else {
    await sendViaBot(channelId, token, data, attachment);
  }

  return { ok: true };
}

module.exports = { processLaunchRequest, checkDiscordSetup, cleanToken };

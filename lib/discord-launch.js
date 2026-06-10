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
    return 'Invalid bot token. Check DISCORD_BOT_TOKEN in Vercel (use Bot Token, not Application ID).';
  }
  if (status === 403) {
    if (code === 50001) {
      return 'Bot cannot see the launch channel. In channel settings → Permissions, add the bot role with View Channel enabled (check the category too).';
    }
    if (code === 50013) {
      return [
        'Bot still cannot post in the launch channel (Missing Permissions).',
        'In Discord: channel → Edit → Permissions → add the bot role explicitly with:',
        'View Channel, Send Messages, Embed Links, Attach Files.',
        'Also check the category permissions — they override server defaults.',
        'Fast fix: give the bot Administrator in Server Settings → Roles.',
      ].join(' ');
    }
    return message || 'Discord denied access to the channel.';
  }
  if (status === 404) {
    return 'Launch channel not found. Check LAUNCH_CHANNEL_ID matches the channel where the bot was added.';
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

async function checkDiscordSetup(env) {
  const token = cleanToken(env.DISCORD_BOT_TOKEN);
  const channelId = String(env.LAUNCH_CHANNEL_ID || '1513506023892193392').trim();

  if (!token) {
    throw apiError('DISCORD_BOT_TOKEN is not set.', 503);
  }

  const bot = await getBotUser(token);
  const channel = await getChannel(channelId, token);

  return {
    bot: `${bot.username} (${bot.id})`,
    channel: `#${channel.name || 'unknown'} (${channel.id})`,
    channelType: channel.type,
    guildId: channel.guild_id || null,
  };
}

async function sendLaunchMessage(channelId, token, data, attachment) {
  const attempts = [
    { payload: { embeds: [buildEmbed(data)] }, file: attachment },
    { payload: { embeds: [buildEmbed(data)] }, file: null },
    { payload: { content: buildPlainMessage(data, attachment?.name) }, file: attachment },
    { payload: { content: buildPlainMessage(data, attachment?.name) }, file: null },
  ];

  let lastResponse = null;

  for (const attempt of attempts) {
    lastResponse = await postChannelMessage(channelId, token, attempt.payload, attempt.file);
    if (lastResponse.ok) {
      return { usedPlainText: Boolean(attempt.payload.content) };
    }

    const err = await readDiscordError(lastResponse);
    console.error('Discord post attempt failed:', err.status, err.code, err.message);

    // Stop retrying on auth / access errors — permissions won't improve with another format.
    if (err.status === 401 || err.status === 404 || err.code === 50001 || err.code === 50013) {
      break;
    }
  }

  throw apiError(await parseDiscordError(lastResponse), 502);
}

async function processLaunchRequest(body, env) {
  const token = cleanToken(env.DISCORD_BOT_TOKEN);
  const channelId = String(env.LAUNCH_CHANNEL_ID || '1513506023892193392').trim();

  if (!token) {
    throw apiError('Launch API is not configured. Set DISCORD_BOT_TOKEN in Vercel.', 503);
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
  await sendLaunchMessage(channelId, token, data, attachment);

  return { ok: true };
}

module.exports = { processLaunchRequest, checkDiscordSetup, cleanToken };

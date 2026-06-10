const { File } = require('node:buffer');

const DISCORD_API = 'https://discord.com/api/v10';
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.nbt', '.snbt', '.json', '.png', '.jpg', '.jpeg']);

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
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

async function parseDiscordError(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  const code = data.code;
  const message = data.message || '';

  if (response.status === 401) {
    return 'Invalid bot token. Check DISCORD_BOT_TOKEN in Vercel (use Bot Token, not Application ID).';
  }
  if (response.status === 403) {
    if (code === 50001) {
      return 'Bot cannot see the launch channel. Add the bot to the server and allow View Channel in that channel.';
    }
    if (code === 50013) {
      return 'Bot lacks permissions in the launch channel. Needs Send Messages, Embed Links, and Attach Files.';
    }
    return message || 'Discord denied access to the channel.';
  }
  if (response.status === 404) {
    return 'Launch channel not found. Check LAUNCH_CHANNEL_ID.';
  }

  return message || `Discord returned error ${response.status}.`;
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

async function postChannelMessage(channelId, token, payload, file) {
  if (file) {
    const body = new FormData();
    body.append('payload_json', JSON.stringify(payload));
    body.append(
      'files[0]',
      new File([file.bytes], file.name, { type: file.type })
    );
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

async function processLaunchRequest(body, env) {
  const token = String(env.DISCORD_BOT_TOKEN || '').trim();
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
  const payload = { embeds: [buildEmbed(data)] };

  let channelResponse = await postChannelMessage(channelId, token, payload, attachment);

  // If file upload fails, retry without the file so the request still gets through.
  if (!channelResponse.ok && attachment) {
    console.error('Discord file upload failed, retrying without file:', channelResponse.status);
    payload.embeds[0].fields.push({
      name: 'Attachment',
      value: clip(`Upload failed — file was: ${attachment.name}`, 1024),
    });
    channelResponse = await postChannelMessage(channelId, token, payload, null);
  }

  if (!channelResponse.ok) {
    const detail = await parseDiscordError(channelResponse);
    console.error('Discord channel post failed:', channelResponse.status, detail);
    throw apiError(detail, 502);
  }

  return { ok: true };
}

module.exports = { processLaunchRequest };

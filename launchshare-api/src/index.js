const DISCORD_API = 'https://discord.com/api/v10';
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.nbt', '.snbt', '.json', '.png', '.jpg', '.jpeg']);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || 'https://skillichse.github.io,http://localhost:5500,http://127.0.0.1:5500')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const match = allowed.find((entry) => origin === entry || origin.startsWith(`${entry}/`));
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  // only set ACAO if origin is actually allowed, don't leak to randoms
  if (match) headers['Access-Control-Allow-Origin'] = match;
  return headers;
}

async function discordFetch(path, token, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bot ${token}`);
  return fetch(`${DISCORD_API}${path}`, { ...init, headers });
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
    title: `New launch request: ${data.satName}`,
    color: 0x2563eb,
    fields: [
      { name: 'Discord', value: data.discord, inline: true },
      { name: 'Satellite', value: data.satName, inline: true },
      { name: 'Orbit', value: data.orbit, inline: true },
      { name: 'Launch window', value: windowText, inline: false },
      { name: 'Mission description', value: data.description || '—' },
    ],
    footer: { text: 'Launchshare · ISA' },
    timestamp: new Date().toISOString(),
  };
}

async function postChannelMessage(channelId, token, payload, file) {
  if (file) {
    const body = new FormData();
    body.append('payload_json', JSON.stringify(payload));
    body.append('files[0]', new Blob([file.bytes], { type: file.type }), file.name);
    return discordFetch(`/channels/${channelId}/messages`, token, { method: 'POST', body });
  }

  return discordFetch(`/channels/${channelId}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function findGuildMember(guildId, token, discordHandle) {
  const query = discordHandle.replace(/#\d+$/, '').trim();
  if (!query) return null;

  const response = await discordFetch(
    `/guilds/${guildId}/members/search?query=${encodeURIComponent(query)}&limit=10`,
    token
  );
  if (!response.ok) return null;

  const members = await response.json();
  const lower = query.toLowerCase();

  const match = members.find((member) => {
    const username = member.user.username?.toLowerCase();
    const globalName = member.user.global_name?.toLowerCase();
    return username === lower || globalName === lower;
  });

  return match?.user || null;
}

async function sendDirectMessage(userId, token, content) {
  const dmChannelResponse = await discordFetch(`/users/${userId}/channels`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!dmChannelResponse.ok) return false;

  const dmChannel = await dmChannelResponse.json();
  const messageResponse = await discordFetch(`/channels/${dmChannel.id}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  return messageResponse.ok;
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

async function handleSubmit(request, env, corsHeaders) {
  if (!env.DISCORD_BOT_TOKEN || !env.LAUNCH_CHANNEL_ID) {
    return json({ ok: false, error: 'Launch API is not configured yet.' }, 503, corsHeaders);
  }

  const formData = await request.formData();
  const data = {
    discord: String(formData.get('discord') || '').trim(),
    satName: String(formData.get('satName') || '').trim(),
    orbit: String(formData.get('orbit') || '').trim(),
    launchDate: String(formData.get('launchDate') || '').trim(),
    launchDateMax: String(formData.get('launchDateMax') || '').trim(),
    description: String(formData.get('description') || '').trim(),
  };

  const validationError = validatePayload(data);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400, corsHeaders);
  }

  const file = formData.get('file');
  let attachment = null;

  if (file && typeof file !== 'string' && file.size > 0) {
    const ext = `.${file.name.split('.').pop().toLowerCase()}`;
    if (!ALLOWED_EXT.has(ext)) {
      return json({ ok: false, error: 'File type not allowed.' }, 400, corsHeaders);
    }
    if (file.size > MAX_FILE_BYTES) {
      return json({ ok: false, error: 'File is too large. Max size is 8 MB.' }, 400, corsHeaders);
    }
    attachment = {
      name: file.name,
      type: file.type || 'application/octet-stream',
      bytes: await file.arrayBuffer(),
    };
  }

  const channelPayload = { embeds: [buildEmbed(data)] };
  const channelResponse = await postChannelMessage(
    env.LAUNCH_CHANNEL_ID,
    env.DISCORD_BOT_TOKEN,
    channelPayload,
    attachment
  );

  if (!channelResponse.ok) {
    const errorText = await channelResponse.text();
    console.error('Discord channel post failed:', channelResponse.status, errorText);
    return json({ ok: false, error: 'Could not post the request to Discord.' }, 502, corsHeaders);
  }

  let dmSent = false;
  const guildId = env.GUILD_ID || '1507774799194099903';
  const member = await findGuildMember(guildId, env.DISCORD_BOT_TOKEN, data.discord);

  if (member) {
    const dmText = [
      '**ISA Launchshare — request received**',
      '',
      `Satellite: **${data.satName}**`,
      `Orbit: **${data.orbit}**`,
      `Launch window: **${formatMonth(data.launchDate)}${data.launchDateMax ? ` – ${formatMonth(data.launchDateMax)}` : ''}**`,
      '',
      'Our team will review your request within **48 hours**.',
    ].join('\n');

    dmSent = await sendDirectMessage(member.id, env.DISCORD_BOT_TOKEN, dmText);
  }

  return json({ ok: true, dmSent, memberFound: Boolean(member) }, 200, corsHeaders);
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true }, 200, corsHeaders);
    }

    if (request.method === 'POST' && (url.pathname === '/submit' || url.pathname === '/')) {
      return handleSubmit(request, env, corsHeaders);
    }

    return json({ ok: false, error: 'Not found' }, 404, corsHeaders);
  },
};

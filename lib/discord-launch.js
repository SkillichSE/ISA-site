const {
  discordFetch,
  findGuildMember,
  sendDirectMessage,
} = require('./discord-bot');

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_EXT = new Set(['.nbt', '.snbt', '.json', '.png', '.jpg', '.jpeg']);

function apiError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
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
    throw apiError('File is too large. Max size is 4 MB.');
  }

  return {
    name,
    type: file.type || 'application/octet-stream',
    bytes,
  };
}

async function processLaunchRequest(body, env) {
  const token = env.DISCORD_BOT_TOKEN;
  const channelId = env.LAUNCH_CHANNEL_ID || '1513506023892193392';
  const guildId = env.GUILD_ID || '1507774799194099903';

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
  const channelResponse = await postChannelMessage(
    channelId,
    token,
    { embeds: [buildEmbed(data)] },
    attachment
  );

  if (!channelResponse.ok) {
    console.error('Discord channel post failed:', channelResponse.status, await channelResponse.text());
    throw apiError('Could not post the request to Discord.', 502);
  }

  let dmSent = false;
  const member = await findGuildMember(guildId, token, data.discord);

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

    const dmResult = await sendDirectMessage(member.id, token, dmText);
    dmSent = dmResult.ok;
  }

  return { ok: true, dmSent, memberFound: Boolean(member) };
}

module.exports = { processLaunchRequest };

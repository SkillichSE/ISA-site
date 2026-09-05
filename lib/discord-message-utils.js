const DISCORD_API = 'https://discord.com/api/v10';

function apiError(message, status = 500) {
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

function stripMentions(text) {
  return String(text || '')
    .replace(/<@!?\d+>/g, '')
    .replace(/<@&\d+>/g, '')
    .replace(/@everyone/gi, '')
    .replace(/@here/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function firstImageAttachment(message) {
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  return attachments.find((a) => {
    if (a.content_type && a.content_type.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp)$/i.test(a.filename || a.url || '');
  }) || null;
}

function buildTitle(text) {
  const firstLine = text.split('\n').find((l) => l.trim()) || text;
  const clean = firstLine.trim();
  return clean.length > 90 ? `${clean.slice(0, 89)}…` : clean;
}

function toIsoDate(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function parseMessageUrl(url) {
  const match = String(url || '').trim().match(
    /discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/
  );
  if (!match) return null;
  return { guildId: match[1], channelId: match[2], messageId: match[3] };
}

async function discordFetch(path, token) {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw apiError(`Discord API ${res.status}: ${body.message || 'error'}`, 502);
  }
  return res.json();
}

module.exports = {
  apiError,
  cleanToken,
  stripMentions,
  firstImageAttachment,
  buildTitle,
  toIsoDate,
  parseMessageUrl,
  discordFetch,
};

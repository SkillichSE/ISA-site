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

const DISCORD_TIMESTAMP_RE = /<t:(-?\d+)(?::([tTdDfFR]))?>/g;

function formatRelativeTime(diffMs) {
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['week', 604800000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    const value = diffMs / ms;
    if (Math.abs(value) >= 1 || unit === 'second') {
      return rtf.format(Math.round(value), unit);
    }
  }
  return 'just now';
}

function formatDiscordTimestamp(unixSeconds, style) {
  const date = new Date(Number(unixSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return null;

  if (style === 'R') {
    return formatRelativeTime(date.getTime() - Date.now());
  }

  const time = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' };
  const timeSec = { ...time, second: '2-digit' };
  const dateLong = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
  const dateShort = { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' };
  const dateLongWithDay = { weekday: 'long', ...dateLong };

  switch (style) {
    case 't':
      return `${new Intl.DateTimeFormat('en-US', time).format(date)} UTC`;
    case 'T':
      return `${new Intl.DateTimeFormat('en-US', timeSec).format(date)} UTC`;
    case 'd':
      return new Intl.DateTimeFormat('en-GB', dateShort).format(date);
    case 'D':
      return new Intl.DateTimeFormat('en-US', dateLong).format(date);
    case 'F':
      return `${new Intl.DateTimeFormat('en-US', dateLongWithDay).format(date)} \u2022 ${new Intl.DateTimeFormat('en-US', time).format(date)} UTC`;
    case 'f':
    default:
      return `${new Intl.DateTimeFormat('en-US', dateLong).format(date)} \u2022 ${new Intl.DateTimeFormat('en-US', time).format(date)} UTC`;
  }
}

// Discord-only tags like <t:1788625800:D> mean nothing to a generic markdown
// renderer (marked.js etc.), so they show up as raw text on the site. This
// swaps them for plain, human-readable UTC text at import time, before the
// message is ever handed to the markdown renderer.
function convertDiscordTimestamps(text) {
  return String(text || '').replace(DISCORD_TIMESTAMP_RE, (match, unix, style) => {
    const formatted = formatDiscordTimestamp(unix, style);
    return formatted === null ? match : formatted;
  });
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
  const trimmed = firstLine.trim();
  const periodIdx = trimmed.indexOf('.');
  if (periodIdx === -1) return trimmed;
  return trimmed.slice(0, periodIdx).trim();
}

function toIsoDate(timestamp) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

const AUTHOR_TAGS = {
  '.bmng': 'Kazakhstan',
  'andreatnt12': 'Main ISA',
};

function authorTag(message) {
  const username = String(message.author?.username || '').trim().toLowerCase();
  return AUTHOR_TAGS[username] || null;
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
  convertDiscordTimestamps,
  firstImageAttachment,
  buildTitle,
  toIsoDate,
  parseMessageUrl,
  discordFetch,
  authorTag,
};

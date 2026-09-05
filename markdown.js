// Markdown helpers shared by admin.html and the public pages.
// Needs marked.js and DOMPurify loaded first.

function escHtmlMd(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Discord message-link timestamps: <t:UNIXTIME> or <t:UNIXTIME:STYLE>.
// Generic markdown renderers (marked.js) don't know this syntax and leave it
// as literal text, so we swap it for a plain, readable string in the
// visitor's own local time zone before markdown ever sees it.
const DISCORD_TIMESTAMP_RE = /<t:(-?\d+)(?::([tTdDfFR]))?>/g;

function formatDiscordRelative(diffMs) {
  const units = [
    ['year', 31536000000],
    ['month', 2592000000],
    ['week', 604800000],
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
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

  if (style === 'R') return formatDiscordRelative(date.getTime() - Date.now());

  const time = { hour: 'numeric', minute: '2-digit' };
  const timeSec = { ...time, second: '2-digit' };
  const dateLong = { day: 'numeric', month: 'long', year: 'numeric' };
  const dateShort = { day: '2-digit', month: '2-digit', year: 'numeric' };
  const dateLongWithDay = { weekday: 'long', ...dateLong };

  switch (style) {
    case 't': return new Intl.DateTimeFormat('en-US', time).format(date);
    case 'T': return new Intl.DateTimeFormat('en-US', timeSec).format(date);
    case 'd': return new Intl.DateTimeFormat('en-US', dateShort).format(date);
    case 'D': return new Intl.DateTimeFormat('en-US', dateLong).format(date);
    case 'F':
      return `${new Intl.DateTimeFormat('en-US', dateLongWithDay).format(date)} \u2022 ${new Intl.DateTimeFormat('en-US', time).format(date)}`;
    case 'f':
    default:
      return `${new Intl.DateTimeFormat('en-US', dateLong).format(date)} \u2022 ${new Intl.DateTimeFormat('en-US', time).format(date)}`;
  }
}

function convertDiscordTimestamps(text) {
  return String(text || '').replace(DISCORD_TIMESTAMP_RE, (match, unix, style) => {
    const formatted = formatDiscordTimestamp(unix, style);
    return formatted === null ? match : formatted;
  });
}

// Raw Discord user/role/channel mentions and @everyone/@here, in case text
// was typed or pasted directly (e.g. into the launches admin form) without
// going through the Discord-import cleanup pipeline.
function stripDiscordMentions(text) {
  return String(text || '')
    .replace(/<@!?\d+>/g, '')
    .replace(/<@&\d+>/g, '')
    .replace(/<#\d+>/g, '')
    .replace(/@everyone/gi, '')
    .replace(/@here/gi, '')
    .replace(/[ \t]{2,}/g, ' ');
}

// Discord "subtext" lines (a line starting with "-# ") render as small,
// muted text in Discord. Standard markdown has no equivalent syntax, so
// left alone it just shows the literal "-#". We turn each such line into
// <small>...</small> (an inline tag, so marked still processes any bold/
// italic/links inside it normally).
function convertDiscordSubtext(text) {
  return String(text || '').replace(/^-#[ \t]?(.*)$/gm, '<small>$1</small>');
}

// Full markdown -> sanitized HTML (used for modal / detail views)
function mdToHtml(text) {
  if (!text) return '';
  try {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
      const raw = marked.parse(convertDiscordSubtext(stripDiscordMentions(convertDiscordTimestamps(String(text)))), { breaks: true, gfm: true });
      const clean = DOMPurify.sanitize(raw, {
        ALLOWED_TAGS: ['p','br','strong','em','b','i','a','ul','ol','li','blockquote','code','pre','h1','h2','h3','h4','hr','img','del','table','thead','tbody','tr','th','td','small'],
        ALLOWED_ATTR: ['href','target','rel','src','alt','title']
      });
      // force noopener on target=_blank links, tabnabbing otherwise
      const wrapper = document.createElement('div');
      wrapper.innerHTML = clean;
      wrapper.querySelectorAll('a[target="_blank"]').forEach(a => a.setAttribute('rel', 'noopener noreferrer'));
      // Broken/unreachable image URLs shouldn't show the browser's ugly broken-icon + alt text;
      // just hide them instead so the rest of the content still looks clean.
      wrapper.querySelectorAll('img').forEach(img => {
        img.loading = 'lazy';
        // Many hosts (Discord CDN, image hosts, etc.) block requests whose
        // Referer header points at a different site ("hotlink protection"),
        // which is why an image works when opened directly in a tab but
        // fails to load when embedded here. Dropping the referrer avoids that.
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { img.style.display = 'none'; }, { once: true });
      });
      return wrapper.innerHTML;
    }
  } catch (e) {
    console.error('Markdown render failed:', e);
  }
  // libs didn't load, just escape and bail
  return escHtmlMd(text).replace(/\n/g, '<br>');
}

// Markdown -> plain text, for short truncated previews (cards/lists)
function mdToPlain(text) {
  if (!text) return '';
  return stripDiscordMentions(convertDiscordTimestamps(String(text)))
    .replace(/^-#[ \t]?/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`{1,3}([^`]*)`{1,3}/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\n{2,}/g, ' ')
    .replace(/\n/g, ' ')
    .trim();
}

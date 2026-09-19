const crypto = require('crypto');

// Discord's attachment CDN links (cdn.discordapp.com / media.discordapp.net)
// are signed and expire after a while, so any image URL pulled straight from
// a Discord message eventually 404s on the site. This module downloads the
// image once at sync time and re-hosts it in Supabase Storage, so the news
// table only ever points at a URL we control.

const EXT_BY_CONTENT_TYPE = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFromContentType(contentType) {
  return EXT_BY_CONTENT_TYPE[String(contentType || '').toLowerCase()] || 'jpg';
}

function isDiscordCdnUrl(url) {
  return /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//i.test(String(url || ''));
}

async function uploadImageToStorage(env, buffer, contentType, bucket = 'images') {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured on the server.');
  }

  const filename = `discord-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extFromContentType(contentType)}`;

  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${filename}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: buffer,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Supabase storage upload failed: ${res.status} ${body}`);
  }

  return `${env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${filename}`;
}

// Downloads an image from any URL (a Discord CDN link, typically) and
// re-uploads it to Supabase Storage, returning the new public URL.
async function rehostImage(env, sourceUrl) {
  const res = await fetch(sourceUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch source image: ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  return uploadImageToStorage(env, Buffer.from(arrayBuffer), contentType);
}

module.exports = { uploadImageToStorage, rehostImage, isDiscordCdnUrl };

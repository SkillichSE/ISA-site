#!/usr/bin/env node
/**
 * One-off fix for news items published before the sync started re-hosting
 * images itself: finds every `news` row whose `image` still points at
 * Discord's CDN, downloads it, uploads it to Supabase Storage, and updates
 * the row to the new URL.
 *
 * If SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY only live in Vercel and not
 * locally, it's easier to call the deployed endpoint instead of running
 * this file — see api/admin/rehost-news-images.js:
 *
 *   curl -X POST https://<your-site>/api/admin/rehost-news-images \
 *     -H "Authorization: Bearer <NEWS_SYNC_SECRET>"
 *
 * Local usage (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env if
 * present, or from real environment variables):
 *   node scripts/rehost-discord-news-images.js
 */
loadDotEnvIfPresent();

const { rehostExistingNewsImages } = require('../lib/rehost-news-images');

function loadDotEnvIfPresent() {
  const fs = require('node:fs');
  const path = require('node:path');
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set locally.');
    console.error('Either add them to a local .env, or call the deployed endpoint instead:');
    console.error('  curl -X POST https://<your-site>/api/admin/rehost-news-images -H "Authorization: Bearer <NEWS_SYNC_SECRET>"');
    process.exit(1);
  }

  const results = await rehostExistingNewsImages(process.env);
  console.log(`${results.total} news item(s) total, ${results.candidates} still pointing at Discord's CDN.`);
  for (const row of results.fixed) console.log(`  OK    ${row.id} -> ${row.image}`);
  for (const row of results.failed) console.error(`  FAIL  ${row.id}: ${row.error}`);
  console.log(`Done. ${results.fixed.length} fixed, ${results.failed.length} could not be recovered.`);
}

main();

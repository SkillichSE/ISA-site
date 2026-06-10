import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const GUILD_ID = '1507774799194099903';
const INVITE_CODE = 'CMDSKwTBnm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'discord-stats.json');

const res = await fetch(`https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`);
if (!res.ok) throw new Error(`Discord API error: ${res.status}`);

const data = await res.json();
if (data.guild?.id !== GUILD_ID) {
  throw new Error(`Unexpected guild id: ${data.guild?.id}`);
}

const stats = {
  guild_id: data.guild.id,
  guild_name: data.guild.name,
  invite_code: INVITE_CODE,
  invite_url: `https://discord.gg/${INVITE_CODE}`,
  member_count: data.approximate_member_count,
  online_count: data.approximate_presence_count,
  icon: data.guild.icon ?? null,
  updated_at: new Date().toISOString(),
};

writeFileSync(outPath, JSON.stringify(stats, null, 2) + '\n');
console.log(`Updated ${outPath}:`, stats);

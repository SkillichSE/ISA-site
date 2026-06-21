const INVITE_CODE = 'CMDSKwTBnm';
const GUILD_ID = '1507774799194099903';

export const config = { runtime: 'edge' };

export default async function handler() {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/invites/${INVITE_CODE}?with_counts=true`,
      { headers: { 'User-Agent': 'ISA-Site/1.0' } }
    );
    if (!res.ok) throw new Error(`Discord API ${res.status}`);
    const data = await res.json();
    if (data.guild?.id !== GUILD_ID) throw new Error('Guild mismatch');

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

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

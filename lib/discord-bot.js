const DISCORD_API = 'https://discord.com/api/v10';

async function discordFetch(path, token, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bot ${token}`);
  return fetch(`${DISCORD_API}${path}`, { ...init, headers });
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

function parseUserHandle(input) {
  const value = String(input || '').trim();
  if (!value) return { type: 'empty' };

  const mentionMatch = value.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return { type: 'id', id: mentionMatch[1] };

  if (/^\d{17,20}$/.test(value)) return { type: 'id', id: value };

  return { type: 'username', username: value };
}

async function resolveUser(guildId, token, input) {
  const parsed = parseUserHandle(input);

  if (parsed.type === 'empty') {
    return { user: null, error: 'No user specified.' };
  }

  if (parsed.type === 'id') {
    const response = await discordFetch(`/guilds/${guildId}/members/${parsed.id}`, token);
    if (!response.ok) {
      return { user: null, error: 'User not found on this server.' };
    }
    const member = await response.json();
    return { user: member.user };
  }

  const user = await findGuildMember(guildId, token, parsed.username);
  if (!user) {
    return { user: null, error: `Could not find **${parsed.username}** on the server. Check the username or use their user ID.` };
  }

  return { user };
}

async function sendDirectMessage(userId, token, content) {
  const dmChannelResponse = await discordFetch(`/users/${userId}/channels`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: userId }),
  });

  if (!dmChannelResponse.ok) {
    const detail = await dmChannelResponse.text();
    console.error('DM channel open failed:', dmChannelResponse.status, detail);
    return { ok: false, error: 'Could not open DM channel. User may have DMs disabled.' };
  }

  const dmChannel = await dmChannelResponse.json();
  const messageResponse = await discordFetch(`/channels/${dmChannel.id}/messages`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  if (!messageResponse.ok) {
    const detail = await messageResponse.text();
    console.error('DM send failed:', messageResponse.status, detail);
    return { ok: false, error: 'Could not send the message.' };
  }

  return { ok: true };
}

async function sendDMByHandle(guildId, token, handle, message) {
  const { user, error } = await resolveUser(guildId, token, handle);
  if (!user) return { ok: false, error };

  const result = await sendDirectMessage(user.id, token, message);
  if (!result.ok) return result;

  const label = user.global_name || user.username;
  return { ok: true, userId: user.id, label };
}

function isAdmin(userId, env) {
  const admins = (env.ADMIN_DISCORD_IDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return admins.includes(userId);
}

module.exports = {
  discordFetch,
  findGuildMember,
  parseUserHandle,
  resolveUser,
  sendDirectMessage,
  sendDMByHandle,
  isAdmin,
};

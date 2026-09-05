const { isAuthenticated } = require('../auth');
const {
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
} = require('../../lib/discord-message-utils');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    const parsed = parseMessageUrl(body.url);
    if (!parsed) {
      throw apiError('That doesn\'t look like a Discord message link.', 400);
    }

    const token = cleanToken(process.env.DISCORD_BOT_TOKEN);
    if (!token) throw apiError('DISCORD_BOT_TOKEN is not configured.', 503);

    const message = await discordFetch(`/channels/${parsed.channelId}/messages/${parsed.messageId}`, token);

    const image = firstImageAttachment(message);
    const cleanText = convertDiscordTimestamps(stripMentions(message.content || ''));

    if (!cleanText) {
      throw apiError('That message has no text after removing mentions — nothing to import.', 422);
    }

    return res.status(200).json({
      ok: true,
      id: `discord-${parsed.messageId}`,
      title: buildTitle(cleanText),
      body: cleanText,
      image: image ? image.url : '',
      date: toIsoDate(message.timestamp),
      tag: authorTag(message) || '',
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message || 'Import failed.',
    });
  }
};

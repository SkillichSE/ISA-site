const { processLaunchRequest } = require('../lib/discord-launch');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const result = await processLaunchRequest(req.body || {}, process.env);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      error: error.message || 'Submission failed.',
    });
  }
};

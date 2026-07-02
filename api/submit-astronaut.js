const { processAstronautApplication } = require('../lib/discord-astronaut');

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  try {
    const body = await readJsonBody(req);
    const result = await processAstronautApplication(body, process.env);
    return res.status(200).json(result);
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, error: error.message || 'Submission failed.' });
  }
};

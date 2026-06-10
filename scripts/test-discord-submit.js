#!/usr/bin/env node
/**
 * Test Discord channel posting locally.
 * Usage: DISCORD_BOT_TOKEN=xxx node scripts/test-discord-submit.js
 */
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const { processLaunchRequest } = require('../lib/discord-launch');

processLaunchRequest(
  {
    discord: 'testuser',
    satName: 'TEST-SAT-1',
    orbit: 'LEO',
    launchDate: '2026-10',
    description: 'Local API test from scripts/test-discord-submit.js',
  },
  process.env
)
  .then((result) => {
    console.log('Success:', result);
  })
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });

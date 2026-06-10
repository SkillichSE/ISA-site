require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { sendDMByHandle, isAdmin } = require('../lib/discord-bot');

const token = process.env.DISCORD_BOT_TOKEN;
const guildId = process.env.GUILD_ID || '1507774799194099903';

if (!token) {
  console.error('Missing DISCORD_BOT_TOKEN');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const HELP = [
  '**ISA Launchshare bot — DM commands**',
  '',
  'Send DMs to server members without posting on the server:',
  '',
  '`dm <username> <message>`',
  '`send <username> <message>`',
  '',
  'Examples:',
  '`dm andreatnt12 Your launch slot is confirmed for Oct 2026.`',
  '`send @user See you at the design review tomorrow.`',
  '',
  'You can use username, @mention, or user ID.',
  'Only authorized staff can use this bot.',
].join('\n');

function parseCommand(content) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === 'help' || lower === '/help' || lower === 'start') {
    return { type: 'help' };
  }

  const match = trimmed.match(/^(?:dm|send)\s+(\S+)\s+([\s\S]+)$/i);
  if (!match) return { type: 'unknown' };

  return {
    type: 'send',
    target: match[1],
    message: match[2].trim(),
  };
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log('Staff can DM this bot to send messages to members.');
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || message.guild) return;

  const command = parseCommand(message.content);
  if (!command) return;

  if (!isAdmin(message.author.id, process.env)) {
    await message.reply('You are not authorized to use this bot.');
    return;
  }

  if (command.type === 'help' || command.type === 'unknown') {
    await message.reply(command.type === 'help' ? HELP : `Unknown command.\n\n${HELP}`);
    return;
  }

  if (command.message.length > 1900) {
    await message.reply('Message is too long (max 1900 characters).');
    return;
  }

  const result = await sendDMByHandle(guildId, token, command.target, command.message);

  if (!result.ok) {
    await message.reply(`Could not send DM: ${result.error}`);
    return;
  }

  await message.reply(`Sent to **${result.label}**.`);
});

client.login(token);

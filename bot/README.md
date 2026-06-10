# ISA DM Bot

Staff message this bot **in private DMs** to send messages to server members.  
Nothing is posted on the ISA server.

## Setup

1. **Developer Portal → Bot**
   - Enable **Message Content Intent**
   - Enable **Server Members Intent**

2. **`.env`** in repo root (copy from `.env.example`):
   ```
   DISCORD_BOT_TOKEN=...
   ADMIN_DISCORD_IDS=your_user_id
   GUILD_ID=1507774799194099903
   ```

3. **Install & run**
   ```bash
   cd bot
   npm install
   npm start
   ```

Keep the bot running 24/7 (Railway, Render, Fly.io, VPS).  
Vercel only handles the website form — this bot handles staff DMs.

## Usage

Open a **DM with your bot** in Discord and send:

```
dm username Your launch is approved for October 2026.
```

or

```
send @mention Thanks for submitting your satellite design!
```

Type `help` for the command list.

## Hosting (free options)

- [Railway](https://railway.app) — deploy `bot/` folder, add env vars
- [Render](https://render.com) — Background Worker, start command `npm start`

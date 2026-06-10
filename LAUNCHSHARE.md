# Launchshare + Discord

## Website form → server channel

Users submit on the site → `/api/submit` (Vercel) → embed + file in channel `1513506023892193392` → auto-DM confirmation to the user.

**Vercel env:** `DISCORD_BOT_TOKEN`, `LAUNCH_CHANNEL_ID`, `GUILD_ID`

---

## Staff DMs → members (private, no server spam)

Message the bot **in DM** — nothing gets posted on the server.

```
dm username Your launch slot is confirmed!
send @user Please update your contraption file.
```

### Bot setup

1. Developer Portal → Bot:
   - **Message Content Intent** ✅
   - **Server Members Intent** ✅

2. `.env`:
   ```
   DISCORD_BOT_TOKEN=...
   ADMIN_DISCORD_IDS=your_discord_user_id
   GUILD_ID=1507774799194099903
   ```

3. Run (must stay online 24/7):
   ```bash
   cd bot
   npm install
   npm start
   ```

Deploy `bot/` to Railway or Render — see `bot/README.md`.

Only IDs in `ADMIN_DISCORD_IDS` can use the bot. Multiple admins: `111,222,333`

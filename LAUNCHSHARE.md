# Launchshare form (Vercel)

## What happens on submit

1. User fills the form on `/launchshare/`
2. Browser sends `POST /api/submit`
3. Vercel posts an embed (+ optional file) to Discord channel **`1513506023892193392`**

No DMs — only the staff channel.

## Vercel setup

**Settings → Environment Variables:**

| Name | Value |
|------|--------|
| `DISCORD_BOT_TOKEN` | Bot token from Developer Portal |
| `LAUNCH_CHANNEL_ID` | `1513506023892193392` |

(`GUILD_ID` is optional — only in `vercel.json` for reference.)

**Bot on server:**
- View Channel, Send Messages, Attach Files, Embed Links in the launch channel

## Troubleshooting

| Error | Fix |
|-------|-----|
| Invalid bot token | Use **Bot → Token**, not Application ID or Public Key |
| Bot cannot see the channel | Invite bot to server; channel permissions → View Channel for bot role |
| Missing Permissions | Send Messages, Embed Links, Attach Files in launch channel |
| Launch channel not found | Confirm channel ID `1513506023892193392` |

Local test (create `.env` from `.env.example`):

```bash
npm install dotenv
node scripts/test-discord-submit.js
```

Redeploy Vercel after changing env vars.

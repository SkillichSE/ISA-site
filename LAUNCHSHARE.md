# Launchshare + Discord (Vercel)

## Куда уходят заявки

| Куда | Что |
|------|-----|
| Discord-канал `1513506023892193392` | Embed с заявкой + файл |
| Личка пользователя | Подтверждение, если бот нашёл username на сервере |

## Настройка на Vercel

1. **Discord bot** — токен, Server Members Intent, бот на сервере ISA
2. **Vercel → Project → Settings → Environment Variables:**

| Name | Value |
|------|-------|
| `DISCORD_BOT_TOKEN` | токен бота |
| `LAUNCH_CHANNEL_ID` | `1513506023892193392` |
| `GUILD_ID` | `1507774799194099903` |

3. **Deploy** — после пуша в Git Vercel сам подхватит `/api/submit`
4. Форма шлёт на `/api/submit` (уже в `launchshare/config.js`)

## Локально

```bash
npx vercel dev
```

Создай `.env` из `.env.example` и вставь токен бота.

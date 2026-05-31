import { prisma } from './prisma'

export async function sendSystemNotification({ userId, message, tab }) {
  try {
    // 1. Veritabanına kaydet
    const notification = await prisma.notification.create({
      data: {
        userId,
        message,
        tab,
        read: false
      }
    })

    // 2. Discord Webhook Gönderimi (Opsiyonel)
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
    if (discordWebhookUrl) {
      try {
        fetch(discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🔔 **HD Studio Bildirimi:** ${message}${tab ? ` (Sekme: \`${tab}\`)` : ''}`
          })
        }).catch(err => console.error('Discord Webhook Hatası:', err))
      } catch (err) {
        console.error('Discord gönderim hatası:', err)
      }
    }

    // 3. Telegram Gönderimi (Opsiyonel)
    const tgToken = process.env.TELEGRAM_BOT_TOKEN
    const tgChatId = process.env.TELEGRAM_CHAT_ID
    if (tgToken && tgChatId) {
      try {
        const url = `https://api.telegram.org/bot${tgToken}/sendMessage`
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: `🔔 HD Studio Bildirimi:\n${message}`,
            parse_mode: 'HTML'
          })
        }).catch(err => console.error('Telegram API Hatası:', err))
      } catch (err) {
        console.error('Telegram gönderim hatası:', err)
      }
    }

    return notification
  } catch (error) {
    console.error('Bildirim oluşturma/gönderme hatası:', error)
    throw error
  }
}

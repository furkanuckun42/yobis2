import { prisma } from './prisma'
import webpush from './webpush'

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

    // 4. Web Push Bildirimi Gönderimi (Cihaz Bildirimleri)
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId }
      })

      if (subscriptions.length > 0) {
        const payload = JSON.stringify({
          title: 'HD Studio',
          body: message,
          url: tab ? `/?tab=${tab}` : '/'
        })

        const pushPromises = subscriptions.map(sub => {
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }
          return webpush.sendNotification(pushConfig, payload)
            .catch(async (err) => {
              console.error('Web Push Gönderim Hatası:', err)
              // Abonelik artık geçerli değilse (404 veya 410 Gone) veritabanından sil
              if (err.statusCode === 410 || err.statusCode === 404) {
                try {
                  await prisma.pushSubscription.delete({ where: { id: sub.id } })
                  console.log(`Temizlendi (Süresi Dolan/İptal Edilen Abonelik): ${sub.endpoint}`)
                } catch (delErr) {
                  console.error('Geçersiz abonelik silme hatası:', delErr)
                }
              }
            })
        })

        // Gönderimleri arka planda paralel başlat, ana akışı engelleme
        Promise.all(pushPromises).catch(err => console.error('Push Promise.all hatası:', err))
      }
    } catch (pushErr) {
      console.error('Web Push toplu gönderim hatası:', pushErr)
    }

    return notification
  } catch (error) {
    console.error('Bildirim oluşturma/gönderme hatası:', error)
    throw error
  }
}

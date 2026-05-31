import { prisma } from './prisma'
import webpush from './webpush'

export async function sendSystemNotification({ userId, message, tab }) {
  try {
    const decodedMessage = decodeURIComponent(message || '')
    // 1. Veritabanına kaydet (Hemen tamamlanması gereken veritabanı kaydı)
    const notification = await prisma.notification.create({
      data: {
        userId,
        message: decodedMessage,
        tab,
        read: false
      }
    })

    // Harici ağ entegrasyonlarını arka planda yürüt (Ana HTTP akışını bloke etmez)
    ;(async () => {
      // 2. Discord Webhook Gönderimi (Opsiyonel)
      const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
      const discordPromise = discordWebhookUrl
        ? fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🔔 **HD Studio Bildirimi:** ${decodedMessage}${tab ? ` (Sekme: \`${tab}\`)` : ''}`
            })
          }).catch(err => console.error('Discord Webhook Hatası:', err))
        : Promise.resolve()

      // 3. Telegram Gönderimi (Opsiyonel)
      const tgToken = process.env.TELEGRAM_BOT_TOKEN
      const tgChatId = process.env.TELEGRAM_CHAT_ID
      const telegramPromise = (tgToken && tgChatId)
        ? fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgChatId,
              text: `🔔 HD Studio Bildirimi:\n${decodedMessage}`,
              parse_mode: 'HTML'
            })
          }).catch(err => console.error('Telegram API Hatası:', err))
        : Promise.resolve()

      // 4. Web Push Bildirimi Gönderimi (Cihaz Bildirimleri - Tüm Kullanıcılar)
      let pushPromise = Promise.resolve()
      try {
        const subscriptions = await prisma.pushSubscription.findMany({
          where: { userId }
        })

        if (subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: 'HD Studio',
            body: decodedMessage,
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
          pushPromise = Promise.all(pushPromises)
        }
      } catch (pushErr) {
        console.error('Web Push toplu gönderim hatası:', pushErr)
      }

      await Promise.all([discordPromise, telegramPromise, pushPromise])
    })().catch(err => console.error('Arka plan bildirim servis hatası:', err))

    return notification
  } catch (error) {
    console.error('Bildirim oluşturma/gönderme hatası:', error)
    throw error
  }
}

export async function notifyAdmins({ message, tab, requesterRole }) {
  if (requesterRole === 'admin') {
    return
  }

  // Tüm akışı arka plana alarak API yanıt sürelerini düşürür ve UI'ı anında günceller.
  ;(async () => {
    try {
      const decodedMessage = decodeURIComponent(message || '')

      // 1. Tek bir sorguyla tüm adminleri ve cihaz aboneliklerini çek (Batch Query)
      const admins = await prisma.user.findMany({
        where: { role: 'admin' },
        include: { pushSubscriptions: true }
      })

      if (admins.length === 0) return

      // 2. Sistem bildirimlerini topluca oluştur (Batch Insert)
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          message: decodedMessage,
          tab,
          read: false
        }))
      })

      // 3. Harici ağ servis entegrasyonlarını paralel başlat
      const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
      const discordPromise = discordWebhookUrl
        ? fetch(discordWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: `🔔 **HD Studio Bildirimi:** ${decodedMessage}${tab ? ` (Sekme: \`${tab}\`)` : ''}`
            })
          }).catch(err => console.error('Discord Webhook Hatası:', err))
        : Promise.resolve()

      const tgToken = process.env.TELEGRAM_BOT_TOKEN
      const tgChatId = process.env.TELEGRAM_CHAT_ID
      const telegramPromise = (tgToken && tgChatId)
        ? fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: tgChatId,
              text: `🔔 HD Studio Bildirimi:\n${decodedMessage}`,
              parse_mode: 'HTML'
            })
          }).catch(err => console.error('Telegram API Hatası:', err))
        : Promise.resolve()

      // 4. Tüm Web Push bildirimlerini topla ve paralel gönder
      const pushPromises = []
      const payload = JSON.stringify({
        title: 'HD Studio',
        body: decodedMessage,
        url: tab ? `/?tab=${tab}` : '/'
      })

      for (const admin of admins) {
        for (const sub of admin.pushSubscriptions) {
          const pushConfig = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          }
          pushPromises.push(
            webpush.sendNotification(pushConfig, payload)
              .catch(async (err) => {
                console.error('Web Push Gönderim Hatası:', err)
                if (err.statusCode === 410 || err.statusCode === 404) {
                  try {
                    await prisma.pushSubscription.delete({ where: { id: sub.id } })
                    console.log(`Temizlendi (Süresi Dolan Abonelik): ${sub.endpoint}`)
                  } catch (delErr) {
                    console.error('Geçersiz abonelik silme hatası:', delErr)
                  }
                }
              })
          )
        }
      }

      await Promise.all([discordPromise, telegramPromise, ...pushPromises])
    } catch (err) {
      console.error('Arka plan admin bildirim gönderme hatası:', err)
    }
  })().catch(err => console.error('Admin bildirim arka plan sarıcı hatası:', err))
}

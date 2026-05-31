import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

function formatTimeRange(start, end) {
  if (start.date) return 'Tüm Gün'
  try {
    const s = new Date(start.dateTime)
    const e = new Date(end.dateTime)
    const sh = s.getHours().toString().padStart(2, '0')
    const sm = s.getMinutes().toString().padStart(2, '0')
    const eh = e.getHours().toString().padStart(2, '0')
    const em = e.getMinutes().toString().padStart(2, '0')
    return `${sh}:${sm} - ${eh}:${em}`
  } catch (error) {
    return 'Belirtilmedi'
  }
}

export async function POST(request) {
  try {
    const config = await prisma.googleConfig.findUnique({
      where: { id: 'main' }
    })

    if (!config || !config.clientId || !config.clientSecret || !config.refreshToken) {
      return NextResponse.json(
        { error: 'Google entegrasyonu tamamlanmamış! Lütfen önce hesabınızı yetkilendirin.' },
        { status: 400 }
      )
    }

    const host = request.headers.get('host') || 'localhost:3000'
    // IP adreslerini veya yerel ağ sunucularını localhost'a normalize et (Google OAuth IP adreslerini kabul etmez)
    const cleanHost = (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.') || host.startsWith('0.0.0.0') || host.includes('127.0.0.1'))
      ? 'localhost:3000'
      : host;
    const protocol = cleanHost.includes('localhost') ? 'http' : (request.headers.get('x-forwarded-proto') || 'http')
    const redirectUri = `${protocol}://${cleanHost}/api/auth/google/callback`

    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    )

    oauth2Client.setCredentials({
      access_token: config.accessToken,
      refresh_token: config.refreshToken,
      expiry_date: config.expiryDate ? parseInt(config.expiryDate) : null
    })

    // Token otomatik yenilenirse veritabanına kaydetmek için dinleyici ekliyoruz
    oauth2Client.on('tokens', async (newTokens) => {
      console.log('Google OAuth token yenilendi, kaydediliyor...')
      await prisma.googleConfig.update({
        where: { id: 'main' },
        data: {
          accessToken: newTokens.access_token || config.accessToken,
          refreshToken: newTokens.refresh_token || config.refreshToken,
          expiryDate: newTokens.expiry_date ? newTokens.expiry_date.toString() : config.expiryDate
        }
      })
    })

    // Google Calendar API istemcisi
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Son 30 gün ile gelecek 90 gün arasındaki etkinlikleri çek
    const timeMin = new Date()
    timeMin.setDate(timeMin.getDate() - 30)
    
    const timeMax = new Date()
    timeMax.setDate(timeMax.getDate() + 90)

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100
    })

    const items = response.data.items || []
    const syncedGoogleIds = []

    // Etkinlikleri SQLite veritabanına kaydet
    for (const item of items) {
      if (item.status === 'cancelled') continue
      
      const eventDate = new Date(item.start.dateTime || item.start.date)
      const timeRange = formatTimeRange(item.start, item.end)
      const googleId = item.id

      syncedGoogleIds.push(googleId)

      // Upsert: Varsa güncelle, yoksa ekle
      await prisma.event.upsert({
        where: { googleId },
        update: {
          title: item.summary || 'Başlıksız Etkinlik',
          date: eventDate,
          time: timeRange,
        },
        create: {
          googleId,
          title: item.summary || 'Başlıksız Etkinlik',
          date: eventDate,
          time: timeRange,
          type: 'google'
        }
      })
    }

    // Google takviminden silinmiş olan etkinlikleri yerel veritabanından da temizle (Temizlik aşaması)
    await prisma.event.deleteMany({
      where: {
        type: 'google',
        googleId: {
          notIn: syncedGoogleIds
        }
      }
    })

    return NextResponse.json({ success: true, count: items.length })
  } catch (error) {
    console.error('Google Calendar Senkronizasyon Hatası:', error)
    return NextResponse.json({ error: `Senkronizasyon başarısız: ${error.message}` }, { status: 500 })
  }
}

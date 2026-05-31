import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const config = await prisma.googleConfig.findUnique({
      where: { id: 'main' }
    })

    if (!config || !config.clientId || !config.clientSecret) {
      return NextResponse.json(
        { error: 'Google Client ID ve Client Secret ayarları henüz yapılmamış!' },
        { status: 400 }
      )
    }

    // Yönlendirme adresini tarayıcının gönderdiği Host başlığına göre dinamik belirle (böylece 0.0.0.0 yerine localhost gelir)
    const host = request.headers.get('host') || 'localhost:3000'
    // IP adreslerini veya yerel ağ sunucularını localhost'a normalize et (Google OAuth IP adreslerini kabul etmez)
    const cleanHost = (host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.') || host.startsWith('0.0.0.0') || host.includes('127.0.0.1'))
      ? 'localhost:3000'
      : host;
    const protocol = cleanHost.includes('localhost') ? 'http' : (request.headers.get('x-forwarded-proto') || 'http')
    const redirectUri = `${protocol}://${cleanHost}/api/auth/google/callback`

    // Google OAuth istemcisini başlat
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      redirectUri
    )

    // Yetkilendirme URL'sini oluştur
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // refresh_token almak için şart
      prompt: 'consent',      // Her seferinde onay ekranını aç ki refresh_token gelsin
      scope: ['https://www.googleapis.com/auth/calendar.readonly'] // Sadece okuma yetkisi yeterli
    })

    return NextResponse.json({ url: authUrl })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

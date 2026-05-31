import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      return NextResponse.redirect(new URL('/?gcal=error&details=' + errorParam, request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/?gcal=nocode', request.url))
    }

    const config = await prisma.googleConfig.findUnique({
      where: { id: 'main' }
    })

    if (!config) {
      return NextResponse.redirect(new URL('/?gcal=noconfig', request.url))
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

    // Kod ile Google Token'larını al
    const { tokens } = await oauth2Client.getToken(code)
    
    // Veritabanını güncelle
    await prisma.googleConfig.update({
      where: { id: 'main' },
      data: {
        accessToken: tokens.access_token || config.accessToken,
        refreshToken: tokens.refresh_token || config.refreshToken, // refresh_token boş gelirse eskisini koru
        expiryDate: tokens.expiry_date ? tokens.expiry_date.toString() : config.expiryDate
      }
    })

    // Yetkilendirme başarılı, ana sayfaya yönlendir
    return NextResponse.redirect(new URL('/?gcal=success', request.url))
  } catch (error) {
    console.error('Google Callback Hatası:', error)
    return NextResponse.redirect(new URL('/?gcal=error&msg=' + encodeURIComponent(error.message), request.url))
  }
}

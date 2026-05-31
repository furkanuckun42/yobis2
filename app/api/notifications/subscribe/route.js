import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  try {
    const userId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')
    if (!userId) {
      return NextResponse.json({ error: 'Yetkisiz işlem. Oturum açmalısınız.' }, { status: 401 })
    }

    const { subscription } = await request.json()
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Geçersiz abonelik verisi.' }, { status: 400 })
    }

    const { endpoint, keys } = subscription
    const p256dh = keys.p256dh
    const auth = keys.auth

    if (!p256dh || !auth) {
      return NextResponse.json({ error: 'Eksik abonelik anahtarları.' }, { status: 400 })
    }

    // Aboneliği ekle veya güncelle (endpoint benzersizdir)
    const result = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh,
        auth
      },
      create: {
        userId,
        endpoint,
        p256dh,
        auth
      }
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('Subscription API Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

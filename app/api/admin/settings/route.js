import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const requesterRole = request.headers.get('x-requester-role')
  if (requesterRole !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'kasa_notification_time' }
    })
    
    return NextResponse.json({
      kasaNotificationTime: setting?.value || '19:30'
    })
  } catch (err) {
    console.error('Ayarlar yüklenemedi:', err)
    return NextResponse.json({ error: 'Ayarlar yüklenemedi.' }, { status: 500 })
  }
}

export async function POST(request) {
  const requesterRole = request.headers.get('x-requester-role')
  if (requesterRole !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { kasaNotificationTime } = body

    if (!kasaNotificationTime || !/^\d{2}:\d{2}$/.test(kasaNotificationTime)) {
      return NextResponse.json({ error: 'Geçersiz saat formatı. Örn: 19:30' }, { status: 400 })
    }

    await prisma.systemSetting.upsert({
      where: { key: 'kasa_notification_time' },
      update: { value: kasaNotificationTime },
      create: { key: 'kasa_notification_time', value: kasaNotificationTime }
    })

    return NextResponse.json({ success: true, kasaNotificationTime })
  } catch (err) {
    console.error('Ayarlar kaydedilemedi:', err)
    return NextResponse.json({ error: 'Ayarlar kaydedilemedi.' }, { status: 500 })
  }
}

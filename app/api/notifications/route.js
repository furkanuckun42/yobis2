import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1. Kullanıcıya Ait Bildirimleri Listele
export async function GET(request) {
  try {
    const userId = request.headers.get('x-requester-id')

    if (!userId) {
      return NextResponse.json({ error: 'Kullanıcı kimliği belirtilmedi.' }, { status: 400 })
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Son 50 bildirim yeterli
    })

    return NextResponse.json(notifications)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 2. Bildirimleri Okundu Olarak İşaretle
export async function POST(request) {
  try {
    const userId = request.headers.get('x-requester-id')
    const { id, readAll } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'Kullanıcı kimliği belirtilmedi.' }, { status: 400 })
    }

    if (readAll) {
      // Tümünü okundu yap
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true }
      })
      return NextResponse.json({ success: true, message: 'Tüm bildirimler okundu yapıldı.' })
    } else if (id) {
      // Belirli bir bildirimi okundu yap
      await prisma.notification.update({
        where: { id },
        data: { read: true }
      })
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Bildirim ID veya readAll parametresi gerekli.' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 3. Okunan Bildirimleri Sil (Veya tekil sil)
export async function DELETE(request) {
  try {
    const userId = request.headers.get('x-requester-id')
    if (!userId) {
      return NextResponse.json({ error: 'Kullanıcı kimliği belirtilmedi.' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const clearRead = searchParams.get('clearRead') === 'true'
    const id = searchParams.get('id')

    if (clearRead) {
      const result = await prisma.notification.deleteMany({
        where: { userId, read: true }
      })
      return NextResponse.json({ success: true, count: result.count })
    } else if (id) {
      await prisma.notification.delete({
        where: { id, userId }
      })
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Geçersiz parametre.' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

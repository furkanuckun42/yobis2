import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const role = request.headers.get('x-requester-role')
    
    // Yalnızca yöneticiler (admin) log kayıtlarını görebilir
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Yalnızca yöneticiler sistem günlüklerini görebilir.' }, { status: 403 })
    }

    const logs = await prisma.actionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200, // Performans için son 200 kaydı çekelim
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Logs API Hatası:', error)
    return NextResponse.json({ error: 'Loglar alınırken hata oluştu: ' + error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const role = request.headers.get('x-requester-role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Yalnızca yöneticiler sistem günlüklerini silebilir.' }, { status: 403 })
    }

    const { ids } = await request.json()
    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'Geçersiz parametre.' }, { status: 400 })
    }

    await prisma.actionLog.deleteMany({
      where: {
        id: { in: ids }
      }
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (error) {
    console.error('Logs DELETE API Hatası:', error)
    return NextResponse.json({ error: 'Loglar silinirken hata oluştu: ' + error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyAdmins } from '@/lib/notifications'

export async function POST(request) {
  const requesterRole = request.headers.get('x-requester-role')
  if (requesterRole !== 'admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim.' }, { status: 403 })
  }

  try {
    // Kasa bakiyesini hesapla
    const aggGelir = await prisma.finance.aggregate({
      where: { category: 'KASA', type: 'GELIR' },
      _sum: { amount: true }
    })
    const aggGider = await prisma.finance.aggregate({
      where: { category: 'KASA', type: 'GIDER' },
      _sum: { amount: true }
    })
    const aggKarAlma = await prisma.finance.aggregate({
      where: { category: 'KASA', type: 'KAR_ALMA' },
      _sum: { amount: true }
    })
    const balance = (aggGelir._sum.amount || 0) - (aggGider._sum.amount || 0) - (aggKarAlma._sum.amount || 0)
    
    // Biçimlendirme
    const formattedBalance = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(balance)
    
    // Test bildirimini adminlere gönder (requesterRole'ü bypass ediyoruz ki tetikleyen admin de alabilsin)
    await notifyAdmins({
      message: `💰 [TEST] Güncel Kasa Bildirimi: Kasa bakiyeniz ${formattedBalance}.`,
      tab: 'finance',
      requesterRole: 'system'
    })

    return NextResponse.json({ success: true, balance: formattedBalance })
  } catch (err) {
    console.error('Test bildirimi gönderilemedi:', err)
    return NextResponse.json({ error: 'Test bildirimi gönderilemedi.' }, { status: 500 })
  }
}

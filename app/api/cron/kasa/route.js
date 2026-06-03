import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notifyAdmins } from '@/lib/notifications'

export async function GET(request) {
  // Vercel Cron Security: Doğrulama için opsiyonel CRON_SECRET kontrolü
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Yetkisiz cron tetiklemesi.' }, { status: 401 })
  }

  try {
    const now = new Date()
    // Türkiye saati (UTC+3)
    const trTime = new Date(now.getTime() + 3 * 60 * 60 * 1000)
    const dateStr = trTime.toISOString().split('T')[0]

    // Bugün daha önce gönderildi mi kontrol et
    const lastSentSetting = await prisma.systemSetting.findUnique({
      where: { key: 'kasa_notification_last_sent' }
    })

    if (lastSentSetting?.value !== dateStr) {
      // Son gönderim tarihini güncelle
      await prisma.systemSetting.upsert({
        where: { key: 'kasa_notification_last_sent' },
        update: { value: dateStr },
        create: { key: 'kasa_notification_last_sent', value: dateStr }
      })

      // Kasa bakiyesini hesapla
      const aggGelir = await prisma.finance.aggregate({
        where: { category: 'KASA', type: 'GELIR' },
        _sum: { amount: true }
      })
      const aggGider = await prisma.finance.aggregate({
        where: { category: 'KASA', type: 'GIDER' },
        _sum: { amount: true }
      })
      const balance = (aggGelir._sum.amount || 0) - (aggGider._sum.amount || 0)
      
      // Biçimlendirme
      const formattedBalance = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(balance)

      console.log(`⏰ [Cron API] Kasa Bildirimi gönderiliyor. Kasa: ${formattedBalance}`)
      await notifyAdmins({
        message: `💰 Güncel Kasa Bildirimi: Güncel kasa bakiyeniz ${formattedBalance}.`,
        tab: 'finance'
      })

      return NextResponse.json({ success: true, message: 'Bildirim gönderildi.', balance: formattedBalance })
    }

    return NextResponse.json({ success: true, message: 'Bugün zaten bakiye bildirimi gönderildi.' })
  } catch (err) {
    console.error('Cron API Hatası:', err)
    return NextResponse.json({ error: 'Cron işlemi başarısız.' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 1. Aktif Proje Sayısı (Teslim Edildi aşamasında olmayanlar ve Arşivlenmemiş olanlar)
    const activeProjectsCount = await prisma.project.count({
      where: {
        stage: { not: 'Teslim Edildi' },
        isArchived: false
      }
    })

    // 2. Net Kasa Durumu (Toplam Gelir - Toplam Gider - Sadece KASA kategorisi)
    const financeRecords = await prisma.finance.findMany({
      where: { category: 'KASA' }
    })
    let netCashStatus = 0
    financeRecords.forEach(record => {
      if (record.type === 'GELIR') {
        netCashStatus += record.amount
      } else if (record.type === 'GIDER') {
        netCashStatus -= record.amount
      }
    })

    // 3. Aylık Tahmini Gelir (Bu ayın aktif/arşivlenmemiş Aylık Müşteri Kartlarının gelir toplamı - Türkiye Saati Uyumlu)
    const currentDate = new Date(Date.now() + 3 * 60 * 60 * 1000)
    const currentMonthStr = `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`

    const activeMonthlyCards = await prisma.monthlyCard.findMany({
      where: {
        month: currentMonthStr,
        status: { not: 'ARCHIVED' }
      },
      include: {
        customer: true
      }
    })
    const monthlyEstimatedRevenue = activeMonthlyCards.reduce((sum, card) => sum + (card.customer?.monthlyIncome || 0), 0)

    // 4. Net Cari Durum (Alacaklarımız - Borçlarımız)
    const customers = await prisma.customer.findMany()
    const caris = await prisma.cari.findMany()
    const totalAlacak = customers.reduce((sum, customer) => sum + customer.currentBalance, 0)
    const totalBorc = caris.reduce((sum, cari) => sum + cari.currentBalance, 0)
    const netCariStatus = totalAlacak - totalBorc

    // En Yakın Teslimatlar (Teslim edilmemiş projeler, yakından uzağa doğru sıralı)
    const upcomingProjects = await prisma.project.findMany({
      where: {
        stage: { not: 'Teslim Edildi' },
        isArchived: false
      },
      include: {
        customer: true
      },
      orderBy: {
        deliveryDate: 'asc'
      },
      take: 10
    })

    // 5. Son 6 Ayın Finansal Trend Verisi (Türkiye Saati Uyumlu)
    const sixMonthsAgo = new Date(Date.now() + 3 * 60 * 60 * 1000)
    sixMonthsAgo.setUTCMonth(sixMonthsAgo.getUTCMonth() - 5)
    sixMonthsAgo.setUTCDate(1)
    sixMonthsAgo.setUTCHours(0, 0, 0, 0)

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    const monthsList = []
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
      d.setUTCMonth(d.getUTCMonth() - i)
      monthsList.push({
        year: d.getUTCFullYear(),
        monthNum: d.getUTCMonth(),
        month: monthNames[d.getUTCMonth()],
        income: 0,
        expense: 0,
        profit: 0
      })
    }

    const chartFinances = await prisma.finance.findMany({
      where: {
        date: { gte: sixMonthsAgo }
      }
    })

    chartFinances.forEach(record => {
      const rDate = new Date(record.date)
      // DB kaydını Türkiye zamanına göre değerlendir
      const turkeyDate = new Date(rDate.getTime() + 3 * 60 * 60 * 1000)
      const rYear = turkeyDate.getUTCFullYear()
      const rMonth = turkeyDate.getUTCMonth()

      const monthObj = monthsList.find(m => m.year === rYear && m.monthNum === rMonth)
      if (monthObj) {
        if (record.category === 'KASA') {
          if (record.type === 'GELIR') {
            monthObj.income += record.amount
          } else if (record.type === 'GIDER') {
            monthObj.expense += record.amount
          }
        } else if (record.category === 'CARI') {
          if (record.type === 'GELIR') {
            monthObj.expense += record.amount // Cari ödemesi kasadan gider demektir
          }
        }
      }
    })

    monthsList.forEach(m => {
      m.profit = m.income - m.expense
    })

    return NextResponse.json({
      metrics: {
        activeProjectsCount,
        netCashStatus,
        monthlyEstimatedRevenue,
        netCariStatus,
        totalAlacak,
        totalBorc
      },
      upcomingProjects,
      chartData: monthsList
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

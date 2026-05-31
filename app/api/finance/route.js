import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'
import { notifyAdmins } from '@/lib/notifications'

async function getKasaBalance() {
  try {
    const aggGelir = await prisma.finance.aggregate({
      where: { category: 'KASA', type: 'GELIR' },
      _sum: { amount: true }
    })
    const aggGider = await prisma.finance.aggregate({
      where: { category: 'KASA', type: 'GIDER' },
      _sum: { amount: true }
    })
    return (aggGelir._sum.amount || 0) - (aggGider._sum.amount || 0)
  } catch (err) {
    console.error('Kasa bakiye hesaplama hatası:', err)
    return 0
  }
}

async function getUserFullName(request) {
  const userId = request.headers.get('x-requester-id')
  if (!userId) {
    const headerUsername = request.headers.get('x-requester-username') || 'Sistem'
    try {
      return decodeURIComponent(headerUsername)
    } catch {
      return headerUsername
    }
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true }
    })
    if (user) {
      return user.displayName || user.username
    }
  } catch (err) {
    console.error('Kullanıcı adı çekme hatası:', err)
  }
  const headerUsername = request.headers.get('x-requester-username') || 'Sistem'
  try {
    return decodeURIComponent(headerUsername)
  } catch {
    return headerUsername
  }
}

export async function GET() {
  try {
    const records = await prisma.finance.findMany({
      orderBy: { date: 'desc' },
      include: {
        customer: { select: { id: true, name: true } },
        cari: { select: { id: true, name: true } }
      }
    })
    return NextResponse.json(records)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    const data = await request.json()
    const { type, amount, description, date, category, customerId, cariId } = data
    
    if (!type || !amount) {
      return NextResponse.json({ error: 'Eksik alanlar var' }, { status: 400 })
    }

    if (date) {
      try {
        const incomingDateStr = new Date(date).toISOString().split('T')[0]
        const turkeyNow = new Date(new Date().getTime() + 3 * 60 * 60 * 1000)
        const todayStr = turkeyNow.toISOString().split('T')[0]
        if (incomingDateStr > todayStr) {
          return NextResponse.json({ error: 'Gelecekteki bir tarihe işlem yapılamaz.' }, { status: 400 })
        }
      } catch (err) {
        return NextResponse.json({ error: 'Geçersiz tarih formatı.' }, { status: 400 })
      }
    }

    const parsedAmount = parseFloat(amount)
    const finCategory = category || 'KASA'

    // 1. Yetki ve Doğrulama: Giriş yapmış tüm yetkili roller cari borç kaydı ekleyebilir
    if (finCategory === 'CARI' && requesterRole !== 'admin' && requesterRole !== 'personel') {
      return NextResponse.json({ error: 'Cari borç kayıtlarını eklemek için yetkiniz yok.' }, { status: 403 })
    }

    if (finCategory === 'CARI' && !cariId) {
      return NextResponse.json({ error: 'Cari borç kaydı için lütfen firma seçimi yapın.' }, { status: 400 })
    }

    // 2. Finans kaydını oluştur
    const record = await prisma.finance.create({
      data: {
        type,
        category: finCategory,
        amount: parsedAmount,
        description,
        customerId: customerId || null,
        cariId: cariId || null,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        customer: { select: { id: true, name: true } },
        cari: { select: { id: true, name: true } }
      }
    })

    // 3. Cari/Müşteri Bakiye Etkileri
    if (finCategory === 'CARI') {
      // Veresiye Alım/Gider: Bizim firmaya borcumuz artar (currentBalance artar)
      if (type === 'GIDER') {
        await prisma.cari.update({
          where: { id: cariId },
          data: { currentBalance: { increment: parsedAmount } }
        })
      } else if (type === 'GELIR') {
        // Cari Gelir: Firmaya olan borcumuzdan düşülür (currentBalance azalır)
        await prisma.cari.update({
          where: { id: cariId },
          data: { currentBalance: { decrement: parsedAmount } }
        })
      }
    } else if (finCategory === 'KASA') {
      // Kasadan Müşteri Tahsilatı: Müşterinin borcu azalır (currentBalance azalır)
      if (customerId && type === 'GELIR') {
        await prisma.customer.update({
          where: { id: customerId },
          data: { currentBalance: { decrement: parsedAmount } }
        })
      }
      // Kasadan Cari Ödemesi: Bizim firmaya borcumuz azalır (currentBalance azalır)
      if (cariId && type === 'GIDER') {
        await prisma.cari.update({
          where: { id: cariId },
          data: { currentBalance: { decrement: parsedAmount } }
        })
      }
    }
    
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    const userFullName = await getUserFullName(request)
    await logAction('INSERT', 'Finance', record.id, record, requesterUsername)

    const currentKasa = await getKasaBalance()

    const emoji = type === 'GELIR' ? '💰' : '💸'
    const typeStr = type === 'GELIR' ? 'GELİR' : 'GİDER'
    const descStr = description ? `${description.trim()} ` : ''

    await notifyAdmins({
      message: `${emoji} ${userFullName}, yeni bir ${typeStr} girdi. ${descStr}${parsedAmount}TL. Güncel Kasa: ${currentKasa}TL.`,
      tab: 'finance',
      requesterRole
    })

    return NextResponse.json(record)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Düzenleme yetkisi sadece yöneticidedir.' }, { status: 403 })
    }

    const data = await request.json()
    const { id, type, amount, description, date } = data
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }

    if (date) {
      try {
        const incomingDateStr = new Date(date).toISOString().split('T')[0]
        const turkeyNow = new Date(new Date().getTime() + 3 * 60 * 60 * 1000)
        const todayStr = turkeyNow.toISOString().split('T')[0]
        if (incomingDateStr > todayStr) {
          return NextResponse.json({ error: 'Gelecekteki bir tarihe işlem yapılamaz.' }, { status: 400 })
        }
      } catch (err) {
        return NextResponse.json({ error: 'Geçersiz tarih formatı.' }, { status: 400 })
      }
    }

    const existing = await prisma.finance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Finansal kayıt bulunamadı' }, { status: 404 })
    }

    // Basit güncelleme (bakiyeleri karıştırmamak için sadece açıklama ve tarihi güncelletiyoruz)
    const updateData = {
      description: description !== undefined ? description : existing.description,
      date: date !== undefined ? new Date(date) : existing.date,
    }

    const record = await prisma.finance.update({
      where: { id },
      data: updateData
    })
    
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    const userFullName = await getUserFullName(request)
    await logAction('UPDATE', 'Finance', id, existing, requesterUsername)

    const currentKasa = await getKasaBalance()

    const typeStr = existing.type === 'GELIR' ? 'GELİR' : 'GİDER'
    const descStr = record.description ? `${record.description.trim()} ` : ''

    await notifyAdmins({
      message: `✍️ ${userFullName}, bir ${typeStr} işlemini güncelledi. ${descStr}${existing.amount}TL. Güncel Kasa: ${currentKasa}TL.`,
      tab: 'finance',
      requesterRole
    })

    return NextResponse.json(record)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const requesterRole = request.headers.get('x-requester-role')
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }

    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Silme yetkisi sadece yöneticidedir.' }, { status: 403 })
    }
    
    const existing = await prisma.finance.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Finansal kayıt bulunamadı' }, { status: 404 })
    }

    // İptal/Geri Alma (Reversal) İşlemleri
    if (existing.category === 'CARI') {
      // Veresiye Gider Silindi: Borcumuz azalır
      if (existing.type === 'GIDER' && existing.cariId) {
        await prisma.cari.update({
          where: { id: existing.cariId },
          data: { currentBalance: { decrement: existing.amount } }
        })
      } else if (existing.type === 'GELIR' && existing.cariId) {
        // Veresiye Gelir Silindi: Borcumuz geri artar
        await prisma.cari.update({
          where: { id: existing.cariId },
          data: { currentBalance: { increment: existing.amount } }
        })
      }
    } else if (existing.category === 'KASA') {
      // Müşteri Tahsilat Kaydı Silindi: Müşteri borcu geri artar
      if (existing.type === 'GELIR' && existing.customerId) {
        await prisma.customer.update({
          where: { id: existing.customerId },
          data: { currentBalance: { increment: existing.amount } }
        })
      }
      // Cari Ödeme Kaydı Silindi: Bizim cari borcumuz geri artar
      if (existing.type === 'GIDER' && existing.cariId) {
        await prisma.cari.update({
          where: { id: existing.cariId },
          data: { currentBalance: { increment: existing.amount } }
        })
      }
    }
    
    await prisma.finance.delete({ where: { id } })
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    const userFullName = await getUserFullName(request)
    await logAction('DELETE', 'Finance', id, existing, requesterUsername)

    const currentKasa = await getKasaBalance()

    const typeStr = existing.type === 'GELIR' ? 'GELİR' : 'GİDER'
    const descStr = existing.description ? `${existing.description.trim()} ` : ''

    await notifyAdmins({
      message: `🗑️ ${userFullName}, bir ${typeStr} işlemini sildi. ${descStr}${existing.amount}TL. Güncel Kasa: ${currentKasa}TL.`,
      tab: 'finance',
      requesterRole
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

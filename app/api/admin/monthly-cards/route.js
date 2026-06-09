import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'

export async function GET(request) {
  try {
    const role = request.headers.get('x-requester-role')
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const getTurkeyMonthStr = () => {
      const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
    const month = searchParams.get('month') || getTurkeyMonthStr()
    const includeArchived = searchParams.get('includeArchived') === 'true'

    const where = { month }
    if (!includeArchived) {
      where.status = { not: 'ARCHIVED' }
    }

    const cards = await prisma.monthlyCard.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            task: {
              include: {
                assignedUser: {
                  select: { id: true, username: true, displayName: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(cards)
  } catch (error) {
    console.error('Monthly Cards GET Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const role = request.headers.get('x-requester-role')
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const data = await request.json()
    const { customerId, month } = data

    if (!customerId || !month) {
      return NextResponse.json({ error: 'Eksik alanlar var.' }, { status: 400 })
    }

    // Zaten bu ay için kart açılmış mı kontrol et
    const existing = await prisma.monthlyCard.findUnique({
      where: {
        customerId_month: { customerId, month }
      }
    })

    if (existing) {
      return NextResponse.json({ error: 'Bu müşteri için bu ay zaten kart oluşturulmuş.' }, { status: 400 })
    }

    const card = await prisma.monthlyCard.create({
      data: {
        customerId,
        month,
        status: 'ACTIVE'
      },
      include: {
        customer: true
      }
    })

    await logAction('INSERT', 'MonthlyCard', card.id, card, requesterUsername)

    return NextResponse.json(card)
  } catch (error) {
    console.error('Monthly Cards POST Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const role = request.headers.get('x-requester-role')
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const data = await request.json()
    const { cardId, status, paymentType, amount } = data

    if (!cardId || !status) {
      return NextResponse.json({ error: 'Eksik alanlar var.' }, { status: 400 })
    }

    const card = await prisma.monthlyCard.findUnique({
      where: { id: cardId },
      include: { customer: true }
    })

    if (!card) {
      return NextResponse.json({ error: 'Kart bulunamadı.' }, { status: 404 })
    }

    let finalPaidAmount = card.paidAmount
    let finalStatus = status

    if (paymentType === 'partial') {
      const parsedAmount = parseFloat(amount) || 0
      if (parsedAmount <= 0) {
        return NextResponse.json({ error: 'Tutar sıfırdan büyük olmalıdır.' }, { status: 400 })
      }

      // 1. Kasaya Gelir Ekle
      const finance = await prisma.finance.create({
        data: {
          type: 'GELIR',
          category: 'KASA',
          amount: parsedAmount,
          description: `${card.customer.name} - ${card.month} Aylık Hizmet Taksit Ödemesi (Aylık Müşteri Kartı)`,
          customerId: card.customerId,
          date: new Date()
        }
      })
      await logAction('INSERT', 'Finance', finance.id, finance, requesterUsername)

      finalPaidAmount = card.paidAmount + parsedAmount
      if (finalPaidAmount >= card.customer.monthlyIncome) {
        finalStatus = 'ARCHIVED'
      } else {
        finalStatus = 'ACTIVE' // Taksit devam ederken kart aktif kalmaya devam etmeli
      }
    } else {
      // Ödeme alındı işlemi (Tam Ödeme)
      if (status === 'ARCHIVED' && card.status !== 'ARCHIVED') {
        const remainingAmount = Math.max(0, card.customer.monthlyIncome - card.paidAmount)

        // 1. Kasaya Gelir Ekle
        if (remainingAmount > 0) {
          const finance = await prisma.finance.create({
            data: {
              type: 'GELIR',
              category: 'KASA',
              amount: remainingAmount,
              description: `${card.customer.name} - ${card.month} Aylık Hizmet Ödemesi (Aylık Müşteri Kartı)`,
              customerId: card.customerId,
              date: new Date()
            }
          })
          await logAction('INSERT', 'Finance', finance.id, finance, requesterUsername)
        }
        finalPaidAmount = card.customer.monthlyIncome
      }
    }

    const updatedCard = await prisma.monthlyCard.update({
      where: { id: cardId },
      data: { 
        status: finalStatus,
        paidAmount: finalPaidAmount
      },
      include: { customer: true }
    })

    await logAction('UPDATE', 'MonthlyCard', cardId, card, requesterUsername)

    return NextResponse.json(updatedCard)
  } catch (error) {
    console.error('Monthly Cards PUT Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const role = request.headers.get('x-requester-role')
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Kimlik eksik.' }, { status: 400 })
    }

    const card = await prisma.monthlyCard.findUnique({
      where: { id },
      include: { items: true }
    })

    if (!card) {
      return NextResponse.json({ error: 'Kart bulunamadı.' }, { status: 404 })
    }

    // Kart içindeki tüm maddelerin ilişkili görevlerini sil
    for (const item of card.items) {
      if (item.taskId) {
        try {
          await prisma.task.delete({
            where: { id: item.taskId }
          })
        } catch (err) {
          console.error('Görev silme hatası:', err)
        }
      }
    }

    // Kartı sil
    await prisma.monthlyCard.delete({
      where: { id }
    })

    await logAction('DELETE', 'MonthlyCard', id, card, requesterUsername)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Monthly Cards DELETE Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

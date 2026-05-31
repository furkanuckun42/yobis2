import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'

export async function GET() {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        projects: {
          orderBy: { deliveryDate: 'asc' }
        }
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(customers)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    const { name, phone, instagram, notes, monthlyIncome, startingBalance } = data
    
    const parsedMonthlyIncome = parseFloat(monthlyIncome || 0)
    const parsedStartingBalance = parseFloat(startingBalance || 0)

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        instagram,
        notes,
        monthlyIncome: parsedMonthlyIncome,
        startingBalance: parsedStartingBalance,
        currentBalance: parsedStartingBalance, // İlk başta borç/bakiye starting balance kadardır
      }
    })
    
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    
    // Geri alma kaydı
    await logAction('INSERT', 'Customer', customer.id, customer, requesterUsername)
    return NextResponse.json(customer)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    const data = await request.json()
    const { id, name, phone, instagram, notes, monthlyIncome, startingBalance, currentBalance, payAmount } = data
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }

    const existing = await prisma.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }
    
    let customer
    if (payAmount !== undefined) {
      // Hızlı Taksit Öde / Borç Düş aracı: mevcut bakiyeden düşer
      const parsedPayAmount = parseFloat(payAmount || 0)
      if (parsedPayAmount <= 0) {
        return NextResponse.json({ error: 'Geçersiz ödeme tutarı' }, { status: 400 })
      }

      customer = await prisma.$transaction(async (tx) => {
        // 1. Kasa girişi (GELIR) kaydı oluştur
        await tx.finance.create({
          data: {
            type: 'GELIR',
            category: 'KASA', // Kasa tahsilatı
            amount: parsedPayAmount,
            description: `${existing.name} firmasından tahsilat yapıldı.`,
            customerId: id,
            date: new Date(),
          }
        })

        // 2. Müşteri bakiyesini güncelle
        return await tx.customer.update({
          where: { id },
          data: {
            currentBalance: existing.currentBalance - parsedPayAmount
          }
        })
      })
    } else {
      const updateData = {
        name: name !== undefined ? name : existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        instagram: instagram !== undefined ? instagram : existing.instagram,
        notes: notes !== undefined ? notes : existing.notes,
        monthlyIncome: monthlyIncome !== undefined ? parseFloat(monthlyIncome || 0) : existing.monthlyIncome,
        startingBalance: startingBalance !== undefined ? parseFloat(startingBalance || 0) : existing.startingBalance,
        currentBalance: currentBalance !== undefined ? parseFloat(currentBalance || 0) : existing.currentBalance,
      }

      customer = await prisma.customer.update({
        where: { id },
        data: updateData
      })
    }
    
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    
    // Geri alma kaydı (eski veriyi kaydediyoruz)
    await logAction('UPDATE', 'Customer', id, existing, requesterUsername)
    return NextResponse.json(customer)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }
    
    const existing = await prisma.customer.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }
    
    // İşlemleri veri bütünlüğü için transaction içinde çalıştıralım
    await prisma.$transaction(async (tx) => {
      // 1. İlişkili finans kayıtlarının açıklamasına silinen müşteri adını ekleyelim (Kasa geçmişi korunur)
      await tx.$executeRaw`UPDATE "Finance" SET "description" = '[Silinmiş Müşteri: ' || ${existing.name} || '] ' || COALESCE("description", '') WHERE "customerId" = ${id}`

      // 2. Müşteriyi sil
      await tx.customer.delete({ where: { id } })
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    
    // Geri alma kaydı
    await logAction('DELETE', 'Customer', id, existing, requesterUsername)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

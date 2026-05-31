import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'
import { notifyAdmins } from '@/lib/notifications'

export async function GET() {
  try {
    const caris = await prisma.cari.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(caris)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlemi sadece yöneticiler yapabilir.' }, { status: 403 })
    }

    const data = await request.json()
    const { name, phone, notes, startingBalance } = data

    if (!name) {
      return NextResponse.json({ error: 'Cari adı zorunludur.' }, { status: 400 })
    }

    const parsedStartingBalance = parseFloat(startingBalance || 0)

    const cari = await prisma.cari.create({
      data: {
        name,
        phone,
        notes,
        startingBalance: parsedStartingBalance,
        currentBalance: parsedStartingBalance, // İlk bakiye başlangıç bakiyesidir
      }
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('INSERT', 'Cari', cari.id, cari, requesterUsername)
    
    await notifyAdmins({
      message: `📂 Cari Eklendi: ${requesterUsername} yeni bir cari hesap oluşturdu: "${name}"`,
      tab: 'caris',
      requesterRole
    })

    return NextResponse.json(cari)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    const data = await request.json()
    const { id, name, phone, notes, startingBalance, currentBalance, payAmount } = data

    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur.' }, { status: 400 })
    }

    const existing = await prisma.cari.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cari bulunamadı.' }, { status: 404 })
    }

    let cari
    if (payAmount !== undefined) {
      // Ödeme yapma seçeneği: Bizim onlara borcumuz azalır (currentBalance azalır)
      const parsedPayAmount = parseFloat(payAmount || 0)
      if (parsedPayAmount <= 0) {
        return NextResponse.json({ error: 'Geçersiz ödeme tutarı.' }, { status: 400 })
      }

      cari = await prisma.$transaction(async (tx) => {
        // 1. Kasa çıkışı (GIDER) kaydı oluştur
        await tx.finance.create({
          data: {
            type: 'GIDER',
            category: 'KASA', // Kasa ödemesi
            amount: parsedPayAmount,
            description: `${existing.name} cari hesabına ödeme yapıldı.`,
            cariId: id,
            date: new Date(),
          }
        })

        // 2. Cari bakiyesini güncelle
        return await tx.cari.update({
          where: { id },
          data: {
            currentBalance: existing.currentBalance - parsedPayAmount
          }
        })
      })
    } else {
      // Cari profil düzenleme: Sadece Admin
      if (requesterRole !== 'admin') {
        return NextResponse.json({ error: 'Bu işlemi sadece yöneticiler yapabilir.' }, { status: 403 })
      }

      const updateData = {
        name: name !== undefined ? name : existing.name,
        phone: phone !== undefined ? phone : existing.phone,
        notes: notes !== undefined ? notes : existing.notes,
        startingBalance: startingBalance !== undefined ? parseFloat(startingBalance || 0) : existing.startingBalance,
        currentBalance: currentBalance !== undefined ? parseFloat(currentBalance || 0) : existing.currentBalance,
      }

      cari = await prisma.cari.update({
        where: { id },
        data: updateData
      })
    }

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('UPDATE', 'Cari', id, existing, requesterUsername)

    // Adminleri bilgilendir
    if (payAmount !== undefined) {
      const parsedPayAmount = parseFloat(payAmount || 0)
      await notifyAdmins({
        message: `💸 Ödeme Yapıldı: ${requesterUsername}, "${existing.name}" cari hesabına ${parsedPayAmount} TL ödedi.`,
        tab: 'caris',
        requesterRole
      })
    } else {
      await notifyAdmins({
        message: `✍️ Cari Güncellendi: ${requesterUsername}, "${existing.name}" cari bilgilerini güncelledi.`,
        tab: 'caris',
        requesterRole
      })
    }

    return NextResponse.json(cari)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlemi sadece yöneticiler yapabilir.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur.' }, { status: 400 })
    }

    const existing = await prisma.cari.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Cari bulunamadı.' }, { status: 404 })
    }

    // İşlemleri veri bütünlüğü için transaction içinde çalıştıralım
    await prisma.$transaction(async (tx) => {
      // 1. İlişkili finans kayıtlarının açıklamasına silinen cari adını ekleyelim (Kasa geçmişi korunur)
      await tx.$executeRaw`UPDATE "Finance" SET "description" = '[Silinmiş Cari: ' || ${existing.name} || '] ' || COALESCE("description", '') WHERE "cariId" = ${id}`

      // 2. Cari kaydını sil
      await tx.cari.delete({ where: { id } })
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('DELETE', 'Cari', id, existing, requesterUsername)

    await notifyAdmins({
      message: `🗑️ Cari Silindi: ${requesterUsername}, "${existing.name}" cari hesabını kaldırdı.`,
      tab: 'caris',
      requesterRole
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

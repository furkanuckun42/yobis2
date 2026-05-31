import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'

export async function POST(request) {
  try {
    const role = request.headers.get('x-requester-role')
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const data = await request.json()
    const { cardId, title, assignedUserId, dueDate } = data

    if (!cardId || !title) {
      return NextResponse.json({ error: 'Eksik alanlar var.' }, { status: 400 })
    }

    const card = await prisma.monthlyCard.findUnique({
      where: { id: cardId },
      include: { customer: true }
    })

    if (!card) {
      return NextResponse.json({ error: 'Kart bulunamadı.' }, { status: 404 })
    }

    // 1. Görev Oluştur
    const task = await prisma.task.create({
      data: {
        title: `[Aylık Müşteri: ${card.customer.name}] ${title}`,
        description: `"${card.customer.name}" isimli aylık müşteri kartı için oluşturulan otomatik görev.`,
        assignedUserId: assignedUserId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'Bekliyor'
      }
    })

    // 2. Kart Elemanı Oluştur ve Göreve Bağla
    const item = await prisma.monthlyCardItem.create({
      data: {
        cardId,
        title,
        taskId: task.id,
        completed: false
      },
      include: {
        task: {
          include: {
            assignedUser: {
              select: { id: true, username: true, displayName: true }
            }
          }
        }
      }
    })

    await logAction('INSERT', 'MonthlyCardItem', item.id, item, requesterUsername)

    return NextResponse.json(item)
  } catch (error) {
    console.error('Monthly Card Items POST Hatası:', error)
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
    const { itemId, title, completed, assignedUserId, dueDate } = data

    if (!itemId) {
      return NextResponse.json({ error: 'Eksik alanlar var.' }, { status: 400 })
    }

    const item = await prisma.monthlyCardItem.findUnique({
      where: { id: itemId },
      include: {
        card: { include: { customer: true } },
        task: true
      }
    })

    if (!item) {
      return NextResponse.json({ error: 'Maddeler bulunamadı.' }, { status: 404 })
    }

    // 1. İlişkili Görevi Güncelle
    if (item.taskId) {
      const taskData = {}
      if (title !== undefined) {
        taskData.title = `[Aylık Müşteri: ${item.card.customer.name}] ${title}`
      }
      if (completed !== undefined) {
        taskData.status = completed ? 'Tamamlandı' : 'Bekliyor'
      }
      if (assignedUserId !== undefined) {
        taskData.assignedUserId = assignedUserId || null
      }
      if (dueDate !== undefined) {
        taskData.dueDate = dueDate ? new Date(dueDate) : null
      }

      await prisma.task.update({
        where: { id: item.taskId },
        data: taskData
      })
    }

    // 2. Kart Elemanını Güncelle
    const itemData = {}
    if (title !== undefined) itemData.title = title
    if (completed !== undefined) itemData.completed = completed

    const updatedItem = await prisma.monthlyCardItem.update({
      where: { id: itemId },
      data: itemData,
      include: {
        task: {
          include: {
            assignedUser: {
              select: { id: true, username: true, displayName: true }
            }
          }
        }
      }
    })

    await logAction('UPDATE', 'MonthlyCardItem', itemId, item, requesterUsername)

    return NextResponse.json(updatedItem)
  } catch (error) {
    console.error('Monthly Card Items PUT Hatası:', error)
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

    const item = await prisma.monthlyCardItem.findUnique({
      where: { id }
    })

    if (!item) {
      return NextResponse.json({ error: 'Maddeler bulunamadı.' }, { status: 404 })
    }

    // 1. İlişkili Görevi Sil
    if (item.taskId) {
      try {
        await prisma.task.delete({
          where: { id: item.taskId }
        })
      } catch (err) {
        console.error('İlişkili görev silme hatası (görev zaten silinmiş olabilir):', err)
      }
    }

    // 2. Kart Elemanını Sil
    await prisma.monthlyCardItem.delete({
      where: { id }
    })

    await logAction('DELETE', 'MonthlyCardItem', id, item, requesterUsername)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Monthly Card Items DELETE Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

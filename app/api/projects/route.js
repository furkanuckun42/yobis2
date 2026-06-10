import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'
import { sendSystemNotification } from '@/lib/notifications'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        customer: true,
        assignedUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      },
      orderBy: { deliveryDate: 'asc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    const data = await request.json()
    const { name, customerId, stage, deliveryDate, budget, assignedUserId } = data
    
    if (!name || !customerId || !stage || !deliveryDate) {
      return NextResponse.json({ error: 'Eksik alanlar var' }, { status: 400 })
    }

    let creatorName = 'Bilinmeyen Kullanıcı'
    if (requesterId) {
      const creator = await prisma.user.findUnique({ where: { id: requesterId } })
      creatorName = creator?.displayName || creator?.username || 'Personel'
    }

    const project = await prisma.project.create({
      data: {
        name,
        customer: { connect: { id: customerId } },
        stage,
        deliveryDate: new Date(deliveryDate),
        budget: parseFloat(budget || 0),
        assignedUser: assignedUserId ? { connect: { id: assignedUserId } } : undefined,
        lastUpdatedBy: creatorName,
      },
      include: {
        customer: true,
        assignedUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    })

    // Proje oluşturulunca otomatik görev oluştur
    try {
      await prisma.task.create({
        data: {
          title: `[Çalışma] ${name}`,
          description: `"${name}" çalışması için oluşturulan otomatik görev.`,
          projectId: project.id,
          status: 'Bekliyor',
          dueDate: new Date(deliveryDate)
        }
      })
    } catch (err) {
      console.error('Otomatik görev oluşturma hatası:', err)
    }
    
    // Admin dışındaki kullanıcıların yaptığı değişiklikleri admine bildirim olarak gönder
    if (requesterRole !== 'admin' && requesterId) {
      try {
        const admins = await prisma.user.findMany({ where: { role: 'admin' } })
        for (const admin of admins) {
          await sendSystemNotification({
            userId: admin.id,
            message: `${creatorName} yeni bir çalışma oluşturdu: "${project.name}"`,
            tab: 'projects'
          })
        }
      } catch (err) {
        console.error('Proje oluşturma bildirim hatası:', err)
      }
    }

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('INSERT', 'Project', project.id, project, requesterUsername)
    return NextResponse.json(project)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    const data = await request.json()
    const { id, name, customerId, stage, deliveryDate, budget, paidAmount, assignedUserId, isArchived, paymentAmount } = data
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }

    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })
    }

    // Sadece admin arşivleme durumunu değiştirebilir
    if (isArchived !== undefined && isArchived !== existing.isArchived) {
      if (requesterRole !== 'admin') {
        return NextResponse.json({ error: 'Sadece yöneticiler (admin) arşivleme yetkisine sahiptir.' }, { status: 403 })
      }
    }

    // Proje sadece "Teslim Edildi" veya "Ödemesi Alındı" durumunda arşivlenebilir
    if (isArchived === true) {
      const currentStage = stage !== undefined ? stage : existing.stage
      if (currentStage !== 'Teslim Edildi' && currentStage !== 'Ödemesi Alındı') {
        return NextResponse.json({ error: 'Sadece "Teslim Edildi" veya "Ödemesi Alındı" aşamasındaki projeler arşivlenebilir.' }, { status: 400 })
      }
    }

    let updaterName = 'Bilinmeyen Kullanıcı'
    if (requesterId) {
      const updater = await prisma.user.findUnique({ where: { id: requesterId } })
      updaterName = updater?.displayName || updater?.username || 'Personel'
    }

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    let finalPaidAmount = paidAmount !== undefined ? parseFloat(paidAmount || 0) : existing.paidAmount
    let finalStage = stage !== undefined ? stage : existing.stage

    // Ödeme alma ve Kasa entegrasyonu
    if (paymentAmount !== undefined) {
      const parsedAmount = parseFloat(paymentAmount) || 0
      if (parsedAmount > 0) {
        const finance = await prisma.finance.create({
          data: {
            type: 'GELIR',
            category: 'KASA',
            amount: parsedAmount,
            description: `${existing.name} - Proje Ödemesi`,
            customerId: existing.customerId,
            projectId: id,
            date: new Date()
          }
        })
        await logAction('INSERT', 'Finance', finance.id, finance, requesterUsername)

        finalPaidAmount = existing.paidAmount + parsedAmount
        const finalBudget = budget !== undefined ? parseFloat(budget || 0) : existing.budget
        if (finalPaidAmount >= finalBudget) {
          finalStage = 'Ödemesi Alındı'
        }
      }
    } else if (stage === 'Ödemesi Alındı' && existing.stage !== 'Ödemesi Alındı') {
      // Doğrudan 'Ödemesi Alındı' aşamasına çekildiyse, kalan bakiye otomatik kasaya eklenir
      const finalBudget = budget !== undefined ? parseFloat(budget || 0) : existing.budget
      const remainingAmount = Math.max(0, finalBudget - existing.paidAmount)
      if (remainingAmount > 0) {
        const finance = await prisma.finance.create({
          data: {
            type: 'GELIR',
            category: 'KASA',
            amount: remainingAmount,
            description: `${existing.name} - Proje Ödemesi (Kalan Tutar)`,
            customerId: existing.customerId,
            projectId: id,
            date: new Date()
          }
        })
        await logAction('INSERT', 'Finance', finance.id, finance, requesterUsername)
      }
      finalPaidAmount = finalBudget
    }

    const updateData = {
      name: name !== undefined ? name : existing.name,
      stage: finalStage,
      deliveryDate: deliveryDate !== undefined ? new Date(deliveryDate) : existing.deliveryDate,
      budget: budget !== undefined ? parseFloat(budget || 0) : existing.budget,
      paidAmount: finalPaidAmount,
      isArchived: isArchived !== undefined ? Boolean(isArchived) : existing.isArchived,
      lastUpdatedBy: updaterName,
    }

    if (assignedUserId !== undefined) {
      if (assignedUserId) {
        updateData.assignedUser = { connect: { id: assignedUserId } }
      } else {
        updateData.assignedUser = { disconnect: true }
      }
    }

    if (customerId !== undefined) {
      updateData.customer = { connect: { id: customerId } }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        assignedUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    })

    // Proje aşaması değiştiğinde ilişkili görevlerin durumlarını güncelle
    if (project.stage !== existing.stage) {
      try {
        if (['Devam Ediyor', 'Revize Bekliyor', 'Teslime Hazır'].includes(project.stage)) {
          await prisma.task.updateMany({
            where: { projectId: id },
            data: { status: 'Devam Ediyor' }
          })
        } else if (['Teslim Edildi', 'Ödemesi Alındı'].includes(project.stage)) {
          await prisma.task.updateMany({
            where: { projectId: id },
            data: { status: 'Tamamlandı' }
          })
        }
      } catch (err) {
        console.error('Görev otomatik durum güncelleme hatası:', err)
      }
    }
    
    // Admin dışındaki kullanıcıların yaptığı değişiklikleri admine bildirim olarak gönder
    if (requesterRole !== 'admin' && requesterId) {
      try {
        const admins = await prisma.user.findMany({ where: { role: 'admin' } })
        for (const admin of admins) {
          await sendSystemNotification({
            userId: admin.id,
            message: `${updaterName} "${project.name}" çalışmasını güncelledi (Aşama: "${project.stage}").`,
            tab: 'projects'
          })
        }
      } catch (err) {
        console.error('Proje güncelleme bildirim hatası:', err)
      }
    }

    await logAction('UPDATE', 'Project', id, existing, requesterUsername)
    return NextResponse.json(project)
  } catch (error) {
    console.error('Projects PUT Error:', error)
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
    
    const existing = await prisma.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proje bulunamadı' }, { status: 404 })
    }
    
    await prisma.project.delete({ where: { id } })
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('DELETE', 'Project', id, existing, requesterUsername)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

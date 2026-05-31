import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'
import { sendSystemNotification } from '@/lib/notifications'

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        customer: true,
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
    const { name, customerId, stage, deliveryDate, budget } = data
    
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
        lastUpdatedBy: creatorName,
      },
      include: {
        customer: true
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
    const { id, name, customerId, stage, deliveryDate, budget, isArchived } = data
    
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

    // Proje sadece "Teslim Edildi" durumunda arşivlenebilir
    if (isArchived === true) {
      const currentStage = stage !== undefined ? stage : existing.stage
      if (currentStage !== 'Teslim Edildi') {
        return NextResponse.json({ error: 'Sadece "Teslim Edildi" aşamasındaki projeler arşivlenebilir.' }, { status: 400 })
      }
    }

    let updaterName = 'Bilinmeyen Kullanıcı'
    if (requesterId) {
      const updater = await prisma.user.findUnique({ where: { id: requesterId } })
      updaterName = updater?.displayName || updater?.username || 'Personel'
    }

    const updateData = {
      name: name !== undefined ? name : existing.name,
      stage: stage !== undefined ? stage : existing.stage,
      deliveryDate: deliveryDate !== undefined ? new Date(deliveryDate) : existing.deliveryDate,
      budget: budget !== undefined ? parseFloat(budget || 0) : existing.budget,
      isArchived: isArchived !== undefined ? Boolean(isArchived) : existing.isArchived,
      lastUpdatedBy: updaterName,
    }

    if (customerId !== undefined) {
      updateData.customer = { connect: { id: customerId } }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        customer: true
      }
    })

    // Proje 'Teslim Edildi' aşamasına geçtiğinde ilgili görevleri tamamla
    if (project.stage === 'Teslim Edildi' && existing.stage !== 'Teslim Edildi') {
      try {
        await prisma.task.updateMany({
          where: { projectId: id, status: { not: 'Tamamlandı' } },
          data: { status: 'Tamamlandı' }
        })
      } catch (err) {
        console.error('Görev otomatik tamamlama hatası:', err)
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

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
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

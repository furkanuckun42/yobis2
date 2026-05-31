import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendSystemNotification } from '@/lib/notifications'

// 1. Görevleri Listele
export async function GET(request) {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignedUser: {
          select: {
            id: true,
            username: true,
            role: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(tasks)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 2. Görev Oluştur
export async function POST(request) {
  try {
    const { title, description, assignedUserId, dueDate, status } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Görev başlığı zorunludur.' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        assignedUserId: assignedUserId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: status || 'Bekliyor'
      }
    })

    // Görev birine atandıysa ona bildirim oluştur
    if (assignedUserId) {
      await sendSystemNotification({
        userId: assignedUserId,
        message: `Size yeni bir görev atandı: ${title}`,
        tab: 'tasks'
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 3. Görev Güncelle
export async function PUT(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    const { id, title, description, assignedUserId, dueDate, status } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Güncellenecek görev ID bilgisi eksik.' }, { status: 400 })
    }

    const existingTask = await prisma.task.findUnique({
      where: { id }
    })

    if (!existingTask) {
      return NextResponse.json({ error: 'Görev bulunamadı.' }, { status: 404 })
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existingTask.title,
        description: description !== undefined ? description : existingTask.description,
        assignedUserId: assignedUserId !== undefined ? (assignedUserId || null) : existingTask.assignedUserId,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : existingTask.dueDate,
        status: status !== undefined ? status : existingTask.status
      }
    })

    // Aylık Müşteri Kartı Elemanı ile eşleşiyorsa durum güncelle
    if (status !== undefined) {
      try {
        await prisma.monthlyCardItem.updateMany({
          where: { taskId: id },
          data: {
            completed: status === 'Tamamlandı'
          }
        })
      } catch (err) {
        console.error('Aylık müşteri kart elemanı durumu senkronizasyon hatası:', err)
      }
    }

    // Eğer yeni bir kullanıcıya atandıysa veya atanan kişi değiştiyse yeni kişiye bildirim gönder
    if (assignedUserId && assignedUserId !== existingTask.assignedUserId) {
      await sendSystemNotification({
        userId: assignedUserId,
        message: `Size yeni bir görev atandı: ${title || updatedTask.title}`,
        tab: 'tasks'
      })
    }

    // Admin dışındaki kullanıcıların yaptığı değişiklikleri admine bildirim olarak gönder
    if (requesterRole !== 'admin' && requesterId) {
      try {
        const updater = await prisma.user.findUnique({ where: { id: requesterId } })
        const updaterName = updater?.displayName || updater?.username || 'Personel'
        const admins = await prisma.user.findMany({
          where: { role: 'admin' }
        })
        for (const admin of admins) {
          await sendSystemNotification({
            userId: admin.id,
            message: `${updaterName}, "${updatedTask.title}" görevinin durumunu "${updatedTask.status}" olarak güncelledi.`,
            tab: 'tasks'
          })
        }
      } catch (err) {
        console.error('Görev güncelleme bildirim hatası:', err)
      }
    } else if (updatedTask.projectId) {
      // Eğer görev bir projeyle ilişkiliyse, yöneticilere (admin) bildirim gönder (kendi kendine bildirim gitmesin)
      try {
        const project = await prisma.project.findUnique({
          where: { id: updatedTask.projectId }
        })
        const admins = await prisma.user.findMany({
          where: { role: 'admin' }
        })
        const projectName = project ? project.name : 'Çalışma'
        const statusText = status !== undefined ? `durumu "${status}" yapıldı` : 'güncellendi'

        for (const admin of admins) {
          if (admin.id === requesterId) continue;
          await sendSystemNotification({
            userId: admin.id,
            message: `"${projectName}" çalışmasının "${updatedTask.title}" görevi ${statusText}.`,
            tab: 'tasks'
          })
        }
      } catch (err) {
        console.error('Proje görevi bildirim hatası:', err)
      }
    }

    return NextResponse.json(updatedTask)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 4. Görev Sil
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Silinecek görev ID bilgisi eksik.' }, { status: 400 })
    }

    await prisma.task.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

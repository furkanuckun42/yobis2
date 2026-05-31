import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    // 1. Veritabanındaki Google Calendar üzerinden çekilen etkinlikleri al
    const dbEvents = await prisma.event.findMany({
      orderBy: { date: 'asc' }
    })

    // 2. Projeler tablosundaki tüm teslimatları da dinamik olarak takvime ekle
    const projects = await prisma.project.findMany({
      include: {
        customer: true
      }
    })

    const projectEvents = projects.map(p => ({
      id: `project-${p.id}`,
      title: `${p.name} (Teslimat - ${p.customer?.name || 'Müşteri Yok'})`,
      date: p.deliveryDate,
      time: 'Tüm Gün',
      type: 'project'
    }))

    // 3. Görevleri (Task) dinamik olarak takvime ekle (son tarihi olanlar)
    // Rol bazlı filtreleme yapıyoruz: Personel ise sadece kendi görevleri, Admin ise hepsi
    let tasks = []
    if (requesterRole === 'admin') {
      tasks = await prisma.task.findMany({
        where: {
          dueDate: { not: null }
        },
        include: {
          assignedUser: {
            select: { displayName: true, username: true }
          }
        }
      })
    } else if (requesterId) {
      tasks = await prisma.task.findMany({
        where: {
          dueDate: { not: null },
          assignedUserId: requesterId
        },
        include: {
          assignedUser: {
            select: { displayName: true, username: true }
          }
        }
      })
    }

    const taskEvents = tasks.map(t => ({
      id: `task-${t.id}`,
      title: `${t.title} (${t.status}) ${t.assignedUser ? `- Alıcı: ${t.assignedUser.displayName || t.assignedUser.username}` : ''}`,
      date: t.dueDate,
      time: 'Tüm Gün',
      type: 'task'
    }))

    // 4. Tüm listeleri birleştirip dön
    const allEvents = [
      ...dbEvents.map(e => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        type: e.type, // "google"
      })),
      ...projectEvents,
      ...taskEvents
    ]

    return NextResponse.json(allEvents)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

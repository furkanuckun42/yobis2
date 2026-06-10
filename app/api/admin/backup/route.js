import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'

export async function GET(request) {
  try {
    const role = request.headers.get('x-requester-role')
    
    // Yalnızca yöneticiler (admin) veritabanını yedekleyebilir
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Yalnızca yöneticiler yedekleme yapabilir.' }, { status: 403 })
    }

    // Tüm tabloların verilerini sorgula
    const customers = await prisma.customer.findMany()
    const projects = await prisma.project.findMany()
    const finances = await prisma.finance.findMany()
    const equipments = await prisma.equipment.findMany()
    const actionLogs = await prisma.actionLog.findMany()
    const googleConfigs = await prisma.googleConfig.findMany()
    const events = await prisma.event.findMany()
    const users = await prisma.user.findMany()
    const caris = await prisma.cari.findMany()
    const employees = await prisma.employee.findMany()
    const workLogs = await prisma.workLog.findMany()
    const tasks = await prisma.task.findMany()
    const notifications = await prisma.notification.findMany()
    const attachments = await prisma.attachment.findMany()
    const projectComments = await prisma.projectComment.findMany()
    const monthlyCards = await prisma.monthlyCard.findMany()
    const monthlyCardItems = await prisma.monthlyCardItem.findMany()
    const pushSubscriptions = await prisma.pushSubscription.findMany()
    const systemSettings = await prisma.systemSetting.findMany()

    const backupData = {
      version: 'yobis2.6',
      customers,
      projects,
      finances,
      equipments,
      actionLogs,
      googleConfigs,
      events,
      users,
      caris,
      employees,
      workLogs,
      tasks,
      notifications,
      attachments,
      projectComments,
      monthlyCards,
      monthlyCardItems,
      pushSubscriptions,
      systemSettings
    }

    // JSON verisini UTF-8 olarak buffer'a dönüştür
    const dbBuffer = Buffer.from(JSON.stringify(backupData, null, 2), 'utf-8')

    const getTurkeyDateStr = () => {
      const d = new Date(Date.now() + 3 * 60 * 60 * 1000)
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    }
    const dateStr = getTurkeyDateStr()
    
    return new NextResponse(dbBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="hd-studio-yobi-backup-${dateStr}.db"`,
      },
    })
  } catch (error) {
    console.error('Yedekleme Hatası:', error)
    return NextResponse.json({ error: 'Yedekleme dosyası oluşturulurken hata oluştu: ' + error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const role = request.headers.get('x-requester-role')
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Yalnızca yöneticiler yedek geri yükleyebilir.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'Yüklenecek yedek dosyası bulunamadı.' }, { status: 400 })
    }

    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'Lütfen geçerli bir yedek dosyası yükleyin.' }, { status: 400 })
    }

    const fileContent = await file.text()

    // Dosya içeriği JSON formatında mı kontrol et
    if (fileContent.trim().startsWith('{')) {
      let backupData
      try {
        backupData = JSON.parse(fileContent)
      } catch (err) {
        return NextResponse.json({ error: 'Dosya içeriği geçerli bir JSON yedek formatında değil.' }, { status: 400 })
      }

      // İlişkisel bütünlüğü korumak için sırayla silip yükleme işlemlerini transaction içinde yapıyoruz
      await prisma.$transaction(async (tx) => {
        // Çocuk tablolardan ebeveyn tablolara doğru sil (Cascade silmeler dahil)
        await tx.monthlyCardItem.deleteMany()
        await tx.monthlyCard.deleteMany()
        await tx.projectComment.deleteMany()
        await tx.attachment.deleteMany()
        await tx.task.deleteMany()
        await tx.workLog.deleteMany()
        await tx.employee.deleteMany()
        await tx.cari.deleteMany()
        await tx.pushSubscription.deleteMany()
        await tx.notification.deleteMany()
        await tx.event.deleteMany()
        await tx.googleConfig.deleteMany()
        await tx.actionLog.deleteMany()
        await tx.equipment.deleteMany()
        await tx.finance.deleteMany()
        await tx.project.deleteMany()
        await tx.customer.deleteMany()
        await tx.user.deleteMany()
        await tx.systemSetting.deleteMany()

        // Ebeveyn tablolardan çocuk tablolara doğru yükle
        if (backupData.systemSettings?.length) {
          await tx.systemSetting.createMany({ data: backupData.systemSettings })
        }
        if (backupData.users?.length) {
          await tx.user.createMany({ data: backupData.users })
        }
        if (backupData.customers?.length) {
          await tx.customer.createMany({ data: backupData.customers })
        }
        if (backupData.projects?.length) {
          const projectsData = backupData.projects.map(p => ({
            ...p,
            deliveryDate: new Date(p.deliveryDate),
            createdAt: new Date(p.createdAt),
            updatedAt: new Date(p.updatedAt)
          }))
          await tx.project.createMany({ data: projectsData })
        }
        if (backupData.finances?.length) {
          const financesData = backupData.finances.map(f => ({
            ...f,
            date: new Date(f.date),
            createdAt: new Date(f.createdAt),
            updatedAt: new Date(f.updatedAt)
          }))
          await tx.finance.createMany({ data: financesData })
        }
        if (backupData.equipments?.length) {
          const equipmentsData = backupData.equipments.map(e => ({
            ...e,
            createdAt: new Date(e.createdAt),
            updatedAt: new Date(e.updatedAt)
          }))
          await tx.equipment.createMany({ data: equipmentsData })
        }
        if (backupData.actionLogs?.length) {
          const actionLogsData = backupData.actionLogs.map(a => ({
            ...a,
            createdAt: new Date(a.createdAt)
          }))
          await tx.actionLog.createMany({ data: actionLogsData })
        }
        if (backupData.googleConfigs?.length) {
          const googleConfigsData = backupData.googleConfigs.map(g => ({
            ...g,
            updatedAt: new Date(g.updatedAt)
          }))
          await tx.googleConfig.createMany({ data: googleConfigsData })
        }
        if (backupData.events?.length) {
          const eventsData = backupData.events.map(e => ({
            ...e,
            date: new Date(e.date),
            createdAt: new Date(e.createdAt)
          }))
          await tx.event.createMany({ data: eventsData })
        }
        if (backupData.notifications?.length) {
          const notificationsData = backupData.notifications.map(n => ({
            ...n,
            createdAt: new Date(n.createdAt)
          }))
          await tx.notification.createMany({ data: notificationsData })
        }
        if (backupData.pushSubscriptions?.length) {
          const pushSubsData = backupData.pushSubscriptions.map(p => ({
            ...p,
            createdAt: new Date(p.createdAt)
          }))
          await tx.pushSubscription.createMany({ data: pushSubsData })
        }
        if (backupData.caris?.length) {
          const carisData = backupData.caris.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt)
          }))
          await tx.cari.createMany({ data: carisData })
        }
        if (backupData.employees?.length) {
          const employeesData = backupData.employees.map(e => ({
            ...e,
            createdAt: new Date(e.createdAt),
            updatedAt: new Date(e.updatedAt)
          }))
          await tx.employee.createMany({ data: employeesData })
        }
        if (backupData.workLogs?.length) {
          const workLogsData = backupData.workLogs.map(w => ({
            ...w,
            date: new Date(w.date),
            createdAt: new Date(w.createdAt),
            updatedAt: new Date(w.updatedAt)
          }))
          await tx.workLog.createMany({ data: workLogsData })
        }
        if (backupData.tasks?.length) {
          const tasksData = backupData.tasks.map(t => ({
            ...t,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt)
          }))
          await tx.task.createMany({ data: tasksData })
        }
        if (backupData.attachments?.length) {
          const attachmentsData = backupData.attachments.map(a => ({
            ...a,
            createdAt: new Date(a.createdAt)
          }))
          await tx.attachment.createMany({ data: attachmentsData })
        }
        if (backupData.projectComments?.length) {
          const commentsData = backupData.projectComments.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt)
          }))
          await tx.projectComment.createMany({ data: commentsData })
        }
        if (backupData.monthlyCards?.length) {
          const cardsData = backupData.monthlyCards.map(c => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt)
          }))
          await tx.monthlyCard.createMany({ data: cardsData })
        }
        if (backupData.monthlyCardItems?.length) {
          const itemsData = backupData.monthlyCardItems.map(i => ({
            ...i,
            createdAt: new Date(i.createdAt),
            updatedAt: new Date(i.updatedAt)
          }))
          await tx.monthlyCardItem.createMany({ data: itemsData })
        }
      })

      return NextResponse.json({ success: true, message: 'Veritabanı verisi bulut üzerinden başarıyla geri yüklendi.' })
    }

    // Geriye dönük uyumluluk: Eski SQLite ikili dosyası (.db) yükleme işlemi
    const buffer = Buffer.from(await file.arrayBuffer())
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    const tempBackupPath = path.join(process.cwd(), 'prisma', `dev.db.bak.${Date.now()}`)
    
    if (fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, tempBackupPath)
      } catch (err) {
        console.error('Kurtarma öncesi yedekleme kopyalama hatası:', err)
      }
    }

    fs.writeFileSync(dbPath, buffer)

    return NextResponse.json({ success: true, message: 'SQLite veritabanı başarıyla geri yüklendi.' })
  } catch (error) {
    console.error('Yedek Geri Yükleme Hatası:', error)
    return NextResponse.json({ error: 'Yedek geri yüklenirken hata oluştu: ' + error.message }, { status: 500 })
  }
}

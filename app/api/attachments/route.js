import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

// Get files for a customer, project or task
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const customerId = searchParams.get('customerId')
    const projectId = searchParams.get('projectId')
    const taskId = searchParams.get('taskId')

    const where = {}
    if (customerId) where.customerId = customerId
    if (projectId) where.projectId = projectId
    if (taskId) where.taskId = taskId

    if (Object.keys(where).length === 0) {
      return NextResponse.json({ error: 'Geçersiz parametreler' }, { status: 400 })
    }

    const attachments = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(attachments)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Upload a file
export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const customerId = formData.get('customerId') || null
    const projectId = formData.get('projectId') || null
    const taskId = formData.get('taskId') || null

    if (!file) {
      return NextResponse.json({ error: 'Yüklenecek dosya bulunamadı.' }, { status: 400 })
    }

    // Dosya boyutunu kontrol et (5MB sınırı)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Dosya boyutu 5MB sınırını aşamaz.' }, { status: 400 })
    }

    // Dosya uzantısı ve MIME tipi doğrulaması (Güvenlik Sertleşmesi)
    const fileExt = path.extname(file.name).toLowerCase()
    const whitelistedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv', '.zip', '.rar']
    const whitelistedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/octet-stream'
    ]

    if (!whitelistedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Bu dosya türü desteklenmiyor. Lütfen yalnızca resim, PDF, Word, Excel veya sıkıştırılmış arşiv dosyası yükleyin.' },
        { status: 400 }
      )
    }

    if (file.type && !whitelistedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Geçersiz veya desteklenmeyen dosya biçimi.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Klasörü hazırla
    const uploadDir = path.join(process.cwd(), 'public', 'uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    // Eşsiz dosya adı oluştur
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`
    const filePath = path.join(uploadDir, uniqueName)

    // Diske yaz
    fs.writeFileSync(filePath, buffer)

    // Veritabanına kaydet
    const attachment = await prisma.attachment.create({
      data: {
        name: file.name,
        path: `/uploads/${uniqueName}`,
        fileType: file.type,
        size: file.size,
        customerId: customerId || undefined,
        projectId: projectId || undefined,
        taskId: taskId || undefined
      }
    })

    return NextResponse.json(attachment)
  } catch (error) {
    console.error('Dosya yükleme hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Delete an attachment
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID zorunludur.' }, { status: 400 })
    }

    const attachment = await prisma.attachment.findUnique({
      where: { id }
    })

    if (!attachment) {
      return NextResponse.json({ error: 'Dosya bulunamadı.' }, { status: 404 })
    }

    // Diskten sil
    const filePath = path.join(process.cwd(), 'public', attachment.path)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch (err) {
        console.error('Disk dosya silme hatası:', err)
      }
    }

    // Veritabanından sil
    await prisma.attachment.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request) {
  try {
    const role = request.headers.get('x-requester-role')
    
    // Yalnızca yöneticiler (admin) veritabanını yedekleyebilir
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Yalnızca yöneticiler yedekleme yapabilir.' }, { status: 403 })
    }

    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Veritabanı dosyası bulunamadı.' }, { status: 404 })
    }

    const dbBuffer = fs.readFileSync(dbPath)
    const dateStr = new Date().toISOString().split('T')[0]
    
    return new NextResponse(dbBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
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
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Yalnızca yöneticiler yedek geri yükleyebilir.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'Yüklenecek yedek dosyası bulunamadı.' }, { status: 400 })
    }

    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'Lütfen geçerli bir SQLite (.db) veritabanı dosyası yükleyin.' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')

    // Geri yükleme öncesinde mevcut veritabanının yedeğini al (güvenlik için)
    const tempBackupPath = path.join(process.cwd(), 'prisma', `dev.db.bak.${Date.now()}`)
    if (fs.existsSync(dbPath)) {
      try {
        fs.copyFileSync(dbPath, tempBackupPath)
      } catch (err) {
        console.error('Kurtarma öncesi yedekleme kopyalama hatası:', err)
      }
    }

    // Yeni veriyi diske yaz (mevcut db üzerine yazar)
    fs.writeFileSync(dbPath, buffer)

    return NextResponse.json({ success: true, message: 'Veritabanı başarıyla geri yüklendi.' })
  } catch (error) {
    console.error('Yedek Geri Yükleme Hatası:', error)
    return NextResponse.json({ error: 'Yedek geri yüklenirken hata oluştu: ' + error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/session'
import crypto from 'crypto'

// Basit in-memory IP tabanlı rate limiter
const loginAttempts = new Map()

function isRateLimited(ip) {
  // Localhost ve yerel ağ aramalarında rate limit devre dışı kalsın veya yüksek tutulsun
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) return false

  const now = Date.now()
  const windowMs = 60 * 1000 // 1 dakika
  const maxAttempts = 15

  const record = loginAttempts.get(ip)
  if (!record) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  if (now > record.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + windowMs })
    return false
  }

  record.count += 1
  if (record.count > maxAttempts) {
    return true
  }
  return false
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1'
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Çok fazla başarısız giriş denemesi. Lütfen 1 dakika sonra tekrar deneyin.' }, { status: 429 })
    }

    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Kullanıcı adı ve şifre zorunludur.' }, { status: 400 })
    }

    // iOS/Safari NFD uyumluluğu için NFC normalizasyonu yap
    const normalizedUsername = username.trim().toLowerCase().normalize('NFC')

    // 1. Veritabanındaki kullanıcı sayısını kontrol et
    const userCount = await prisma.user.count()

    // 2. Eğer kullanıcı yoksa, ilk admin kullanıcısını otomatik oluştur (Auto-seeding)
    if (userCount === 0) {
      console.log('Veritabanında hiç kullanıcı bulunamadı. Varsayılan admin hesabı oluşturuluyor...')
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashPassword('4366'),
          role: 'admin',
          displayName: 'Furkan Uçkun'
        }
      })
    }

    // 3. Kullanıcıyı ara
    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername }
    })

    if (!user) {
      return NextResponse.json({ error: 'Geçersiz kullanıcı adı veya şifre.' }, { status: 401 })
    }

    // 4. Şifreyi doğrula (SHA-256)
    const inputHashed = hashPassword(password)
    if (user.password !== inputHashed) {
      return NextResponse.json({ error: 'Geçersiz kullanıcı adı veya şifre.' }, { status: 401 })
    }

    // 5. Oturum verisini oluştur ve şifreli token haline getir
    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 gün geçerli
    }
    const token = await encrypt(sessionData)

    // Giriş başarılı, kullanıcı bilgilerini ve tokenı dön (iOS PWA httpOnly cookie aşımı için)
    const response = NextResponse.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        displayName: user.displayName || user.username
      }
    })

    response.cookies.set('session_token', token, {
      httpOnly: true,
      secure: false, // HTTP'de de çalışsın (dev + local network)
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 gün (saniye cinsinden)
      path: '/'
    })

    // Başarılı girişte IP denemesini temizle/azalt
    loginAttempts.delete(ip)

    return response
  } catch (error) {
    console.error('Login API Hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


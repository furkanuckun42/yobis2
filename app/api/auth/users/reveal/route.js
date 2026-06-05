import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { decryptPassword, verifyPassword } from '@/lib/auth'

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    const requesterRole = request.headers.get('x-requester-role')

    if (requesterRole !== 'admin' || !requesterId) {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const { targetUserId, adminPassword } = await request.json()

    if (!targetUserId || !adminPassword) {
      return NextResponse.json({ error: 'Eksik parametreler.' }, { status: 400 })
    }

    // 1. İsteği yapan admini doğrula
    const adminUser = await prisma.user.findUnique({
      where: { id: requesterId }
    })

    if (!adminUser) {
      return NextResponse.json({ error: 'Yönetici hesabı bulunamadı.' }, { status: 404 })
    }

    // Admin şifresini doğrula
    const isPasswordCorrect = verifyPassword(adminPassword, adminUser.password)
    if (!isPasswordCorrect) {
      return NextResponse.json({ error: 'Yönetici şifresi hatalı.' }, { status: 401 })
    }

    // 2. Hedef kullanıcının şifresini çöz
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Hedef kullanıcı bulunamadı.' }, { status: 404 })
    }

    const decrypted = decryptPassword(targetUser.password)
    if (decrypted === null) {
      return NextResponse.json({
        success: false,
        message: 'Eski şifre formatı (SHA-256). Bu şifre güvenlik nedeniyle çözülemez. Ancak yeni bir şifre belirleyebilirsiniz.'
      })
    }

    return NextResponse.json({
      success: true,
      password: decrypted
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

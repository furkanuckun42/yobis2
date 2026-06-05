import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, encryptPassword } from '@/lib/auth'

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')

    if (!requesterId) {
      return NextResponse.json({ error: 'Oturum geçersiz. Lütfen tekrar giriş yapın.' }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Mevcut şifre ve yeni şifre zorunludur.' }, { status: 400 })
    }

    if (newPassword.length < 4) {
      return NextResponse.json({ error: 'Yeni şifre en az 4 karakter olmalıdır.' }, { status: 400 })
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: 'Yeni şifre mevcut şifreyle aynı olamaz.' }, { status: 400 })
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: requesterId }
    })

    if (!user) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
    }

    // Mevcut şifreyi doğrula
    const isPasswordCorrect = verifyPassword(currentPassword, user.password)
    if (!isPasswordCorrect) {
      return NextResponse.json({ error: 'Mevcut şifreniz hatalı.' }, { status: 403 })
    }

    // Yeni şifreyi şifrele ve güncelle
    const newEncrypted = encryptPassword(newPassword)
    await prisma.user.update({
      where: { id: requesterId },
      data: { password: newEncrypted }
    })

    return NextResponse.json({ success: true, message: 'Şifreniz başarıyla değiştirildi.' })
  } catch (error) {
    console.error('Şifre değiştirme hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

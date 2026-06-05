import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encryptPassword } from '@/lib/auth'

// 1. Kullanıcı Listesi
export async function GET(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    
    // Güvenlik kontrolü: Giriş yapmış herhangi bir kullanıcı listeleyebilir (görevler için)
    if (!requesterId) {
      return NextResponse.json({ error: 'Lütfen giriş yapın.' }, { status: 401 })
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true
      },
      orderBy: { username: 'asc' }
    })

    return NextResponse.json(users)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 2. Yeni Kullanıcı Ekleme
export async function POST(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const { username, password, role, displayName } = await request.json()

    if (!username || !password || !role) {
      return NextResponse.json({ error: 'Kullanıcı adı, şifre ve rol alanları zorunludur.' }, { status: 400 })
    }

    const cleanUsername = username.trim().toLowerCase()

    // Kullanıcı adı benzersiz olmalı
    const existingUser = await prisma.user.findUnique({
      where: { username: cleanUsername }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'Bu kullanıcı adı zaten alınmış.' }, { status: 400 })
    }

    // Yeni kullanıcıyı kaydet
    const newUser = await prisma.user.create({
      data: {
        username: cleanUsername,
        password: encryptPassword(password),
        role: role,
        displayName: displayName?.trim() || null
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true
      }
    })

    return NextResponse.json(newUser)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 3. Kullanıcı Silme
export async function DELETE(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    const requesterId = request.headers.get('x-requester-id')
    
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('id')

    if (!targetUserId) {
      return NextResponse.json({ error: 'Silinecek kullanıcı ID bilgisi verilmedi.' }, { status: 400 })
    }

    // Kendini silmeyi engelle
    if (targetUserId === requesterId) {
      return NextResponse.json({ error: 'Kendi hesabınızı silemezsiniz.' }, { status: 400 })
    }

    // En az bir admin kalmalı kontrolü
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (targetUser && targetUser.role === 'admin') {
      const adminCount = await prisma.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Sistemde en az bir yönetici (admin) bulunmalıdır.' }, { status: 400 })
      }
    }

    await prisma.user.delete({
      where: { id: targetUserId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// 4. Kullanıcı Güncelleme
export async function PUT(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlem için yetkiniz yok.' }, { status: 403 })
    }

    const { id, username, password, role, displayName } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Kullanıcı ID bilgisi zorunludur.' }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'Kullanıcı bulunamadı.' }, { status: 404 })
    }

    const updateData = {}
    if (username !== undefined) {
      const cleanUsername = username.trim().toLowerCase()
      // Kullanıcı adı değiştiyse çakışmayı kontrol et
      if (cleanUsername !== existingUser.username) {
        const usernameCheck = await prisma.user.findUnique({ where: { username: cleanUsername } })
        if (usernameCheck) {
          return NextResponse.json({ error: 'Bu kullanıcı adı zaten alınmış.' }, { status: 400 })
        }
        updateData.username = cleanUsername
      }
    }

    if (password !== undefined && password.trim() !== '') {
      updateData.password = encryptPassword(password.trim())
    }

    if (role !== undefined) {
      updateData.role = role
    }

    if (displayName !== undefined) {
      updateData.displayName = displayName.trim() || null
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { name: 'asc' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, role: true }
        }
      }
    })
    return NextResponse.json(employees)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlemi sadece yöneticiler yapabilir.' }, { status: 403 })
    }

    const data = await request.json()
    const { name, userId, fullDayRate, halfDayRate, iban, notes } = data

    if (!name) {
      return NextResponse.json({ error: 'Çalışan adı zorunludur.' }, { status: 400 })
    }

    // Eşleştirilmek istenen userId boşluk durumuna göre kontrol et
    const actualUserId = userId && userId !== '' ? userId : null

    const employee = await prisma.employee.create({
      data: {
        name,
        userId: actualUserId,
        fullDayRate: parseFloat(fullDayRate || 0),
        halfDayRate: parseFloat(halfDayRate || 0),
        iban: iban && iban.trim() !== '' ? iban.trim().toUpperCase() : null,
        notes: notes && notes.trim() !== '' ? notes.trim() : null,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, role: true }
        }
      }
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('INSERT', 'Employee', employee.id, employee, requesterUsername)
    return NextResponse.json(employee)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlemi sadece yöneticiler yapabilir.' }, { status: 403 })
    }

    const data = await request.json()
    const { id, name, userId, fullDayRate, halfDayRate, iban, notes } = data

    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur.' }, { status: 400 })
    }

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Çalışan bulunamadı.' }, { status: 404 })
    }

    const actualUserId = userId && userId !== '' ? userId : null

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        userId: userId !== undefined ? actualUserId : existing.userId,
        fullDayRate: fullDayRate !== undefined ? parseFloat(fullDayRate || 0) : existing.fullDayRate,
        halfDayRate: halfDayRate !== undefined ? parseFloat(halfDayRate || 0) : existing.halfDayRate,
        iban: iban !== undefined ? (iban && iban.trim() !== '' ? iban.trim().toUpperCase() : null) : existing.iban,
        notes: notes !== undefined ? (notes && notes.trim() !== '' ? notes.trim() : null) : existing.notes,
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, role: true }
        }
      }
    })

    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('UPDATE', 'Employee', id, existing, requesterUsername)
    return NextResponse.json(employee)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const requesterRole = request.headers.get('x-requester-role')
    if (requesterRole !== 'admin') {
      return NextResponse.json({ error: 'Bu işlemi sadece yöneticiler yapabilir.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur.' }, { status: 400 })
    }

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Çalışan bulunamadı.' }, { status: 404 })
    }

    await prisma.employee.delete({ where: { id } })
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('DELETE', 'Employee', id, existing, requesterUsername)

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logAction } from '@/lib/logger'

export async function GET() {
  try {
    const items = await prisma.equipment.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const data = await request.json()
    const { name, status } = data
    
    if (!name || !status) {
      return NextResponse.json({ error: 'Eksik alanlar var' }, { status: 400 })
    }

    const item = await prisma.equipment.create({
      data: {
        name,
        status, // "OFIS", "SET", "BAKIM"
      }
    })
    
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('INSERT', 'Equipment', item.id, item, requesterUsername)
    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const data = await request.json()
    const { id, name, status } = data
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }

    const existing = await prisma.equipment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ekipman bulunamadı' }, { status: 404 })
    }

    const updateData = {
      name: name !== undefined ? name : existing.name,
      status: status !== undefined ? status : existing.status,
    }

    const item = await prisma.equipment.update({
      where: { id },
      data: updateData
    })
    
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('UPDATE', 'Equipment', id, existing, requesterUsername)
    return NextResponse.json(item)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID parametresi zorunludur' }, { status: 400 })
    }
    
    const existing = await prisma.equipment.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Ekipman bulunamadı' }, { status: 404 })
    }
    
    await prisma.equipment.delete({ where: { id } })
    const requesterUsername = request.headers.get('x-requester-username') || 'Sistem'
    await logAction('DELETE', 'Equipment', id, existing, requesterUsername)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

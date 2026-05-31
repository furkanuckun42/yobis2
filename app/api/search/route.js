import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''

    if (query.length < 2) {
      return NextResponse.json({ customers: [], projects: [], caris: [], tasks: [] })
    }

    const [customers, projects, caris, tasks] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
            { instagram: { contains: query } },
            { notes: { contains: query } }
          ]
        },
        take: 5
      }),
      prisma.project.findMany({
        where: {
          name: { contains: query }
        },
        include: { customer: true },
        take: 5
      }),
      prisma.cari.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { phone: { contains: query } },
            { notes: { contains: query } }
          ]
        },
        take: 5
      }),
      prisma.task.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { description: { contains: query } }
          ]
        },
        include: { project: true },
        take: 5
      })
    ])

    return NextResponse.json({
      customers,
      projects,
      caris,
      tasks
    })
  } catch (error) {
    console.error('Arama API hatası:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

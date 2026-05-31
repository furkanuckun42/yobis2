import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Proje ID zorunludur.' }, { status: 400 })
    }

    const comments = await prisma.projectComment.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            username: true,
            displayName: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json(comments)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const requesterId = request.headers.get('x-requester-id')
    
    if (!requesterId) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 })
    }

    const { projectId, text } = await request.json()

    if (!projectId || !text?.trim()) {
      return NextResponse.json({ error: 'Proje ve yorum metni zorunludur.' }, { status: 400 })
    }

    const comment = await prisma.projectComment.create({
      data: {
        projectId,
        userId: requesterId,
        text: text.trim()
      },
      include: {
        user: {
          select: {
            username: true,
            displayName: true,
            role: true
          }
        }
      }
    })

    return NextResponse.json(comment)
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

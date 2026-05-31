import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const config = await prisma.googleConfig.findUnique({
      where: { id: 'main' }
    })
    
    return NextResponse.json({
      exists: !!config,
      clientId: config?.clientId || '',
      hasTokens: !!(config?.accessToken && config?.refreshToken)
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { clientId, clientSecret } = await request.json()
    
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID ve Client Secret alanları zorunludur.' }, { status: 400 })
    }

    // SQLite veritabanına tekil (singleton) GoogleConfig kaydını ekle veya güncelle (upsert)
    const config = await prisma.googleConfig.upsert({
      where: { id: 'main' },
      update: {
        clientId,
        clientSecret,
        // Config güncellenirse eski tokenleri temizleyelim ki yetkilendirme baştan yapılsın
        accessToken: null,
        refreshToken: null,
        expiryDate: null
      },
      create: {
        id: 'main',
        clientId,
        clientSecret
      }
    })

    return NextResponse.json({ success: true, clientId: config.clientId })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

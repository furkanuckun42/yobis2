import { NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // Sadece API rotalarını koru (login ve cron hariç)
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth/login') && !pathname.startsWith('/api/cron')) {
    let sessionToken = request.cookies.get('session_token')?.value

    // Fallback: iOS PWA / HTTP cookie engeli durumunda Authorization headerını kontrol et
    if (!sessionToken) {
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        sessionToken = authHeader.substring(7)
      }
    }

    // Güvenlik için istemciden gelen potansiyel sahte header'ları temizle
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-requester-id')
    requestHeaders.delete('x-requester-role')
    requestHeaders.delete('x-requester-username')

    if (!sessionToken) {
      return NextResponse.json({ error: 'Oturum sonlandırıldı veya geçersiz. Lütfen tekrar giriş yapın.' }, { status: 401 })
    }

    const payload = await decrypt(sessionToken)
    if (!payload) {
      // Geçersiz veya süresi geçmiş cookie durumunda temizle
      const response = NextResponse.json({ error: 'Oturumunuzun süresi dolmuş. Lütfen tekrar giriş yapın.' }, { status: 401 })
      response.cookies.set('session_token', '', { maxAge: -1, path: '/' })
      return response
    }

    // Sunucu tarafında doğrulanmış bilgileri header olarak alt API'lere ilet
    requestHeaders.set('x-requester-id', payload.userId)
    requestHeaders.set('x-requester-role', payload.role)
    requestHeaders.set('x-requester-username', payload.username || '')

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}

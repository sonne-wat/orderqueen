import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // 비로그인 → /login 리다이렉트
  if (!session) {
    if (pathname.startsWith('/dashboard') ||
        pathname.startsWith('/orders') ||
        pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  const role = session.user?.role

  // DISTRIBUTOR가 /admin 접근 시 차단
  if (pathname.startsWith('/admin') && role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  // ADMIN이 distributor 전용 페이지 접근 시 admin으로 리다이렉트
  if ((pathname === '/dashboard' || pathname.startsWith('/orders')) && role === 'ADMIN') {
    return NextResponse.redirect(new URL('/admin/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/orders/:path*', '/admin/:path*'],
}

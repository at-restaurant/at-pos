// src/middleware.ts
// ✅ SINGLE SOURCE OF TRUTH: Protects admin routes at edge

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Only protect /admin routes (except login)
    if (!pathname.startsWith('/admin')) {
        return NextResponse.next()
    }

    // Allow login page without auth
    if (pathname === '/admin/login') {
        return NextResponse.next()
    }

    // Check session from cookie (server-side check)
    const adminAuth = request.cookies.get('admin_auth')?.value
    const authTime = request.cookies.get('admin_auth_time')?.value

    // No session → redirect to login
    if (!adminAuth || adminAuth !== 'true') {
        return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Session expired (8 hours)
    if (authTime) {
        const elapsed = Date.now() - parseInt(authTime)
        const SESSION_DURATION = 8 * 60 * 60 * 1000

        if (elapsed > SESSION_DURATION) {
            const response = NextResponse.redirect(new URL('/admin/login', request.url))
            response.cookies.delete('admin_auth')
            response.cookies.delete('admin_auth_time')
            return response
        }
    }

    // Valid session → allow access
    return NextResponse.next()
}

// Only run on /admin routes
export const config = {
    matcher: '/admin/:path*'
}
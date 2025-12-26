// src/app/admin/layout.tsx - FIXED LAYOUT
"use client"

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAdminAuth } from '@/lib/hooks/useAdminAuth'
import { Shield, Loader2 } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const { isAuthenticated, loading } = useAdminAuth()

    const isLoginPage = pathname === '/admin/login'

    // ✅ ALWAYS REDIRECT TO LOGIN IF NOT AUTHENTICATED
    useEffect(() => {
        if (!loading && !isAuthenticated && !isLoginPage) {
            router.push('/admin/login')
        }
    }, [loading, isAuthenticated, isLoginPage, pathname])

    // Show loading only for protected pages
    if (loading && !isLoginPage) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-[var(--muted)]">Loading admin panel...</p>
                </div>
            </div>
        )
    }

    // Allow login page without auth
    if (!isAuthenticated && !isLoginPage) {
        return null
    }

    return <div className="min-h-screen bg-[var(--bg)]">{children}</div>
}
// src/lib/hooks/useAdminAuth.ts
// ✅ FIXED: Uses cookies (server-side compatible)

"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

type AdminProfile = {
    name: string
    bio?: string
    profile_pic?: string
}

type LoginResult = {
    success: boolean
    error?: string
}

const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours

// ✅ Cookie helpers (works with middleware)
function setCookie(name: string, value: string, hours: number = 8) {
    const expires = new Date(Date.now() + hours * 60 * 60 * 1000).toUTCString()
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
}

export function useAdminAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<AdminProfile | null>(null)
    const router = useRouter()
    const pathname = usePathname()

    // ✅ Check auth on mount
    const checkAuth = useCallback(() => {
        const isLoginPage = pathname === '/admin/login'

        const authCookie = getCookie('admin_auth')
        const timeCookie = getCookie('admin_auth_time')

        if (authCookie === 'true' && timeCookie) {
            const elapsed = Date.now() - parseInt(timeCookie)

            if (elapsed < SESSION_DURATION) {
                // Valid session
                const storedProfile = sessionStorage.getItem('admin_profile')
                if (storedProfile) {
                    try {
                        setProfile(JSON.parse(storedProfile))
                    } catch (e) {
                        console.error('Profile parse error:', e)
                    }
                }
                setIsAuthenticated(true)
                setLoading(false)
                return
            }
        }

        // Session invalid/expired
        setIsAuthenticated(false)
        setLoading(false)

        // Clear expired cookies
        deleteCookie('admin_auth')
        deleteCookie('admin_auth_time')
        sessionStorage.removeItem('admin_profile')
    }, [pathname])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    // ✅ Login with cookie support
    const login = async (password: string): Promise<LoginResult> => {
        try {
            if (!navigator.onLine) {
                return {
                    success: false,
                    error: '🌐 No internet connection. Please connect to login.'
                }
            }

            const res = await fetch('/api/auth/verify-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })

            if (!res.ok) {
                const data = await res.json()
                return {
                    success: false,
                    error: data.error || 'Invalid password'
                }
            }

            const data = await res.json()

            // ✅ Set cookies (server-side readable)
            setCookie('admin_auth', 'true', 8)
            setCookie('admin_auth_time', Date.now().toString(), 8)

            // ✅ Set profile in sessionStorage (client-side only)
            if (data.profile) {
                sessionStorage.setItem('admin_profile', JSON.stringify(data.profile))
                setProfile(data.profile)
            }

            setIsAuthenticated(true)
            return { success: true }

        } catch (error: any) {
            console.error('Login error:', error)
            return {
                success: false,
                error: '❌ Network error. Please try again.'
            }
        }
    }

    const updateProfile = (newProfile: AdminProfile) => {
        setProfile(newProfile)
        sessionStorage.setItem('admin_profile', JSON.stringify(newProfile))
    }

    const logout = () => {
        deleteCookie('admin_auth')
        deleteCookie('admin_auth_time')
        sessionStorage.removeItem('admin_profile')
        setIsAuthenticated(false)
        setProfile(null)
        router.push('/admin/login')
    }

    return {
        isAuthenticated,
        loading,
        profile,
        login,
        logout,
        updateProfile
    }
}
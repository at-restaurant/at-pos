// src/lib/hooks/useAdminAuth.ts
// ✅ FIXED: Online-only, no offline logic, single login flow

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

export function useAdminAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<AdminProfile | null>(null)
    const router = useRouter()
    const pathname = usePathname()

    // ✅ Check session validity
    const checkAuth = useCallback(() => {
        const isLoginPage = pathname === '/admin/login'

        const sessionAuth = sessionStorage.getItem('admin_auth')
        const sessionTime = sessionStorage.getItem('admin_auth_time')

        if (sessionAuth === 'true' && sessionTime) {
            const elapsed = Date.now() - parseInt(sessionTime)

            if (elapsed < SESSION_DURATION) {
                // Valid session - load profile
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

        // Clear expired session
        sessionStorage.removeItem('admin_auth')
        sessionStorage.removeItem('admin_auth_time')
        sessionStorage.removeItem('admin_profile')

        // Redirect to login if not already there
        if (!isLoginPage && pathname.startsWith('/admin')) {
            router.push('/admin/login')
        }
    }, [pathname, router])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    // ✅ FIXED: Single online-only login flow
    const login = async (password: string): Promise<LoginResult> => {
        try {
            // Check internet connection
            if (!navigator.onLine) {
                return {
                    success: false,
                    error: '🌐 No internet connection. Please connect to the internet to login.'
                }
            }

            // Verify with server
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

            // Setup session
            sessionStorage.setItem('admin_auth', 'true')
            sessionStorage.setItem('admin_auth_time', Date.now().toString())

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
                error: '❌ Network error. Please check your internet connection and try again.'
            }
        }
    }

    const updateProfile = (newProfile: AdminProfile) => {
        setProfile(newProfile)
        sessionStorage.setItem('admin_profile', JSON.stringify(newProfile))
    }

    const logout = () => {
        sessionStorage.removeItem('admin_auth')
        sessionStorage.removeItem('admin_auth_time')
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
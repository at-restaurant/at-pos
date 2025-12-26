// src/lib/hooks/useAdminAuth.ts - IMPROVED LOGIN SYSTEM
"use client"
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import bcrypt from 'bcryptjs'

type AdminProfile = {
    name: string
    bio?: string
    profile_pic?: string
}

export function useAdminAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<AdminProfile | null>(null)
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        checkAuth()
    }, [pathname])

    const checkAuth = () => {
        const isLoginPage = pathname === '/admin/login'

        // ✅ Check session (expires after 8 hours)
        const sessionAuth = sessionStorage.getItem('admin_auth') === 'true'
        const sessionTime = parseInt(sessionStorage.getItem('admin_auth_time') || '0')
        const now = Date.now()
        const isSessionValid = sessionAuth && (now - sessionTime < 8 * 60 * 60 * 1000)

        // Load profile
        const storedProfile = localStorage.getItem('admin_profile')
        if (storedProfile) {
            setProfile(JSON.parse(storedProfile))
        }

        setIsAuthenticated(isSessionValid)
        setLoading(false)

        // ✅ ALWAYS REDIRECT TO LOGIN IF NOT AUTHENTICATED
        if (!isSessionValid && !isLoginPage && pathname.startsWith('/admin')) {
            sessionStorage.removeItem('admin_auth')
            sessionStorage.removeItem('admin_auth_time')
            router.push('/admin/login')
        }
    }

    const login = async (password: string) => {
        setLoading(true)

        try {
            if (navigator.onLine) {
                // ✅ Online verification
                const res = await fetch('/api/auth/verify-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                })

                if (res.ok) {
                    const data = await res.json()

                    // Store session
                    sessionStorage.setItem('admin_auth', 'true')
                    sessionStorage.setItem('admin_auth_time', Date.now().toString())

                    // Store profile
                    if (data.profile) {
                        localStorage.setItem('admin_profile', JSON.stringify(data.profile))
                        setProfile(data.profile)
                    }

                    // ✅ Cache password hash for offline use
                    const hashed = await bcrypt.hash(password, 10)
                    localStorage.setItem('admin_pwd_hash', hashed)
                    localStorage.setItem('admin_offline_enabled', 'true')

                    setIsAuthenticated(true)
                    return { success: true }
                }

                const data = await res.json()
                return { success: false, error: data.error || 'Invalid password' }
            } else {
                // ✅ Offline verification
                const offlineEnabled = localStorage.getItem('admin_offline_enabled') === 'true'

                if (!offlineEnabled) {
                    return {
                        success: false,
                        error: '🔒 Please login online once to enable offline access'
                    }
                }

                const storedHash = localStorage.getItem('admin_pwd_hash')
                if (!storedHash) {
                    return {
                        success: false,
                        error: '🔒 No offline credentials. Login online first.'
                    }
                }

                // Verify password offline
                const isValid = await bcrypt.compare(password, storedHash)

                if (isValid) {
                    sessionStorage.setItem('admin_auth', 'true')
                    sessionStorage.setItem('admin_auth_time', Date.now().toString())

                    const storedProfile = localStorage.getItem('admin_profile')
                    if (storedProfile) setProfile(JSON.parse(storedProfile))

                    setIsAuthenticated(true)
                    return { success: true }
                }

                return { success: false, error: 'Invalid password' }
            }
        } catch (error) {
            // Network error - try offline
            const offlineEnabled = localStorage.getItem('admin_offline_enabled') === 'true'

            if (!offlineEnabled) {
                return {
                    success: false,
                    error: '🔒 Login online once to enable offline access'
                }
            }

            const storedHash = localStorage.getItem('admin_pwd_hash')
            if (storedHash) {
                const isValid = await bcrypt.compare(password, storedHash)
                if (isValid) {
                    sessionStorage.setItem('admin_auth', 'true')
                    sessionStorage.setItem('admin_auth_time', Date.now().toString())

                    const storedProfile = localStorage.getItem('admin_profile')
                    if (storedProfile) setProfile(JSON.parse(storedProfile))

                    setIsAuthenticated(true)
                    return { success: true }
                }
            }

            return {
                success: false,
                error: '❌ Network error. Login online first to enable offline access.'
            }
        } finally {
            setLoading(false)
        }
    }

    const updateProfile = (newProfile: AdminProfile) => {
        setProfile(newProfile)
        localStorage.setItem('admin_profile', JSON.stringify(newProfile))
    }

    const logout = () => {
        sessionStorage.removeItem('admin_auth')
        sessionStorage.removeItem('admin_auth_time')
        setIsAuthenticated(false)
        setProfile(null)
        router.push('/admin/login')
    }

    return { isAuthenticated, loading, profile, login, logout, updateProfile }
}



// src/lib/hooks/useAdminAuth.ts - FIXED: Single verification only
"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import bcrypt from 'bcryptjs'

type AdminProfile = {
    name: string
    bio?: string
    profile_pic?: string
}

type LoginResult = {
    success: boolean
    error?: string
}

const SESSION_DURATION = 5 * 60 * 1000 // 5 minutes

export function useAdminAuth() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<AdminProfile | null>(null)
    const router = useRouter()
    const pathname = usePathname()

    // ✅ Memoized checkAuth to prevent unnecessary re-runs
    const checkAuth = useCallback(() => {
        const isLoginPage = pathname === '/admin/login'

        // Check session validity
        const sessionAuth = sessionStorage.getItem('admin_auth')
        const sessionTime = sessionStorage.getItem('admin_auth_time')

        if (sessionAuth === 'true' && sessionTime) {
            const elapsed = Date.now() - parseInt(sessionTime)

            if (elapsed < SESSION_DURATION) {
                // Valid session - load profile
                const storedProfile = localStorage.getItem('admin_profile')
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

        // Redirect to login if not already there
        if (!isLoginPage && pathname.startsWith('/admin')) {
            sessionStorage.removeItem('admin_auth')
            sessionStorage.removeItem('admin_auth_time')
            router.push('/admin/login')
        }
    }, [pathname, router])

    useEffect(() => {
        checkAuth()
    }, [checkAuth])

    // ✅ MAIN FIX: Single verification flow
    const login = async (password: string): Promise<LoginResult> => {
        try {
            // Try online verification first
            if (navigator.onLine) {
                const onlineResult = await verifyOnline(password)
                if (onlineResult.success) {
                    return setupSession(onlineResult.profile ?? null)
                }
                // Online failed - only try offline as fallback if network error
                if (onlineResult.networkError) {
                    const offlineResult = await verifyOffline(password)
                    if (offlineResult.success) {
                        return setupSession(null)
                    }
                    return offlineResult
                }
                return onlineResult
            } else {
                // Offline mode - direct verification
                const offlineResult = await verifyOffline(password)
                if (offlineResult.success) {
                    return setupSession(null)
                }
                return offlineResult
            }
        } catch (error: any) {
            console.error('Login error:', error)
            return { success: false, error: 'Login failed. Please try again.' }
        }
    }

    // ✅ Online verification
    const verifyOnline = async (password: string): Promise<LoginResult & { profile?: AdminProfile, networkError?: boolean }> => {
        try {
            const res = await fetch('/api/auth/verify-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            })

            if (res.ok) {
                const data = await res.json()

                // Cache password hash for offline use
                const hashed = await bcrypt.hash(password, 10)
                localStorage.setItem('admin_pwd_hash', hashed)
                localStorage.setItem('admin_offline_enabled', 'true')

                return {
                    success: true,
                    profile: data.profile,
                    networkError: false
                }
            } else {
                const data = await res.json()
                return {
                    success: false,
                    error: data.error || 'Invalid password',
                    networkError: false
                }
            }
        } catch (error) {
            // Network error - allow offline fallback
            return {
                success: false,
                error: 'Network error',
                networkError: true
            }
        }
    }

    // ✅ Offline verification
    const verifyOffline = async (password: string): Promise<LoginResult> => {
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
                error: '🔒 No offline credentials found'
            }
        }

        const isValid = await bcrypt.compare(password, storedHash)

        if (!isValid) {
            return { success: false, error: 'Invalid password' }
        }

        return { success: true }
    }

    // ✅ Setup session after successful login
    const setupSession = (profileData: AdminProfile | null): LoginResult => {
        sessionStorage.setItem('admin_auth', 'true')
        sessionStorage.setItem('admin_auth_time', Date.now().toString())

        if (profileData) {
            localStorage.setItem('admin_profile', JSON.stringify(profileData))
            setProfile(profileData)
        } else {
            // Load cached profile
            const storedProfile = localStorage.getItem('admin_profile')
            if (storedProfile) {
                try {
                    setProfile(JSON.parse(storedProfile))
                } catch (e) {
                    console.error('Profile parse error:', e)
                }
            }
        }

        setIsAuthenticated(true)
        return { success: true }
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

    return {
        isAuthenticated,
        loading,
        profile,
        login,
        logout,
        updateProfile
    }
}
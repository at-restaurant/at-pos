// src/lib/hooks/useAdminAuth.ts - FIXED: Single verification
"use client"

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import bcrypt from 'bcryptjs'

type AdminProfile = {
    name: string
    bio?: string
    profile_pic?: string
}

const SESSION_DURATION = 5 * 60 * 1000 // 5 minutes

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

        // ✅ Check session validity
        const sessionAuth = sessionStorage.getItem('admin_auth')
        const sessionTime = sessionStorage.getItem('admin_auth_time')

        if (sessionAuth === 'true' && sessionTime) {
            const elapsed = Date.now() - parseInt(sessionTime)

            if (elapsed < SESSION_DURATION) {
                // ✅ Valid session - load profile
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

        // ✅ Session invalid/expired
        setIsAuthenticated(false)
        setLoading(false)

        // Redirect to login if not already there
        if (!isLoginPage && pathname.startsWith('/admin')) {
            sessionStorage.removeItem('admin_auth')
            sessionStorage.removeItem('admin_auth_time')
            router.push('/admin/login')
        }
    }

    const login = async (password: string) => {
        try {
            let isValid = false
            let profileData: AdminProfile | null = null

            // ✅ FIX: Try online first, THEN offline (not both)
            if (navigator.onLine) {
                try {
                    console.log('🔐 Attempting online verification...')

                    const res = await fetch('/api/auth/verify-admin', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    })

                    if (res.ok) {
                        const data = await res.json()
                        console.log('✅ Online verification successful')

                        isValid = true
                        profileData = data.profile

                        // ✅ Cache password hash for offline use
                        const hashed = await bcrypt.hash(password, 10)
                        localStorage.setItem('admin_pwd_hash', hashed)
                        localStorage.setItem('admin_offline_enabled', 'true')
                    } else {
                        const data = await res.json()
                        console.log('❌ Online verification failed:', data.error)
                        return { success: false, error: data.error || 'Invalid password' }
                    }
                } catch (networkError) {
                    console.log('📴 Network error, trying offline verification...')

                    // ✅ FIX: Only try offline if online failed
                    const offlineResult = await verifyOffline(password)
                    if (!offlineResult.success) {
                        return offlineResult
                    }
                    isValid = true
                }
            } else {
                // ✅ Offline mode - direct verification
                console.log('📴 Offline mode - using cached credentials')
                const offlineResult = await verifyOffline(password)
                if (!offlineResult.success) {
                    return offlineResult
                }
                isValid = true
            }

            // ✅ Login successful
            if (isValid) {
                console.log('✅ Login successful - setting session')

                sessionStorage.setItem('admin_auth', 'true')
                sessionStorage.setItem('admin_auth_time', Date.now().toString())

                if (profileData) {
                    localStorage.setItem('admin_profile', JSON.stringify(profileData))
                    setProfile(profileData)
                } else {
                    // Load cached profile
                    const storedProfile = localStorage.getItem('admin_profile')
                    if (storedProfile) {
                        setProfile(JSON.parse(storedProfile))
                    }
                }

                setIsAuthenticated(true)
                return { success: true }
            }

            return { success: false, error: 'Authentication failed' }
        } catch (error: any) {
            console.error('Login error:', error)
            return { success: false, error: 'Login failed. Please try again.' }
        }
    }

    const verifyOffline = async (password: string) => {
        const offlineEnabled = localStorage.getItem('admin_offline_enabled') === 'true'

        if (!offlineEnabled) {
            console.log('❌ Offline mode not enabled')
            return {
                success: false,
                error: '🔒 Please login online once to enable offline access'
            }
        }

        const storedHash = localStorage.getItem('admin_pwd_hash')
        if (!storedHash) {
            console.log('❌ No cached credentials found')
            return {
                success: false,
                error: '🔒 No offline credentials found'
            }
        }

        console.log('🔐 Verifying offline credentials...')
        const isValid = await bcrypt.compare(password, storedHash)

        if (!isValid) {
            console.log('❌ Offline password mismatch')
            return { success: false, error: 'Invalid password' }
        }

        console.log('✅ Offline verification successful')
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
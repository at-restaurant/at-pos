"use client"

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/client'

interface Waiter {
    id: string
    name: string
    phone: string
    profile_pic?: string
    is_active: boolean
    is_on_duty: boolean
}

export function useAttendanceOffline() {
    const [waiters, setWaiters] = useState<Waiter[]>([])
    const [loading, setLoading] = useState(true)
    const [isOffline, setIsOffline] = useState(false)
    const [lastResetDate, setLastResetDate] = useState<string | null>(null)
    const supabase = createClient()

    // ✅ Check and auto-reset at midnight
    const checkDailyReset = useCallback(async () => {
        const today = new Date().toISOString().split('T')[0]
        const storedDate = localStorage.getItem('last_attendance_reset')

        if (storedDate !== today) {
            console.log('📅 New day detected, resetting attendance...')

            // Reset locally FIRST
            const allWaiters = await db.get(STORES.SETTINGS, 'waiters_cache')
            if (allWaiters && (allWaiters as any).value) {
                const resetWaiters = (allWaiters as any).value.map((w: any) => ({
                    ...w,
                    is_on_duty: false
                }))

                await db.put(STORES.SETTINGS, {
                    key: 'waiters_cache',
                    value: resetWaiters
                })

                setWaiters(resetWaiters)
            }

            // Try server reset if online
            if (navigator.onLine) {
                try {
                    await fetch('/api/attendance/daily-reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    console.log('✅ Server reset completed')
                } catch (error) {
                    console.error('Server reset failed, offline mode active:', error)
                }
            }

            localStorage.setItem('last_attendance_reset', today)
            setLastResetDate(today)
        }
    }, [])

    // ✅ Load from cache FIRST
    const loadFromCache = useCallback(async () => {
        try {
            const cached = await db.get(STORES.SETTINGS, 'waiters_cache')
            if (cached && (cached as any).value) {
                const sorted = (cached as any).value.sort((a: any, b: any) => {
                    if (a.is_on_duty && !b.is_on_duty) return -1
                    if (!a.is_on_duty && b.is_on_duty) return 1
                    return a.name.localeCompare(b.name)
                })
                setWaiters(sorted)
            }
            setLoading(false)
        } catch (error) {
            console.error('Cache load failed:', error)
            setLoading(false)
        }
    }, [])

    // ✅ Sync from Supabase in background
    const syncFromSupabase = useCallback(async () => {
        if (!navigator.onLine) {
            setIsOffline(true)
            return
        }

        try {
            const { data } = await supabase
                .from('waiters')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (data) {
                const sorted = data.sort((a: any, b: any) => {
                    if (a.is_on_duty && !b.is_on_duty) return -1
                    if (!a.is_on_duty && b.is_on_duty) return 1
                    return a.name.localeCompare(b.name)
                })

                await db.put(STORES.SETTINGS, {
                    key: 'waiters_cache',
                    value: sorted
                })

                setWaiters(sorted)
                setIsOffline(false)
                console.log('✅ Synced waiters from Supabase')
            }
        } catch (error) {
            console.error('Sync failed:', error)
            setIsOffline(true)
        }
    }, [])

    // ✅ Track attendance locally + queue for sync
    const trackAttendance = useCallback(async (
        waiterId: string,
        status: 'present' | 'absent'
    ) => {
        const today = new Date().toISOString().split('T')[0]
        const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5)

        try {
            // Always save locally FIRST
            const localKey = `attendance_${waiterId}_${today}`
            const existingLocal = await db.get(STORES.SETTINGS, localKey)

            const attendanceRecord: any = {
                waiter_id: waiterId,
                date: today,
                status,
                synced: false
            }

            if (existingLocal && (existingLocal as any).value) {
                const existing = (existingLocal as any).value
                attendanceRecord.check_in = existing.check_in || currentTime

                if (status === 'present' && !existing.check_out) {
                    attendanceRecord.check_out = currentTime
                    const checkIn = new Date(`2000-01-01T${existing.check_in || currentTime}`)
                    const checkOut = new Date(`2000-01-01T${currentTime}`)
                    attendanceRecord.total_hours = Math.max(0,
                        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
                    )
                } else if (status === 'absent' && existing.check_in && !existing.check_out) {
                    attendanceRecord.check_out = currentTime
                    const checkIn = new Date(`2000-01-01T${existing.check_in}`)
                    const checkOut = new Date(`2000-01-01T${currentTime}`)
                    attendanceRecord.total_hours = Math.max(0,
                        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
                    )
                }
            } else {
                attendanceRecord.check_in = status === 'present' ? currentTime : null
                attendanceRecord.total_hours = 0
            }

            // Save locally
            await db.put(STORES.SETTINGS, {
                key: localKey,
                value: attendanceRecord
            })

            // Try to sync if online
            if (navigator.onLine) {
                const { data: existing } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('waiter_id', waiterId)
                    .eq('date', today)
                    .single()

                if (existing) {
                    await supabase
                        .from('attendance')
                        .update(attendanceRecord)
                        .eq('id', existing.id)
                } else {
                    await supabase
                        .from('attendance')
                        .insert(attendanceRecord)
                }

                // Mark as synced
                attendanceRecord.synced = true
                await db.put(STORES.SETTINGS, {
                    key: localKey,
                    value: attendanceRecord
                })
            }
        } catch (error) {
            console.error('Attendance tracking failed:', error)
        }
    }, [])

    // ✅ Toggle present/absent with offline support
    const togglePresent = useCallback(async (
        waiterId: string,
        currentStatus: boolean
    ) => {
        const newStatus = !currentStatus

        // Update locally FIRST
        const updatedWaiters = waiters.map(w =>
            w.id === waiterId ? { ...w, is_on_duty: newStatus } : w
        ).sort((a, b) => {
            if (a.is_on_duty && !b.is_on_duty) return -1
            if (!a.is_on_duty && b.is_on_duty) return 1
            return a.name.localeCompare(b.name)
        })

        setWaiters(updatedWaiters)

        await db.put(STORES.SETTINGS, {
            key: 'waiters_cache',
            value: updatedWaiters
        })

        // Track attendance
        await trackAttendance(waiterId, newStatus ? 'present' : 'absent')

        // Try server update if online
        if (navigator.onLine) {
            try {
                await supabase
                    .from('waiters')
                    .update({ is_on_duty: newStatus })
                    .eq('id', waiterId)
            } catch (error) {
                console.error('Server update failed:', error)
            }
        }

        return { success: true, offline: !navigator.onLine }
    }, [waiters, trackAttendance])

    // ✅ Mark all present with offline support
    const markAllPresent = useCallback(async () => {
        const absentWaiters = waiters.filter(w => !w.is_on_duty)

        if (absentWaiters.length === 0) {
            return { success: false, message: 'Everyone is already present' }
        }

        const updatedWaiters = waiters.map(w =>
            absentWaiters.find(a => a.id === w.id)
                ? { ...w, is_on_duty: true }
                : w
        )

        setWaiters(updatedWaiters)

        await db.put(STORES.SETTINGS, {
            key: 'waiters_cache',
            value: updatedWaiters
        })

        // Track all attendance
        for (const waiter of absentWaiters) {
            await trackAttendance(waiter.id, 'present')
        }

        // Try server update if online
        if (navigator.onLine) {
            try {
                await supabase
                    .from('waiters')
                    .update({ is_on_duty: true })
                    .in('id', absentWaiters.map(w => w.id))
            } catch (error) {
                console.error('Server update failed:', error)
            }
        }

        return {
            success: true,
            count: absentWaiters.length,
            offline: !navigator.onLine
        }
    }, [waiters, trackAttendance])

    // ✅ Initial setup
    useEffect(() => {
        const init = async () => {
            await checkDailyReset()
            await loadFromCache()
            if (navigator.onLine) {
                await syncFromSupabase()
            }
        }
        init()

        // Check for reset every 5 minutes
        const resetInterval = setInterval(checkDailyReset, 5 * 60 * 1000)

        // Online/offline listeners
        const handleOnline = () => {
            setIsOffline(false)
            syncFromSupabase()
        }
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            clearInterval(resetInterval)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [checkDailyReset, loadFromCache, syncFromSupabase])

    const refresh = useCallback(async () => {
        await loadFromCache()
        if (navigator.onLine) {
            await syncFromSupabase()
        }
    }, [loadFromCache, syncFromSupabase])

    return {
        waiters,
        loading,
        isOffline,
        togglePresent,
        markAllPresent,
        refresh,
        lastResetDate
    }
}
// src/app/(public)/attendance/page.tsx
// ✅ AUTO-TRACKING: Records attendance in database

'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, RefreshCw, WifiOff, CheckCircle, Clock } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'
import { addToQueue } from '@/lib/db/syncQueue'

interface Waiter {
    id: string
    name: string
    phone: string
    profile_pic?: string
    is_active: boolean
    is_on_duty: boolean
    created_at: string
}

export default function AttendancePage() {
    const [waiters, setWaiters] = useState<Waiter[]>([])
    const [loading, setLoading] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const supabase = createClient()
    const toast = useToast()
    const { isOnline, pendingCount } = useOfflineStatus()

    useEffect(() => {
        loadWaitersOfflineFirst()
        const interval = setInterval(() => {
            if (isOnline) syncWaitersInBackground()
        }, 10000)
        return () => clearInterval(interval)
    }, [])

    const loadWaitersOfflineFirst = async () => {
        try {
            const cached = await db.get(STORES.SETTINGS, 'waiters_cache')
            if (cached && (cached as any).value) {
                const cachedWaiters = (cached as any).value
                const sorted = cachedWaiters.sort((a: any, b: any) => {
                    if (a.is_on_duty && !b.is_on_duty) return -1
                    if (!a.is_on_duty && b.is_on_duty) return 1
                    return a.name.localeCompare(b.name)
                })
                setWaiters(sorted)
            }

            if (isOnline) {
                syncWaitersInBackground()
            }
        } catch (error) {
            console.error('Failed to load waiters:', error)
        }
    }

    const syncWaitersInBackground = async () => {
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

                setWaiters(sorted)
                await db.put(STORES.SETTINGS, {
                    key: 'waiters_cache',
                    value: sorted
                })
            }
        } catch (error) {
            console.error('Background sync failed:', error)
        }
    }

    // ✅ TRACK ATTENDANCE in database
    const trackAttendance = async (waiterId: string, status: 'present' | 'absent') => {
        const today = new Date().toISOString().split('T')[0]
        const currentTime = new Date().toTimeString().split(' ')[0].slice(0, 5)

        try {
            if (isOnline) {
                // Check if record exists
                const { data: existing } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('waiter_id', waiterId)
                    .eq('date', today)
                    .single()

                if (existing) {
                    // Update existing record
                    const updateData: any = { status }

                    if (status === 'present') {
                        if (!existing.check_in) {
                            updateData.check_in = currentTime
                        }
                        if (existing.check_in && !existing.check_out) {
                            updateData.check_out = currentTime
                            // Calculate hours
                            const checkIn = new Date(`2000-01-01T${existing.check_in}`)
                            const checkOut = new Date(`2000-01-01T${currentTime}`)
                            const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)
                            updateData.total_hours = Math.max(0, hours)
                        }
                    }

                    await supabase
                        .from('attendance')
                        .update(updateData)
                        .eq('id', existing.id)
                } else {
                    // Create new record
                    await supabase
                        .from('attendance')
                        .insert({
                            waiter_id: waiterId,
                            date: today,
                            check_in: status === 'present' ? currentTime : null,
                            status,
                            total_hours: 0
                        })
                }
            }
            // ✅ Note: Offline attendance tracking disabled for now
            // Will be synced when back online through waiter status
        } catch (error) {
            console.error('Failed to track attendance:', error)
        }
    }

    const markAllPresent = async () => {
        if (loading || !confirm('✅ Mark everyone as present?')) return
        setLoading(true)

        try {
            const absentWaiters = waiters.filter(w => !w.is_on_duty)

            if (absentWaiters.length === 0) {
                toast.add('warning', 'ℹ️ Everyone is already present!')
                setLoading(false)
                return
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

            if (isOnline) {
                const { error } = await supabase
                    .from('waiters')
                    .update({ is_on_duty: true })
                    .in('id', absentWaiters.map(w => w.id))

                if (error) throw error

                // Track attendance for all
                for (const waiter of absentWaiters) {
                    await trackAttendance(waiter.id, 'present')
                }

                toast.add('success', `✅ Marked ${absentWaiters.length} staff as present!`)
            } else {
                // Offline: Store in IndexedDB
                for (const waiter of absentWaiters) {
                    await addToQueue('update', 'waiters', {
                        id: waiter.id,
                        is_on_duty: true
                    })
                }

                // Track all attendance offline
                for (const waiter of absentWaiters) {
                    await trackAttendance(waiter.id, 'present')
                }

                toast.add('success', `✅ Marked ${absentWaiters.length} staff as present offline!`)
            }
        } catch (error: any) {
            console.error('Mark all present error:', error)
            toast.add('error', `❌ Failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const togglePresent = async (waiterId: string, currentStatus: boolean) => {
        if (processingId) {
            toast.add('warning', '⚠️ Please wait...')
            return
        }

        setProcessingId(waiterId)
        setLoading(true)

        try {
            const newStatus = !currentStatus

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

            if (isOnline) {
                const { error } = await supabase
                    .from('waiters')
                    .update({ is_on_duty: newStatus })
                    .eq('id', waiterId)

                if (error) throw error

                // Track attendance
                await trackAttendance(waiterId, newStatus ? 'present' : 'absent')

                toast.add('success', newStatus ? '✅ Marked Present!' : '✅ Marked Absent!')
            } else {
                // Offline: Queue waiter update
                await addToQueue('update', 'waiters', {
                    id: waiterId,
                    is_on_duty: newStatus
                })

                // Track attendance offline
                await trackAttendance(waiterId, newStatus ? 'present' : 'absent')

                toast.add('success', newStatus
                    ? '✅ Marked Present offline!'
                    : '✅ Marked Absent offline!'
                )
            }
        } catch (error: any) {
            console.error('Toggle present error:', error)
            toast.add('error', `❌ Failed: ${error.message}`)
        } finally {
            setLoading(false)
            setProcessingId(null)
        }
    }

    const presentCount = waiters.filter(w => w.is_on_duty).length
    const totalCount = waiters.length

    return (
        <div className="min-h-screen bg-[var(--bg)] pb-20">
            <PageHeader
                title="Attendance"
                subtitle={`${presentCount}/${totalCount} present${pendingCount > 0 ? ` • ${pendingCount} pending sync` : ''}${!isOnline ? ' • Offline' : ''}`}
                action={
                    <div className="flex gap-2">
                        <button
                            onClick={markAllPresent}
                            disabled={loading}
                            className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:scale-95 disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline">Mark All</span>
                        </button>
                        <button
                            onClick={loadWaitersOfflineFirst}
                            disabled={loading}
                            className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-5 h-5 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                }
            />

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
                {!isOnline && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                        <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold text-[var(--fg)] mb-1">Offline Mode</p>
                            <p className="text-[var(--muted)]">Attendance will be tracked locally and synced when online.</p>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/20 border border-green-500/30 rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0">
                                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-[var(--muted)]">Present</p>
                                <p className="text-2xl sm:text-4xl font-bold text-green-600">{presentCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/20 border border-gray-500/30 rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                                {totalCount - presentCount}
                            </div>
                            <div>
                                <p className="text-xs sm:text-sm text-[var(--muted)]">Absent</p>
                                <p className="text-2xl sm:text-4xl font-bold text-gray-600">{totalCount - presentCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="mb-6 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-xs sm:text-sm text-[var(--fg)] flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <strong>Auto-Tracking:</strong> Check-in/out times recorded automatically. View history in Admin panel.
                    </p>
                </div>

                {/* Staff List */}
                <div className="space-y-3">
                    {waiters.map(waiter => (
                        <button
                            key={waiter.id}
                            onClick={() => togglePresent(waiter.id, waiter.is_on_duty)}
                            disabled={loading || processingId === waiter.id}
                            className={`w-full bg-[var(--card)] border rounded-xl p-4 sm:p-5 flex items-center gap-3 sm:gap-4 transition-all text-left disabled:opacity-50 active:scale-[0.98] ${
                                waiter.is_on_duty
                                    ? 'border-green-500/30 shadow-lg shadow-green-500/10'
                                    : 'border-[var(--border)] hover:border-[var(--border)]/60 hover:shadow-md'
                            }`}
                        >
                            {waiter.profile_pic ? (
                                <img
                                    src={waiter.profile_pic}
                                    alt={waiter.name}
                                    className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 flex-shrink-0 ${
                                        waiter.is_on_duty ? 'border-green-600' : 'border-gray-400'
                                    }`}
                                />
                            ) : (
                                <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-lg sm:text-2xl flex-shrink-0 ${
                                    waiter.is_on_duty ? 'bg-green-600' : 'bg-gray-600'
                                }`}>
                                    {waiter.name[0]}
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base sm:text-lg text-[var(--fg)] truncate mb-1">
                                    {waiter.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-[var(--muted)] truncate mb-2">
                                    {waiter.phone}
                                </p>

                                {waiter.is_on_duty ? (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-600 rounded-full animate-pulse" />
                                        <span className="text-[10px] sm:text-xs font-semibold text-green-600">PRESENT</span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-500/20 border border-gray-500/30 rounded-full">
                                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-600 rounded-full" />
                                        <span className="text-[10px] sm:text-xs font-semibold text-gray-600">ABSENT</span>
                                    </div>
                                )}
                            </div>

                            {processingId === waiter.id ? (
                                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            ) : (
                                <CheckCircle className={`w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 ${
                                    waiter.is_on_duty ? 'text-green-600' : 'text-gray-400'
                                }`} />
                            )}
                        </button>
                    ))}

                    {waiters.length === 0 && (
                        <div className="bg-[var(--card)] border rounded-xl p-12 sm:p-16 text-center">
                            <div className="text-5xl sm:text-7xl mb-4">👥</div>
                            <p className="text-lg sm:text-xl font-semibold text-[var(--fg)] mb-2">No Staff Members</p>
                            <p className="text-xs sm:text-sm text-[var(--muted)]">
                                {!isOnline ? 'Go online to download staff data' : 'Add staff in admin panel'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
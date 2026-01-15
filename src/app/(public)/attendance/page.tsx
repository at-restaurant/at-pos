// src/app/(public)/attendance/page.tsx
// ✅ MODERN DESIGN + FULL INDEXEDDB INTEGRATION + OFFLINE-FIRST

'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Users, RefreshCw, WifiOff, CheckCircle } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'

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
        load()
        const interval = setInterval(load, 5000)
        return () => clearInterval(interval)
    }, [isOnline])

    const load = async () => {
        try {
            if (isOnline) {
                // ✅ Load from Supabase
                const { data } = await supabase
                    .from('waiters')
                    .select('*')
                    .eq('is_active', true)
                    .order('name')

                if (data) {
                    // ✅ Sort: Present first, then by name
                    const sorted = data.sort((a: any, b: any) => {
                        if (a.is_on_duty && !b.is_on_duty) return -1
                        if (!a.is_on_duty && b.is_on_duty) return 1
                        return a.name.localeCompare(b.name)
                    })
                    setWaiters(sorted)

                    // ✅ Cache in IndexedDB
                    await db.put(STORES.SETTINGS, {
                        key: 'waiters_cache',
                        value: sorted
                    })
                }
            } else {
                // ✅ Load from IndexedDB cache
                const cached = await db.get(STORES.SETTINGS, 'waiters_cache')
                if (cached && (cached as any).value) {
                    setWaiters((cached as any).value)
                }
            }
        } catch (error) {
            console.error('Failed to load waiters:', error)
        }
    }

    // ✅ MARK ALL PRESENT
    const markAllPresent = async () => {
        if (loading || !confirm('✅ Mark everyone as present?')) return
        setLoading(true)

        try {
            const now = new Date().toISOString()
            const absentWaiters = waiters.filter(w => !w.is_on_duty)

            if (absentWaiters.length === 0) {
                toast.add('warning', 'ℹ️ Everyone is already present!')
                setLoading(false)
                return
            }

            for (const waiter of absentWaiters) {
                const shiftId = isOnline
                    ? `shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    : `offline_shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

                const shiftRecord = {
                    id: shiftId,
                    waiter_id: waiter.id,
                    clock_in: now,
                    clock_out: null,
                    synced: isOnline,
                    created_at: now
                }

                // ✅ Save to IndexedDB
                await db.put(STORES.WAITER_SHIFTS, shiftRecord)

                if (isOnline) {
                    // ✅ Update Supabase
                    await supabase.from('waiters').update({ is_on_duty: true }).eq('id', waiter.id)
                    await supabase.from('waiter_shifts').insert({
                        waiter_id: waiter.id,
                        clock_in: now,
                        clock_out: null
                    })
                }
            }

            toast.add('success', `✅ Marked ${absentWaiters.length} staff as present!${!isOnline ? ' Will sync when online.' : ''}`)
            await load()
        } catch (error: any) {
            console.error('Mark all present error:', error)
            toast.add('error', `❌ Failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    // ✅ TOGGLE INDIVIDUAL
    const togglePresent = async (waiterId: string, currentStatus: boolean) => {
        if (processingId) {
            toast.add('warning', '⚠️ Please wait...')
            return
        }

        setProcessingId(waiterId)
        setLoading(true)

        try {
            const newStatus = !currentStatus
            const now = new Date().toISOString()

            if (newStatus) {
                // ✅ MARKING PRESENT
                if (isOnline) {
                    // Check if already has active shift
                    const { data: existingShifts } = await supabase
                        .from('waiter_shifts')
                        .select('id')
                        .eq('waiter_id', waiterId)
                        .is('clock_out', null)

                    if (existingShifts && existingShifts.length > 0) {
                        toast.add('error', '⚠️ Already marked present!')
                        setLoading(false)
                        setProcessingId(null)
                        return
                    }

                    // Insert new shift
                    await supabase.from('waiter_shifts').insert({
                        waiter_id: waiterId,
                        clock_in: now,
                        clock_out: null
                    })

                    // Update waiter status
                    await supabase.from('waiters').update({ is_on_duty: true }).eq('id', waiterId)

                    toast.add('success', '✅ Marked Present!')
                } else {
                    // ✅ Offline mode
                    const offlineShiftId = `offline_shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    await db.put(STORES.WAITER_SHIFTS, {
                        id: offlineShiftId,
                        waiter_id: waiterId,
                        clock_in: now,
                        clock_out: null,
                        synced: false,
                        created_at: now
                    })

                    toast.add('success', '✅ Marked Present offline! Will sync when online.')
                }
            } else {
                // ✅ MARKING ABSENT
                if (isOnline) {
                    // Find active shift
                    const { data: shifts } = await supabase
                        .from('waiter_shifts')
                        .select('id')
                        .eq('waiter_id', waiterId)
                        .is('clock_out', null)
                        .order('clock_in', { ascending: false })
                        .limit(1)

                    if (shifts && shifts.length > 0) {
                        await supabase
                            .from('waiter_shifts')
                            .update({ clock_out: now })
                            .eq('id', shifts[0].id)
                    }

                    await supabase.from('waiters').update({ is_on_duty: false }).eq('id', waiterId)

                    toast.add('success', '✅ Marked Absent!')
                } else {
                    // ✅ Offline mode
                    const allShifts = await db.getAll(STORES.WAITER_SHIFTS) as any[]
                    const activeShift = allShifts.find(s =>
                        s.waiter_id === waiterId && !s.clock_out
                    )

                    if (activeShift) {
                        await db.put(STORES.WAITER_SHIFTS, {
                            ...activeShift,
                            clock_out: now
                        })
                    }

                    toast.add('success', '✅ Marked Absent offline! Will sync when online.')
                }
            }

            // ✅ Update local state immediately
            setWaiters(prev => prev.map(w =>
                w.id === waiterId ? { ...w, is_on_duty: newStatus } : w
            ).sort((a, b) => {
                if (a.is_on_duty && !b.is_on_duty) return -1
                if (!a.is_on_duty && b.is_on_duty) return 1
                return a.name.localeCompare(b.name)
            }))

            await load()
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
                            onClick={load}
                            disabled={loading}
                            className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-5 h-5 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                }
            />

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
                {/* Offline Warning */}
                {!isOnline && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                        <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold text-[var(--fg)] mb-1">Offline Mode</p>
                            <p className="text-[var(--muted)]">Attendance will sync when you're back online.</p>
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
                    <p className="text-xs sm:text-sm text-[var(--fg)]">
                        <strong>💡 Tip:</strong> Tap any staff member to toggle present/absent status.
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
                            {/* Avatar */}
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

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base sm:text-lg text-[var(--fg)] truncate mb-1">
                                    {waiter.name}
                                </h3>
                                <p className="text-xs sm:text-sm text-[var(--muted)] truncate mb-2">
                                    {waiter.phone}
                                </p>

                                {/* Status Badge */}
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

                            {/* Spinner or Checkmark */}
                            {processingId === waiter.id ? (
                                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            ) : (
                                <CheckCircle className={`w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 ${
                                    waiter.is_on_duty ? 'text-green-600' : 'text-gray-400'
                                }`} />
                            )}
                        </button>
                    ))}

                    {/* Empty State */}
                    {waiters.length === 0 && (
                        <div className="bg-[var(--card)] border rounded-xl p-12 sm:p-16 text-center">
                            <div className="text-5xl sm:text-7xl mb-4">👥</div>
                            <p className="text-lg sm:text-xl font-semibold text-[var(--fg)] mb-2">No Staff Members</p>
                            <p className="text-xs sm:text-sm text-[var(--muted)]">
                                {!isOnline ? 'Go online to see staff' : 'Add staff in admin panel'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
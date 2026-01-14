// src/app/(public)/attendance/page.tsx - ULTRA SIMPLE VERSION
'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { CheckCircle, Users, WifiOff, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { db, dbHelpers } from '@/lib/db/dexie'
import { createClient } from '@/lib/supabase/client'
import type { Waiter } from '@/lib/db/dexie'

export default function AttendancePage() {
    const [waiters, setWaiters] = useState<Waiter[]>([])
    const [loading, setLoading] = useState(false)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [isOnline, setIsOnline] = useState(true)
    const supabase = createClient()
    const toast = useToast()

    useEffect(() => {
        load()
        const interval = setInterval(load, 5000)

        const handleOnline = () => {
            setIsOnline(true)
            load()
        }
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            clearInterval(interval)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const load = async () => {
        try {
            const dexieWaiters = await db.waiters.where('is_active').equals(1).toArray()
            const sorted = dexieWaiters.sort((a, b) => {
                if (a.is_on_duty && !b.is_on_duty) return -1
                if (!a.is_on_duty && b.is_on_duty) return 1
                return a.name.localeCompare(b.name)
            })
            if (sorted.length > 0) setWaiters(sorted)

            if (navigator.onLine) {
                const { data } = await supabase
                    .from('waiters')
                    .select('*')
                    .eq('is_active', true)
                    .order('name')

                if (data && data.length > 0) {
                    await db.waiters.bulkPut(data)
                    const sortedOnline = data.sort((a: any, b: any) => {
                        if (a.is_on_duty && !b.is_on_duty) return -1
                        if (!a.is_on_duty && b.is_on_duty) return 1
                        return a.name.localeCompare(b.name)
                    })
                    setWaiters(sortedOnline)
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
                toast.add('info', 'ℹ️ Everyone is already present!')
                setLoading(false)
                return
            }

            // Update all to present
            for (const waiter of absentWaiters) {
                await db.waiters.update(waiter.id, { is_on_duty: true })

                const attendanceId = `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                const record = {
                    id: attendanceId,
                    waiter_id: waiter.id,
                    clock_in: now,
                    clock_out: null,
                    synced: false,
                    created_at: now
                }
                await db.waiter_shifts.add(record)

                if (isOnline) {
                    await supabase.from('waiters').update({ is_on_duty: true }).eq('id', waiter.id)
                    await supabase.from('waiter_shifts').insert({
                        waiter_id: waiter.id,
                        clock_in: now,
                        clock_out: null,
                        created_at: now
                    })
                } else {
                    await dbHelpers.addToQueue('waiters', 'update', { id: waiter.id, is_on_duty: true })
                    await dbHelpers.addToQueue('waiter_shifts', 'create', record)
                }
            }

            toast.add('success', `✅ Marked ${absentWaiters.length} staff as present!`)
            await load()
        } catch (error: any) {
            toast.add('error', `❌ Failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    // ✅ TOGGLE INDIVIDUAL
    const togglePresent = async (waiterId: string, currentStatus: boolean) => {
        if (processingId) return
        setProcessingId(waiterId)
        setLoading(true)

        try {
            const newStatus = !currentStatus
            const now = new Date().toISOString()

            await db.waiters.update(waiterId, { is_on_duty: newStatus })

            if (newStatus) {
                // Marking present
                const attendanceId = `attendance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                const record = {
                    id: attendanceId,
                    waiter_id: waiterId,
                    clock_in: now,
                    clock_out: null,
                    synced: false,
                    created_at: now
                }
                await db.waiter_shifts.add(record)

                if (isOnline) {
                    await supabase.from('waiters').update({ is_on_duty: true }).eq('id', waiterId)
                    await supabase.from('waiter_shifts').insert({
                        waiter_id: waiterId,
                        clock_in: now,
                        clock_out: null,
                        created_at: now
                    })
                } else {
                    await dbHelpers.addToQueue('waiters', 'update', { id: waiterId, is_on_duty: true })
                    await dbHelpers.addToQueue('waiter_shifts', 'create', record)
                }

                toast.add('success', '✅ Marked Present!')
            } else {
                // Marking absent (left)
                const allShifts = await db.waiter_shifts.where('waiter_id').equals(waiterId).toArray()
                const activeShift = allShifts.find(s => !s.clock_out)

                if (activeShift) {
                    await db.waiter_shifts.update(activeShift.id, { clock_out: now })
                }

                if (isOnline) {
                    await supabase.from('waiters').update({ is_on_duty: false }).eq('id', waiterId)
                    if (activeShift) {
                        await supabase.from('waiter_shifts').update({ clock_out: now }).eq('id', activeShift.id)
                    }
                } else {
                    await dbHelpers.addToQueue('waiters', 'update', { id: waiterId, is_on_duty: false })
                }

                toast.add('success', '✅ Marked Absent!')
            }

            await load()
        } catch (error: any) {
            toast.add('error', `❌ Failed: ${error.message}`)
        } finally {
            setLoading(false)
            setProcessingId(null)
        }
    }

    const presentCount = waiters.filter(w => w.is_on_duty).length
    const totalCount = waiters.length

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <PageHeader
                title="Attendance"
                subtitle={`${presentCount}/${totalCount} present today${!isOnline ? ' • Offline' : ''}`}
                action={
                    <div className="flex gap-2">
                        <button
                            onClick={markAllPresent}
                            disabled={loading}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline">Mark All Present</span>
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

            <div className="max-w-5xl mx-auto px-4 py-6">
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
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-green-500/10 to-green-600/20 border border-green-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <p className="text-sm text-[var(--muted)]">Present</p>
                                <p className="text-4xl font-bold text-green-600">{presentCount}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-500/10 to-gray-600/20 border border-gray-500/30 rounded-xl p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                {totalCount - presentCount}
                            </div>
                            <div>
                                <p className="text-sm text-[var(--muted)]">Absent</p>
                                <p className="text-4xl font-bold text-gray-600">{totalCount - presentCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Banner */}
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-sm text-[var(--fg)]">
                        <strong>💡 Note:</strong> Not marked = Absent. Click name to toggle present/absent.
                    </p>
                </div>

                {/* Staff List */}
                <div className="space-y-3">
                    {waiters.map(waiter => (
                        <button
                            key={waiter.id}
                            onClick={() => togglePresent(waiter.id, waiter.is_on_duty)}
                            disabled={loading || processingId === waiter.id}
                            className={`w-full bg-[var(--card)] border rounded-xl p-5 flex items-center gap-4 transition-all text-left disabled:opacity-50 ${
                                waiter.is_on_duty
                                    ? 'border-green-500/30 shadow-lg shadow-green-500/10 hover:shadow-xl'
                                    : 'border-[var(--border)] hover:border-[var(--border)]/60 hover:shadow-md'
                            }`}
                        >
                            {/* Avatar */}
                            {waiter.profile_pic ? (
                                <img
                                    src={waiter.profile_pic}
                                    alt={waiter.name}
                                    className={`w-16 h-16 rounded-full object-cover border-2 ${
                                        waiter.is_on_duty ? 'border-green-600' : 'border-gray-400'
                                    }`}
                                />
                            ) : (
                                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl ${
                                    waiter.is_on_duty ? 'bg-green-600' : 'bg-gray-600'
                                }`}>
                                    {waiter.name[0]}
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-lg text-[var(--fg)] truncate mb-1">
                                    {waiter.name}
                                </h3>
                                <p className="text-sm text-[var(--muted)] truncate mb-2">
                                    {waiter.phone}
                                </p>

                                {/* Status */}
                                {waiter.is_on_duty ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full">
                                        <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                                        <span className="text-xs font-semibold text-green-600">PRESENT</span>
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-500/20 border border-gray-500/30 rounded-full">
                                        <span className="w-2 h-2 bg-gray-600 rounded-full" />
                                        <span className="text-xs font-semibold text-gray-600">ABSENT</span>
                                    </div>
                                )}
                            </div>

                            {/* Spinner or Checkmark */}
                            {processingId === waiter.id ? (
                                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                            ) : (
                                <CheckCircle className={`w-8 h-8 flex-shrink-0 ${
                                    waiter.is_on_duty ? 'text-green-600' : 'text-gray-400'
                                }`} />
                            )}
                        </button>
                    ))}

                    {waiters.length === 0 && (
                        <div className="bg-[var(--card)] border rounded-xl p-16 text-center">
                            <div className="text-7xl mb-4">👥</div>
                            <p className="text-xl font-semibold text-[var(--fg)] mb-2">No Staff Members</p>
                            <p className="text-sm text-[var(--muted)]">
                                {!isOnline ? 'Go online to see staff' : 'Add staff in admin panel'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
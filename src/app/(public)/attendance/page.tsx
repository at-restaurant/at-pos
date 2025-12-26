// src/app/(public)/attendance/page.tsx - UPDATED WITH OFFLINE SUPPORT
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Timer, LogIn, LogOut, AlertCircle, WifiOff } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { getWaiterStatusColor } from '@/lib/utils/statusHelpers'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'

export default function AttendancePage() {
    const [waiters, setWaiters] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()
    const toast = useToast()
    const { isOnline } = useOfflineStatus()

    useEffect(() => { load() }, [isOnline])

    const load = async () => {
        try {
            if (isOnline) {
                const { data } = await supabase
                    .from('waiters')
                    .select('*')
                    .eq('is_active', true)
                    .order('name')
                setWaiters(data || [])

                // Cache for offline
                if (data && data.length > 0) {
                    await db.put(STORES.SETTINGS, {
                        key: 'waiters',
                        value: data
                    })
                }
            } else {
                // Load from cache
                const cached = await db.get(STORES.SETTINGS, 'waiters')
                if (cached && (cached as any).value) {
                    setWaiters((cached as any).value)
                }
            }
        } catch (error) {
            console.error('Failed to load waiters:', error)
        }
    }

    const handleClockIn = async (waiterId: string) => {
        setLoading(true)
        try {
            const now = new Date().toISOString()

            if (isOnline) {
                // Check if already clocked in
                const { data: existingShift } = await supabase
                    .from('waiter_shifts')
                    .select('id')
                    .eq('waiter_id', waiterId)
                    .is('clock_out', null)
                    .single()

                if (existingShift) {
                    toast.add('error', '⚠️ Already clocked in!')
                    setLoading(false)
                    return
                }

                await supabase
                    .from('waiter_shifts')
                    .insert({ waiter_id: waiterId, clock_in: now })

                await supabase
                    .from('waiters')
                    .update({ is_on_duty: true })
                    .eq('id', waiterId)

                toast.add('success', '✅ Clocked in!')
            } else {
                // ✅ Offline clock-in
                const offlineId = `offline_shift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

                await db.put('waiter_shifts', {
                    id: offlineId,
                    waiter_id: waiterId,
                    clock_in: now,
                    clock_out: null,
                    synced: false,
                    created_at: now
                })

                // Update local waiter status
                const updatedWaiters = waiters.map(w =>
                    w.id === waiterId ? { ...w, is_on_duty: true } : w
                )
                setWaiters(updatedWaiters)

                toast.add('success', '✅ Clocked in offline! Will sync when online.')
            }

            load()
        } catch (error) {
            toast.add('error', '❌ Failed')
        }
        setLoading(false)
    }

    const handleClockOut = async (waiterId: string) => {
        setLoading(true)
        try {
            const now = new Date().toISOString()

            if (isOnline) {
                const { data: shift } = await supabase
                    .from('waiter_shifts')
                    .select('id')
                    .eq('waiter_id', waiterId)
                    .is('clock_out', null)
                    .single()

                if (shift) {
                    await supabase
                        .from('waiter_shifts')
                        .update({ clock_out: now })
                        .eq('id', shift.id)

                    await supabase
                        .from('waiters')
                        .update({ is_on_duty: false })
                        .eq('id', waiterId)

                    toast.add('success', '✅ Clocked out!')
                }
            } else {
                // ✅ Offline clock-out
                const allShifts = await db.getAll('waiter_shifts') as any[]
                const activeShift = allShifts.find(s =>
                    s.waiter_id === waiterId && !s.clock_out
                )

                if (activeShift) {
                    await db.put('waiter_shifts', {
                        ...activeShift,
                        clock_out: now
                    })

                    // Update local waiter status
                    const updatedWaiters = waiters.map(w =>
                        w.id === waiterId ? { ...w, is_on_duty: false } : w
                    )
                    setWaiters(updatedWaiters)

                    toast.add('success', '✅ Clocked out offline! Will sync when online.')
                }
            }

            load()
        } catch (error) {
            toast.add('error', '❌ Failed')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <PageHeader
                title="Attendance"
                subtitle={`Mark your presence${!isOnline ? ' • Offline mode' : ''}`}
            />

            <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-6">
                {!isOnline && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                        <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold text-[var(--fg)] mb-1">Offline Mode Active</p>
                            <p className="text-[var(--muted)]">
                                Attendance will sync automatically when you're back online.
                            </p>
                        </div>
                    </div>
                )}

                <div className="mb-6 p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold text-[var(--fg)] mb-1">Auto Clock-In Enabled</p>
                        <p className="text-[var(--muted)]">
                            Staff automatically clock in when assigned to an order. Manual clock-in available below.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    {waiters.map(waiter => (
                        <div
                            key={waiter.id}
                            className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6 flex items-center justify-between gap-4 hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                {waiter.profile_pic ? (
                                    <img
                                        src={waiter.profile_pic}
                                        alt={waiter.name}
                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-blue-600"
                                    />
                                ) : (
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl">
                                        {waiter.name[0]}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-[var(--fg)] text-base sm:text-lg truncate">
                                        {waiter.name}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] truncate">
                                        {waiter.phone}
                                    </p>
                                    {(() => {
                                        const statusColors = getWaiterStatusColor(waiter.is_on_duty)
                                        return (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1 rounded-full text-xs font-medium ${statusColors.bgColor} ${statusColors.textColor}`}>
                                                <span
                                                    className="w-1.5 h-1.5 rounded-full"
                                                    style={{ backgroundColor: statusColors.dotColor }}
                                                />
                                                {statusColors.label}
                                            </span>
                                        )
                                    })()}
                                </div>
                            </div>

                            <div className="flex-shrink-0">
                                {waiter.is_on_duty ? (
                                    <button
                                        onClick={() => handleClockOut(waiter.id)}
                                        disabled={loading}
                                        className="px-4 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-red-700 active:scale-95 disabled:opacity-50 text-sm sm:text-base transition-all shadow-md"
                                    >
                                        <LogOut className="w-4 h-4" />
                                        <span className="hidden sm:inline">Clock Out</span>
                                        <span className="sm:hidden">Out</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleClockIn(waiter.id)}
                                        disabled={loading}
                                        className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 hover:bg-green-700 active:scale-95 disabled:opacity-50 text-sm sm:text-base transition-all shadow-md"
                                    >
                                        <LogIn className="w-4 h-4" />
                                        <span className="hidden sm:inline">Clock In</span>
                                        <span className="sm:hidden">In</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {waiters.length === 0 && (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
                            <Timer className="w-16 h-16 mx-auto mb-4 text-[var(--muted)]" />
                            <p className="text-[var(--fg)] font-medium mb-2">No staff members found</p>
                            <p className="text-sm text-[var(--muted)]">
                                {!isOnline ? 'Go online to see staff members' : 'Add staff members in admin panel'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
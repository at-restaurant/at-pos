'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Users, RefreshCw, WifiOff, CheckCircle, Clock, Calendar } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'
import { useAttendanceOffline } from '@/lib/hooks/useAttendanceOffline'

export default function AttendancePage() {
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [todayDate, setTodayDate] = useState('')
    const toast = useToast()
    const { pendingCount } = useOfflineStatus()

    const {
        waiters,
        loading,
        isOffline,
        togglePresent,
        markAllPresent,
        refresh,
        lastResetDate
    } = useAttendanceOffline()

    useEffect(() => {
        const today = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        setTodayDate(today)
    }, [])

    const handleToggle = async (waiterId: string, currentStatus: boolean) => {
        if (processingId) {
            toast.add('warning', '⚠️ Please wait...')
            return
        }

        setProcessingId(waiterId)

        try {
            const result = await togglePresent(waiterId, currentStatus)

            if (result.success) {
                toast.add('success',
                    !currentStatus
                        ? `✅ Marked Present${result.offline ? ' (Offline)' : ''}!`
                        : `✅ Marked Absent${result.offline ? ' (Offline)' : ''}!`
                )
            }
        } catch (error: any) {
            toast.add('error', `❌ Failed: ${error.message}`)
        } finally {
            setProcessingId(null)
        }
    }

    const handleMarkAll = async () => {
        if (!confirm('✅ Mark everyone as present?')) return

        try {
            const result = await markAllPresent()

            if (result.success) {
                toast.add('success',
                    `✅ Marked ${result.count} staff as present${result.offline ? ' offline' : ''}!`
                )
            } else {
                toast.add('warning', `ℹ️ ${result.message}`)
            }
        } catch (error: any) {
            toast.add('error', `❌ Failed: ${error.message}`)
        }
    }

    const presentCount = waiters.filter(w => w.is_on_duty).length
    const totalCount = waiters.length

    return (
        <div className="min-h-screen bg-[var(--bg)] pb-20">
            <PageHeader
                title="Attendance"
                subtitle={`${todayDate} • ${presentCount}/${totalCount} present${pendingCount > 0 ? ` • ${pendingCount} pending` : ''}${isOffline ? ' • Offline' : ''}`}
                action={
                    <div className="flex gap-2">
                        <button
                            onClick={handleMarkAll}
                            disabled={loading}
                            className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:scale-95 disabled:opacity-50 flex items-center gap-2 text-sm"
                        >
                            <Users className="w-4 h-4" />
                            <span className="hidden sm:inline">Mark All</span>
                        </button>
                        <button
                            onClick={refresh}
                            disabled={loading}
                            className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-5 h-5 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                }
            />

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6">
                {isOffline && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
                        <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold text-[var(--fg)] mb-1">Offline Mode Active</p>
                            <p className="text-[var(--muted)]">
                                Attendance is being tracked locally. Data will sync when you're back online.
                            </p>
                        </div>
                    </div>
                )}

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

                <div className="mb-6 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-xs sm:text-sm text-[var(--fg)] font-medium">
                                <strong>Auto-Reset:</strong> Attendance automatically resets daily at midnight.
                            </p>
                            <p className="text-xs text-[var(--muted)] mt-1">
                                {lastResetDate && `Last reset: ${new Date(lastResetDate).toLocaleDateString()}`}
                                {!lastResetDate && 'Works offline - data syncs when online'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    {waiters.map(waiter => (
                        <button
                            key={waiter.id}
                            onClick={() => handleToggle(waiter.id, waiter.is_on_duty)}
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
                                {isOffline ? 'Go online to download staff data' : 'Add staff in admin panel'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
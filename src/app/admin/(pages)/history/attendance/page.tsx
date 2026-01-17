// src/app/admin/(pages)/history/attendance/page.tsx
// 🎯 ATTENDANCE TRACKING - Complete history with analytics

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Calendar, Users, Clock, Download, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type AttendanceRecord = {
    id: string
    waiter_id: string
    date: string
    check_in: string | null
    check_out: string | null
    status: 'present' | 'absent' | 'half-day'
    total_hours: number
    created_at: string
    waiters?: {
        name: string
        profile_pic?: string
        employee_type: string
    }
}

const PRESETS = [
    { id: 'today', label: 'Today', days: 0 },
    { id: 'week', label: 'This Week', days: 7 },
    { id: 'month', label: 'This Month', days: 30 },
    { id: 'all', label: 'All Time', days: 9999 }
]

export default function AttendanceHistoryPage() {
    const router = useRouter()
    const supabase = createClient()

    const [records, setRecords] = useState<AttendanceRecord[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPreset, setSelectedPreset] = useState('month')
    const [selectedWaiter, setSelectedWaiter] = useState<string>('all')
    const [waiters, setWaiters] = useState<any[]>([])

    useEffect(() => {
        loadData()
    }, [selectedPreset, selectedWaiter])

    const getDateRange = () => {
        const preset = PRESETS.find(p => p.id === selectedPreset)
        if (!preset) return { start: new Date(), end: new Date() }

        const end = new Date()
        const start = new Date()

        if (preset.id === 'all') {
            start.setFullYear(2020, 0, 1)
        } else if (preset.id === 'today') {
            start.setHours(0, 0, 0, 0)
        } else {
            start.setDate(start.getDate() - preset.days)
        }

        return { start, end }
    }

    const loadData = async () => {
        setLoading(true)
        const { start, end } = getDateRange()

        try {
            // Load waiters
            const { data: waitersData } = await supabase
                .from('waiters')
                .select('id, name, profile_pic, employee_type')
                .eq('is_active', true)

            setWaiters(waitersData || [])

            // Load attendance records
            let query = supabase
                .from('attendance')
                .select('*, waiters(name, profile_pic, employee_type)')
                .gte('date', start.toISOString().split('T')[0])
                .lte('date', end.toISOString().split('T')[0])
                .order('date', { ascending: false })

            if (selectedWaiter !== 'all') {
                query = query.eq('waiter_id', selectedWaiter)
            }

            const { data, error } = await query

            if (error) throw error
            setRecords(data || [])
        } catch (error) {
            console.error('Load error:', error)
        } finally {
            setLoading(false)
        }
    }

    const stats = useMemo(() => {
        const totalPresent = records.filter(r => r.status === 'present').length
        const totalAbsent = records.filter(r => r.status === 'absent').length
        const totalHalfDay = records.filter(r => r.status === 'half-day').length
        const avgHours = records.length > 0
            ? records.reduce((sum, r) => sum + (r.total_hours || 0), 0) / totalPresent
            : 0

        // Staff wise breakdown
        const staffStats: Record<string, any> = {}
        records.forEach(record => {
            const wId = record.waiter_id
            if (!staffStats[wId]) {
                staffStats[wId] = {
                    name: record.waiters?.name || 'Unknown',
                    present: 0,
                    absent: 0,
                    halfDay: 0,
                    totalHours: 0
                }
            }
            if (record.status === 'present') staffStats[wId].present++
            if (record.status === 'absent') staffStats[wId].absent++
            if (record.status === 'half-day') staffStats[wId].halfDay++
            staffStats[wId].totalHours += record.total_hours || 0
        })

        return {
            totalPresent,
            totalAbsent,
            totalHalfDay,
            avgHours,
            attendanceRate: records.length > 0
                ? ((totalPresent / records.length) * 100).toFixed(1)
                : '0',
            staffStats: Object.values(staffStats)
        }
    }, [records])

    const exportReport = () => {
        const report = `ATTENDANCE REPORT
Period: ${selectedPreset}
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Records: ${records.length}
Present: ${stats.totalPresent} (${stats.attendanceRate}%)
Absent: ${stats.totalAbsent}
Half Day: ${stats.totalHalfDay}
Average Hours: ${stats.avgHours.toFixed(1)}h

=== STAFF BREAKDOWN ===
${stats.staffStats.map((s: any) =>
            `${s.name}: ${s.present}P / ${s.absent}A / ${s.halfDay}H - ${s.totalHours.toFixed(1)}h total`
        ).join('\n')}

=== DETAILED RECORDS ===
${records.map(r => `
Date: ${new Date(r.date).toLocaleDateString()}
Staff: ${r.waiters?.name || 'Unknown'}
Status: ${r.status}
Hours: ${r.total_hours?.toFixed(1) || 0}h
Check In: ${r.check_in || 'N/A'}
Check Out: ${r.check_out || 'N/A'}
`).join('\n')}
`.trim()

        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance-${selectedPreset}-${Date.now()}.txt`
        a.click()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="Attendance History"
                    subtitle={`${records.length} records • ${stats.attendanceRate}% attendance rate`}
                    action={
                        <div className="flex gap-2">
                            <button
                                onClick={exportReport}
                                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                            >
                                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/history')}
                                className="px-3 sm:px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                            >
                                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>
                    }
                />

                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                    {/* Filters */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Period Selector */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-2">Period</label>
                                <div className="flex gap-2 flex-wrap">
                                    {PRESETS.map(preset => (
                                        <button
                                            key={preset.id}
                                            onClick={() => setSelectedPreset(preset.id)}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                                                selectedPreset === preset.id
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)]'
                                            }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Staff Filter */}
                            <div>
                                <label className="block text-xs font-medium text-[var(--muted)] mb-2">Staff Member</label>
                                <select
                                    value={selectedWaiter}
                                    onChange={(e) => setSelectedWaiter(e.target.value)}
                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="all">All Staff</option>
                                    {waiters.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <Users className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Present</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalPresent}</p>
                            <p className="text-xs opacity-75 mt-1">{stats.attendanceRate}% rate</p>
                        </div>

                        <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <Users className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Absent</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalAbsent}</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <Clock className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Half Day</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalHalfDay}</p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <Clock className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Avg Hours</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.avgHours.toFixed(1)}h</p>
                        </div>
                    </div>

                    {/* Records List */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="p-3 sm:p-6 border-b border-[var(--border)]">
                            <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">
                                All Records ({records.length})
                            </h3>
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                            {records.map(record => (
                                <div key={record.id} className="p-3 sm:p-4 hover:bg-[var(--bg)]">
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {record.waiters?.profile_pic ? (
                                            <img
                                                src={record.waiters.profile_pic}
                                                alt={record.waiters.name}
                                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-blue-600"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                                                {record.waiters?.name?.charAt(0) || '?'}
                                            </div>
                                        )}

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-[var(--fg)] text-sm sm:text-base">
                                                    {record.waiters?.name || 'Unknown'}
                                                </p>
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                    record.status === 'present'
                                                        ? 'bg-green-500/20 text-green-600'
                                                        : record.status === 'absent'
                                                            ? 'bg-red-500/20 text-red-600'
                                                            : 'bg-orange-500/20 text-orange-600'
                                                }`}>
                                                    {record.status === 'present' ? '✓ Present' :
                                                        record.status === 'absent' ? '✗ Absent' : '◐ Half Day'}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-[var(--muted)]">
                                                {new Date(record.date).toLocaleDateString('en-US', {
                                                    weekday: 'short',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm sm:text-base font-bold text-blue-600">
                                                {record.total_hours?.toFixed(1) || 0}h
                                            </p>
                                            <p className="text-xs text-[var(--muted)]">
                                                {record.check_in ? record.check_in.slice(0, 5) : '--:--'} -
                                                {record.check_out ? record.check_out.slice(0, 5) : '--:--'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {records.length === 0 && (
                            <div className="p-8 sm:p-12 text-center">
                                <Calendar className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20" />
                                <p className="text-[var(--fg)] font-medium text-sm sm:text-base">No records found</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                                    Try adjusting your filters
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Timer, Download } from 'lucide-react'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'

export default function AdminAttendancePage() {
    const [shifts, setShifts] = useState<any[]>([])
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => { load() }, [date])

    const load = async () => {
        setLoading(true)
        const start = new Date(date)
        start.setHours(0, 0, 0, 0)
        const end = new Date(date)
        end.setHours(23, 59, 59, 999)

        const { data } = await supabase
            .from('waiter_shifts')
            .select('*, waiters(name, profile_pic, phone)')
            .gte('clock_in', start.toISOString())
            .lte('clock_in', end.toISOString())
            .order('clock_in', { ascending: false })

        setShifts(data || [])
        setLoading(false)
    }

    const calculateDuration = (clockIn: string, clockOut: string | null) => {
        const start = new Date(clockIn)
        const end = clockOut ? new Date(clockOut) : new Date()
        const diff = end.getTime() - start.getTime()
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        return `${hours}h ${minutes}m`
    }

    const totalHours = shifts.filter(s => s.clock_out).reduce((sum, s) => {
        const duration = new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()
        return sum + duration / (1000 * 60 * 60)
    }, 0)

    const stats = [
        { label: 'Total Shifts', value: shifts.length, icon: <Timer className="w-6 h-6" />, color: '#3b82f6' },
        { label: 'Active Now', value: shifts.filter(s => !s.clock_out).length, icon: <Timer className="w-6 h-6" />, color: '#10b981' },
        { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, icon: <Timer className="w-6 h-6" />, color: '#f59e0b' }
    ]

    const exportCSV = () => {
        const headers = 'Name,Clock In,Clock Out,Duration\n'
        const rows = shifts.map(s => `${s.waiters?.name},${new Date(s.clock_in).toLocaleString()},${s.clock_out ? new Date(s.clock_out).toLocaleString() : 'Active'},${calculateDuration(s.clock_in, s.clock_out)}`).join('\n')
        const blob = new Blob([headers + rows], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `attendance-${date}.csv`
        a.click()
    }

    const columns = [
        {
            key: 'staff',
            label: 'Staff',
            render: (row: any) => (
                <div className="flex items-center gap-3">
                    {row.waiters?.profile_pic ? (
                        <img src={row.waiters.profile_pic} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                            {row.waiters?.name?.[0] || '?'}
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-sm text-[var(--fg)]">{row.waiters?.name}</p>
                        <p className="text-xs text-[var(--muted)]">{row.waiters?.phone}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'clock_in',
            label: 'Clock In',
            render: (row: any) => (
                <span className="text-sm text-[var(--fg)]">
                    {new Date(row.clock_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
            )
        },
        {
            key: 'clock_out',
            label: 'Clock Out',
            render: (row: any) => row.clock_out ? (
                <span className="text-sm text-[var(--fg)]">
                    {new Date(row.clock_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
            ) : (
                <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse" />
                    Active
                </span>
            )
        },
        {
            key: 'duration',
            label: 'Duration',
            align: 'right' as const,
            render: (row: any) => <span className="font-bold text-[var(--fg)]">{calculateDuration(row.clock_in, row.clock_out)}</span>
        }
    ]

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Records', icon: '📋', count: shifts.length }
    ], 'all', () => {})

    return (
        <>
            <AutoSidebar items={sidebarItems} title="View" />

            <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                <PageHeader
                    title="Attendance Records"
                    subtitle="Staff attendance tracking"
                    action={
                        <div className="flex gap-2">
                            {/* ✅ THEME-AWARE DATE PICKER */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg">
                                <Calendar className="w-4 h-4 text-[var(--muted)]" />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className="bg-transparent text-sm outline-none text-[var(--fg)] cursor-pointer"
                                    style={{
                                        colorScheme: 'dark' // ✅ Forces dark calendar in dark mode
                                    }}
                                />
                            </div>
                            <button
                                onClick={exportCSV}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95 transition-transform"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                        </div>
                    }
                />

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                    <ResponsiveStatsGrid stats={stats} />
                    <UniversalDataTable
                        columns={columns}
                        data={shifts}
                        loading={loading}
                        emptyMessage="No attendance records for this date"
                    />
                </div>
            </div>
        </>
    )
}
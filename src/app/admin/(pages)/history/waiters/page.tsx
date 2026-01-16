// src/app/admin/(pages)/history/waiters/page.tsx
// 🚀 FULLY OPTIMIZED - Fast, Mobile Perfect, User Friendly

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Users, TrendingUp, Award, Calendar, Download, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const PRESETS = [
    { id: 'today', label: 'Today', days: 0 },
    { id: 'week', label: 'Week', days: 7 },
    { id: 'month', label: 'Month', days: 30 },
    { id: 'all', label: 'All Time', days: 9999 }
]

export default function WaitersPerformancePage() {
    const router = useRouter()
    const supabase = createClient()

    const [waiters, setWaiters] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPreset, setSelectedPreset] = useState('month')
    const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null)

    useEffect(() => {
        loadData()
    }, [selectedPreset])

    const getDateRange = () => {
        const preset = PRESETS.find(p => p.id === selectedPreset)
        if (!preset) return { start: new Date(), end: new Date() }

        const end = new Date()
        const start = new Date()

        if (preset.id === 'all') {
            start.setFullYear(2020, 0, 1)
        } else {
            start.setDate(start.getDate() - preset.days)
        }

        return { start, end }
    }

    const loadData = async () => {
        setLoading(true)
        const { start, end } = getDateRange()

        try {
            const [waitersRes, ordersRes] = await Promise.all([
                supabase.from('waiters').select('*').eq('is_active', true),
                supabase.from('orders').select('*, waiters(name, profile_pic)')
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString())
                    .eq('status', 'completed')
            ])

            setWaiters(waitersRes.data || [])
            setOrders(ordersRes.data || [])
        } catch (error) {
            console.error('Load data error:', error)
        } finally {
            setLoading(false)
        }
    }

    const performance = useMemo(() => {
        const stats: any = {}

        waiters.forEach(waiter => {
            const waiterOrders = orders.filter(o => o.waiter_id === waiter.id)
            const totalRevenue = waiterOrders.reduce((s, o) => s + o.total_amount, 0)
            const avgOrder = waiterOrders.length > 0 ? totalRevenue / waiterOrders.length : 0

            stats[waiter.id] = {
                ...waiter,
                orders: waiterOrders.length,
                revenue: totalRevenue,
                avgOrder,
                rank: 0
            }
        })

        const sorted = Object.values(stats).sort((a: any, b: any) => b.revenue - a.revenue)
        sorted.forEach((waiter: any, index) => {
            stats[waiter.id].rank = index + 1
        })

        return sorted
    }, [waiters, orders])

    const selectedWaiterData = useMemo(() => {
        if (!selectedWaiter) return null

        const waiter: any = performance.find((w: any) => w.id === selectedWaiter)
        if (!waiter) return null

        const waiterOrders = orders.filter(o => o.waiter_id === selectedWaiter)

        const dailyData: any = {}
        waiterOrders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString()
            if (!dailyData[date]) {
                dailyData[date] = { orders: 0, revenue: 0 }
            }
            dailyData[date].orders++
            dailyData[date].revenue += order.total_amount
        })

        return {
            id: waiter.id,
            name: waiter.name,
            orders: waiter.orders,
            revenue: waiter.revenue,
            avgOrder: waiter.avgOrder,
            rank: waiter.rank,
            dailyData: Object.entries(dailyData).map(([date, data]) => ({ date, ...(data as any) }))
        }
    }, [selectedWaiter, performance, orders])

    const exportReport = () => {
        const report = `STAFF PERFORMANCE REPORT
Period: ${selectedPreset}
Generated: ${new Date().toLocaleString()}

=== TOP PERFORMERS ===
${performance.slice(0, 10).map((w: any, i: number) =>
            `${i + 1}. ${w.name} - PKR ${w.revenue.toLocaleString()} (${w.orders} orders)`
        ).join('\n')}

=== DETAILED STATS ===
${performance.map((w: any) => `
${w.name}
- Rank: #${w.rank}
- Orders: ${w.orders}
- Revenue: PKR ${w.revenue.toLocaleString()}
- Average Order: PKR ${Math.round(w.avgOrder).toLocaleString()}
`).join('\n')}
    `.trim()

        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `staff-performance-${Date.now()}.txt`
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
                    title="Staff Performance"
                    subtitle={`${performance.length} active staff members`}
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
                    {/* Period Selector */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => setSelectedPreset(preset.id)}
                                className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap shrink-0 ${
                                    selectedPreset === preset.id
                                        ? 'bg-blue-600 text-white shadow-lg'
                                        : 'bg-[var(--card)] border border-[var(--border)] text-[var(--fg)] hover:bg-[var(--bg)]'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>

                    {/* Top 3 Performers */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        {performance.slice(0, 3).map((waiter: any, i: number) => {
                            const colors = [
                                { bg: 'from-yellow-400 to-yellow-600', border: 'border-yellow-500' },
                                { bg: 'from-gray-300 to-gray-500', border: 'border-gray-400' },
                                { bg: 'from-orange-400 to-orange-600', border: 'border-orange-500' }
                            ]
                            return (
                                <div key={waiter.id} className={`bg-gradient-to-br ${colors[i].bg} rounded-xl p-4 sm:p-6 text-white shadow-2xl relative overflow-hidden`}>
                                    <div className="absolute top-4 right-4 text-5xl sm:text-6xl font-bold opacity-20">#{i + 1}</div>
                                    <div className="relative">
                                        {waiter.profile_pic ? (
                                            <img src={waiter.profile_pic} alt={waiter.name} className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 ${colors[i].border} object-cover mb-3 sm:mb-4`} />
                                        ) : (
                                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 ${colors[i].border} bg-white/20 flex items-center justify-center text-2xl sm:text-3xl font-bold mb-3 sm:mb-4`}>
                                                {waiter.name.charAt(0)}
                                            </div>
                                        )}
                                        <h3 className="text-base sm:text-xl font-bold mb-2 truncate">{waiter.name}</h3>
                                        <p className="text-2xl sm:text-3xl font-bold mb-1">₨{(waiter.revenue / 1000).toFixed(1)}k</p>
                                        <p className="text-xs sm:text-sm opacity-90">{waiter.orders} orders • Avg: ₨{Math.round(waiter.avgOrder)}</p>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* All Staff Performance */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="p-3 sm:p-6 border-b border-[var(--border)]">
                            <h3 className="font-bold text-[var(--fg)] flex items-center gap-2 text-sm sm:text-base">
                                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                All Staff Members
                            </h3>
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                            {performance.map((waiter: any) => (
                                <button
                                    key={waiter.id}
                                    onClick={() => setSelectedWaiter(waiter.id === selectedWaiter ? null : waiter.id)}
                                    className="w-full p-3 sm:p-4 hover:bg-[var(--bg)] transition-colors text-left"
                                >
                                    <div className="flex items-center gap-3 sm:gap-4">
                                        {/* Rank Badge */}
                                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-white shrink-0 text-sm sm:text-base ${
                                            waiter.rank === 1 ? 'bg-yellow-500' :
                                                waiter.rank === 2 ? 'bg-gray-400' :
                                                    waiter.rank === 3 ? 'bg-orange-500' : 'bg-blue-600'
                                        }`}>
                                            #{waiter.rank}
                                        </div>

                                        {/* Profile */}
                                        {waiter.profile_pic ? (
                                            <img src={waiter.profile_pic} alt={waiter.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-blue-600 shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0">
                                                {waiter.name.charAt(0)}
                                            </div>
                                        )}

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-[var(--fg)] truncate text-sm sm:text-base">{waiter.name}</p>
                                            <p className="text-xs sm:text-sm text-[var(--muted)] capitalize">{waiter.employee_type}</p>
                                        </div>

                                        {/* Stats */}
                                        <div className="text-right shrink-0">
                                            <p className="text-base sm:text-lg font-bold text-blue-600">₨{(waiter.revenue / 1000).toFixed(1)}k</p>
                                            <p className="text-xs text-[var(--muted)]">{waiter.orders} orders</p>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {selectedWaiter === waiter.id && selectedWaiterData && (
                                        <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-3 animate-in slide-in-from-top-2">
                                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                                <div className="p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                                                    <p className="text-xs text-[var(--muted)]">Total Orders</p>
                                                    <p className="text-base sm:text-xl font-bold text-[var(--fg)]">{selectedWaiterData.orders}</p>
                                                </div>
                                                <div className="p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                                                    <p className="text-xs text-[var(--muted)]">Total Revenue</p>
                                                    <p className="text-base sm:text-xl font-bold text-green-600">₨{(selectedWaiterData.revenue / 1000).toFixed(1)}k</p>
                                                </div>
                                                <div className="p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                                                    <p className="text-xs text-[var(--muted)]">Avg Order</p>
                                                    <p className="text-base sm:text-xl font-bold text-blue-600">₨{Math.round(selectedWaiterData.avgOrder)}</p>
                                                </div>
                                            </div>

                                            {selectedWaiterData.dailyData.length > 0 && (
                                                <div>
                                                    <p className="text-xs sm:text-sm font-semibold text-[var(--fg)] mb-2 flex items-center gap-2">
                                                        <Calendar className="w-4 h-4" />
                                                        Daily Performance
                                                    </p>
                                                    <div className="space-y-1.5 max-h-40 sm:max-h-48 overflow-y-auto">
                                                        {selectedWaiterData.dailyData.map((day: any, i: number) => (
                                                            <div key={i} className="flex justify-between text-xs sm:text-sm p-2 bg-[var(--bg)] rounded">
                                                                <span className="text-[var(--muted)]">{day.date}</span>
                                                                <span className="font-semibold text-[var(--fg)]">
                                                                    {day.orders} orders • ₨{day.revenue.toLocaleString()}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
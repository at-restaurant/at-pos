// src/app/admin/(pages)/history/revenue/page.tsx
// 🚀 FULLY OPTIMIZED - Fast, Mobile Perfect, User Friendly

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, DollarSign, TrendingUp, PieChart, BarChart3, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const PRESETS = [
    { id: 'today', label: 'Today', days: 0 },
    { id: 'week', label: 'Week', days: 7 },
    { id: 'month', label: 'Month', days: 30 },
    { id: 'year', label: 'Year', days: 365 }
]

export default function RevenueAnalysisPage() {
    const router = useRouter()
    const supabase = createClient()

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedPreset, setSelectedPreset] = useState('month')

    useEffect(() => {
        loadRevenue()
    }, [selectedPreset])

    const getDateRange = () => {
        const preset = PRESETS.find(p => p.id === selectedPreset)
        if (!preset) return { start: new Date(), end: new Date() }

        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - preset.days)

        return { start, end }
    }

    const loadRevenue = async () => {
        setLoading(true)
        const { start, end } = getDateRange()

        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .gte('created_at', start.toISOString())
                .lte('created_at', end.toISOString())
                .eq('status', 'completed')

            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Load revenue error:', error)
        } finally {
            setLoading(false)
        }
    }

    const analysis = useMemo(() => {
        const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
        const totalTax = orders.reduce((s, o) => s + (o.tax || 0), 0)
        const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0

        // By type
        const dineIn = orders.filter(o => o.order_type === 'dine-in')
        const delivery = orders.filter(o => o.order_type === 'delivery')
        const takeaway = orders.filter(o => o.order_type === 'takeaway')

        const dineInRevenue = dineIn.reduce((s, o) => s + o.total_amount, 0)
        const deliveryRevenue = delivery.reduce((s, o) => s + o.total_amount, 0)
        const takeawayRevenue = takeaway.reduce((s, o) => s + o.total_amount, 0)

        // By payment
        const cash = orders.filter(o => o.payment_method === 'cash')
        const online = orders.filter(o => o.payment_method === 'online')
        const cashRevenue = cash.reduce((s, o) => s + o.total_amount, 0)
        const onlineRevenue = online.reduce((s, o) => s + o.total_amount, 0)

        // Hourly breakdown
        const hourlyData = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            revenue: 0,
            orders: 0
        }))

        orders.forEach(order => {
            const hour = new Date(order.created_at).getHours()
            hourlyData[hour].revenue += order.total_amount
            hourlyData[hour].orders++
        })

        return {
            totalRevenue,
            totalTax,
            avgOrder,
            orderCount: orders.length,
            byType: [
                { label: 'Dine-In', value: dineInRevenue, count: dineIn.length, color: '#3b82f6', percentage: totalRevenue > 0 ? (dineInRevenue / totalRevenue * 100).toFixed(1) : '0' },
                { label: 'Delivery', value: deliveryRevenue, count: delivery.length, color: '#8b5cf6', percentage: totalRevenue > 0 ? (deliveryRevenue / totalRevenue * 100).toFixed(1) : '0' },
                { label: 'Takeaway', value: takeawayRevenue, count: takeaway.length, color: '#10b981', percentage: totalRevenue > 0 ? (takeawayRevenue / totalRevenue * 100).toFixed(1) : '0' }
            ],
            byPayment: [
                { label: 'Cash', value: cashRevenue, count: cash.length, color: '#10b981', percentage: totalRevenue > 0 ? (cashRevenue / totalRevenue * 100).toFixed(1) : '0' },
                { label: 'Online', value: onlineRevenue, count: online.length, color: '#3b82f6', percentage: totalRevenue > 0 ? (onlineRevenue / totalRevenue * 100).toFixed(1) : '0' }
            ],
            hourlyData: hourlyData.filter(h => h.revenue > 0)
        }
    }, [orders])

    const maxHourlyRevenue = Math.max(...analysis.hourlyData.map(h => h.revenue), 1)

    const exportReport = () => {
        const report = `REVENUE ANALYSIS REPORT
Period: ${selectedPreset}
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Revenue: PKR ${analysis.totalRevenue.toLocaleString()}
Total Orders: ${analysis.orderCount}
Average Order: PKR ${Math.round(analysis.avgOrder).toLocaleString()}
Tax Collected: PKR ${analysis.totalTax.toLocaleString()}

=== BY ORDER TYPE ===
${analysis.byType.map(t => `${t.label}: PKR ${t.value.toLocaleString()} (${t.percentage}%)`).join('\n')}

=== BY PAYMENT METHOD ===
${analysis.byPayment.map(p => `${p.label}: PKR ${p.value.toLocaleString()} (${p.percentage}%)`).join('\n')}

=== HOURLY BREAKDOWN ===
${analysis.hourlyData.map(h => `${h.hour}:00 - PKR ${h.revenue.toLocaleString()} (${h.orders} orders)`).join('\n')}
`.trim()

        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `revenue-report-${Date.now()}.txt`
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
                    title="Revenue Analysis"
                    subtitle={`Financial breakdown • PKR ${(analysis.totalRevenue / 1000).toFixed(1)}k total`}
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

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90 mb-1">Total Revenue</p>
                            <p className="text-lg sm:text-2xl font-bold">₨{(analysis.totalRevenue / 1000).toFixed(1)}k</p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90 mb-1">Total Orders</p>
                            <p className="text-2xl sm:text-3xl font-bold">{analysis.orderCount}</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90 mb-1">Avg Order</p>
                            <p className="text-lg sm:text-2xl font-bold">₨{Math.round(analysis.avgOrder)}</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <PieChart className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90 mb-1">Tax Collected</p>
                            <p className="text-lg sm:text-2xl font-bold">₨{(analysis.totalTax / 1000).toFixed(1)}k</p>
                        </div>
                    </div>

                    {/* Revenue by Type */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <h3 className="font-bold text-[var(--fg)] mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                            <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                            Revenue by Order Type
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            {analysis.byType.map((type, i) => (
                                <div key={i} className="p-3 sm:p-4 rounded-lg" style={{ backgroundColor: `${type.color}10`, border: `2px solid ${type.color}30` }}>
                                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                                        <span className="font-semibold text-sm sm:text-base" style={{ color: type.color }}>{type.label}</span>
                                        <span className="text-xl sm:text-2xl font-bold" style={{ color: type.color }}>{type.percentage}%</span>
                                    </div>
                                    <p className="text-base sm:text-xl font-bold text-[var(--fg)] mb-1">₨{(type.value / 1000).toFixed(1)}k</p>
                                    <p className="text-xs sm:text-sm text-[var(--muted)]">{type.count} orders</p>

                                    <div className="mt-2 sm:mt-3 h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${type.percentage}%`,
                                                backgroundColor: type.color
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Revenue by Payment */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <h3 className="font-bold text-[var(--fg)] mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                            Revenue by Payment Method
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {analysis.byPayment.map((payment, i) => (
                                <div key={i} className="p-4 sm:p-6 rounded-lg" style={{ backgroundColor: `${payment.color}10`, border: `2px solid ${payment.color}30` }}>
                                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                                        <span className="text-base sm:text-lg font-semibold" style={{ color: payment.color }}>{payment.label}</span>
                                        <span className="text-2xl sm:text-3xl font-bold" style={{ color: payment.color }}>{payment.percentage}%</span>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-[var(--fg)] mb-2">₨{(payment.value / 1000).toFixed(1)}k</p>
                                    <p className="text-xs sm:text-sm text-[var(--muted)]">{payment.count} orders</p>

                                    <div className="mt-3 sm:mt-4 h-3 bg-[var(--bg)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${payment.percentage}%`,
                                                backgroundColor: payment.color
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hourly Revenue Chart */}
                    {analysis.hourlyData.length > 0 && (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                            <h3 className="font-bold text-[var(--fg)] mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                Hourly Revenue Breakdown
                            </h3>

                            <div className="space-y-2 sm:space-y-3">
                                {analysis.hourlyData.map((item, i) => (
                                    <div key={i}>
                                        <div className="flex justify-between text-xs sm:text-sm mb-1">
                                            <span className="text-[var(--muted)]">{item.hour}:00</span>
                                            <span className="font-bold text-[var(--fg)]">
                                                ₨{(item.revenue / 1000).toFixed(1)}k • {item.orders} orders
                                            </span>
                                        </div>
                                        <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                                                style={{ width: `${(item.revenue / maxHourlyRevenue) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ErrorBoundary>
    )
}
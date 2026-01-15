// src/app/admin/(pages)/history/page.tsx
// ✅ COMPLETELY REFACTORED: Simple, visual, user-friendly for non-technical admin

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, TrendingUp, DollarSign, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Simple date presets
const PRESETS = [
    { id: 'today', label: 'Today', days: 0 },
    { id: 'yesterday', label: 'Yesterday', days: 1 },
    { id: 'week', label: 'This Week', days: 7 },
    { id: 'month', label: 'This Month', days: 30 },
    { id: 'last-month', label: 'Last Month', days: 60 },
    { id: 'year', label: 'This Year', days: 365 }
]

export default function HistoryPage() {
    const [selectedPreset, setSelectedPreset] = useState('today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [selectedPreset, customStart, customEnd])

    const getDateRange = () => {
        if (customStart && customEnd) {
            return {
                start: new Date(customStart),
                end: new Date(customEnd)
            }
        }

        const preset = PRESETS.find(p => p.id === selectedPreset)
        if (!preset) return { start: new Date(), end: new Date() }

        const end = new Date()
        const start = new Date()

        if (preset.id === 'yesterday') {
            start.setDate(start.getDate() - 1)
            start.setHours(0, 0, 0, 0)
            end.setDate(end.getDate() - 1)
            end.setHours(23, 59, 59, 999)
        } else if (preset.id === 'last-month') {
            start.setDate(start.getDate() - 60)
            end.setDate(end.getDate() - 30)
        } else {
            start.setDate(start.getDate() - preset.days)
        }

        return { start, end }
    }

    const loadData = async () => {
        setLoading(true)
        const { start, end } = getDateRange()

        try {
            // Load all data in parallel
            const [ordersRes, inventoryRes, menuRes, waitersRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('*, order_items(quantity, total_price, menu_items(name, price))')
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString())
                    .eq('status', 'completed'),
                supabase.from('inventory_items').select('*'),
                supabase
                    .from('order_items')
                    .select('menu_item_id, quantity, total_price, menu_items(name, price)')
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString()),
                supabase
                    .from('orders')
                    .select('waiter_id, total_amount, waiters(name)')
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString())
                    .eq('status', 'completed')
            ])

            const orders = ordersRes.data || []
            const inventory = inventoryRes.data || []
            const menuItems = menuRes.data || []
            const waiterOrders = waitersRes.data || []

            // Calculate metrics
            const totalOrders = orders.length
            const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
            const totalTax = orders.reduce((s, o) => s + (o.tax || 0), 0)
            const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0

            // Inventory
            const inventoryValue = inventory.reduce((s, i) => s + (i.quantity * i.purchase_price), 0)
            const lowStock = inventory.filter(i => i.quantity <= i.reorder_level).length

            // Profit (estimated)
            const estimatedCost = totalRevenue * 0.65 // 65% cost
            const profit = totalRevenue - estimatedCost - totalTax

            // Menu items sold
            const itemsSold: any = {}
            menuItems.forEach((item: any) => {
                const name = item.menu_items?.name || 'Unknown'
                if (!itemsSold[name]) {
                    itemsSold[name] = { quantity: 0, revenue: 0 }
                }
                itemsSold[name].quantity += item.quantity
                itemsSold[name].revenue += item.total_price
            })

            const topItems = Object.entries(itemsSold)
                .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
                .slice(0, 10)

            // Waiter performance
            const waiterStats: any = {}
            waiterOrders.forEach((order: any) => {
                const name = order.waiters?.name || 'Unknown'
                if (!waiterStats[name]) {
                    waiterStats[name] = { orders: 0, revenue: 0 }
                }
                waiterStats[name].orders += 1
                waiterStats[name].revenue += order.total_amount
            })

            const topWaiters = Object.entries(waiterStats)
                .sort((a: any, b: any) => b[1].revenue - a[1].revenue)
                .slice(0, 10)

            setData({
                summary: {
                    totalOrders,
                    totalRevenue,
                    totalTax,
                    avgOrder,
                    inventoryValue,
                    lowStock,
                    estimatedCost,
                    profit,
                    profitMargin: totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0
                },
                topItems,
                topWaiters,
                period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
            })
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const exportReport = () => {
        if (!data) return

        const { summary, topItems, topWaiters, period } = data

        const report = `
AT RESTAURANT - BUSINESS REPORT
Period: ${period}

=== FINANCIAL SUMMARY ===
Total Orders: ${summary.totalOrders}
Total Revenue: PKR ${summary.totalRevenue.toLocaleString()}
Average Order: PKR ${Math.round(summary.avgOrder).toLocaleString()}
Tax Collected: PKR ${summary.totalTax.toLocaleString()}
Estimated Cost: PKR ${Math.round(summary.estimatedCost).toLocaleString()}
Net Profit: PKR ${Math.round(summary.profit).toLocaleString()}
Profit Margin: ${summary.profitMargin.toFixed(1)}%

=== INVENTORY ===
Total Value: PKR ${summary.inventoryValue.toLocaleString()}
Low Stock Items: ${summary.lowStock}

=== TOP SELLING ITEMS ===
${topItems.map((item: any, i: number) =>
            `${i + 1}. ${item[0]} - ${item[1].quantity} sold - PKR ${item[1].revenue.toLocaleString()}`
        ).join('\n')}

=== TOP PERFORMING WAITERS ===
${topWaiters.map((waiter: any, i: number) =>
            `${i + 1}. ${waiter[0]} - ${waiter[1].orders} orders - PKR ${waiter[1].revenue.toLocaleString()}`
        ).join('\n')}
        `.trim()

        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report-${Date.now()}.txt`
        a.click()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--muted)]">Loading report...</p>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="Business Reports"
                    subtitle="Simple reports for your restaurant"
                    action={
                        <button
                            onClick={exportReport}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 active:scale-95 transition-all"
                        >
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    }
                />

                <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                    {/* Date Selection */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                        <h3 className="text-lg font-bold text-[var(--fg)] mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Select Time Period
                        </h3>

                        {/* Quick Presets */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                            {PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => {
                                        setSelectedPreset(preset.id)
                                        setCustomStart('')
                                        setCustomEnd('')
                                    }}
                                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                                        selectedPreset === preset.id
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--border)]'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom Range */}
                        <div className="border-t border-[var(--border)] pt-4">
                            <p className="text-sm font-medium text-[var(--fg)] mb-3">Or select custom dates:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-[var(--muted)] mb-1">From</label>
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => {
                                            setCustomStart(e.target.value)
                                            setSelectedPreset('')
                                        }}
                                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--muted)] mb-1">To</label>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => {
                                            setCustomEnd(e.target.value)
                                            setSelectedPreset('')
                                        }}
                                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                            <p className="text-sm text-blue-600 font-medium">
                                📅 Showing: {data?.period}
                            </p>
                        </div>
                    </div>

                    {/* Financial Summary - Big Numbers */}
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 text-white shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <DollarSign className="w-8 h-8" />
                            <div>
                                <h2 className="text-2xl font-bold">Financial Summary</h2>
                                <p className="text-green-100 text-sm">{data?.period}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <p className="text-green-100 text-sm mb-1">Total Orders</p>
                                <p className="text-4xl font-bold">{data?.summary.totalOrders}</p>
                                <p className="text-green-100 text-xs mt-2">
                                    Avg: PKR {Math.round(data?.summary.avgOrder || 0).toLocaleString()}
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <p className="text-green-100 text-sm mb-1">Total Revenue</p>
                                <p className="text-3xl font-bold">
                                    PKR {((data?.summary.totalRevenue || 0) / 1000).toFixed(0)}k
                                </p>
                                <p className="text-green-100 text-xs mt-2">
                                    Tax: PKR {(data?.summary.totalTax || 0).toLocaleString()}
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <p className="text-green-100 text-sm mb-1">Net Profit</p>
                                <p className="text-3xl font-bold">
                                    PKR {(Math.round(data?.summary.profit || 0) / 1000).toFixed(0)}k
                                </p>
                                <p className="text-green-100 text-xs mt-2">
                                    Margin: {(data?.summary.profitMargin || 0).toFixed(1)}%
                                </p>
                            </div>

                            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                                <p className="text-green-100 text-sm mb-1">Inventory Value</p>
                                <p className="text-3xl font-bold">
                                    PKR {((data?.summary.inventoryValue || 0) / 1000).toFixed(0)}k
                                </p>
                                {data?.summary.lowStock > 0 && (
                                    <p className="text-yellow-200 text-xs mt-2 flex items-center gap-1">
                                        ⚠️ {data.summary.lowStock} items low
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                        <h3 className="text-lg font-bold text-[var(--fg)] mb-4">🏆 Best Selling Items</h3>
                        <div className="space-y-3">
                            {data?.topItems.slice(0, 5).map((item: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-4 bg-[var(--bg)] rounded-lg">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                        i === 0 ? 'bg-yellow-500 text-white' :
                                            i === 1 ? 'bg-gray-400 text-white' :
                                                i === 2 ? 'bg-orange-600 text-white' :
                                                    'bg-[var(--border)] text-[var(--muted)]'
                                    }`}>
                                        {i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-[var(--fg)]">{item[0]}</p>
                                        <p className="text-sm text-[var(--muted)]">{item[1].quantity} sold</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-green-600">PKR {item[1].revenue.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Waiters */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                        <h3 className="text-lg font-bold text-[var(--fg)] mb-4">⭐ Top Performing Staff</h3>
                        <div className="space-y-3">
                            {data?.topWaiters.slice(0, 5).map((waiter: any, i: number) => (
                                <div key={i} className="flex items-center gap-4 p-4 bg-[var(--bg)] rounded-lg">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                                        i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                            i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                                                i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                                                    'bg-blue-600'
                                    }`}>
                                        {waiter[0][0]}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium text-[var(--fg)]">{waiter[0]}</p>
                                        <p className="text-sm text-[var(--muted)]">{waiter[1].orders} orders served</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-600">PKR {waiter[1].revenue.toLocaleString()}</p>
                                        <p className="text-xs text-[var(--muted)]">
                                            Avg: PKR {Math.round(waiter[1].revenue / waiter[1].orders).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Profit Breakdown */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                        <h3 className="text-lg font-bold text-[var(--fg)] mb-4">💰 Profit Breakdown</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                                <span className="font-medium text-[var(--fg)]">Total Revenue</span>
                                <span className="font-bold text-green-600">+ PKR {data?.summary.totalRevenue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                                <span className="font-medium text-[var(--fg)]">Estimated Costs (65%)</span>
                                <span className="font-bold text-red-600">- PKR {Math.round(data?.summary.estimatedCost || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                                <span className="font-medium text-[var(--fg)]">Tax</span>
                                <span className="font-bold text-orange-600">- PKR {data?.summary.totalTax.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between p-4 bg-blue-600/20 rounded-lg border-2 border-blue-600">
                                <span className="font-bold text-[var(--fg)]">Net Profit</span>
                                <span className="text-2xl font-bold text-blue-600">
                                    PKR {Math.round(data?.summary.profit || 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
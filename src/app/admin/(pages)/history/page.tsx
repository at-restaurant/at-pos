// src/app/admin/(pages)/history/page.tsx
// ✅ HISTORY HUB: Main navigation + Quick overview

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
    Calendar, TrendingUp, DollarSign, ShoppingBag,
    Users, Package, FileText, MapPin, ArrowRight,
    BarChart3, Clock
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// ✅ ADD TYPE DEFINITIONS
type Order = {
    id: string
    total_amount: number
    status: string
    order_type: string
    payment_method: string
}

type InventoryItem = {
    quantity: number
    purchase_price: number
}

// Date presets
const PRESETS = [
    { id: 'today', label: 'Today', days: 0 },
    { id: 'week', label: 'This Week', days: 7 },
    { id: 'month', label: 'This Month', days: 30 },
    { id: 'year', label: 'This Year', days: 365 }
]

export default function HistoryHub() {
    const [selectedPreset, setSelectedPreset] = useState('month')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    const supabase = createClient()

    useEffect(() => {
        loadQuickStats()
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
        start.setDate(start.getDate() - preset.days)

        return { start, end }
    }

    const loadQuickStats = async () => {
        setLoading(true)
        const { start, end } = getDateRange()

        try {
            // Quick parallel queries
            const [ordersRes, inventoryRes, waitersRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('id, total_amount, status, order_type, payment_method')
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString()),
                supabase
                    .from('inventory_items')
                    .select('quantity, purchase_price'),
                supabase
                    .from('waiters')
                    .select('id, name, total_orders, total_revenue')
                    .eq('is_active', true)
            ])

            const orders = (ordersRes.data || []) as Order[]
            const inventory = (inventoryRes.data || []) as InventoryItem[]
            const waiters = waitersRes.data || []

            // ✅ FIX: Add explicit types for callback parameters
            const completed = orders.filter((o: Order) => o.status === 'completed')
            const totalRevenue = completed.reduce((s: number, o: Order) => s + (o.total_amount || 0), 0)
            const inventoryValue = inventory.reduce((s: number, i: InventoryItem) => s + (i.quantity * i.purchase_price), 0)

            // Order type breakdown
            const dineInCount = orders.filter((o: Order) => o.order_type === 'dine-in').length
            const deliveryCount = orders.filter((o: Order) => o.order_type === 'delivery').length
            const takeawayCount = orders.filter((o: Order) => o.order_type === 'takeaway').length

            // Payment breakdown
            const cashCount = completed.filter((o: Order) => o.payment_method === 'cash').length
            const onlineCount = completed.filter((o: Order) => o.payment_method === 'online').length

            setStats({
                totalOrders: orders.length,
                completedOrders: completed.length,
                totalRevenue,
                inventoryValue,
                activeWaiters: waiters.length,
                dineInCount,
                deliveryCount,
                takeawayCount,
                cashCount,
                onlineCount,
                period: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
            })
        } catch (error) {
            console.error('Load stats error:', error)
        } finally {
            setLoading(false)
        }
    }

    // Navigation cards with dynamic data
    const navigationCards = [
        {
            id: 'orders',
            title: 'Orders History',
            description: 'View all orders with filters',
            icon: ShoppingBag,
            color: '#3b82f6',
            href: '/admin/history/orders',
            stat: `${stats?.totalOrders || 0} orders`,
            subtext: `${stats?.completedOrders || 0} completed`
        },
        {
            id: 'revenue',
            title: 'Revenue Analysis',
            description: 'Charts & financial breakdown',
            icon: DollarSign,
            color: '#10b981',
            href: '/admin/history/revenue',
            stat: `PKR ${((stats?.totalRevenue || 0) / 1000).toFixed(1)}k`,
            subtext: 'Total revenue'
        },
        {
            id: 'inventory',
            title: 'Inventory Archive',
            description: 'Monthly inventory snapshots',
            icon: Package,
            color: '#f59e0b',
            href: '/admin/history/inventory',
            stat: `PKR ${((stats?.inventoryValue || 0) / 1000).toFixed(1)}k`,
            subtext: 'Current value'
        },
        {
            id: 'waiters',
            title: 'Staff Performance',
            description: 'Track individual staff stats',
            icon: Users,
            color: '#8b5cf6',
            href: '/admin/history/waiters',
            stat: `${stats?.activeWaiters || 0} staff`,
            subtext: 'Active members'
        },
        {
            id: 'attendance',
            title: 'Attendance History',
            description: 'Daily staff check-in/out records',
            icon: Calendar,
            color: '#06b6d4',
            href: '/admin/history/attendance',
            stat: `${stats?.todayPresent || 0} present today`,
            subtext: 'Track daily attendance'
        },
        {
            id: 'customers',
            title: 'Customer Database',
            description: 'Delivery & takeaway contacts',
            icon: MapPin,
            color: '#ec4899',
            href: '/admin/history/customers',
            stat: `${stats?.deliveryCount || 0} deliveries`,
            subtext: 'This period'
        }
    ]

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--muted)]">Loading history...</p>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="History & Reports"
                    subtitle={`Track all restaurant data • ${stats?.period}`}
                />

                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    {/* Date Selection */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-[var(--fg)]">Select Period</h3>
                        </div>

                        {/* Quick Presets */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                            {PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => {
                                        setSelectedPreset(preset.id)
                                        setCustomStart('')
                                        setCustomEnd('')
                                    }}
                                    className={`px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                                        selectedPreset === preset.id
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--border)] border border-[var(--border)]'
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
                                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
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
                                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Overview Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
                            <BarChart3 className="w-8 h-8 opacity-80 mb-2" />
                            <p className="text-sm opacity-90">Total Orders</p>
                            <p className="text-3xl font-bold mt-1">{stats?.totalOrders}</p>
                        </div>

                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
                            <DollarSign className="w-8 h-8 opacity-80 mb-2" />
                            <p className="text-sm opacity-90">Revenue</p>
                            <p className="text-2xl font-bold mt-1">PKR {((stats?.totalRevenue || 0) / 1000).toFixed(1)}k</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
                            <Users className="w-8 h-8 opacity-80 mb-2" />
                            <p className="text-sm opacity-90">Active Staff</p>
                            <p className="text-3xl font-bold mt-1">{stats?.activeWaiters}</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
                            <ShoppingBag className="w-8 h-8 opacity-80 mb-2" />
                            <p className="text-sm opacity-90">Dine-In</p>
                            <p className="text-3xl font-bold mt-1">{stats?.dineInCount}</p>
                        </div>

                        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-4 text-white shadow-lg">
                            <MapPin className="w-8 h-8 opacity-80 mb-2" />
                            <p className="text-sm opacity-90">Delivery</p>
                            <p className="text-3xl font-bold mt-1">{stats?.deliveryCount}</p>
                        </div>

                        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl p-4 text-white shadow-lg">
                            <ShoppingBag className="w-8 h-8 opacity-80 mb-2" />
                            <p className="text-sm opacity-90">Takeaway</p>
                            <p className="text-3xl font-bold mt-1">{stats?.takeawayCount}</p>
                        </div>
                    </div>

                    {/* Navigation Cards */}
                    <div>
                        <h2 className="text-xl font-bold text-[var(--fg)] mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Detailed Reports
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {navigationCards.map(card => {
                                const Icon = card.icon
                                return (
                                    <Link
                                        key={card.id}
                                        href={card.href}
                                        className="group bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 hover:border-blue-600 hover:shadow-xl transition-all duration-300 relative overflow-hidden"
                                    >
                                        {/* Background gradient on hover */}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity"
                                            style={{ background: `linear-gradient(135deg, ${card.color}00 0%, ${card.color} 100%)` }}
                                        />

                                        <div className="relative">
                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                                                style={{ backgroundColor: `${card.color}20` }}
                                            >
                                                <Icon className="w-6 h-6" style={{ color: card.color }} />
                                            </div>

                                            <h3 className="font-bold text-[var(--fg)] mb-2 text-lg">{card.title}</h3>
                                            <p className="text-sm text-[var(--muted)] mb-4">{card.description}</p>

                                            <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                                                <div>
                                                    <p className="text-2xl font-bold" style={{ color: card.color }}>
                                                        {card.stat}
                                                    </p>
                                                    <p className="text-xs text-[var(--muted)] mt-1">{card.subtext}</p>
                                                </div>
                                                <ArrowRight
                                                    className="w-5 h-5 text-[var(--muted)] group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
                                                />
                                            </div>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-[var(--fg)] mb-1">💡 Quick Tips</p>
                                <ul className="text-sm text-[var(--muted)] space-y-1">
                                    <li>• Select a date range above to filter all reports</li>
                                    <li>• Click any card to view detailed analysis</li>
                                    <li>• Inventory data auto-saves monthly for long-term tracking</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
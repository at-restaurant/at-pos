// src/app/admin/page.tsx - FIXED ADMIN DASHBOARD
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminProfileBadge from '@/components/ui/AdminProfileBadge'
import AdminProfileModal from '@/components/admin/AdminProfileModal'
import Link from 'next/link'
import {
    Package, Users, LayoutGrid, ShoppingBag, UtensilsCrossed,
    DollarSign, Clock, AlertCircle, ArrowRight,
    Calendar, Target, Award, Activity, BarChart3, PieChart
} from 'lucide-react'

export default function AdminDashboard() {
    const [data, setData] = useState({
        inventory: 0, waiters: 0, tables: 0, orders: 0,
        revenue: 0, todayOrders: 0, activeWaiters: 0,
        lowStock: 0, pendingOrders: 0, todayRevenue: 0,
        completedToday: 0
    })
    const [loading, setLoading] = useState(true)
    const [hourlyData, setHourlyData] = useState<any[]>([])
    const [showProfileModal, setShowProfileModal] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        load()
        const interval = setInterval(load, 30000)
        return () => clearInterval(interval)
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const [inv, wait, tab, ord, todayOrd, invItems] = await Promise.all([
                supabase.from('inventory_items').select('id', { count: 'exact', head: true }),
                supabase.from('waiters').select('id, is_on_duty', { count: 'exact' }),
                supabase.from('restaurant_tables').select('id', { count: 'exact', head: true }),
                supabase.from('orders').select('total_amount, status'),
                supabase.from('orders').select('id, total_amount, status, created_at').gte('created_at', today.toISOString()),
                supabase.from('inventory_items').select('quantity, reorder_level')
            ])

            // ✅ SAFE DATA EXTRACTION
            const ordersData = Array.isArray(ord.data) ? ord.data : []
            const todayOrdersData = Array.isArray(todayOrd.data) ? todayOrd.data : []
            const inventoryData = Array.isArray(invItems.data) ? invItems.data : []
            const waitersData = Array.isArray(wait.data) ? wait.data : []

            const revenue = ordersData.reduce((s, o) => s + (o?.total_amount || 0), 0)
            const todayRevenue = todayOrdersData.reduce((s, o) => s + (o?.total_amount || 0), 0)
            const lowStock = inventoryData.filter(i => (i?.quantity || 0) <= (i?.reorder_level || 0)).length
            const pendingOrders = ordersData.filter(o => o?.status === 'pending').length
            const activeWaiters = waitersData.filter(w => w?.is_on_duty).length
            const completedToday = todayOrdersData.filter(o => o?.status === 'completed').length

            // Calculate hourly data for chart
            const hourly = Array.from({ length: 24 }, (_, i) => ({
                hour: i,
                orders: 0,
                revenue: 0
            }))

            todayOrdersData.forEach(order => {
                if (order?.created_at) {
                    const hour = new Date(order.created_at).getHours()
                    hourly[hour].orders++
                    hourly[hour].revenue += order.total_amount || 0
                }
            })

            setHourlyData(hourly.filter(h => h.orders > 0 || h.revenue > 0))

            setData({
                inventory: inv.count || 0,
                waiters: wait.count || 0,
                tables: tab.count || 0,
                orders: ordersData.length,
                revenue,
                todayOrders: todayOrdersData.length,
                activeWaiters,
                lowStock,
                pendingOrders,
                todayRevenue,
                completedToday
            })
        } catch (error) {
            console.error('Failed to load dashboard:', error)
        }
        setLoading(false)
    }

    const quickActions = [
        {
            id: 'inventory',
            label: 'Inventory',
            icon: Package,
            href: '/admin/inventory',
            color: '#3b82f6',
            badge: data.lowStock > 0 ? data.lowStock : null,
            description: `${data.inventory} items`
        },
        {
            id: 'staff',
            label: 'Staff',
            icon: Users,
            href: '/admin/waiters',
            color: '#8b5cf6',
            badge: data.activeWaiters,
            description: `${data.waiters} total`
        },
        {
            id: 'tables',
            label: 'Tables',
            icon: LayoutGrid,
            href: '/admin/tables',
            color: '#10b981',
            description: `${data.tables} tables`
        },
        {
            id: 'menu',
            label: 'Menu',
            icon: UtensilsCrossed,
            href: '/admin/menu',
            color: '#f59e0b',
            description: 'Manage items'
        },
        {
            id: 'history',
            label: 'History',
            icon: Clock,
            href: '/admin/history',
            color: '#06b6d4',
            description: 'Reports'
        }
    ]

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--muted)] text-sm sm:text-base">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    const maxRevenue = Math.max(...hourlyData.map(h => h.revenue), 1)

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)] backdrop-blur-lg bg-opacity-80">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <AdminProfileBadge onClick={() => setShowProfileModal(true)} />

                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--fg)]">
                                    Dashboard
                                </h1>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 flex items-center gap-2">
                                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                    {new Date().toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={load}
                            className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg text-sm sm:text-base font-medium"
                        >
                            <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">

                {/* Quick Stats */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg sm:text-xl font-bold text-[var(--fg)]">Today's Overview</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        {[
                            {
                                label: "Orders",
                                value: data.todayOrders,
                                icon: ShoppingBag,
                                color: '#3b82f6',
                                subtext: `${data.completedToday} completed`
                            },
                            {
                                label: "Revenue",
                                value: `PKR ${data.todayRevenue.toLocaleString()}`,
                                icon: DollarSign,
                                color: '#10b981',
                                subtext: 'Today'
                            },
                            {
                                label: 'Staff',
                                value: `${data.activeWaiters}/${data.waiters}`,
                                icon: Users,
                                color: '#f59e0b',
                                subtext: 'On duty'
                            },
                            {
                                label: 'Low Stock',
                                value: data.lowStock,
                                icon: AlertCircle,
                                color: data.lowStock > 0 ? '#ef4444' : '#10b981',
                                subtext: data.lowStock > 0 ? 'Alert!' : 'All good'
                            }
                        ].map((stat, idx) => {
                            const Icon = stat.icon
                            return (
                                <div key={idx} className="p-4 sm:p-5 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-blue-600 transition-all">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                                            <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                                        </div>
                                    </div>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mb-1">{stat.label}</p>
                                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--fg)]">{stat.value}</p>
                                    <p className="text-xs text-[var(--muted)] mt-1">{stat.subtext}</p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* Charts Section */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Hourly Orders Chart */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">Hourly Orders</h3>
                        </div>

                        {hourlyData.length > 0 ? (
                            <div className="space-y-3">
                                {hourlyData.map((item, idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs sm:text-sm mb-1">
                                            <span className="text-[var(--muted)]">{item.hour}:00</span>
                                            <span className="font-bold text-[var(--fg)]">{item.orders} orders</span>
                                        </div>
                                        <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                                style={{ width: `${(item.orders / Math.max(...hourlyData.map(h => h.orders), 1)) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-[var(--muted)] text-sm">
                                No orders yet today
                            </div>
                        )}
                    </div>

                    {/* Revenue Chart */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <PieChart className="w-5 h-5 text-green-600" />
                            <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">Hourly Revenue</h3>
                        </div>

                        {hourlyData.length > 0 ? (
                            <div className="space-y-3">
                                {hourlyData.map((item, idx) => (
                                    <div key={idx}>
                                        <div className="flex justify-between text-xs sm:text-sm mb-1">
                                            <span className="text-[var(--muted)]">{item.hour}:00</span>
                                            <span className="font-bold text-green-600">PKR {item.revenue.toLocaleString()}</span>
                                        </div>
                                        <div className="h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-green-600 rounded-full transition-all duration-500"
                                                style={{ width: `${(item.revenue / maxRevenue) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-[var(--muted)] text-sm">
                                No revenue yet today
                            </div>
                        )}
                    </div>
                </section>

                {/* Alerts Section */}
                {(data.lowStock > 0 || data.pendingOrders > 5) && (
                    <section className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-500/50 rounded-xl p-4 sm:p-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                            <div className="flex-1">
                                <h3 className="font-bold text-yellow-900 dark:text-yellow-100 mb-2 text-sm sm:text-base">
                                    ⚠️ Attention Required
                                </h3>
                                <ul className="space-y-1 text-xs sm:text-sm">
                                    {data.lowStock > 0 && (
                                        <li className="text-yellow-800 dark:text-yellow-200">
                                            • <strong>{data.lowStock}</strong> inventory items are low on stock
                                        </li>
                                    )}
                                    {data.pendingOrders > 5 && (
                                        <li className="text-yellow-800 dark:text-yellow-200">
                                            • <strong>{data.pendingOrders}</strong> orders are pending
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}

                {/* Quick Actions */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg sm:text-xl font-bold text-[var(--fg)]">Quick Actions</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {quickActions.map(action => {
                            const Icon = action.icon
                            return (
                                <Link
                                    key={action.id}
                                    href={action.href}
                                    className="group relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6 hover:border-blue-600 hover:shadow-xl transition-all duration-300 active:scale-95"
                                >
                                    {action.badge !== null && action.badge !== undefined && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-red-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg animate-pulse">
                                            {action.badge}
                                        </div>
                                    )}

                                    <div
                                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg"
                                        style={{ backgroundColor: `${action.color}20` }}
                                    >
                                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: action.color }} />
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-[var(--fg)] mb-1 text-sm sm:text-base">
                                            {action.label}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-[var(--muted)]">
                                            {action.description}
                                        </p>
                                    </div>

                                    <ArrowRight
                                        className="absolute bottom-4 right-4 w-4 h-4 text-[var(--muted)] group-hover:text-blue-600 group-hover:translate-x-1 transition-all"
                                    />
                                </Link>
                            )
                        })}
                    </div>
                </section>
            </div>

            <AdminProfileModal
                open={showProfileModal}
                onClose={() => setShowProfileModal(false)}
            />
        </div>
    )
}
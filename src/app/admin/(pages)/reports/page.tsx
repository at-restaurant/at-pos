// src/app/admin/(pages)/history/page.tsx - COMPLETE PRODUCTION VERSION
'use client'

import { useState, useEffect , useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, TrendingUp, DollarSign, ShoppingCart, Download, Package, Users, Activity, BarChart3, PieChart } from 'lucide-react'
import { useSidebarItems } from '@/lib/hooks/useSidebarItems'
import AutoSidebar from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type Category = 'overview' | 'waiters' | 'menu' | 'profit' | 'inventory'
type DateRange = 'week' | 'month' | 'year' | 'all'

export default function HistoryPage() {
    const [category, setCategory] = useState<Category>('overview')
    const [dateRange, setDateRange] = useState<DateRange>('week')
    const [data, setData] = useState<any[]>([])
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [overviewData, setOverviewData] = useState<any>(null)
    const supabase = createClient()

    useEffect(() => { loadData() }, [category, dateRange])

    const getDateFilter = () => {
        const now = new Date()
        const filters: Record<DateRange, Date> = {
            week: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            month: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
            year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
            all: new Date(0)
        }
        return filters[dateRange]
    }

    const loadData = async () => {
        setLoading(true)
        const startDate = getDateFilter()

        try {
            if (category === 'overview') {
                // ✅ COMPREHENSIVE OVERVIEW
                const [ordersRes, inventoryRes, waiterShiftsRes] = await Promise.all([
                    supabase
                        .from('orders')
                        .select('*, order_items(quantity, total_price, menu_items(name, price, category_id))')
                        .gte('created_at', startDate.toISOString())
                        .eq('status', 'completed'),
                    supabase.from('inventory_items').select('*'),
                    supabase
                        .from('waiter_shifts')
                        .select('waiter_id, clock_in, clock_out')
                        .gte('clock_in', startDate.toISOString())
                ])

                const orders = ordersRes.data || []
                const inventory = inventoryRes.data || []
                const shifts = waiterShiftsRes.data || []

                // Calculate metrics
                const totalOrders = orders.length
                const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
                const totalTax = orders.reduce((s, o) => s + (o.tax || 0), 0)
                const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

                // Inventory value
                const totalInventoryValue = inventory.reduce((s, i) =>
                    s + (i.quantity * i.purchase_price), 0)
                const lowStockItems = inventory.filter(i => i.quantity <= i.reorder_level).length

                // Items sold
                const itemsSold: Record<string, number> = {}
                orders.forEach(order => {
                    order.order_items?.forEach((item: any) => {
                        const name = item.menu_items?.name || 'Unknown'
                        itemsSold[name] = (itemsSold[name] || 0) + item.quantity
                    })
                })
                const totalItemsSold = Object.values(itemsSold).reduce((a, b) => a + b, 0)
                const topSellingItem = Object.entries(itemsSold).sort((a, b) => b[1] - a[1])[0]

                // Working hours
                const totalWorkingHours = shifts.reduce((sum, shift) => {
                    if (shift.clock_out) {
                        const duration = new Date(shift.clock_out).getTime() - new Date(shift.clock_in).getTime()
                        return sum + duration / (1000 * 60 * 60)
                    }
                    return sum
                }, 0)

                // Cost estimation (70% of revenue)
                const estimatedCost = totalRevenue * 0.7
                const grossProfit = totalRevenue - estimatedCost
                const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

                const overview = {
                    totalOrders,
                    totalRevenue,
                    totalTax,
                    avgOrderValue,
                    totalInventoryValue,
                    lowStockItems,
                    totalItemsSold,
                    topSellingItem: topSellingItem ? `${topSellingItem[0]} (${topSellingItem[1]} sold)` : 'N/A',
                    totalWorkingHours: totalWorkingHours.toFixed(1),
                    totalShifts: shifts.length,
                    estimatedCost,
                    grossProfit,
                    profitMargin: profitMargin.toFixed(1)
                }

                setOverviewData(overview)
                setData([overview])

                setStats([
                    { label: 'Total Orders', value: totalOrders, color: '#3b82f6', icon: <ShoppingCart className="w-6 h-6" /> },
                    { label: 'Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Gross Profit', value: `PKR ${Math.round(grossProfit).toLocaleString()}`, color: '#8b5cf6', icon: <TrendingUp className="w-6 h-6" /> },
                    { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, color: '#f59e0b', icon: <BarChart3 className="w-6 h-6" /> }
                ])

            } else if (category === 'waiters') {
                // ✅ WAITER ANALYTICS
                const [ordersRes, shiftsRes] = await Promise.all([
                    supabase
                        .from('orders')
                        .select('waiter_id, total_amount, status, created_at, waiters(name, profile_pic, phone)')
                        .gte('created_at', startDate.toISOString()),
                    supabase
                        .from('waiter_shifts')
                        .select('waiter_id, clock_in, clock_out')
                        .gte('clock_in', startDate.toISOString())
                ])

                const orders = ordersRes.data || []
                const shifts = shiftsRes.data || []

                const shiftsByWaiter: { [key: string]: any[] } = {}
                shifts.forEach(shift => {
                    if (!shiftsByWaiter[shift.waiter_id]) {
                        shiftsByWaiter[shift.waiter_id] = []
                    }
                    shiftsByWaiter[shift.waiter_id].push(shift)
                })

                const waiterData = orders.reduce((acc: any, order: any) => {
                    const wId = order.waiter_id
                    if (!wId) return acc

                    if (!acc[wId]) {
                        const waiterShifts = shiftsByWaiter[wId] || []
                        const totalHours = waiterShifts.reduce((sum, shift) => {
                            if (shift.clock_out) {
                                const duration = new Date(shift.clock_out).getTime() - new Date(shift.clock_in).getTime()
                                return sum + duration / (1000 * 60 * 60)
                            }
                            return sum
                        }, 0)

                        acc[wId] = {
                            waiter_id: wId,
                            waiter_name: order.waiters?.name || 'Unknown',
                            profile_pic: order.waiters?.profile_pic,
                            phone: order.waiters?.phone,
                            total_orders: 0,
                            completed_orders: 0,
                            total_revenue: 0,
                            avg_order_value: 0,
                            total_shifts: waiterShifts.length,
                            total_hours: totalHours,
                            performance_score: 0
                        }
                    }

                    acc[wId].total_orders += 1
                    if (order.status === 'completed') {
                        acc[wId].completed_orders += 1
                        acc[wId].total_revenue += order.total_amount || 0
                    }

                    return acc
                }, {})

                Object.values(waiterData).forEach((waiter: any) => {
                    waiter.avg_order_value = waiter.completed_orders > 0
                        ? waiter.total_revenue / waiter.completed_orders
                        : 0

                    const completionRate = waiter.total_orders > 0
                        ? (waiter.completed_orders / waiter.total_orders) * 100
                        : 0
                    const ordersPerShift = waiter.total_shifts > 0
                        ? waiter.completed_orders / waiter.total_shifts
                        : 0

                    waiter.performance_score = Math.min(100, Math.round(
                        (completionRate * 0.4) + (Math.min(ordersPerShift * 5, 50)) + (waiter.total_shifts * 1)
                    ))
                })

                const result = Object.values(waiterData).sort((a: any, b: any) => b.performance_score - a.performance_score)
                setData(result)

                const totalRevenue = result.reduce((s: number, w: any) => s + w.total_revenue, 0)
                const totalOrders = result.reduce((s: number, w: any) => s + w.total_orders, 0)

                setStats([
                    { label: 'Active Waiters', value: result.length, color: '#3b82f6', icon: <Users className="w-6 h-6" /> },
                    { label: 'Total Orders', value: totalOrders, color: '#10b981', icon: <ShoppingCart className="w-6 h-6" /> },
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#f59e0b', icon: <DollarSign className="w-6 h-6" /> }
                ])

            } else if (category === 'menu') {
                // ✅ MENU ANALYTICS
                const orderItems = await supabase
                    .from('order_items')
                    .select('menu_item_id, quantity, total_price, menu_items(name, price)')
                    .gte('created_at', startDate.toISOString())

                const items = orderItems.data || []
                const menuStats: any = {}

                items.forEach((item: any) => {
                    const id = item.menu_item_id
                    if (!menuStats[id]) {
                        menuStats[id] = {
                            item_name: item.menu_items?.name || 'Unknown',
                            item_price: item.menu_items?.price || 0,
                            total_quantity: 0,
                            total_revenue: 0
                        }
                    }
                    menuStats[id].total_quantity += item.quantity || 0
                    menuStats[id].total_revenue += item.total_price || 0
                })

                const result = Object.values(menuStats).sort((a: any, b: any) => b.total_revenue - a.total_revenue)
                setData(result)

                const totalRevenue = result.reduce((s: number, i: any) => s + i.total_revenue, 0)

                setStats([
                    { label: 'Items Sold', value: result.length, color: '#3b82f6', icon: <Package className="w-6 h-6" /> },
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> }
                ])

            } else if (category === 'profit') {
                // ✅ PROFIT ANALYSIS WITH INVENTORY
                const [ordersRes, inventoryRes] = await Promise.all([
                    supabase
                        .from('orders')
                        .select('total_amount, subtotal, tax, status')
                        .gte('created_at', startDate.toISOString())
                        .eq('status', 'completed'),
                    supabase.from('inventory_items').select('quantity, purchase_price')
                ])

                const orders = ordersRes.data || []
                const inventory = inventoryRes.data || []

                const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
                const totalTax = orders.reduce((s, o) => s + (o.tax || 0), 0)
                const totalInventoryValue = inventory.reduce((s, i) => s + (i.quantity * i.purchase_price), 0)
                const estimatedCost = totalRevenue * 0.7
                const grossProfit = totalRevenue - estimatedCost
                const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

                const profitDetails = {
                    total_revenue: totalRevenue,
                    estimated_cost: estimatedCost,
                    gross_profit: grossProfit,
                    profit_margin: profitMargin,
                    tax_collected: totalTax,
                    inventory_value: totalInventoryValue,
                    net_revenue: totalRevenue - totalTax
                }

                setData([profitDetails])
                setStats([
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Gross Profit', value: `PKR ${Math.round(grossProfit).toLocaleString()}`, color: '#3b82f6', icon: <TrendingUp className="w-6 h-6" /> },
                    { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, color: '#f59e0b', icon: <BarChart3 className="w-6 h-6" /> },
                    { label: 'Inventory Value', value: `PKR ${totalInventoryValue.toLocaleString()}`, color: '#8b5cf6', icon: <Package className="w-6 h-6" /> }
                ])

            } else if (category === 'inventory') {
                // ✅ INVENTORY USAGE
                const inventory = await supabase.from('inventory_items').select('*')
                const items = inventory.data || []

                const result = items.map(item => ({
                    ...item,
                    total_value: item.quantity * item.purchase_price,
                    status: item.quantity <= item.reorder_level * 0.5 ? 'critical' :
                        item.quantity <= item.reorder_level ? 'low' : 'high'
                }))

                setData(result)

                const totalValue = result.reduce((s, i) => s + i.total_value, 0)
                const lowStock = result.filter(i => i.status === 'low' || i.status === 'critical').length

                setStats([
                    { label: 'Total Items', value: result.length, color: '#3b82f6', icon: <Package className="w-6 h-6" /> },
                    { label: 'Total Value', value: `PKR ${totalValue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Low Stock', value: lowStock, color: '#f59e0b', icon: <Activity className="w-6 h-6" /> }
                ])
            }
        } catch (error) {
            console.error('Error loading data:', error)
            setData([])
            setStats([])
        }
        setLoading(false)
    }

    const exportCSV = () => {
        if (data.length === 0) return
        const headers = Object.keys(data[0]).join(',')
        const rows = data.map(r => Object.values(r).join(',')).join('\n')
        const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `history-${category}-${Date.now()}.csv`
        a.click()
    }

    const columns: any = {
        overview: [
            {
                key: 'metric',
                label: 'Business Overview',
                render: () => (
                    <div className="space-y-3 w-full">
                        {/* 📊 Orders & Revenue */}
                        <div className="w-full space-y-3">
                            {/* Total Orders */}
                            <div className="w-full p-4 bg-blue-600/10 dark:bg-blue-600/20 rounded-xl border border-blue-600/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                            📊 Total Orders
                                        </p>
                                        <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                            {overviewData?.totalOrders || 0}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-xs text-[var(--muted)] mb-1">Average</p>
                                        <p className="text-sm font-semibold text-[var(--fg)]">
                                            PKR {Math.round(overviewData?.avgOrderValue || 0)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Total Revenue */}
                            <div className="w-full p-4 bg-green-600/10 dark:bg-green-600/20 rounded-xl border border-green-600/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                                            💰 Total Revenue
                                        </p>
                                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                            {(overviewData?.totalRevenue || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-xs text-[var(--muted)] mb-1">Tax</p>
                                        <p className="text-sm font-semibold text-[var(--fg)]">
                                            PKR {(overviewData?.totalTax || 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 📈 Profit Analysis */}
                        <div className="w-full p-4 bg-purple-600/10 dark:bg-purple-600/20 rounded-xl border border-purple-600/30">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-3">
                                📈 Profit Analysis
                            </p>
                            <div className="space-y-2">
                                {/* Cost */}
                                <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
                                        <span className="text-xs text-[var(--muted)] truncate">Cost (Est.)</span>
                                    </div>
                                    <span className="text-sm font-bold text-red-600 dark:text-red-400 ml-2 flex-shrink-0">
                                    PKR {Math.round(overviewData?.estimatedCost || 0).toLocaleString()}
                                </span>
                                </div>

                                {/* Profit */}
                                <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                                        <span className="text-xs text-[var(--muted)] truncate">Gross Profit</span>
                                    </div>
                                    <span className="text-sm font-bold text-green-600 dark:text-green-400 ml-2 flex-shrink-0">
                                    PKR {Math.round(overviewData?.grossProfit || 0).toLocaleString()}
                                </span>
                                </div>

                                {/* Margin */}
                                <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                                        <span className="text-xs text-[var(--muted)] truncate">Profit Margin</span>
                                    </div>
                                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400 ml-2 flex-shrink-0">
                                    {overviewData?.profitMargin || 0}%
                                </span>
                                </div>
                            </div>
                        </div>

                        {/* 📦 Inventory & Sales */}
                        <div className="w-full space-y-3">
                            {/* Inventory Value */}
                            <div className="w-full p-4 bg-orange-600/10 dark:bg-orange-600/20 rounded-xl border border-orange-600/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">
                                            📦 Inventory Value
                                        </p>
                                        <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                                            PKR {(overviewData?.totalInventoryValue || 0).toLocaleString()}
                                        </p>
                                        {overviewData?.lowStockItems > 0 && (
                                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 dark:bg-red-600/20 rounded-md">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                                {overviewData?.lowStockItems} low stock
                                            </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items Sold */}
                            <div className="w-full p-4 bg-cyan-600/10 dark:bg-cyan-600/20 rounded-xl border border-cyan-600/30">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400 mb-1">
                                            🛍️ Items Sold
                                        </p>
                                        <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mb-2">
                                            {overviewData?.totalItemsSold || 0}
                                        </p>
                                        {overviewData?.topSellingItem && (
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-xs text-[var(--muted)] flex-shrink-0">Top:</span>
                                                <span className="text-xs font-semibold text-[var(--fg)] truncate">
                                                {overviewData?.topSellingItem}
                                            </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 👥 Staff Performance */}
                        <div className="w-full p-4 bg-pink-600/10 dark:bg-pink-600/20 rounded-xl border border-pink-600/30">
                            <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 mb-3">
                                👥 Staff Performance
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {/* Total Shifts */}
                                <div className="p-3 bg-[var(--bg)] rounded-lg text-center">
                                    <p className="text-xs text-[var(--muted)] mb-1">Total Shifts</p>
                                    <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                        {overviewData?.totalShifts || 0}
                                    </p>
                                </div>

                                {/* Working Hours */}
                                <div className="p-3 bg-[var(--bg)] rounded-lg text-center">
                                    <p className="text-xs text-[var(--muted)] mb-1">Working Hours</p>
                                    <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                                        {overviewData?.totalWorkingHours || 0}h
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 💡 Quick Stats Summary */}
                        <div className="w-full p-4 bg-[var(--card)] rounded-xl border border-[var(--border)]">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="text-center p-3 bg-[var(--bg)] rounded-lg">
                                    <p className="text-xs text-[var(--muted)] mb-1">Avg Order</p>
                                    <p className="text-lg font-bold text-[var(--fg)]">
                                        PKR {Math.round(overviewData?.avgOrderValue || 0)}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-[var(--bg)] rounded-lg">
                                    <p className="text-xs text-[var(--muted)] mb-1">Profit %</p>
                                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {overviewData?.profitMargin || 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        ],
        waiters: [
            {
                key: 'waiter',
                label: 'Waiter',
                render: (r: any) => (
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        {r.profile_pic ? (
                            <img
                                src={r.profile_pic}
                                alt={r.waiter_name}
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                            />
                        ) : (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0">
                                {r.waiter_name?.[0] || '?'}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--fg)] text-xs sm:text-sm truncate">
                                {r.waiter_name}
                            </p>
                            <p className="text-xs text-[var(--muted)] truncate">
                                {r.phone || 'No phone'}
                            </p>
                        </div>
                    </div>
                )
            },
            {
                key: 'performance',
                label: 'Performance',
                render: (r: any) => {
                    const score = r.performance_score || 0
                    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
                    return (
                        <div className="w-full">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-1.5 sm:h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ width: `${score}%`, backgroundColor: color }}
                                    />
                                </div>
                                <span
                                    className="text-xs sm:text-sm font-bold flex-shrink-0"
                                    style={{ color }}
                                >
                        {score}%
                    </span>
                            </div>
                        </div>
                    )
                }
            },
            {
                key: 'stats',
                label: 'Orders & Revenue',
                render: (r: any) => (
                    <div>
                        <p className="font-bold text-[var(--fg)] text-xs sm:text-sm">
                            {r.completed_orders}/{r.total_orders} orders
                        </p>
                        <p className="text-xs text-green-600 font-medium">
                            PKR {(r.total_revenue || 0).toLocaleString()}
                        </p>
                    </div>
                )
            }
        ],
        menu: [
            {
                key: 'item',
                label: 'Item',
                render: (r: any) => (
                    <span className="font-medium text-[var(--fg)] text-xs sm:text-sm truncate block">
            {r.item_name}
        </span>
                )
            },
            {
                key: 'sold',
                label: 'Sold',
                render: (r: any) => (
                    <span className="font-bold text-[var(--fg)] text-sm sm:text-base">
            {r.total_quantity}
        </span>
                )
            },
            {
                key: 'revenue',
                label: 'Revenue',
                align: 'right' as const,
                render: (r: any) => (
                    <span className="font-bold text-blue-600 text-xs sm:text-sm whitespace-nowrap">
            PKR {(r.total_revenue || 0).toLocaleString()}
        </span>
                )
            }
        ],
        profit: [
            {
                key: 'details',
                label: 'Financial Summary',
                render: (r: any) => (
                    <div className="space-y-2">
                        <div className="flex justify-between p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                            <span className="text-[var(--muted)] text-xs sm:text-sm">Total Revenue</span>
                            <span className="font-bold text-green-600 text-xs sm:text-sm whitespace-nowrap">
                    PKR {(r.total_revenue || 0).toLocaleString()}
                </span>
                        </div>
                        <div className="flex justify-between p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                            <span className="text-[var(--muted)] text-xs sm:text-sm">Estimated Cost</span>
                            <span className="font-bold text-red-600 text-xs sm:text-sm whitespace-nowrap">
                    PKR {Math.round(r.estimated_cost || 0).toLocaleString()}
                </span>
                        </div>
                        <div className="flex justify-between p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                            <span className="text-[var(--muted)] text-xs sm:text-sm">Gross Profit</span>
                            <span className="font-bold text-blue-600 text-xs sm:text-sm whitespace-nowrap">
                    PKR {Math.round(r.gross_profit || 0).toLocaleString()}
                </span>
                        </div>
                        <div className="flex justify-between p-2 sm:p-3 bg-[var(--bg)] rounded-lg">
                            <span className="text-[var(--muted)] text-xs sm:text-sm">Inventory Value</span>
                            <span className="font-bold text-purple-600 text-xs sm:text-sm whitespace-nowrap">
                    PKR {(r.inventory_value || 0).toLocaleString()}
                </span>
                        </div>
                    </div>
                )
            }
        ],
        inventory: [
            {
                key: 'item',
                label: 'Item',
                render: (r: any) => (
                    <span className="font-medium text-[var(--fg)] text-xs sm:text-sm truncate block">
            {r.name}
        </span>
                )
            },
            {
                key: 'stock',
                label: 'Stock',
                render: (r: any) => {
                    const color = r.status === 'critical' ? '#ef4444' : r.status === 'low' ? '#f59e0b' : '#10b981'
                    return (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-bold text-[var(--fg)] text-sm">
                    {r.quantity}
                </span>
                            <span
                                className="px-2 py-0.5 rounded text-xs font-medium inline-block"
                                style={{ backgroundColor: `${color}20`, color }}
                            >
                    {r.status}
                </span>
                        </div>
                    )
                }
            },
            {
                key: 'value',
                label: 'Value',
                align: 'right' as const,
                render: (r: any) => (
                    <span className="font-bold text-blue-600 text-xs sm:text-sm whitespace-nowrap">
            PKR {(r.total_value || 0).toLocaleString()}
        </span>
                )
            }
        ]
    }

    const sidebarItems = useSidebarItems([
        { id: 'overview', label: 'Business Overview', icon: '📊', count: 0 },
        { id: 'profit', label: 'Profit & Inventory', icon: '💰', count: 0 },
        { id: 'waiters', label: 'Waiter Analytics', icon: '👤', count: category === 'waiters' ? data.length : 0 },
        { id: 'menu', label: 'Menu Stats', icon: '🍽️', count: category === 'menu' ? data.length : 0 },
        { id: 'inventory', label: 'Inventory', icon: '📦', count: category === 'inventory' ? data.length : 0 }
    ], category, (id: string) => setCategory(id as Category))

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Reports" />

                <div className="lg:ml-64">
                    <PageHeader
                        title="Reports"
                        subtitle="Complete business insights with inventory tracking"
                        action={
                            <div className="flex gap-2">
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                                    className="px-2 sm:px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs sm:text-sm text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    style={{
                                        colorScheme: typeof document !== 'undefined' &&
                                        document.documentElement.classList.contains('dark')
                                            ? 'dark' : 'light'
                                    }}
                                >
                                    <option value="week">Last Week</option>
                                    <option value="month">Last Month</option>
                                    <option value="year">Last Year</option>
                                    <option value="all">All Time</option>
                                </select>
                                <button
                                    onClick={exportCSV}
                                    className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 transition-all"
                                >
                                    <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                            </div>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable
                            columns={columns[category]}
                            data={data}
                            loading={loading}
                            searchable={category !== 'overview' && category !== 'profit'}
                        />
                    </div>
                </div>
            </>
        </ErrorBoundary>
    )
}
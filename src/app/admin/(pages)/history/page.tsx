// src/app/admin/(pages)/history/page.tsx - COMPLETE WAITER ANALYTICS
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, TrendingUp, DollarSign, ShoppingCart, Download, Package, TrendingDown, Percent, Activity, Clock, Award, Users } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type Category = 'recent' | 'waiters' | 'menu' | 'profit' | 'inventory'
type DateRange = 'week' | 'month' | 'year' | 'all'

export default function HistoryPage() {
    const [category, setCategory] = useState<Category>('recent')
    const [dateRange, setDateRange] = useState<DateRange>('week')
    const [data, setData] = useState<any[]>([])
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [profitData, setProfitData] = useState<any>(null)
    const [selectedWaiter, setSelectedWaiter] = useState<any>(null)
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
            if (category === 'recent') {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('*, waiters(name), restaurant_tables(table_number), order_items(quantity, total_price, menu_items(name, price))')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(500)

                const safeOrders = Array.isArray(orders) ? orders : []
                setData(safeOrders)

                const completed = safeOrders.filter(o => o.status === 'completed')
                const totalRevenue = completed.reduce((s, o) => s + (o.total_amount || 0), 0)
                const avgOrder = completed.length > 0 ? totalRevenue / completed.length : 0
                const totalTax = completed.reduce((s, o) => s + (o.tax || 0), 0)

                setStats([
                    { label: 'Total Orders', value: safeOrders.length, color: '#3b82f6', icon: <ShoppingCart className="w-6 h-6" /> },
                    { label: 'Completed', value: completed.length, color: '#10b981', icon: <TrendingUp className="w-6 h-6" /> },
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#f59e0b', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Avg Order', value: `PKR ${Math.round(avgOrder)}`, color: '#8b5cf6', icon: <TrendingUp className="w-6 h-6" /> },
                    { label: 'Tax Collected', value: `PKR ${totalTax.toLocaleString()}`, color: '#06b6d4', icon: <Percent className="w-6 h-6" /> }
                ])
            } else if (category === 'waiters') {
                // ✅ COMPREHENSIVE WAITER STATS WITH ATTENDANCE
                const { data: orders } = await supabase
                    .from('orders')
                    .select('waiter_id, total_amount, status, created_at, waiters(name, profile_pic, phone)')
                    .gte('created_at', startDate.toISOString())

                const { data: shifts } = await supabase
                    .from('waiter_shifts')
                    .select('waiter_id, clock_in, clock_out')
                    .gte('clock_in', startDate.toISOString())

                const safeOrders = Array.isArray(orders) ? orders : []
                const safeShifts = Array.isArray(shifts) ? shifts : []

                // Calculate shift durations
                const shiftsByWaiter: { [key: string]: any[] } = {}
                safeShifts.forEach(shift => {
                    if (!shiftsByWaiter[shift.waiter_id]) {
                        shiftsByWaiter[shift.waiter_id] = []
                    }
                    shiftsByWaiter[shift.waiter_id].push(shift)
                })

                const waiterData = safeOrders.reduce((acc: any, order: any) => {
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
                            pending_orders: 0,
                            cancelled_orders: 0,
                            total_revenue: 0,
                            avg_order_value: 0,
                            total_shifts: waiterShifts.length,
                            total_hours: totalHours,
                            attendance_days: new Set(),
                            performance_score: 0
                        }
                    }

                    acc[wId].total_orders += 1

                    if (order.status === 'completed') {
                        acc[wId].completed_orders += 1
                        acc[wId].total_revenue += order.total_amount || 0
                    } else if (order.status === 'pending') {
                        acc[wId].pending_orders += 1
                    } else if (order.status === 'cancelled') {
                        acc[wId].cancelled_orders += 1
                    }

                    // Track unique working days
                    const orderDate = new Date(order.created_at).toDateString()
                    acc[wId].attendance_days.add(orderDate)

                    return acc
                }, {})

                // Calculate averages and performance scores
                Object.values(waiterData).forEach((waiter: any) => {
                    waiter.avg_order_value = waiter.completed_orders > 0
                        ? waiter.total_revenue / waiter.completed_orders
                        : 0

                    waiter.attendance_days = waiter.attendance_days.size

                    // Performance Score (0-100)
                    const completionRate = waiter.total_orders > 0
                        ? (waiter.completed_orders / waiter.total_orders) * 100
                        : 0
                    const ordersPerShift = waiter.total_shifts > 0
                        ? waiter.completed_orders / waiter.total_shifts
                        : 0

                    waiter.performance_score = Math.min(100, Math.round(
                        (completionRate * 0.4) + // 40% weight on completion rate
                        (Math.min(ordersPerShift * 5, 50)) + // 50% weight on productivity
                        (waiter.total_shifts * 1) // 10% weight on attendance
                    ))
                })

                const result = Object.values(waiterData).sort((a: any, b: any) => b.performance_score - a.performance_score)
                setData(result)

                const totalRevenue = result.reduce((s: number, w: any) => s + w.total_revenue, 0)
                const totalOrders = result.reduce((s: number, w: any) => s + w.total_orders, 0)
                const totalShifts = result.reduce((s: number, w: any) => s + w.total_shifts, 0)
                const avgPerformance = result.length > 0
                    ? result.reduce((s: number, w: any) => s + w.performance_score, 0) / result.length
                    : 0

                setStats([
                    { label: 'Active Waiters', value: result.length, color: '#3b82f6', icon: <Users className="w-6 h-6" /> },
                    { label: 'Total Orders', value: totalOrders, color: '#10b981', icon: <ShoppingCart className="w-6 h-6" /> },
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#f59e0b', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Total Shifts', value: totalShifts, color: '#8b5cf6', icon: <Clock className="w-6 h-6" /> },
                    { label: 'Avg Performance', value: `${avgPerformance.toFixed(1)}%`, color: '#06b6d4', icon: <Award className="w-6 h-6" /> }
                ])
            } else if (category === 'menu') {
                const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('menu_item_id, quantity, total_price, menu_items(name, price)')
                    .gte('created_at', startDate.toISOString())

                const safeItems = Array.isArray(orderItems) ? orderItems : []
                const menuStats: any = {}

                safeItems.forEach((item: any) => {
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

                const totalUnits = result.reduce((s: number, i: any) => s + i.total_quantity, 0)
                const totalRevenue = result.reduce((s: number, i: any) => s + i.total_revenue, 0)

                setStats([
                    { label: 'Items Sold', value: result.length, color: '#3b82f6', icon: <Package className="w-6 h-6" /> },
                    { label: 'Total Units', value: totalUnits, color: '#10b981', icon: <ShoppingCart className="w-6 h-6" /> },
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#f59e0b', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Avg/Item', value: result.length > 0 ? `PKR ${Math.round(totalRevenue / result.length)}` : 'PKR 0', color: '#8b5cf6', icon: <TrendingUp className="w-6 h-6" /> }
                ])
            } else if (category === 'profit') {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('total_amount, subtotal, tax, delivery_charges, status, order_items(quantity, total_price, menu_items(name, price))')
                    .gte('created_at', startDate.toISOString())
                    .eq('status', 'completed')

                const safeOrders = Array.isArray(orders) ? orders : []

                const totalRevenue = safeOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
                const totalTax = safeOrders.reduce((s, o) => s + (o.tax || 0), 0)
                const totalDelivery = safeOrders.reduce((s, o) => s + (o.delivery_charges || 0), 0)
                const estimatedCost = safeOrders.reduce((s, o) => s + ((o.subtotal || 0) * 0.7), 0)
                const grossProfit = totalRevenue - estimatedCost
                const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100) : 0

                const profitDetails = {
                    total_revenue: totalRevenue,
                    estimated_cost: estimatedCost,
                    gross_profit: grossProfit,
                    profit_margin: profitMargin,
                    tax_collected: totalTax,
                    delivery_charges: totalDelivery,
                    net_revenue: totalRevenue - totalTax - totalDelivery
                }

                setProfitData(profitDetails)
                setData([profitDetails])

                setStats([
                    { label: 'Total Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Est. Cost', value: `PKR ${Math.round(estimatedCost).toLocaleString()}`, color: '#ef4444', icon: <TrendingDown className="w-6 h-6" /> },
                    { label: 'Gross Profit', value: `PKR ${Math.round(grossProfit).toLocaleString()}`, color: '#3b82f6', icon: <TrendingUp className="w-6 h-6" /> },
                    { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, color: '#f59e0b', icon: <Percent className="w-6 h-6" /> }
                ])
            } else if (category === 'inventory') {
                const { data: invItems } = await supabase
                    .from('inventory_items')
                    .select('id, name, quantity, unit, purchase_price, reorder_level, total_value')

                const safeInv = Array.isArray(invItems) ? invItems : []

                const totalValue = safeInv.reduce((s, i) => s + (i.total_value || 0), 0)
                const lowStock = safeInv.filter(i => i.quantity <= i.reorder_level).length
                const criticalStock = safeInv.filter(i => i.quantity <= i.reorder_level * 0.5).length

                setData(safeInv.map(item => ({
                    ...item,
                    status: item.quantity <= item.reorder_level * 0.5 ? 'critical' :
                        item.quantity <= item.reorder_level ? 'low' :
                            item.quantity <= item.reorder_level * 2 ? 'medium' : 'high',
                    usage_percent: item.reorder_level > 0 ? ((item.quantity / item.reorder_level) * 100).toFixed(0) : 'N/A'
                })))

                setStats([
                    { label: 'Total Items', value: safeInv.length, color: '#3b82f6', icon: <Package className="w-6 h-6" /> },
                    { label: 'Inventory Value', value: `PKR ${totalValue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> },
                    { label: 'Low Stock', value: lowStock, color: '#f59e0b', icon: <TrendingDown className="w-6 h-6" /> },
                    { label: 'Critical', value: criticalStock, color: '#ef4444', icon: <Activity className="w-6 h-6" /> }
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
        recent: [
            {
                key: 'order',
                label: 'Order',
                render: (r: any) => (
                    <div>
                        <p className="font-medium text-sm text-[var(--fg)]">#{r?.id ? String(r.id).slice(0, 8).toUpperCase() : 'N/A'}</p>
                        <p className="text-xs text-[var(--muted)]">{r?.created_at ? new Date(r.created_at).toLocaleString() : 'Unknown'}</p>
                        <p className="text-xs text-blue-600 font-medium mt-1">{r?.order_type || 'dine-in'}</p>
                    </div>
                )
            },
            { key: 'waiter', label: 'Waiter', mobileHidden: true, render: (r: any) => <span className="text-sm text-[var(--fg)]">{r?.waiters?.name || 'N/A'}</span> },
            {
                key: 'items',
                label: 'Items',
                render: (r: any) => {
                    const items = Array.isArray(r?.order_items) ? r.order_items : []
                    return <span className="text-sm text-[var(--fg)]">{items.length}</span>
                }
            },
            {
                key: 'amount',
                label: 'Amount',
                align: 'right' as const,
                render: (r: any) => (
                    <div className="text-right">
                        <span className="font-bold text-blue-600 block">PKR {(r?.total_amount || 0).toLocaleString()}</span>
                        {r?.tax > 0 && <span className="text-xs text-[var(--muted)]">Tax: {r.tax}</span>}
                    </div>
                )
            }
        ],
        waiters: [
            {
                key: 'waiter',
                label: 'Waiter',
                render: (r: any) => (
                    <div className="flex items-center gap-3">
                        {r?.profile_pic ?
                            <img src={r.profile_pic} alt="" className="w-10 h-10 rounded-full object-cover" /> :
                            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                                {r?.waiter_name?.[0] || '?'}
                            </div>
                        }
                        <div>
                            <p className="text-sm font-medium text-[var(--fg)]">{r?.waiter_name || 'N/A'}</p>
                            <p className="text-xs text-[var(--muted)]">{r?.phone || 'No phone'}</p>
                        </div>
                    </div>
                )
            },
            {
                key: 'performance',
                label: 'Performance',
                render: (r: any) => {
                    const score = r?.performance_score || 0
                    const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
                    return (
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="flex-1 h-2 bg-[var(--bg)] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${score}%`, backgroundColor: color }}
                                    />
                                </div>
                                <span className="text-sm font-bold" style={{ color }}>{score}%</span>
                            </div>
                            <p className="text-xs text-[var(--muted)]">
                                {score >= 80 ? '🌟 Excellent' : score >= 60 ? '👍 Good' : '📊 Average'}
                            </p>
                        </div>
                    )
                },
                mobileHidden: true
            },
            {
                key: 'stats',
                label: 'Orders & Revenue',
                render: (r: any) => (
                    <div>
                        <p className="text-sm font-bold text-[var(--fg)]">
                            {r?.completed_orders || 0}/{r?.total_orders || 0} orders
                        </p>
                        <p className="text-xs text-green-600 font-medium">PKR {(r?.total_revenue || 0).toLocaleString()}</p>
                        <p className="text-xs text-[var(--muted)]">Avg: PKR {Math.round(r?.avg_order_value || 0)}</p>
                    </div>
                )
            },
            {
                key: 'attendance',
                label: 'Attendance',
                render: (r: any) => (
                    <div>
                        <p className="text-sm font-bold text-blue-600">{r?.total_shifts || 0} shifts</p>
                        <p className="text-xs text-[var(--muted)]">{(r?.total_hours || 0).toFixed(1)}h total</p>
                        <p className="text-xs text-purple-600 font-medium">{r?.attendance_days || 0} days</p>
                    </div>
                ),
                mobileHidden: true
            }
        ],
        menu: [
            {
                key: 'item',
                label: 'Item',
                render: (r: any) => (
                    <div>
                        <span className="text-sm font-medium text-[var(--fg)] block">{r?.item_name || 'N/A'}</span>
                        <span className="text-xs text-[var(--muted)]">PKR {r?.item_price || 0} each</span>
                    </div>
                )
            },
            { key: 'quantity', label: 'Sold', render: (r: any) => <span className="text-sm font-bold text-[var(--fg)]">{r?.total_quantity || 0}</span> },
            {
                key: 'revenue',
                label: 'Revenue',
                align: 'right' as const,
                render: (r: any) => (
                    <div className="text-right">
                        <span className="font-bold text-blue-600 block">PKR {(r?.total_revenue || 0).toLocaleString()}</span>
                        <span className="text-xs text-[var(--muted)]">Avg: {r?.total_quantity > 0 ? Math.round(r.total_revenue / r.total_quantity) : 0}</span>
                    </div>
                )
            }
        ],
        profit: [
            {
                key: 'metric',
                label: 'Metric',
                render: () => <span className="text-sm font-medium text-[var(--fg)]">Financial Summary</span>
            },
            {
                key: 'details',
                label: 'Details',
                render: (r: any) => (
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-[var(--muted)]">Total Revenue:</span>
                            <span className="font-bold text-green-600">PKR {(r?.total_revenue || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--muted)]">Est. Cost (70%):</span>
                            <span className="font-bold text-red-600">PKR {Math.round(r?.estimated_cost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--muted)]">Gross Profit:</span>
                            <span className="font-bold text-blue-600">PKR {Math.round(r?.gross_profit || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--muted)]">Profit Margin:</span>
                            <span className="font-bold text-purple-600">{(r?.profit_margin || 0).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between border-t border-[var(--border)] pt-1 mt-1">
                            <span className="text-[var(--muted)]">Tax Collected:</span>
                            <span className="font-medium text-[var(--fg)]">PKR {(r?.tax_collected || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-[var(--muted)]">Delivery Charges:</span>
                            <span className="font-medium text-[var(--fg)]">PKR {(r?.delivery_charges || 0).toLocaleString()}</span>
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
                    <div>
                        <span className="text-sm font-medium text-[var(--fg)] block">{r?.name || 'N/A'}</span>
                        <span className="text-xs text-[var(--muted)]">{r?.unit || 'unit'}</span>
                    </div>
                )
            },
            {
                key: 'stock',
                label: 'Stock',
                render: (r: any) => {
                    const statusColor = r?.status === 'critical' ? '#ef4444' :
                        r?.status === 'low' ? '#f59e0b' :
                            r?.status === 'medium' ? '#3b82f6' : '#10b981'
                    return (
                        <div>
                            <span className="text-sm font-bold text-[var(--fg)] block">{r?.quantity || 0}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full capitalize font-medium" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                                {r?.status || 'N/A'}
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
                    <div className="text-right">
                        <span className="font-bold text-blue-600 block">PKR {(r?.total_value || 0).toLocaleString()}</span>
                        <span className="text-xs text-[var(--muted)]">@{r?.purchase_price || 0}</span>
                    </div>
                )
            }
        ]
    }

    const sidebarItems = useSidebarItems([
        { id: 'profit', label: 'Profit Analysis', icon: '💰', count: 0 },
        { id: 'recent', label: 'Recent Orders', icon: '📋', count: category === 'recent' ? data.length : 0 },
        { id: 'waiters', label: 'Waiter Analytics', icon: '👤', count: category === 'waiters' ? data.length : 0 },
        { id: 'menu', label: 'Menu Stats', icon: '🍽️', count: category === 'menu' ? data.length : 0 },
        { id: 'inventory', label: 'Inventory Usage', icon: '📦', count: category === 'inventory' ? data.length : 0 }
    ], category, (id: string) => setCategory(id as Category))

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Reports" />

                <div className="lg:ml-64">
                    <PageHeader
                        title="History & Analytics"
                        subtitle="Comprehensive business insights with attendance tracking"
                        action={
                            <div className="flex gap-2">
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                                    className="px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    style={{
                                        colorScheme: typeof window !== 'undefined' &&
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
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 text-sm active:scale-95 hover:bg-green-700 transition-all"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                            </div>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                <div>
                                    <p className="font-semibold text-[var(--fg)]">📊 Full Analytics with Attendance</p>
                                    <p className="text-sm text-[var(--muted)]">
                                        {typeof window !== 'undefined' && navigator.onLine
                                            ? `Viewing ${dateRange === 'all' ? 'all-time' : dateRange} data with attendance tracking`
                                            : '⚠️ Offline: Showing cached 7-day data only'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        <ResponsiveStatsGrid stats={stats} />

                        {/* Profit Breakdown Card */}
                        {category === 'profit' && profitData && (
                            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl p-6 text-white shadow-2xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <DollarSign className="w-6 h-6" />
                                    Profit Breakdown
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                                        <p className="text-sm opacity-90 mb-2">Total Revenue</p>
                                        <p className="text-2xl font-bold">PKR {profitData.total_revenue.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                                        <p className="text-sm opacity-90 mb-2">Estimated Cost (70%)</p>
                                        <p className="text-2xl font-bold">PKR {Math.round(profitData.estimated_cost).toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                                        <p className="text-sm opacity-90 mb-2">Gross Profit (30%)</p>
                                        <p className="text-2xl font-bold">PKR {Math.round(profitData.gross_profit).toLocaleString()}</p>
                                        <p className="text-xs opacity-75 mt-1">{profitData.profit_margin.toFixed(1)}% margin</p>
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-white/20">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="opacity-75">Tax Collected</p>
                                            <p className="font-bold">PKR {profitData.tax_collected.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="opacity-75">Delivery Charges</p>
                                            <p className="font-bold">PKR {profitData.delivery_charges.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <UniversalDataTable
                            columns={columns[category]}
                            data={data}
                            loading={loading}
                            searchable={category !== 'profit'}
                            emptyMessage={`No ${category} data for this period`}
                        />
                    </div>
                </div>
            </>
        </ErrorBoundary>
    )
}
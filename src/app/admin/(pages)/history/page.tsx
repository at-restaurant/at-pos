'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, TrendingUp, DollarSign, ShoppingCart, Download } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type Category = 'recent' | 'waiters' | 'menu'
type DateRange = 'week' | 'month' | 'year' | 'all'

export default function HistoryPage() {
    const [category, setCategory] = useState<Category>('recent')
    const [dateRange, setDateRange] = useState<DateRange>('week')
    const [data, setData] = useState<any[]>([])
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
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
                const { data: orders, error } = await supabase
                    .from('orders')
                    .select('*, waiters(name), restaurant_tables(table_number), order_items(quantity, total_price, menu_items(name))')
                    .gte('created_at', startDate.toISOString())
                    .order('created_at', { ascending: false })
                    .limit(500)

                const safeOrders = Array.isArray(orders) ? orders : []
                setData(safeOrders)

                const completed = safeOrders.filter(o => o.status === 'completed')
                const totalRevenue = completed.reduce((s, o) => s + (o.total_amount || 0), 0)
                const avgOrder = completed.length > 0 ? totalRevenue / completed.length : 0

                setStats([
                    {
                        label: 'Total Orders',
                        value: safeOrders.length,
                        color: '#3b82f6',
                        icon: <ShoppingCart className="w-6 h-6" />
                    },
                    {
                        label: 'Completed',
                        value: completed.length,
                        color: '#10b981',
                        icon: <TrendingUp className="w-6 h-6" />
                    },
                    {
                        label: 'Total Revenue',
                        value: `PKR ${totalRevenue.toLocaleString()}`,
                        color: '#f59e0b',
                        icon: <DollarSign className="w-6 h-6" />
                    },
                    {
                        label: 'Avg Order',
                        value: `PKR ${Math.round(avgOrder)}`,
                        color: '#8b5cf6',
                        icon: <TrendingUp className="w-6 h-6" />
                    }
                ])
            } else if (category === 'waiters') {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('waiter_id, total_amount, waiters(name, profile_pic)')
                    .gte('created_at', startDate.toISOString())
                    .eq('status', 'completed')

                const safeOrders = Array.isArray(orders) ? orders : []

                const waiterData = safeOrders.reduce((acc: any, order: any) => {
                    const wId = order.waiter_id
                    if (!wId) return acc
                    if (!acc[wId]) {
                        acc[wId] = {
                            waiter_name: order.waiters?.name || 'Unknown',
                            profile_pic: order.waiters?.profile_pic,
                            total_orders: 0,
                            total_revenue: 0
                        }
                    }
                    acc[wId].total_orders += 1
                    acc[wId].total_revenue += order.total_amount || 0
                    return acc
                }, {})

                const result = Object.values(waiterData)
                setData(result)
                setStats([
                    { label: 'Active Waiters', value: result.length, color: '#3b82f6' },
                    { label: 'Total Orders', value: safeOrders.length, color: '#10b981' }
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
                            total_quantity: 0,
                            total_revenue: 0
                        }
                    }
                    menuStats[id].total_quantity += item.quantity || 0
                    menuStats[id].total_revenue += item.total_price || 0
                })

                const result = Object.values(menuStats).sort((a: any, b: any) => b.total_revenue - a.total_revenue)
                setData(result)
                setStats([
                    { label: 'Items Sold', value: result.length, color: '#3b82f6' },
                    { label: 'Total Units', value: result.reduce((s: number, i: any) => s + i.total_quantity, 0), color: '#10b981' }
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
                render: (r: any) => {
                    const orderId = r?.id ? String(r.id) : 'N/A'
                    const orderNumber = orderId !== 'N/A' ? orderId.slice(0, 8).toUpperCase() : 'N/A'

                    return (
                        <div>
                            <p className="font-medium text-sm text-[var(--fg)]">#{orderNumber}</p>
                            <p className="text-xs text-[var(--muted)]">
                                {r?.created_at ? new Date(r.created_at).toLocaleString() : 'Unknown'}
                            </p>
                        </div>
                    )
                }
            },
            { key: 'waiter', label: 'Waiter', mobileHidden: true, render: (r: any) => <span className="text-sm text-[var(--fg)]">{r?.waiters?.name || 'N/A'}</span> },
            { key: 'items', label: 'Items', render: (r: any) => {
                    const items = Array.isArray(r?.order_items) ? r.order_items : []
                    return <span className="text-sm text-[var(--fg)]">{items.length}</span>
                }
            },
            {
                key: 'amount',
                label: 'Amount',
                align: 'right' as const,
                render: (r: any) => (
                    <span className="font-bold text-blue-600">
                        PKR {(r?.total_amount || 0).toLocaleString()}
                    </span>
                )
            }
        ],
        waiters: [
            { key: 'waiter', label: 'Waiter', render: (r: any) => (
                    <div className="flex items-center gap-2">
                        {r?.profile_pic ? <img src={r.profile_pic} alt="" className="w-8 h-8 rounded-full" /> :
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                                {r?.waiter_name?.[0] || '?'}
                            </div>
                        }
                        <span className="text-sm text-[var(--fg)]">{r?.waiter_name || 'N/A'}</span>
                    </div>
                )
            },
            { key: 'orders', label: 'Orders', render: (r: any) => <span className="text-sm text-[var(--fg)]">{r?.total_orders || 0}</span> },
            {
                key: 'revenue',
                label: 'Revenue',
                align: 'right' as const,
                render: (r: any) => (
                    <span className="font-bold text-green-600">
                        PKR {(r?.total_revenue || 0).toLocaleString()}
                    </span>
                )
            }
        ],
        menu: [
            { key: 'item', label: 'Item', render: (r: any) => <span className="text-sm text-[var(--fg)]">{r?.item_name || 'N/A'}</span> },
            { key: 'quantity', label: 'Sold', render: (r: any) => <span className="text-sm text-[var(--fg)]">{r?.total_quantity || 0}</span> },
            {
                key: 'revenue',
                label: 'Revenue',
                align: 'right' as const,
                render: (r: any) => (
                    <span className="font-bold text-blue-600">
                        PKR {(r?.total_revenue || 0).toLocaleString()}
                    </span>
                )
            }
        ]
    }

    const sidebarItems = useSidebarItems([
        { id: 'recent', label: 'Recent Orders', icon: '📋', count: category === 'recent' ? data.length : 0 },
        { id: 'waiters', label: 'Waiter Stats', icon: '👤', count: category === 'waiters' ? data.length : 0 },
        { id: 'menu', label: 'Menu Stats', icon: '🍽️', count: category === 'menu' ? data.length : 0 }
    ], category, (id: string) => setCategory(id as Category))

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Reports" />

                <div className="lg:ml-64">
                    <PageHeader
                        title="History & Reports"
                        subtitle="Full online history • Offline: Last 7 days cached"
                        action={
                            <div className="flex gap-2">
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                                    className="px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="week">Last Week</option>
                                    <option value="month">Last Month</option>
                                    <option value="year">Last Year</option>
                                    <option value="all">All Time</option>
                                </select>
                                <button
                                    onClick={exportCSV}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 text-sm active:scale-95"
                                >
                                    <Download className="w-4 h-4" />
                                    Export
                                </button>
                            </div>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                <div>
                                    <p className="font-semibold text-[var(--fg)]">📊 Full History (Online)</p>
                                    <p className="text-sm text-[var(--muted)]">
                                        {typeof window !== 'undefined' && navigator.onLine
                                            ? `Viewing ${dateRange === 'all' ? 'all-time' : dateRange} data from Supabase`
                                            : '⚠️ Offline: Showing cached 7-day data only'
                                        }
                                    </p>
                                </div>
                            </div>
                        </div>

                        <ResponsiveStatsGrid stats={stats} />

                        <UniversalDataTable
                            columns={columns[category]}
                            data={data}
                            loading={loading}
                            searchable
                        />
                    </div>
                </div>
            </>
        </ErrorBoundary>
    )
}

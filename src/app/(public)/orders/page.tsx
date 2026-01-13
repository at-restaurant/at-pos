// src/app/(public)/orders/page.tsx - SIMPLIFIED REUSABLE VERSION
"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { Printer, RefreshCw, WifiOff, Calendar } from 'lucide-react'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import UniversalModal from '@/components/ui/UniversalModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useToast } from '@/components/ui/Toast'
import { getOrderStatusColor } from '@/lib/utils/statusHelpers'
import { useReusableData } from '@/lib/hooks/useReusableData'
import { db, dbHelpers } from '@/lib/db/dexie'
import {
    categorizeOrder,
    getTodayRange,
    loadOrderWithRelations,
    printAndCompleteOrder,
    cancelOrder,
    calculateTodayStats
} from '@/lib/utils/orderUtils'
import type { OrderWithRelations } from '@/types'

export default function OrdersPage() {
    const [filter, setFilter] = useState('active')
    const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null)
    const [orders, setOrders] = useState<OrderWithRelations[]>([])
    const [pendingCount, setPendingCount] = useState(0)
    const [menuCategories, setMenuCategories] = useState<Record<string, { name: string; icon: string }>>({})

    const toast = useToast()

    // ✅ Use reusable hook
    const { data: rawOrders, loading, isOnline, refresh } = useReusableData<any>({
        table: 'orders',
        orderBy: 'created_at',
        refreshInterval: 5000
    })

    // Load enriched orders
    useEffect(() => {
        async function enrichOrders() {
            const enriched = await Promise.all(
                rawOrders.map(o => loadOrderWithRelations(o.id))
            )
            setOrders(enriched.filter(Boolean) as OrderWithRelations[])
        }

        if (rawOrders.length > 0) enrichOrders()
    }, [rawOrders])

    // Load menu categories
    useEffect(() => {
        async function loadCategories() {
            const categories = await db.menu_categories.toArray()
            const items = await db.menu_items.toArray()

            const categoryMap: Record<string, { name: string; icon: string }> = {}
            items.forEach(item => {
                const category = categories.find(c => c.id === item.category_id)
                if (category) {
                    categoryMap[item.id] = { name: category.name, icon: category.icon || '📋' }
                }
            })

            setMenuCategories(categoryMap)
        }
        loadCategories()
    }, [])

    // Update pending count
    useEffect(() => {
        async function updatePending() {
            const count = await dbHelpers.getPendingCount()
            setPendingCount(count)
        }
        updatePending()
        const interval = setInterval(updatePending, 5000)
        return () => clearInterval(interval)
    }, [])

    // Filter orders
    const filtered = useMemo(() => {
        const { startDate, endDate } = getTodayRange()

        switch (filter) {
            case 'active':
                return orders.filter(o => o.status === 'pending')

            case 'dine-in-today':
                return orders.filter(o => {
                    const orderDate = new Date(o.created_at)
                    return orderDate >= startDate && orderDate <= endDate &&
                        o.order_type === 'dine-in' && o.status === 'completed'
                })

            case 'delivery':
                return orders.filter(o => {
                    const orderDate = new Date(o.created_at)
                    const { category } = categorizeOrder(o)
                    return orderDate >= startDate && orderDate <= endDate &&
                        category === 'delivery' && o.status === 'completed'
                })

            case 'takeaway':
                return orders.filter(o => {
                    const orderDate = new Date(o.created_at)
                    const { category } = categorizeOrder(o)
                    return orderDate >= startDate && orderDate <= endDate &&
                        category === 'takeaway' && o.status === 'completed'
                })

            default:
                return orders
        }
    }, [orders, filter])

    // Calculate stats
    const todayStats = useMemo(() => calculateTodayStats(orders), [orders])

    const stats = [
        { label: 'Active Orders', value: todayStats.active, color: '#f59e0b', onClick: () => setFilter('active'), active: filter === 'active' },
        { label: 'Dine-In Today', value: todayStats.dineInToday, color: '#3b82f6', onClick: () => setFilter('dine-in-today'), active: filter === 'dine-in-today', subtext: `PKR ${todayStats.totalRevenue.toLocaleString()}` },
        { label: 'Delivery Today', value: todayStats.delivery, color: '#8b5cf6', onClick: () => setFilter('delivery'), active: filter === 'delivery', subtext: todayStats.totalDeliveryCharges > 0 ? `+PKR ${todayStats.totalDeliveryCharges}` : undefined },
        { label: 'Takeaway Today', value: todayStats.takeaway, color: '#10b981', onClick: () => setFilter('takeaway'), active: filter === 'takeaway' }
    ]

    const sidebarItems = useSidebarItems([
        { id: 'active', label: 'Active Orders', icon: '📋', count: stats[0].value },
        { id: 'dine-in-today', label: 'Dine-In Today', icon: '🏠', count: stats[1].value },
        { id: 'delivery', label: 'Delivery Today', icon: '🚚', count: stats[2].value },
        { id: 'takeaway', label: 'Takeaway Today', icon: '📦', count: stats[3].value }
    ], filter, setFilter)

    // Handle print and complete
    const handlePrintAndComplete = async (order: OrderWithRelations) => {
        try {
            await printAndCompleteOrder(order, menuCategories)
            toast.add('success', '✅ Order completed!')
            setSelectedOrder(null)
            refresh()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    // Handle cancel
    const handleCancel = async (order: OrderWithRelations) => {
        if (!confirm('⚠️ Cancel this order?')) return

        try {
            await cancelOrder(order)
            toast.add('success', '✅ Order cancelled')
            setSelectedOrder(null)
            refresh()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    // Table columns
    const columns = [
        {
            key: 'order',
            label: 'Order',
            render: (row: OrderWithRelations) => (
                <div className="flex items-center gap-2">
                    {!row.synced && <WifiOff className="w-4 h-4 text-yellow-600" />}
                    <div>
                        <p className="font-medium text-sm">#{row.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-[var(--muted)]">
                            {new Date(row.created_at).toLocaleString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Type',
            render: (row: OrderWithRelations) => {
                const { category } = categorizeOrder(row)
                const colors = {
                    'dine-in': 'bg-blue-500/20 text-blue-600',
                    'delivery': 'bg-purple-500/20 text-purple-600',
                    'takeaway': 'bg-green-500/20 text-green-600'
                }
                const icons = {
                    'dine-in': '🏠',
                    'delivery': '🚚',
                    'takeaway': '📦'
                }
                return (
                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${colors[category]}`}>
                        {icons[category]} {category === 'dine-in' ? 'Dine-In' : category === 'delivery' ? 'Delivery' : 'Takeaway'}
                    </span>
                )
            }
        },
        {
            key: 'payment',
            label: 'Payment',
            render: (row: OrderWithRelations) => (
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    row.payment_method === 'cash' ? 'bg-green-500/20 text-green-600' :
                        row.payment_method === 'online' ? 'bg-blue-500/20 text-blue-600' :
                            'bg-gray-500/20 text-gray-600'
                }`}>
                    {row.payment_method === 'cash' ? '💵 Cash' :
                        row.payment_method === 'online' ? '💳 Online' : '⏳ Pending'}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (row: OrderWithRelations) => {
                const status = getOrderStatusColor(row.status)
                return <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
            }
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right' as const,
            render: (row: OrderWithRelations) => (
                <div>
                    <p className="text-lg font-bold text-blue-600">PKR {row.total_amount.toLocaleString()}</p>
                    {row.delivery_charges && row.delivery_charges > 0 && (
                        <p className="text-xs text-green-600">+{row.delivery_charges} delivery</p>
                    )}
                </div>
            )
        }
    ]

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <AutoSidebar items={sidebarItems} title="Filters" />
                <div className="lg:ml-64">
                    <PageHeader
                        title="Orders"
                        subtitle={`${stats[0].value} active${pendingCount > 0 ? ` • ${pendingCount} syncing` : ''}${!isOnline ? ' • Offline' : ''}`}
                        action={
                            <button onClick={refresh} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        {!isOnline && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <p className="text-sm font-medium text-yellow-600">
                                    <WifiOff className="inline w-4 h-4 mr-2" />
                                    Offline Mode - Orders will sync when online
                                </p>
                            </div>
                        )}

                        {filter !== 'active' && (
                            <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-600/30 rounded-xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                    <h3 className="text-lg font-bold">Today's Summary</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-[var(--card)] rounded-lg p-4">
                                        <p className="text-sm text-[var(--muted)] mb-1">Total Revenue</p>
                                        <p className="text-2xl font-bold text-blue-600">PKR {todayStats.totalRevenue.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[var(--card)] rounded-lg p-4">
                                        <p className="text-sm text-[var(--muted)] mb-1">Cash</p>
                                        <p className="text-2xl font-bold text-green-600">PKR {todayStats.cashPayments.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[var(--card)] rounded-lg p-4">
                                        <p className="text-sm text-[var(--muted)] mb-1">Online</p>
                                        <p className="text-2xl font-bold text-purple-600">PKR {todayStats.onlinePayments.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-[var(--card)] rounded-lg p-4">
                                        <p className="text-sm text-[var(--muted)] mb-1">Delivery Charges</p>
                                        <p className="text-2xl font-bold text-orange-600">PKR {todayStats.totalDeliveryCharges.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable columns={columns} data={filtered} loading={loading} searchable onRowClick={setSelectedOrder} />
                    </div>
                </div>

                {selectedOrder && (
                    <UniversalModal
                        open={!!selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        title={`Order #${selectedOrder.id.slice(0, 8)}`}
                        footer={
                            selectedOrder.status === 'pending' && (
                                <div className="flex gap-2 w-full">
                                    <button
                                        onClick={() => handleCancel(selectedOrder)}
                                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => handlePrintAndComplete(selectedOrder)}
                                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                                    >
                                        <Printer className="w-4 h-4" />
                                        Print & Complete
                                    </button>
                                </div>
                            )
                        }
                    >
                        <div className="space-y-4">
                            <div className="space-y-2">
                                {selectedOrder.order_items?.map((item) => (
                                    <div key={item.id} className="flex justify-between p-3 bg-[var(--bg)] rounded-lg">
                                        <span className="font-medium text-sm">
                                            {item.quantity}× {item.menu_items?.name}
                                        </span>
                                        <span className="font-bold text-sm">PKR {item.total_price.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-blue-600/10 rounded-lg p-4 border border-blue-600/30">
                                <div className="flex justify-between text-xl font-bold">
                                    <span>Total</span>
                                    <span className="text-blue-600">PKR {selectedOrder.total_amount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </UniversalModal>
                )}
            </div>
        </ErrorBoundary>
    )
}
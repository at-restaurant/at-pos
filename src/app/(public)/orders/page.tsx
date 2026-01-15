// src/app/(public)/orders/page.tsx
// ✅ COMPLETE - CLICK ANY COMPLETED ORDER OR SUMMARY BUTTON

"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { Printer, Users, RefreshCw, CreditCard, Banknote, WifiOff, DollarSign, TrendingUp } from 'lucide-react'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import UniversalModal from '@/components/ui/UniversalModal'
import SplitBillModal from '@/components/features/split-bill/SplitBillModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useOrderManagement } from '@/lib/hooks'
import { getOrderStatusColor } from '@/lib/utils/statusHelpers'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import type { ReceiptData } from '@/types'

export default function OrdersPage() {
    const [filter, setFilter] = useState<'active' | 'today-dinein' | 'today-delivery' | 'today-takeaway'>('active')
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [showSplitBill, setShowSplitBill] = useState<any>(null)
    const [showPaymentModal, setShowPaymentModal] = useState<any>(null)
    const [showDailySummary, setShowDailySummary] = useState(false)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [menuCategories, setMenuCategories] = useState<{ [key: string]: { name: string; icon: string } }>({})

    const {printAndComplete, cancelOrder, loading: actionLoading} = useOrderManagement()
    const {isOnline, pendingCount} = useOfflineStatus()
    const supabase = createClient()

    useEffect(() => {
        loadOrders()
        loadMenuCategories()
        const interval = setInterval(loadOrders, 10000)
        return () => clearInterval(interval)
    }, [isOnline])

    const loadMenuCategories = async () => {
        const {data} = await supabase
            .from('menu_items')
            .select('id, menu_categories(name, icon)')

        if (data) {
            const categoryMap: { [key: string]: { name: string; icon: string } } = {}
            data.forEach((item: any) => {
                if (item.menu_categories) {
                    categoryMap[item.id] = {
                        name: item.menu_categories.name,
                        icon: item.menu_categories.icon || '📋'
                    }
                }
            })
            setMenuCategories(categoryMap)
        }
    }

    const loadOrders = async () => {
        setLoading(true)
        try {
            let allOrders: any[] = []

            if (isOnline) {
                const {data: onlineOrders} = await supabase
                    .from('orders')
                    .select('*, restaurant_tables(table_number), waiters(name), order_items(*, menu_items(name, price, category_id))')
                    .order('created_at', {ascending: false})
                    .limit(100)

                allOrders = onlineOrders || []
            }

            const offlineOrders = await db.getAll(STORES.ORDERS) as any[]
            const pendingOffline = offlineOrders.filter(o => !o.synced && o.id.startsWith('offline_'))

            for (const order of pendingOffline) {
                const items = await db.getAll(STORES.ORDER_ITEMS) as any[]
                order.order_items = items.filter((i: any) => i.order_id === order.id)
            }

            allOrders = [...pendingOffline, ...allOrders]
            setOrders(allOrders)
        } catch (error) {
            console.error('Failed to load orders:', error)
        } finally {
            setLoading(false)
        }
    }

    const getTodayRange = () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        return {start: today, end: tomorrow}
    }

    const filtered = useMemo(() => {
        const {start, end} = getTodayRange()
        const todayOrders = orders.filter(o => {
            const orderDate = new Date(o.created_at)
            return orderDate >= start && orderDate < end
        })

        switch (filter) {
            case 'active':
                return orders.filter(o => o.status === 'pending' && o.order_type === 'dine-in')
            case 'today-dinein':
                return todayOrders.filter(o => o.status === 'completed' && o.order_type === 'dine-in')
            case 'today-delivery':
                return todayOrders.filter(o => o.status === 'completed' && o.order_type === 'delivery')
            case 'today-takeaway':
                return todayOrders.filter(o => o.status === 'completed' && o.order_type === 'takeaway')
            default:
                return orders
        }
    }, [orders, filter])

    const stats = useMemo(() => {
        const {start, end} = getTodayRange()
        const todayCompleted = orders.filter(o => {
            const orderDate = new Date(o.created_at)
            return orderDate >= start && orderDate < end && o.status === 'completed'
        })

        return [
            {
                label: 'Active (Dine-in)',
                value: orders.filter(o => o.status === 'pending' && o.order_type === 'dine-in').length,
                color: '#f59e0b',
                onClick: () => setFilter('active'),
                active: filter === 'active'
            },
            {
                label: 'Today Dine-in',
                value: todayCompleted.filter(o => o.order_type === 'dine-in').length,
                color: '#3b82f6',
                onClick: () => setFilter('today-dinein'),
                active: filter === 'today-dinein'
            },
            {
                label: 'Today Delivery',
                value: todayCompleted.filter(o => o.order_type === 'delivery').length,
                color: '#8b5cf6',
                onClick: () => setFilter('today-delivery'),
                active: filter === 'today-delivery'
            },
            {
                label: 'Today Takeaway',
                value: todayCompleted.filter(o => o.order_type === 'takeaway').length,
                color: '#10b981',
                onClick: () => setFilter('today-takeaway'),
                active: filter === 'today-takeaway'
            }
        ]
    }, [orders, filter])

    const validatePaymentMethod = (method?: string): 'cash' | 'online' | 'card' | undefined => {
        if (!method) return undefined
        if (method === 'cash' || method === 'online' || method === 'card') return method
        return 'cash'
    }

    const handlePrintAndComplete = async (paymentMethod: 'cash' | 'online') => {
        if (!showPaymentModal) return

        if (isOnline) {
            await supabase
                .from('orders')
                .update({payment_method: paymentMethod})
                .eq('id', showPaymentModal.id)
        }

        const receiptData: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: 'Delicious Food, Memorable Moments',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: showPaymentModal.id.slice(0, 8).toUpperCase(),
            date: new Date(showPaymentModal.created_at).toLocaleString('en-PK'),
            orderType: showPaymentModal.order_type || 'dine-in',
            customerName: showPaymentModal.customer_name,
            customerPhone: showPaymentModal.customer_phone,
            deliveryAddress: showPaymentModal.delivery_address,
            deliveryCharges: showPaymentModal.delivery_charges,
            tableNumber: showPaymentModal.restaurant_tables?.table_number,
            waiter: showPaymentModal.waiters?.name,
            items: showPaymentModal.order_items.map((item: any) => {
                const category = menuCategories[item.menu_items?.id]
                return {
                    name: item.menu_items?.name,
                    quantity: item.quantity,
                    price: item.menu_items?.price,
                    total: item.total_price,
                    category: category ? `${category.icon} ${category.name}` : '📋 Uncategorized'
                }
            }),
            subtotal: showPaymentModal.subtotal,
            tax: showPaymentModal.tax,
            total: showPaymentModal.total_amount,
            paymentMethod: validatePaymentMethod(paymentMethod),
            notes: showPaymentModal.notes
        }

        await productionPrinter.print(receiptData)
        await printAndComplete(showPaymentModal.id, showPaymentModal.table_id, showPaymentModal.order_type)
        setShowPaymentModal(null)
        setSelectedOrder(null)
        loadOrders()
    }

    const handleCancel = async (order: any) => {
        if (!confirm('⚠️ Cancel this order?')) return
        const result = await cancelOrder(order.id, order.table_id, order.order_type)
        if (result.success) {
            setSelectedOrder(null)
            loadOrders()
        }
    }

    const columns = [
        {
            key: 'order', label: 'Order', render: (row: any) => (
                <div className="flex items-center gap-2">
                    {row.id.startsWith('offline_') && (
                        <div title="Offline order">
                            <WifiOff className="w-4 h-4 text-yellow-600 flex-shrink-0"/>
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">#{row.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-[var(--muted)]">{new Date(row.created_at).toLocaleString()}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'type', label: 'Type', mobileHidden: true, render: (row: any) => (
                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${
                    row.order_type === 'dine-in' ? 'bg-blue-500/20 text-blue-600' :
                        row.order_type === 'delivery' ? 'bg-purple-500/20 text-purple-600' :
                            'bg-green-500/20 text-green-600'
                }`}>
                {row.order_type === 'dine-in' ? '🏠 Dine-In' :
                    row.order_type === 'delivery' ? '🚚 Delivery' : '📦 Takeaway'}
            </span>
            )
        },
        {
            key: 'table', label: 'Table/Customer', mobileHidden: true, render: (row: any) => (
                <span className="text-sm text-[var(--fg)]">
                {row.order_type === 'dine-in'
                    ? `Table ${row.restaurant_tables?.table_number || 'N/A'}`
                    : row.customer_name || row.customer_phone || 'Walk-in'}
            </span>
            )
        },
        {
            key: 'payment', label: 'Payment', render: (row: any) => (
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
            key: 'status', label: 'Status', render: (row: any) => {
                const status = getOrderStatusColor(row.status)
                return <span
                    className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
            }
        },
        {
            key: 'amount', label: 'Amount', align: 'right' as const, render: (row: any) => (
                <p className="text-base sm:text-lg font-bold text-blue-600">PKR {row.total_amount.toLocaleString()}</p>
            )
        }
    ]

    const sidebarItems = useSidebarItems([
        {id: 'active', label: 'Active Orders', icon: '🔄', count: stats[0].value},
        {id: 'today-dinein', label: 'Today Dine-in', icon: '🏠', count: stats[1].value},
        {id: 'today-delivery', label: 'Today Delivery', icon: '🚚', count: stats[2].value},
        {id: 'today-takeaway', label: 'Today Takeaway', icon: '📦', count: stats[3].value}
    ], filter, (id: string) => setFilter(id as any))

    // ✅ DAILY SUMMARY MODAL - Mobile Optimized
    const DailySummaryModal = () => {
        const {start, end} = getTodayRange()
        const todayCompleted = orders.filter(o => {
            const orderDate = new Date(o.created_at)
            return orderDate >= start && orderDate < end && o.status === 'completed'
        })

        const totalRevenue = todayCompleted.reduce((sum, o) => sum + o.total_amount, 0)
        const totalDeliveryCharges = todayCompleted
            .filter(o => o.order_type === 'delivery')
            .reduce((sum, o) => sum + (o.delivery_charges || 0), 0)
        const avgOrder = todayCompleted.length > 0 ? totalRevenue / todayCompleted.length : 0

        const cashOrders = todayCompleted.filter(o => o.payment_method === 'cash')
        const onlineOrders = todayCompleted.filter(o => o.payment_method === 'online')

        const cashTotal = cashOrders.reduce((sum, o) => sum + o.total_amount, 0)
        const onlineTotal = onlineOrders.reduce((sum, o) => sum + o.total_amount, 0)

        return (
            <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => setShowDailySummary(false)}>
                <div
                    className="bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                    onClick={e => e.stopPropagation()}>
                    {/* Header - Sticky on mobile */}
                    <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] z-10">
                        <div className="p-4 sm:p-6">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)]">Today's Summary</h3>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] truncate">
                                        {new Date().toLocaleDateString('en-PK', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-20 sm:pb-6">
                        {/* Main Stats - Responsive Grid */}
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div
                                className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg sm:rounded-xl border border-[var(--border)]">
                                <p className="text-[10px] sm:text-xs text-[var(--muted)] mb-1">Orders</p>
                                <p className="text-xl sm:text-3xl font-bold text-[var(--fg)]">{todayCompleted.length}</p>
                            </div>
                            <div
                                className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg sm:rounded-xl border border-[var(--border)]">
                                <p className="text-[10px] sm:text-xs text-[var(--muted)] mb-1">Revenue</p>
                                <p className="text-base sm:text-2xl font-bold text-green-600">₨{(totalRevenue / 1000).toFixed(1)}k</p>
                                <p className="text-[10px] text-[var(--muted)]">{totalRevenue.toLocaleString()}</p>
                            </div>
                            <div
                                className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg sm:rounded-xl border border-[var(--border)]">
                                <p className="text-[10px] sm:text-xs text-[var(--muted)] mb-1">Delivery</p>
                                <p className="text-base sm:text-2xl font-bold text-blue-600">₨{(totalDeliveryCharges / 1000).toFixed(1)}k</p>
                                <p className="text-[10px] text-[var(--muted)]">{totalDeliveryCharges.toLocaleString()}</p>
                            </div>
                            <div
                                className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg sm:rounded-xl border border-[var(--border)]">
                                <p className="text-[10px] sm:text-xs text-[var(--muted)] mb-1">Avg Order</p>
                                <p className="text-base sm:text-2xl font-bold text-purple-600">₨{(avgOrder / 1000).toFixed(1)}k</p>
                                <p className="text-[10px] text-[var(--muted)]">{Math.round(avgOrder).toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Order Types */}
                        <div>
                            <h4 className="text-xs sm:text-sm font-semibold text-[var(--fg)] mb-2 sm:mb-3">Order
                                Types</h4>
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                {['dine-in', 'delivery', 'takeaway'].map(type => {
                                    const count = todayCompleted.filter(o => o.order_type === type).length
                                    const revenue = todayCompleted.filter(o => o.order_type === type).reduce((sum, o) => sum + o.total_amount, 0)
                                    return (
                                        <div key={type}
                                             className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg sm:rounded-xl border border-[var(--border)] text-center">
                                            <p className="text-xl sm:text-2xl mb-1">{type === 'dine-in' ? '🏠' : type === 'delivery' ? '🚚' : '📦'}</p>
                                            <p className="text-[10px] sm:text-xs text-[var(--muted)] capitalize mb-1 truncate">{type.replace('-', ' ')}</p>
                                            <p className="text-lg sm:text-xl font-bold text-[var(--fg)]">{count}</p>
                                            <p className="text-[10px] sm:text-xs text-[var(--muted)] mt-1">₨{(revenue / 1000).toFixed(0)}k</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Payment Methods */}
                        <div>
                            <h4 className="text-xs sm:text-sm font-semibold text-[var(--fg)] mb-2 sm:mb-3">Payment
                                Collection</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div
                                    className="p-4 bg-green-600/10 rounded-lg sm:rounded-xl border border-green-600/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Banknote className="w-4 h-4 sm:w-5 sm:h-5 text-green-600"/>
                                            <p className="text-xs sm:text-sm font-semibold text-green-600">Cash</p>
                                        </div>
                                        <span className="text-xs text-[var(--muted)]">{cashOrders.length} orders</span>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-green-600">PKR {cashTotal.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-blue-600/10 rounded-lg sm:rounded-xl border border-blue-600/30">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600"/>
                                            <p className="text-xs sm:text-sm font-semibold text-blue-600">Online</p>
                                        </div>
                                        <span
                                            className="text-xs text-[var(--muted)]">{onlineOrders.length} orders</span>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-blue-600">PKR {onlineTotal.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer - Sticky on mobile */}
                    <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--border)] p-4 sm:p-6">
                        <button
                            onClick={() => setShowDailySummary(false)}
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg sm:rounded-xl hover:bg-blue-700 font-medium transition-colors active:scale-95"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <AutoSidebar items={sidebarItems} title="Filters"/>
                <div className="lg:ml-64">
                    <PageHeader
                        title="Orders"
                        subtitle={`${stats[0].value} active${pendingCount > 0 ? ` • ${pendingCount} pending sync` : ''}`}
                        action={
                            <button onClick={loadOrders}
                                    className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 transition-transform">
                                <RefreshCw className="w-5 h-5 text-[var(--muted)]"/>
                            </button>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        {pendingCount > 0 && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <p className="text-sm font-medium text-yellow-600">
                                    📴 {pendingCount} orders pending sync. Will upload when online.
                                </p>
                            </div>
                        )}

                        <ResponsiveStatsGrid stats={stats}/>

                        <UniversalDataTable
                            columns={columns}
                            data={filtered}
                            loading={loading}
                            searchable
                            onRowClick={setSelectedOrder}
                        />
                    </div>
                </div>

                {/* ✅ FLOATING SUMMARY BUTTON - Responsive positioning */}
                <button
                    onClick={() => setShowDailySummary(true)}
                    className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-transform flex items-center justify-center z-40"
                    title="View Daily Summary"
                >
                    <DollarSign className="w-6 h-6"/>
                </button>

                {showDailySummary && <DailySummaryModal/>}

                {selectedOrder && (
                    <UniversalModal
                        open={!!selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        title={`Order #${selectedOrder.id.slice(0, 8)}`}
                        footer={
                            <div className="flex flex-wrap gap-2 w-full">
                                <button
                                    onClick={() => setShowSplitBill(selectedOrder)}
                                    className="flex-1 px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center justify-center gap-2 text-sm font-medium transition-colors active:scale-95"
                                >
                                    <Users className="w-4 h-4"/> Split
                                </button>

                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleCancel(selectedOrder)}
                                            disabled={actionLoading}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50 active:scale-95"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (selectedOrder.order_type === 'dine-in' && !selectedOrder.payment_method) {
                                                    setShowPaymentModal(selectedOrder)
                                                } else {
                                                    const receiptData: ReceiptData = {
                                                        restaurantName: 'AT RESTAURANT',
                                                        tagline: 'Delicious Food, Memorable Moments',
                                                        address: 'Sooter Mills Rd, Lahore',
                                                        orderNumber: selectedOrder.id.slice(0, 8).toUpperCase(),
                                                        date: new Date(selectedOrder.created_at).toLocaleString('en-PK'),
                                                        orderType: selectedOrder.order_type || 'dine-in',
                                                        customerName: selectedOrder.customer_name,
                                                        customerPhone: selectedOrder.customer_phone,
                                                        deliveryAddress: selectedOrder.delivery_address,
                                                        deliveryCharges: selectedOrder.delivery_charges,
                                                        tableNumber: selectedOrder.restaurant_tables?.table_number,
                                                        waiter: selectedOrder.waiters?.name,
                                                        items: selectedOrder.order_items.map((item: any) => {
                                                            const category = menuCategories[item.menu_items?.id]
                                                            return {
                                                                name: item.menu_items?.name,
                                                                quantity: item.quantity,
                                                                price: item.menu_items?.price,
                                                                total: item.total_price,
                                                                category: category ? `${category.icon} ${category.name}` : '📋 Uncategorized'
                                                            }
                                                        }),
                                                        subtotal: selectedOrder.subtotal,
                                                        tax: selectedOrder.tax,
                                                        total: selectedOrder.total_amount,
                                                        paymentMethod: validatePaymentMethod(selectedOrder.payment_method),
                                                        notes: selectedOrder.notes
                                                    }

                                                    productionPrinter.print(receiptData).then(() => {
                                                        printAndComplete(
                                                            selectedOrder.id,
                                                            selectedOrder.table_id,
                                                            selectedOrder.order_type
                                                        ).then(() => {
                                                            setSelectedOrder(null)
                                                            loadOrders()
                                                        })
                                                    })
                                                }
                                            }}
                                            disabled={actionLoading || !isOnline}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 active:scale-95"
                                        >
                                            <Printer className="w-4 h-4"/>
                                            Print & Complete
                                        </button>
                                    </>
                                )}
                            </div>
                        }
                    >
                        <div className="space-y-3">
                            {selectedOrder.order_items?.map((item: any) => (
                                <div key={item.id} className="flex justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <span className="font-medium text-sm text-[var(--fg)]">
                                        {item.quantity}× {item.menu_items?.name}
                                    </span>
                                    <span className="font-bold text-sm text-[var(--fg)]">
                                        PKR {item.total_price.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </UniversalModal>
                )}

                {showPaymentModal && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowPaymentModal(null)}>
                        <div
                            className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-sm shadow-2xl"
                            onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-[var(--border)]">
                                <h3 className="text-lg font-bold text-[var(--fg)]">Select Payment Method</h3>
                                <p className="text-sm text-[var(--muted)] mt-1">
                                    Order #{showPaymentModal.id.slice(0, 8).toUpperCase()}
                                </p>
                            </div>

                            <div className="p-6 space-y-3">
                                <button
                                    onClick={() => handlePrintAndComplete('cash')}
                                    disabled={actionLoading}
                                    className="w-full p-4 border-2 border-[var(--border)] rounded-lg hover:border-green-600 hover:bg-green-600/10 transition-all group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                                            <Banknote className="w-6 h-6 text-green-600"/>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-[var(--fg)]">Cash Payment</p>
                                            <p className="text-xs text-[var(--muted)]">Pay with cash</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handlePrintAndComplete('online')}
                                    disabled={actionLoading}
                                    className="w-full p-4 border-2 border-[var(--border)] rounded-lg hover:border-blue-600 hover:bg-blue-600/10 transition-all group disabled:opacity-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                                            <CreditCard className="w-6 h-6 text-blue-600"/>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-[var(--fg)]">Online Payment</p>
                                            <p className="text-xs text-[var(--muted)]">Card / Wallet</p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="p-6 pt-0">
                                <button
                                    onClick={() => setShowPaymentModal(null)}
                                    className="w-full px-4 py-2 bg-[var(--bg)] text-[var(--fg)] rounded-lg hover:bg-[var(--border)] text-sm font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSplitBill && <SplitBillModal order={showSplitBill} onClose={() => setShowSplitBill(null)}/>}
            </div>
        </ErrorBoundary>
    )
}
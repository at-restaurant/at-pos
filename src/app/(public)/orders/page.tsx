// src/app/(public)/orders/page.tsx
// ✅ COMPLETE OFFLINE SUPPORT + PRINT WHEN ADDING TO EXISTING ORDER

"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { Printer, Users, RefreshCw, CreditCard, Banknote, WifiOff, DollarSign, TrendingUp } from 'lucide-react'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import SplitBillModal from '@/components/features/split-bill/SplitBillModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getOrderStatusColor } from '@/lib/utils/statusHelpers'
import { useOfflineFirst } from '@/lib/hooks/useOfflineFirst'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import type { ReceiptData } from '@/types'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'

export default function OrdersPage() {
    const [filter, setFilter] = useState<'active' | 'today-dinein' | 'today-delivery' | 'today-takeaway'>('active')
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [showSplitBill, setShowSplitBill] = useState<any>(null)
    const [showDailySummary, setShowDailySummary] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [menuCategories, setMenuCategories] = useState<{ [key: string]: { name: string; icon: string } }>({})

    const supabase = createClient()
    const { pendingCount } = useOfflineStatus()  // ✅ ADD THIS

    // ✅ FIXED: Use offline-first hook for orders
    const { data: orders, loading, isOffline, refresh } = useOfflineFirst<any>({
        store: STORES.ORDERS,
        table: 'orders',
        autoSync: true
    })

    // Load menu categories
    useEffect(() => {
        loadMenuCategories()
    }, [])

    // Auto-refresh every 10s when online
    useEffect(() => {
        if (!isOffline) {
            const interval = setInterval(refresh, 10000)
            return () => clearInterval(interval)
        }
    }, [isOffline, refresh])

    const loadMenuCategories = async () => {
        // Try cache first
        const cachedItems = await db.getAll(STORES.MENU_ITEMS) as any[]
        if (cachedItems.length > 0) {
            const categoryMap: { [key: string]: { name: string; icon: string } } = {}
            cachedItems.forEach((item: any) => {
                if (item.menu_categories) {
                    categoryMap[item.id] = {
                        name: item.menu_categories.name,
                        icon: item.menu_categories.icon || '📋'
                    }
                }
            })
            setMenuCategories(categoryMap)
            return
        }

        // Fallback to Supabase
        const { data } = await supabase
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

    const getTodayRange = () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)
        return { start: today, end: tomorrow }
    }

    // ✅ Enhanced filtering with offline orders
    const filtered = useMemo(() => {
        const { start, end } = getTodayRange()

        // Enrich orders with calculated totals
        const enrichedOrders = orders.map(order => {
            const itemsTotal = order.order_items?.reduce((sum: number, item: any) =>
                sum + (item.total_price || 0), 0) || 0

            return {
                ...order,
                display_total: itemsTotal > 0 ? itemsTotal : order.total_amount,
                item_count: order.order_items?.reduce((sum: number, item: any) =>
                    sum + item.quantity, 0) || 0
            }
        })

        switch (filter) {
            case 'active':
                return enrichedOrders.filter(o => o.status === 'pending' && o.order_type === 'dine-in')
            case 'today-dinein':
                return enrichedOrders.filter(o => {
                    const d = new Date(o.created_at)
                    return d >= start && d < end && o.status === 'completed' && o.order_type === 'dine-in'
                })
            case 'today-delivery':
                return enrichedOrders.filter(o => {
                    const d = new Date(o.created_at)
                    return d >= start && d < end && o.status === 'completed' && o.order_type === 'delivery'
                })
            case 'today-takeaway':
                return enrichedOrders.filter(o => {
                    const d = new Date(o.created_at)
                    return d >= start && d < end && o.status === 'completed' && o.order_type === 'takeaway'
                })
            default:
                return enrichedOrders
        }
    }, [orders, filter])

    const stats = useMemo(() => {
        const { start, end } = getTodayRange()
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

    // ✅ FIXED: Single print + complete function (works offline)
    const handlePrintAndComplete = async (order: any, paymentMethod: 'cash' | 'online') => {
        if (actionLoading) return

        setActionLoading(true)
        try {
            const isOfflineOrder = order.id.startsWith('offline_')

            // 1. Build receipt
            const receiptData: ReceiptData = {
                restaurantName: 'AT RESTAURANT',
                tagline: 'Delicious Food, Memorable Moments',
                address: 'Sooter Mills Rd, Lahore',
                orderNumber: order.id.slice(0, 8).toUpperCase(),
                date: new Date(order.created_at).toLocaleString('en-PK'),
                orderType: order.order_type || 'dine-in',
                customerName: order.customer_name,
                customerPhone: order.customer_phone,
                deliveryAddress: order.delivery_address,
                deliveryCharges: order.delivery_charges,
                tableNumber: order.restaurant_tables?.table_number,
                waiter: order.waiters?.name,
                items: order.order_items?.map((item: any) => {
                    const category = menuCategories[item.menu_items?.id || item.menu_item_id]
                    return {
                        name: item.menu_items?.name || 'Unknown Item',
                        quantity: item.quantity,
                        price: item.unit_price || item.menu_items?.price || 0,
                        total: item.total_price,
                        category: category ? `${category.icon} ${category.name}` : '📋 Uncategorized'
                    }
                }) || [],
                subtotal: order.display_total || order.total_amount,
                tax: order.tax,
                total: order.display_total || order.total_amount,
                paymentMethod: validatePaymentMethod(paymentMethod),
                notes: order.notes
            }

            // 2. Print ONCE
            console.log('🖨️ Printing receipt...')
            await productionPrinter.print(receiptData)

            // 3. Complete order (offline-compatible)
            if (isOfflineOrder) {
                // Update in IndexedDB
                await db.put(STORES.ORDERS, {
                    ...order,
                    status: 'completed',
                    payment_method: paymentMethod,
                    receipt_printed: true,
                    updated_at: new Date().toISOString()
                })
            } else {
                // Update in Supabase
                const { error: updateError } = await supabase
                    .from('orders')
                    .update({
                        status: 'completed',
                        payment_method: paymentMethod,
                        receipt_printed: true,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', order.id)

                if (updateError) throw updateError

                // Free table if dine-in
                if (order.order_type === 'dine-in' && order.table_id) {
                    await supabase
                        .from('restaurant_tables')
                        .update({
                            status: 'available',
                            current_order_id: null,
                            waiter_id: null
                        })
                        .eq('id', order.table_id)
                }
            }

            setSelectedOrder(null)
            refresh()

            // Show success toast
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toast-add', {
                    detail: { type: 'success', message: '✅ Order completed & printed!' }
                }))
            }
        } catch (error: any) {
            console.error('Print and complete failed:', error)
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toast-add', {
                    detail: { type: 'error', message: `❌ ${error.message}` }
                }))
            }
        } finally {
            setActionLoading(false)
        }
    }

    const handleCancel = async (order: any) => {
        if (!confirm('⚠️ Cancel this order?')) return

        setActionLoading(true)
        try {
            const isOfflineOrder = order.id.startsWith('offline_')

            if (isOfflineOrder) {
                // Mark as cancelled and synced (won't upload)
                await db.put(STORES.ORDERS, {
                    ...order,
                    status: 'cancelled',
                    synced: true
                })
            } else {
                const { error } = await supabase
                    .from('orders')
                    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
                    .eq('id', order.id)

                if (error) throw error

                if (order.order_type === 'dine-in' && order.table_id) {
                    await supabase
                        .from('restaurant_tables')
                        .update({ status: 'available', current_order_id: null, waiter_id: null })
                        .eq('id', order.table_id)
                }
            }

            setSelectedOrder(null)
            refresh()

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toast-add', {
                    detail: { type: 'success', message: '✅ Order cancelled' }
                }))
            }
        } catch (error: any) {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('toast-add', {
                    detail: { type: 'error', message: `❌ ${error.message}` }
                }))
            }
        } finally {
            setActionLoading(false)
        }
    }

    const columns = [
        {
            key: 'order', label: 'Order', render: (row: any) => (
                <div className="flex items-center gap-2">
                    {row.id.startsWith('offline_') && (
                        <div title="Offline order">
                            <WifiOff className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">#{row.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-[var(--muted)]">
                            {new Date(row.created_at).toLocaleString()}
                            {row.item_count > 0 && ` • ${row.item_count} items`}
                        </p>
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
                <p className="text-base sm:text-lg font-bold text-blue-600">
                    PKR {(row.display_total || row.total_amount).toLocaleString()}
                </p>
            )
        }
    ]

    const sidebarItems = useSidebarItems([
        { id: 'active', label: 'Active Orders', icon: '🔄', count: stats[0].value },
        { id: 'today-dinein', label: 'Today Dine-in', icon: '🏠', count: stats[1].value },
        { id: 'today-delivery', label: 'Today Delivery', icon: '🚚', count: stats[2].value },
        { id: 'today-takeaway', label: 'Today Takeaway', icon: '📦', count: stats[3].value }
    ], filter, (id: string) => setFilter(id as any))

    const DailySummaryModal = () => {
        const { start, end } = getTodayRange()
        const todayCompleted = orders.filter(o => {
            const orderDate = new Date(o.created_at)
            return orderDate >= start && orderDate < end && o.status === 'completed'
        })

        const totalRevenue = todayCompleted.reduce((sum, o) => sum + (o.display_total || o.total_amount), 0)
        const cashOrders = todayCompleted.filter(o => o.payment_method === 'cash')
        const onlineOrders = todayCompleted.filter(o => o.payment_method === 'online')
        const cashTotal = cashOrders.reduce((sum, o) => sum + (o.display_total || o.total_amount), 0)
        const onlineTotal = onlineOrders.reduce((sum, o) => sum + (o.display_total || o.total_amount), 0)

        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
                 onClick={() => setShowDailySummary(false)}>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
                     onClick={e => e.stopPropagation()}>
                    <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] z-10 p-4 sm:p-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)]">Today's Summary</h3>
                                <p className="text-xs sm:text-sm text-[var(--muted)] truncate">
                                    {new Date().toLocaleDateString('en-PK', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                <p className="text-xs text-[var(--muted)] mb-1">Orders</p>
                                <p className="text-2xl font-bold text-[var(--fg)]">{todayCompleted.length}</p>
                            </div>
                            <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                <p className="text-xs text-[var(--muted)] mb-1">Revenue</p>
                                <p className="text-xl font-bold text-green-600">₨{(totalRevenue / 1000).toFixed(1)}k</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 bg-green-600/10 rounded-lg border border-green-600/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <Banknote className="w-4 h-4 text-green-600" />
                                    <p className="text-xs font-semibold text-green-600">Cash</p>
                                </div>
                                <p className="text-xl font-bold text-green-600">PKR {cashTotal.toLocaleString()}</p>
                                <p className="text-xs text-[var(--muted)] mt-1">{cashOrders.length} orders</p>
                            </div>
                            <div className="p-4 bg-blue-600/10 rounded-lg border border-blue-600/30">
                                <div className="flex items-center gap-2 mb-2">
                                    <CreditCard className="w-4 h-4 text-blue-600" />
                                    <p className="text-xs font-semibold text-blue-600">Online</p>
                                </div>
                                <p className="text-xl font-bold text-blue-600">PKR {onlineTotal.toLocaleString()}</p>
                                <p className="text-xs text-[var(--muted)] mt-1">{onlineOrders.length} orders</p>
                            </div>
                        </div>
                    </div>

                    <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--border)] p-4">
                        <button onClick={() => setShowDailySummary(false)}
                                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors active:scale-95">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const OrderDetailsModal = () => {
        if (!selectedOrder) return null

        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
                 onClick={() => setSelectedOrder(null)}>
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-t-2xl sm:rounded-xl w-full sm:max-w-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
                     onClick={e => e.stopPropagation()}>

                    <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--border)] p-4 sm:p-6">
                        <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)]">
                            Order #{selectedOrder.id.slice(0, 8).toUpperCase()}
                        </h3>
                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                            {new Date(selectedOrder.created_at).toLocaleString('en-PK')} • {selectedOrder.item_count} items
                        </p>
                    </div>

                    <div className="p-4 sm:p-6 space-y-3">
                        {selectedOrder.order_items?.map((item: any) => (
                            <div key={item.id} className="flex justify-between p-3 bg-[var(--bg)] rounded-lg">
                                <span className="font-medium text-sm text-[var(--fg)]">
                                    {item.quantity}× {item.menu_items?.name || 'Unknown Item'}
                                </span>
                                <span className="font-bold text-sm text-[var(--fg)]">
                                    PKR {item.total_price.toLocaleString()}
                                </span>
                            </div>
                        ))}

                        <div className="p-4 bg-blue-600/10 rounded-lg border border-blue-600/30 mt-4">
                            <div className="flex justify-between text-xl sm:text-2xl font-bold">
                                <span className="text-[var(--fg)]">Total</span>
                                <span className="text-blue-600">PKR {(selectedOrder.display_total || selectedOrder.total_amount).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {selectedOrder.status === 'pending' && (
                        <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--border)] p-4 sm:p-6">
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        setShowSplitBill(selectedOrder)
                                        setSelectedOrder(null)
                                    }}
                                    disabled={actionLoading}
                                    className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center justify-center gap-2 font-medium transition-colors active:scale-95 disabled:opacity-50">
                                    <Users className="w-4 h-4" /> Split Bill
                                </button>

                                {selectedOrder.order_type === 'dine-in' && !selectedOrder.payment_method ? (
                                    <>
                                        <p className="text-xs text-center text-[var(--muted)]">Select payment & print:</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button
                                                onClick={() => handlePrintAndComplete(selectedOrder, 'cash')}
                                                disabled={actionLoading}
                                                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex flex-col items-center gap-2 font-medium transition-colors disabled:opacity-50 active:scale-95">
                                                {actionLoading ? (
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <Banknote className="w-5 h-5" />
                                                        <span className="text-sm">Cash</span>
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handlePrintAndComplete(selectedOrder, 'online')}
                                                disabled={actionLoading}
                                                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex flex-col items-center gap-2 font-medium transition-colors disabled:opacity-50 active:scale-95">
                                                {actionLoading ? (
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <>
                                                        <CreditCard className="w-5 h-5" />
                                                        <span className="text-sm">Online</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handlePrintAndComplete(selectedOrder, selectedOrder.payment_method || 'cash')}
                                        disabled={actionLoading}
                                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 active:scale-95">
                                        {actionLoading ? (
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <Printer className="w-4 h-4" />
                                                Print & Complete
                                            </>
                                        )}
                                    </button>
                                )}

                                <button
                                    onClick={() => handleCancel(selectedOrder)}
                                    disabled={actionLoading}
                                    className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 active:scale-95">
                                    Cancel Order
                                </button>
                            </div>
                        </div>
                    )}
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
                            <button onClick={refresh}
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

                <button
                    onClick={() => setShowDailySummary(true)}
                    className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 w-14 h-14 bg-gradient-to-br from-green-600 to-green-700 text-white rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-transform flex items-center justify-center z-40"
                    title="View Daily Summary"
                >
                    <DollarSign className="w-6 h-6"/>
                </button>

                {showDailySummary && <DailySummaryModal/>}
                {selectedOrder && <OrderDetailsModal/>}
                {showSplitBill && <SplitBillModal order={showSplitBill} onClose={() => setShowSplitBill(null)}/>}
            </div>
        </ErrorBoundary>
    )
}
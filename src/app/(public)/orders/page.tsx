// src/app/(public)/orders/page.tsx - DEXIE POWERED ORDERS
"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { Printer, Users, RefreshCw, CreditCard, Banknote, WifiOff } from 'lucide-react'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import UniversalModal from '@/components/ui/UniversalModal'
import SplitBillModal from '@/components/features/split-bill/SplitBillModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useToast } from '@/components/ui/Toast'
import { getOrderStatusColor } from '@/lib/utils/statusHelpers'
import { createClient } from '@/lib/supabase/client'
import { db, dbHelpers } from '@/lib/db/dexie'
import { syncManager } from '@/lib/db/syncManager'
import { productionPrinter } from '@/lib/print/ProductionPrinter'
import type { ReceiptData } from '@/types'

export default function OrdersPage() {
    const [filter, setFilter] = useState('active')
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [showSplitBill, setShowSplitBill] = useState<any>(null)
    const [showPaymentModal, setShowPaymentModal] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isOnline, setIsOnline] = useState(true) // Default true for SSR
    const [pendingCount, setPendingCount] = useState(0)
    const [menuCategories, setMenuCategories] = useState<{ [key: string]: { name: string; icon: string } }>({})

    const toast = useToast()
    const supabase = createClient()

    useEffect(() => {
        // Set initial online status
        if (typeof window !== 'undefined') {
            setIsOnline(navigator.onLine)
        }

        loadOrders()
        loadMenuCategories()
        updatePendingCount()

        const interval = setInterval(() => {
            loadOrders()
            updatePendingCount()
        }, 5000)

        const handleOnline = () => {
            setIsOnline(true)
            syncManager.syncAll()
        }
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            clearInterval(interval)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    const updatePendingCount = async () => {
        const count = await dbHelpers.getPendingCount()
        setPendingCount(count)
    }

    const loadMenuCategories = async () => {
        try {
            // Load from Dexie
            const categories = await db.menu_categories.toArray()
            const items = await db.menu_items.toArray()

            const categoryMap: { [key: string]: { name: string; icon: string } } = {}

            items.forEach((item: any) => {
                const category = categories.find(c => c.id === item.category_id)
                if (category) {
                    categoryMap[item.id] = {
                        name: category.name,
                        icon: category.icon || '📋'
                    }
                }
            })

            setMenuCategories(categoryMap)
        } catch (error) {
            console.error('Load categories failed:', error)
        }
    }

    const loadOrders = async () => {
        setLoading(true)
        try {
            let allOrders: any[] = []

            // Load from Dexie first
            const dexieOrders = await db.orders.orderBy('created_at').reverse().limit(100).toArray()

            for (const order of dexieOrders) {
                const items = await db.order_items.where('order_id').equals(order.id).toArray()

                // Get menu item details
                const itemsWithDetails = await Promise.all(
                    items.map(async (item) => {
                        const menuItem = await db.menu_items.get(item.menu_item_id)
                        return {
                            ...item,
                            menu_items: menuItem ? {
                                name: menuItem.name,
                                price: menuItem.price,
                                category_id: menuItem.category_id
                            } : null
                        }
                    })
                )

                // Get table and waiter details
                let tableData = null
                let waiterData = null

                if (order.table_id) {
                    tableData = await db.restaurant_tables.get(order.table_id)
                }
                if (order.waiter_id) {
                    waiterData = await db.waiters.get(order.waiter_id)
                }

                allOrders.push({
                    ...order,
                    order_items: itemsWithDetails,
                    restaurant_tables: tableData ? { table_number: tableData.table_number } : null,
                    waiters: waiterData ? { name: waiterData.name } : null
                })
            }

            // If online, fetch fresh data and merge
            if (isOnline) {
                try {
                    const { data: onlineOrders } = await supabase
                        .from('orders')
                        .select('*, restaurant_tables(table_number), waiters(name), order_items(*, menu_items(name, price, category_id))')
                        .order('created_at', { ascending: false })
                        .limit(100)

                    if (onlineOrders && onlineOrders.length > 0) {
                        // Merge: prefer online data, but keep unsynced offline orders
                        const onlineIds = new Set(onlineOrders.map(o => o.id))
                        const unsyncedOffline = allOrders.filter(o => !o.synced && !onlineIds.has(o.id))

                        allOrders = [...unsyncedOffline, ...onlineOrders]
                    }
                } catch (error) {
                    console.log('Using cached orders')
                }
            }

            setOrders(allOrders)
        } catch (error) {
            console.error('Failed to load orders:', error)
            toast.add('error', 'Failed to load orders')
        } finally {
            setLoading(false)
        }
    }

    const getTodayRange = () => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return { start: today.toISOString(), end: new Date().toISOString() }
    }

    const filtered = useMemo(() => {
        const { start, end } = getTodayRange()

        if (filter === 'history') {
            return orders.filter(o => {
                const orderDate = new Date(o.created_at)
                return orderDate >= new Date(start) && orderDate < new Date(end) && o.status === 'completed'
            })
        }
        if (filter === 'active') return orders.filter(o => o.status === 'pending')
        if (filter === 'printed') return orders.filter(o => o.receipt_printed === true && o.status === 'pending')
        if (filter === 'unpaid') return orders.filter(o => o.receipt_printed === false && o.status === 'pending')
        return orders
    }, [orders, filter])

    const stats = useMemo(() => {
        const { start, end } = getTodayRange()
        return [
            { label: 'Active', value: orders.filter(o => o.status === 'pending').length, color: '#f59e0b', onClick: () => setFilter('active'), active: filter === 'active' },
            { label: 'Printed', value: orders.filter(o => o.receipt_printed && o.status === 'pending').length, color: '#3b82f6', onClick: () => setFilter('printed'), active: filter === 'printed' },
            { label: 'Unpaid', value: orders.filter(o => !o.receipt_printed && o.status === 'pending').length, color: '#ef4444', onClick: () => setFilter('unpaid'), active: filter === 'unpaid' },
            { label: "Today Complete", value: orders.filter(o => {
                    const orderDate = new Date(o.created_at)
                    return orderDate >= new Date(start) && orderDate < new Date(end) && o.status === 'completed'
                }).length, color: '#10b981', onClick: () => setFilter('history'), active: filter === 'history' }
        ]
    }, [orders, filter])

    const validatePaymentMethod = (method?: string): 'cash' | 'online' | 'card' | undefined => {
        if (!method) return undefined
        if (method === 'cash' || method === 'online' || method === 'card') {
            return method
        }
        return 'cash'
    }

    const handlePrintAndComplete = async (paymentMethod: 'cash' | 'online') => {
        if (!showPaymentModal) return

        try {
            // Update payment method
            if (isOnline) {
                await supabase
                    .from('orders')
                    .update({ payment_method: paymentMethod })
                    .eq('id', showPaymentModal.id)
            } else {
                await db.orders.update(showPaymentModal.id, { payment_method: paymentMethod })
            }

            // Print receipt
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

            // Mark as printed and completed
            if (isOnline) {
                await supabase
                    .from('orders')
                    .update({
                        receipt_printed: true,
                        status: 'completed',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', showPaymentModal.id)

                if (showPaymentModal.order_type === 'dine-in' && showPaymentModal.table_id) {
                    await supabase
                        .from('restaurant_tables')
                        .update({
                            status: 'available',
                            current_order_id: null,
                            waiter_id: null
                        })
                        .eq('id', showPaymentModal.table_id)
                }
            } else {
                await db.orders.update(showPaymentModal.id, {
                    receipt_printed: true,
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })

                // Queue for sync
                await dbHelpers.addToQueue('orders', 'update', {
                    id: showPaymentModal.id,
                    receipt_printed: true,
                    status: 'completed'
                })
            }

            toast.add('success', '✅ Order completed!')
            setShowPaymentModal(null)
            setSelectedOrder(null)
            loadOrders()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    const handleCancel = async (order: any) => {
        if (!confirm('⚠️ Cancel this order?')) return

        try {
            if (isOnline) {
                await supabase
                    .from('orders')
                    .update({ status: 'cancelled' })
                    .eq('id', order.id)

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
            } else {
                await db.orders.update(order.id, { status: 'cancelled' })
                await dbHelpers.addToQueue('orders', 'update', {
                    id: order.id,
                    status: 'cancelled'
                })
            }

            toast.add('success', '✅ Order cancelled')
            setSelectedOrder(null)
            loadOrders()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    const columns = [
        { key: 'order', label: 'Order', render: (row: any) => (
                <div className="flex items-center gap-2">
                    {!row.synced && (
                        <div title="Pending sync">
                            <WifiOff className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">#{row.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-xs text-[var(--muted)]">{new Date(row.created_at).toLocaleString()}</p>
                    </div>
                </div>
            )},
        { key: 'type', label: 'Type', mobileHidden: true, render: (row: any) => (
                <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${row.order_type === 'dine-in' ? 'bg-blue-500/20 text-blue-600' : 'bg-purple-500/20 text-purple-600'}`}>
                {row.order_type === 'dine-in' ? '🏠 Dine-In' : '🚚 Delivery'}
            </span>
            )},
        { key: 'table', label: 'Table/Customer', mobileHidden: true, render: (row: any) => (
                <span className="text-sm text-[var(--fg)]">
                {row.order_type === 'dine-in' ? `Table ${row.restaurant_tables?.table_number || 'N/A'}` : row.customer_name || row.customer_phone || 'N/A'}
            </span>
            )},
        { key: 'payment', label: 'Payment', render: (row: any) => (
                <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                    row.payment_method === 'cash' ? 'bg-green-500/20 text-green-600' :
                        row.payment_method === 'online' ? 'bg-blue-500/20 text-blue-600' :
                            'bg-gray-500/20 text-gray-600'
                }`}>
                {row.payment_method === 'cash' ? '💵 Cash' :
                    row.payment_method === 'online' ? '💳 Online' :
                        '⏳ Pending'}
            </span>
            )},
        { key: 'status', label: 'Status', render: (row: any) => {
                const status = getOrderStatusColor(row.status)
                return <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${status.bg} ${status.text}`}>{status.label}</span>
            }},
        { key: 'amount', label: 'Amount', align: 'right' as const, render: (row: any) => (
                <p className="text-base sm:text-lg font-bold text-blue-600">PKR {row.total_amount.toLocaleString()}</p>
            )}
    ]

    const sidebarItems = useSidebarItems([
        { id: 'active', label: 'Active Orders', icon: '🔄', count: stats[0].value },
        { id: 'printed', label: 'Printed (Paid)', icon: '🖨️', count: stats[1].value },
        { id: 'unpaid', label: 'Unpaid', icon: '⏳', count: stats[2].value },
        { id: 'history', label: 'Today Complete', icon: '✅', count: stats[3].value }
    ], filter, setFilter)

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <AutoSidebar items={sidebarItems} title="Filters" />
                <div className="lg:ml-64">
                    <PageHeader
                        title="Orders"
                        subtitle={`${stats[0].value} active${pendingCount > 0 ? ` • ${pendingCount} pending sync` : ''}${!isOnline ? ' • Offline' : ''}`}
                        action={
                            <button onClick={loadOrders} className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95 transition-transform">
                                <RefreshCw className="w-5 h-5 text-[var(--muted)]" />
                            </button>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        {!isOnline && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                                <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-semibold text-[var(--fg)] mb-1">Offline Mode</p>
                                    <p className="text-[var(--muted)]">Orders will sync when you're back online.</p>
                                </div>
                            </div>
                        )}

                        {pendingCount > 0 && (
                            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <p className="text-sm font-medium text-blue-600">
                                    📴 {pendingCount} orders pending sync. Will upload when online.
                                </p>
                            </div>
                        )}

                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable
                            columns={columns}
                            data={filtered}
                            loading={loading}
                            searchable
                            onRowClick={setSelectedOrder}
                        />
                    </div>
                </div>

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
                                    <Users className="w-4 h-4" /> Split
                                </button>

                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleCancel(selectedOrder)}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors active:scale-95"
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            onClick={() => setShowPaymentModal(selectedOrder)}
                                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm font-medium transition-colors active:scale-95"
                                        >
                                            <Printer className="w-4 h-4" />
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(null)}>
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-[var(--border)]">
                                <h3 className="text-lg font-bold text-[var(--fg)]">Select Payment Method</h3>
                                <p className="text-sm text-[var(--muted)] mt-1">
                                    Order #{showPaymentModal.id.slice(0, 8).toUpperCase()}
                                </p>
                            </div>

                            <div className="p-6 space-y-3">
                                <button
                                    onClick={() => handlePrintAndComplete('cash')}
                                    className="w-full p-4 border-2 border-[var(--border)] rounded-lg hover:border-green-600 hover:bg-green-600/10 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
                                            <Banknote className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-semibold text-[var(--fg)]">Cash Payment</p>
                                            <p className="text-xs text-[var(--muted)]">Pay with cash</p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handlePrintAndComplete('online')}
                                    className="w-full p-4 border-2 border-[var(--border)] rounded-lg hover:border-blue-600 hover:bg-blue-600/10 transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center group-hover:bg-blue-600/30 transition-colors">
                                            <CreditCard className="w-6 h-6 text-blue-600" />
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

                {showSplitBill && <SplitBillModal order={showSplitBill} onClose={() => setShowSplitBill(null)} />}
            </div>
        </ErrorBoundary>
    )
}
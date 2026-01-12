// src/app/(public)/tables/page.tsx - DEXIE POWERED
"use client"
export const dynamic = 'force-dynamic'

import { useState, useMemo, useEffect } from 'react'
import { RefreshCw, DollarSign, WifiOff } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import UniversalModal from '@/components/ui/UniversalModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getTableStatusColor } from '@/lib/utils/statusHelpers'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/dexie'
import type { RestaurantTable, Waiter, Order } from '@/lib/db/dexie'

type TableWithRelations = RestaurantTable & {
    waiter?: Waiter | null
    order?: Order | null
}

export default function TablesPage() {
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedTable, setSelectedTable] = useState<TableWithRelations | null>(null)
    const [tables, setTables] = useState<TableWithRelations[]>([])
    const [loading, setLoading] = useState(true)
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const supabase = createClient()

    useEffect(() => {
        load()

        const interval = setInterval(load, 5000)

        const handleOnline = () => {
            setIsOnline(true)
            load()
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

    const load = async () => {
        setLoading(true)
        try {
            // Load from Dexie first
            const dexieTables = await db.restaurant_tables.orderBy('table_number').toArray()
            const dexieOrders = await db.orders.where('status').equals('pending').toArray()
            const dexieWaiters = await db.waiters.toArray()

            // Enrich tables with relations
            const enriched: TableWithRelations[] = await Promise.all(
                dexieTables.map(async (table) => {
                    let waiter = null
                    let order = null

                    if (table.waiter_id && table.status !== 'available') {
                        waiter = dexieWaiters.find(w => w.id === table.waiter_id) || null
                    }

                    if (table.current_order_id) {
                        order = dexieOrders.find(o => o.id === table.current_order_id) || null

                        if (order) {
                            // Get order items
                            const items = await db.order_items
                                .where('order_id')
                                .equals(order.id)
                                .toArray()

                            // Enrich with menu item details
                            const enrichedItems = await Promise.all(
                                items.map(async (item) => {
                                    const menuItem = await db.menu_items.get(item.menu_item_id)
                                    return {
                                        ...item,
                                        menu_items: menuItem
                                    }
                                })
                            )

                            order = { ...order, order_items: enrichedItems } as any
                        }
                    }

                    return { ...table, waiter, order }
                })
            )

            setTables(enriched)

            // Update from Supabase if online
            if (navigator.onLine) {
                const { data: onlineTables } = await supabase
                    .from('restaurant_tables')
                    .select('*, waiters(id, name, profile_pic)')
                    .order('table_number')

                const { data: onlineOrders } = await supabase
                    .from('orders')
                    .select('id, total_amount, status, table_id, order_items(id, quantity, total_price, menu_items(name, price))')
                    .eq('status', 'pending')

                if (onlineTables) {
                    // Save to Dexie
                    await db.restaurant_tables.bulkPut(onlineTables.map(t => ({
                        id: t.id,
                        table_number: t.table_number,
                        capacity: t.capacity,
                        section: t.section,
                        status: t.status,
                        waiter_id: t.waiter_id,
                        current_order_id: t.current_order_id,
                        created_at: t.created_at
                    })))

                    // Enrich with relations
                    const enrichedOnline: TableWithRelations[] = onlineTables.map(t => ({
                        ...t,
                        waiter: t.waiter_id && t.status !== 'available' ? (t as any).waiters : null,
                        order: t.current_order_id
                            ? (onlineOrders?.find(o => o.id === t.current_order_id) || null) as any
                            : null
                    }))

                    setTables(enrichedOnline)
                }
            }
        } catch (error) {
            console.error('Failed to load tables:', error)
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() =>
            tables.filter(t => statusFilter === 'all' || t.status === statusFilter),
        [tables, statusFilter]
    )

    const stats = useMemo(() => [
        { label: 'Total', value: tables.length, color: '#3b82f6', onClick: () => setStatusFilter('all'), active: statusFilter === 'all', subtext: `${tables.filter(t => t.status === 'available').length} available` },
        { label: 'Available', value: tables.filter(t => t.status === 'available').length, color: '#10b981', onClick: () => setStatusFilter('available'), active: statusFilter === 'available' },
        { label: 'Occupied', value: tables.filter(t => t.status === 'occupied').length, color: '#ef4444', onClick: () => setStatusFilter('occupied'), active: statusFilter === 'occupied' },
        { label: 'Reserved', value: tables.filter(t => t.status === 'reserved').length, color: '#f59e0b', onClick: () => setStatusFilter('reserved'), active: statusFilter === 'reserved' }
    ], [tables, statusFilter])

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Tables', icon: '🏠', count: tables.length },
        { id: 'available', label: 'Available', icon: '🟢', count: stats[1].value },
        { id: 'occupied', label: 'Occupied', icon: '🔴', count: stats[2].value },
        { id: 'reserved', label: 'Reserved', icon: '🟡', count: stats[3].value }
    ], statusFilter, setStatusFilter)

    const columns = [
        { key: 'table', label: 'Table', render: (row: TableWithRelations) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm" style={{ backgroundColor: getTableStatusColor(row.status) }}>
                        {row.table_number}
                    </div>
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">Table {row.table_number}</p>
                        <p className="text-xs text-[var(--muted)]">{row.capacity} seats • {row.section}</p>
                    </div>
                </div>
            )},
        { key: 'status', label: 'Status', render: (row: TableWithRelations) => (
                <span className="inline-flex px-2 py-1 rounded-md text-xs font-semibold capitalize" style={{ backgroundColor: `${getTableStatusColor(row.status)}15`, color: getTableStatusColor(row.status) }}>
                {row.status}
            </span>
            )},
        { key: 'waiter', label: 'Waiter', mobileHidden: true, render: (row: TableWithRelations) => {
                if (!row.waiter) return <span className="text-sm text-[var(--muted)]">-</span>
                return (
                    <div className="flex items-center gap-2">
                        {row.waiter.profile_pic ? (
                            <img src={row.waiter.profile_pic} alt={row.waiter.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs">
                                {row.waiter.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm text-[var(--fg)]">{row.waiter.name}</span>
                    </div>
                )
            }},
        { key: 'amount', label: 'Bill', align: 'right' as const, render: (row: TableWithRelations) =>
                row.order ? <p className="text-lg font-bold text-[var(--fg)]">PKR {row.order.total_amount.toLocaleString()}</p> : <span className="text-sm text-[var(--muted)]">-</span>
        }
    ]

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <AutoSidebar items={sidebarItems} title="Status" />
                <div className="lg:ml-64">
                    <PageHeader
                        title="Tables"
                        subtitle={`Restaurant tables & running bills${!isOnline ? ' • Offline mode' : ''}`}
                        action={
                            <button onClick={load} className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95">
                                <RefreshCw className={`w-5 h-5 text-[var(--muted)] ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        {!isOnline && (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
                                <WifiOff className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div className="text-sm">
                                    <p className="font-semibold text-[var(--fg)] mb-1">Offline Mode Active</p>
                                    <p className="text-[var(--muted)]">
                                        Showing cached data. Table status updates will sync when you're back online.
                                    </p>
                                </div>
                            </div>
                        )}

                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable columns={columns} data={filtered} loading={loading} searchable onRowClick={setSelectedTable} />
                    </div>
                </div>

                {selectedTable?.order && (
                    <UniversalModal open={!!selectedTable} onClose={() => setSelectedTable(null)}
                                    title={`Table ${selectedTable.table_number} - Running Bill`}
                                    subtitle={`Order #${selectedTable.order.id.slice(0, 8)}`}
                                    icon={<DollarSign className="w-6 h-6 text-blue-600" />}>
                        <div className="space-y-4">
                            {(selectedTable.order as any).order_items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <span className="font-medium text-sm">{item.quantity}× {item.menu_items?.name}</span>
                                    <span className="font-bold text-sm">PKR {item.total_price}</span>
                                </div>
                            ))}
                            <div className="p-4 bg-blue-600/10 rounded-lg border border-blue-600/30">
                                <div className="flex justify-between text-2xl font-bold">
                                    <span>Total</span>
                                    <span className="text-blue-600">PKR {selectedTable.order.total_amount.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </UniversalModal>
                )}
            </div>
        </ErrorBoundary>
    )
}
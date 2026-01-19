// src/app/(public)/tables/page.tsx
// ✅ FIXED: Full offline support with IndexedDB

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
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'
import { createClient } from '@/lib/supabase/client'
import { getTableStatusColor } from '@/lib/utils/statusHelpers'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'

interface TableWithDetails {
    id: string
    table_number: number
    capacity: number
    section: string
    status: string
    waiter_id: string | null
    current_order_id: string | null
    waiter?: { id: string; name: string; profile_pic?: string } | null
    cumulativeTotal: number
    itemCount: number
    orderItems: any[]
}

export default function TablesPage() {
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedTable, setSelectedTable] = useState<TableWithDetails | null>(null)
    const [tables, setTables] = useState<TableWithDetails[]>([])
    const [loading, setLoading] = useState(true)

    const supabase = createClient()
    const { isOnline } = useOfflineStatus()

    useEffect(() => {
        loadTablesOfflineFirst()
    }, [])

    // ✅ STEP 1: Load from IndexedDB FIRST
    const loadTablesOfflineFirst = async () => {
        try {
            // Load from cache immediately
            const cachedTables = await db.get(STORES.SETTINGS, 'restaurant_tables')
            const cachedWaiters = await db.get(STORES.SETTINGS, 'waiters')
            const cachedOrders = await db.getAll(STORES.ORDERS)

            if (cachedTables && (cachedTables as any).value) {
                const enrichedTables = await enrichTablesWithOrders(
                    (cachedTables as any).value,
                    cachedWaiters ? (cachedWaiters as any).value : [],
                    Array.isArray(cachedOrders) ? cachedOrders : []
                )
                setTables(enrichedTables)
                setLoading(false)
            }

            // ✅ STEP 2: Sync in background if online
            if (navigator.onLine) {
                syncTablesInBackground()
            }
        } catch (error) {
            console.error('Failed to load tables from cache:', error)
            setLoading(false)
        }
    }

    // ✅ Enrich tables with order data
    const enrichTablesWithOrders = async (
        tablesData: any[],
        waitersData: any[],
        ordersData: any[]
    ): Promise<TableWithDetails[]> => {
        return tablesData.map((table: any) => {
            let cumulativeTotal = 0
            let itemCount = 0
            let orderItems: any[] = []

            // Find waiter
            const waiter = waitersData.find(w => w.id === table.waiter_id)

            // Find active order for this table
            if (table.status === 'occupied' && table.current_order_id) {
                const order = ordersData.find(o => o.id === table.current_order_id)

                if (order?.order_items) {
                    orderItems = order.order_items
                    cumulativeTotal = order.order_items.reduce(
                        (sum: number, item: any) => sum + (item.total_price || 0),
                        0
                    )
                    itemCount = order.order_items.reduce(
                        (sum: number, item: any) => sum + item.quantity,
                        0
                    )
                }
            }

            return {
                ...table,
                waiter: table.status !== 'available' ? waiter : null,
                cumulativeTotal,
                itemCount,
                orderItems
            } as TableWithDetails
        })
    }

    // ✅ Background sync from Supabase
    const syncTablesInBackground = async () => {
        try {
            // Fetch tables with waiters
            const { data: tablesData } = await supabase
                .from('restaurant_tables')
                .select('*, waiters(id, name, profile_pic)')
                .order('table_number')

            if (!tablesData) return

            // Cache tables
            await db.put(STORES.SETTINGS, {
                key: 'restaurant_tables',
                value: tablesData
            })

            // Fetch all active orders
            const { data: ordersData } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items(*, menu_items(name, price))
                `)
                .eq('status', 'pending')

            // Cache orders
            if (ordersData) {
                await db.clear(STORES.ORDERS)
                await db.bulkPut(STORES.ORDERS, ordersData)
            }

            // Enrich and update state
            const enrichedTables = await enrichTablesWithOrders(
                tablesData,
                tablesData.map((t: any) => t.waiters).filter(Boolean),
                ordersData || []
            )

            setTables(enrichedTables)
            console.log('✅ Tables synced from Supabase')
        } catch (error) {
            console.error('Background sync failed:', error)
        }
    }

    // ✅ Manual refresh
    const loadTables = async () => {
        setLoading(true)
        await loadTablesOfflineFirst()
    }

    const filtered = useMemo(() =>
            tables.filter(t => statusFilter === 'all' || t.status === statusFilter),
        [tables, statusFilter]
    )

    const stats = useMemo(() => [
        {
            label: 'Total',
            value: tables.length,
            color: '#3b82f6',
            onClick: () => setStatusFilter('all'),
            active: statusFilter === 'all',
            subtext: `${tables.filter(t => t.status === 'available').length} available`
        },
        {
            label: 'Available',
            value: tables.filter(t => t.status === 'available').length,
            color: '#10b981',
            onClick: () => setStatusFilter('available'),
            active: statusFilter === 'available'
        },
        {
            label: 'Occupied',
            value: tables.filter(t => t.status === 'occupied').length,
            color: '#ef4444',
            onClick: () => setStatusFilter('occupied'),
            active: statusFilter === 'occupied'
        },
        {
            label: 'Reserved',
            value: tables.filter(t => t.status === 'reserved').length,
            color: '#f59e0b',
            onClick: () => setStatusFilter('reserved'),
            active: statusFilter === 'reserved'
        }
    ], [tables, statusFilter])

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Tables', icon: '🏠', count: tables.length },
        { id: 'available', label: 'Available', icon: '🟢', count: stats[1].value },
        { id: 'occupied', label: 'Occupied', icon: '🔴', count: stats[2].value },
        { id: 'reserved', label: 'Reserved', icon: '🟡', count: stats[3].value }
    ], statusFilter, setStatusFilter)

    const columns = [
        {
            key: 'table',
            label: 'Table',
            render: (row: TableWithDetails) => (
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shadow-sm"
                        style={{ backgroundColor: getTableStatusColor(row.status) }}
                    >
                        {row.table_number}
                    </div>
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">Table {row.table_number}</p>
                        <p className="text-xs text-[var(--muted)]">
                            {row.capacity} seats • {row.section}
                            {row.itemCount > 0 && ` • ${row.itemCount} items`}
                        </p>
                    </div>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (row: TableWithDetails) => (
                <span
                    className="inline-flex px-2 py-1 rounded-md text-xs font-semibold capitalize"
                    style={{
                        backgroundColor: `${getTableStatusColor(row.status)}15`,
                        color: getTableStatusColor(row.status)
                    }}
                >
                    {row.status}
                </span>
            )
        },
        {
            key: 'waiter',
            label: 'Waiter',
            mobileHidden: true,
            render: (row: TableWithDetails) => {
                if (!row.waiter) return <span className="text-sm text-[var(--muted)]">-</span>
                return (
                    <div className="flex items-center gap-2">
                        {row.waiter.profile_pic ? (
                            <img
                                src={row.waiter.profile_pic}
                                alt={row.waiter.name}
                                className="w-8 h-8 rounded-full object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs">
                                {row.waiter.name?.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm text-[var(--fg)]">{row.waiter.name}</span>
                    </div>
                )
            }
        },
        {
            key: 'amount',
            label: 'Running Bill',
            align: 'right' as const,
            render: (row: TableWithDetails) => {
                if (row.cumulativeTotal > 0) {
                    return (
                        <div className="text-right">
                            <p className="text-lg font-bold text-blue-600">
                                PKR {row.cumulativeTotal.toLocaleString()}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                                {row.itemCount} items total
                            </p>
                        </div>
                    )
                }
                return <span className="text-sm text-[var(--muted)]">-</span>
            }
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
                            <button
                                onClick={loadTables}
                                className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95"
                            >
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
                        <UniversalDataTable
                            columns={columns}
                            data={filtered}
                            loading={loading}
                            searchable
                            onRowClick={setSelectedTable}
                        />
                    </div>
                </div>

                {selectedTable && selectedTable.cumulativeTotal > 0 && (
                    <UniversalModal
                        open={!!selectedTable}
                        onClose={() => setSelectedTable(null)}
                        title={`Table ${selectedTable.table_number} - Running Bill`}
                        subtitle={`${selectedTable.itemCount} items • PKR ${selectedTable.cumulativeTotal.toLocaleString()}`}
                        icon={<DollarSign className="w-6 h-6 text-blue-600" />}
                    >
                        <div className="space-y-4">
                            {selectedTable.orderItems.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <span className="font-medium text-sm">
                                        {item.quantity}× {item.menu_items?.name || 'Unknown Item'}
                                    </span>
                                    <span className="font-bold text-sm">
                                        PKR {item.total_price.toLocaleString()}
                                    </span>
                                </div>
                            ))}

                            <div className="p-4 bg-blue-600/10 rounded-lg border border-blue-600/30">
                                <div className="flex justify-between text-2xl font-bold">
                                    <span>Total Bill</span>
                                    <span className="text-blue-600">
                                        PKR {selectedTable.cumulativeTotal.toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--muted)] mt-2">
                                    {selectedTable.itemCount} items total
                                </p>
                            </div>

                            {selectedTable.waiter && (
                                <div className="p-3 bg-[var(--bg)] rounded-lg">
                                    <p className="text-xs text-[var(--muted)] mb-1">Waiter</p>
                                    <p className="font-medium text-sm">{selectedTable.waiter.name}</p>
                                </div>
                            )}
                        </div>
                    </UniversalModal>
                )}
            </div>
        </ErrorBoundary>
    )
}
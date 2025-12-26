// src/app/(public)/tables/page.tsx - FIXED WITH OFFLINE STATUS
"use client"

import { useState, useMemo } from 'react'
import { RefreshCw, DollarSign, WifiOff } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import UniversalModal from '@/components/ui/UniversalModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useDataLoader, useTablesSync } from '@/lib/hooks'
import { getTableStatusColor } from '@/lib/utils/statusHelpers'
import { useOfflineStatus } from '@/lib/hooks/useOfflineStatus'
import type { TableWithRelations } from '@/types'

export default function TablesPage() {
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedTable, setSelectedTable] = useState<TableWithRelations | null>(null)

    const { data: tables, loading, refresh } = useDataLoader<TableWithRelations>({
        table: 'restaurant_tables',
        select: '*, waiters(id, name, profile_pic)',
        order: { column: 'table_number' }
    })

    const { data: orders } = useDataLoader({
        table: 'orders',
        select: 'id, total_amount, status, table_id, order_items(id, quantity, total_price, menu_items(name, price))',
        filter: { status: 'pending' }
    })

    // ✅ ADD: Get offline status
    const { isOnline } = useOfflineStatus()

    useTablesSync(refresh)

    const enrichedTables: TableWithRelations[] = useMemo(() =>
            tables.map(t => ({
                ...t,
                waiter: t.waiter_id && t.status !== 'available' ? (t as any).waiters : null,
                order: t.current_order_id ? orders.find(o => o.id === t.current_order_id) || null : null
            }))
        , [tables, orders])

    const filtered = useMemo(() =>
            enrichedTables.filter(t => statusFilter === 'all' || t.status === statusFilter)
        , [enrichedTables, statusFilter])

    const stats = useMemo(() => [
        { label: 'Total', value: tables.length, color: '#3b82f6', onClick: () => setStatusFilter('all'), active: statusFilter === 'all', subtext: `${enrichedTables.filter(t => t.status === 'available').length} available` },
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
                            <button onClick={refresh} className="p-2 hover:bg-[var(--bg)] rounded-lg active:scale-95">
                                <RefreshCw className="w-5 h-5 text-[var(--muted)]" />
                            </button>
                        }
                    />

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        {/* ✅ ADD: Offline Warning Banner */}
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
                            {selectedTable.order.order_items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between p-3 bg-[var(--bg)] rounded-lg">
                                    <span className="font-medium text-sm">{item.quantity}× {item.menu_items.name}</span>
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
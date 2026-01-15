// src/app/admin/(pages)/history/orders/page.tsx
// ✅ ORDERS HISTORY: Complete order tracking with filters

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Filter, Download, Search, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getOrderStatusColor } from '@/lib/utils/statusHelpers'

export default function OrdersHistoryPage() {
    const router = useRouter()
    const supabase = createClient()

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filters
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [paymentFilter, setPaymentFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [dateRange, setDateRange] = useState({ start: '', end: '' })

    useEffect(() => {
        loadOrders()
    }, [])

    const loadOrders = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
          *,
          restaurant_tables(table_number),
          waiters(name),
          order_items(quantity, total_price, menu_items(name))
        `)
                .order('created_at', { ascending: false })
                .limit(500)

            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Load orders error:', error)
        } finally {
            setLoading(false)
        }
    }

    const filtered = useMemo(() => {
        let result = orders

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(o => o.status === statusFilter)
        }

        // Type filter
        if (typeFilter !== 'all') {
            result = result.filter(o => o.order_type === typeFilter)
        }

        // Payment filter
        if (paymentFilter !== 'all') {
            result = result.filter(o => o.payment_method === paymentFilter)
        }

        // Search filter
        if (searchQuery) {
            result = result.filter(o =>
                o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.customer_phone?.includes(searchQuery)
            )
        }

        // Date range filter
        if (dateRange.start && dateRange.end) {
            const start = new Date(dateRange.start)
            const end = new Date(dateRange.end)
            result = result.filter(o => {
                const orderDate = new Date(o.created_at)
                return orderDate >= start && orderDate <= end
            })
        }

        return result
    }, [orders, statusFilter, typeFilter, paymentFilter, searchQuery, dateRange])

    const stats = useMemo(() => {
        const completed = filtered.filter(o => o.status === 'completed')
        const totalRevenue = completed.reduce((s, o) => s + (o.total_amount || 0), 0)

        return [
            { label: 'Total Orders', value: filtered.length, color: '#3b82f6' },
            { label: 'Completed', value: completed.length, color: '#10b981' },
            { label: 'Pending', value: filtered.filter(o => o.status === 'pending').length, color: '#f59e0b' },
            { label: 'Revenue', value: `PKR ${(totalRevenue / 1000).toFixed(1)}k`, color: '#8b5cf6' }
        ]
    }, [filtered])

    const columns = [
        {
            key: 'order',
            label: 'Order',
            render: (row: any) => (
                <div>
                    <p className="font-medium text-[var(--fg)] text-sm">#{row.id.slice(0, 8).toUpperCase()}</p>
                    <p className="text-xs text-[var(--muted)]">
                        {new Date(row.created_at).toLocaleString()}
                    </p>
                </div>
            )
        },
        {
            key: 'customer',
            label: 'Customer/Table',
            mobileHidden: true,
            render: (row: any) => (
                <span className="text-sm text-[var(--fg)]">
          {row.order_type === 'dine-in'
              ? `Table ${row.restaurant_tables?.table_number || 'N/A'}`
              : row.customer_name || row.customer_phone || 'Walk-in'}
        </span>
            )
        },
        {
            key: 'type',
            label: 'Type',
            render: (row: any) => (
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
            key: 'payment',
            label: 'Payment',
            mobileHidden: true,
            render: (row: any) => (
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
            render: (row: any) => {
                const status = getOrderStatusColor(row.status)
                return (
                    <span className={`inline-flex px-2 py-1 rounded-md text-xs font-semibold ${status.bg} ${status.text}`}>
            {status.label}
          </span>
                )
            }
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right' as const,
            render: (row: any) => (
                <div className="text-right">
                    <p className="font-bold text-blue-600">PKR {row.total_amount.toLocaleString()}</p>
                    <p className="text-xs text-[var(--muted)]">
                        {row.order_items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0} items
                    </p>
                </div>
            )
        }
    ]

    const exportCSV = () => {
        const headers = ['Order ID', 'Date', 'Type', 'Customer', 'Payment', 'Status', 'Amount']
        const rows = filtered.map(o => [
            o.id.slice(0, 8).toUpperCase(),
            new Date(o.created_at).toLocaleString(),
            o.order_type,
            o.customer_name || o.customer_phone || `Table ${o.restaurant_tables?.table_number}` || 'N/A',
            o.payment_method || 'Pending',
            o.status,
            o.total_amount
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `orders-${Date.now()}.csv`
        a.click()
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="Orders History"
                    subtitle={`${filtered.length} orders found`}
                    action={
                        <div className="flex gap-2">
                            <button
                                onClick={exportCSV}
                                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/history')}
                                className="px-3 sm:px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center gap-2 text-sm active:scale-95"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>
                    }
                />

                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                                <p className="text-xs text-[var(--muted)] mb-1">{stat.label}</p>
                                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Filter className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-[var(--fg)]">Filters</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* Search */}
                            <div className="lg:col-span-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by ID, customer..."
                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                />
                            </div>

                            {/* Status */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                            >
                                <option value="all">All Status</option>
                                <option value="pending">Pending</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                            </select>

                            {/* Type */}
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                            >
                                <option value="all">All Types</option>
                                <option value="dine-in">Dine-In</option>
                                <option value="delivery">Delivery</option>
                                <option value="takeaway">Takeaway</option>
                            </select>

                            {/* Payment */}
                            <select
                                value={paymentFilter}
                                onChange={(e) => setPaymentFilter(e.target.value)}
                                className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                            >
                                <option value="all">All Payments</option>
                                <option value="cash">Cash</option>
                                <option value="online">Online</option>
                            </select>
                        </div>

                        {/* Date Range */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            <input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                            />
                            <input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                            />
                        </div>
                    </div>

                    {/* Orders Table */}
                    <UniversalDataTable
                        columns={columns}
                        data={filtered}
                        loading={loading}
                        emptyMessage="No orders found"
                    />
                </div>
            </div>
        </ErrorBoundary>
    )
}
// src/app/admin/(pages)/history/orders/page.tsx
// 🚀 FULLY OPTIMIZED - Fast, Mobile Perfect, User Friendly

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Filter, Download, Search, ShoppingBag, X, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
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
    const [showFilters, setShowFilters] = useState(false)
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

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

        if (statusFilter !== 'all') {
            result = result.filter(o => o.status === statusFilter)
        }

        if (typeFilter !== 'all') {
            result = result.filter(o => o.order_type === typeFilter)
        }

        if (paymentFilter !== 'all') {
            result = result.filter(o => o.payment_method === paymentFilter)
        }

        if (searchQuery) {
            result = result.filter(o =>
                o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                o.customer_phone?.includes(searchQuery)
            )
        }

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
            { label: 'Total', value: filtered.length, color: '#3b82f6' },
            { label: 'Completed', value: completed.length, color: '#10b981' },
            { label: 'Pending', value: filtered.filter(o => o.status === 'pending').length, color: '#f59e0b' },
            { label: 'Revenue', value: `₨${(totalRevenue / 1000).toFixed(1)}k`, color: '#8b5cf6' }
        ]
    }, [filtered])

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

    const clearFilters = () => {
        setStatusFilter('all')
        setTypeFilter('all')
        setPaymentFilter('all')
        setSearchQuery('')
        setDateRange({ start: '', end: '' })
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
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
                                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                            >
                                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/history')}
                                className="px-3 sm:px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                            >
                                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>
                    }
                />

                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {stats.map((stat, i) => (
                            <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                                <p className="text-xs text-[var(--muted)] mb-1">{stat.label}</p>
                                <p className="text-xl sm:text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Filters Toggle Button (Mobile) */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="w-full sm:hidden flex items-center justify-between p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg"
                    >
                        <span className="flex items-center gap-2 text-[var(--fg)] font-medium">
                            <Filter className="w-4 h-4" />
                            Filters {(statusFilter !== 'all' || typeFilter !== 'all' || paymentFilter !== 'all' || searchQuery || dateRange.start) && '(Active)'}
                        </span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Filters */}
                    <div className={`bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4 ${showFilters ? 'block' : 'hidden sm:block'}`}>
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">Filters</h3>
                            </div>
                            <button
                                onClick={clearFilters}
                                className="text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                Clear All
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by ID, customer..."
                                    className="w-full pl-9 pr-3 py-2 sm:py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                />
                            </div>

                            {/* Filter Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>

                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="all">All Types</option>
                                    <option value="dine-in">Dine-In</option>
                                    <option value="delivery">Delivery</option>
                                    <option value="takeaway">Takeaway</option>
                                </select>

                                <select
                                    value={paymentFilter}
                                    onChange={(e) => setPaymentFilter(e.target.value)}
                                    className="px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                    style={{ colorScheme: 'dark' }}
                                >
                                    <option value="all">All Payments</option>
                                    <option value="cash">Cash</option>
                                    <option value="online">Online</option>
                                </select>
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    </div>

                    {/* Orders List */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="p-3 sm:p-6 border-b border-[var(--border)]">
                            <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">All Orders ({filtered.length})</h3>
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                            {filtered.map((order) => {
                                const status = getOrderStatusColor(order.status)
                                const isExpanded = expandedOrder === order.id

                                return (
                                    <div key={order.id} className="p-3 sm:p-4 hover:bg-[var(--bg)] transition-colors">
                                        <button
                                            onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                            className="w-full text-left"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-semibold text-[var(--fg)] text-sm sm:text-base">
                                                            #{order.id.slice(0, 8).toUpperCase()}
                                                        </p>
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${status.bg} ${status.text}`}>
                                                            {status.label}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-[var(--muted)]">
                                                        {new Date(order.created_at).toLocaleString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                                            order.order_type === 'dine-in' ? 'bg-blue-500/20 text-blue-600' :
                                                                order.order_type === 'delivery' ? 'bg-purple-500/20 text-purple-600' :
                                                                    'bg-green-500/20 text-green-600'
                                                        }`}>
                                                            {order.order_type === 'dine-in' ? '🏠' :
                                                                order.order_type === 'delivery' ? '🚚' : '📦'} {order.order_type}
                                                        </span>
                                                        {order.payment_method && (
                                                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                                                order.payment_method === 'cash' ? 'bg-green-500/20 text-green-600' : 'bg-blue-500/20 text-blue-600'
                                                            }`}>
                                                                {order.payment_method === 'cash' ? '💵' : '💳'} {order.payment_method}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="text-left sm:text-right shrink-0">
                                                    <p className="text-lg sm:text-xl font-bold text-blue-600">
                                                        PKR {order.total_amount.toLocaleString()}
                                                    </p>
                                                    <p className="text-xs text-[var(--muted)]">
                                                        {order.order_items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0} items
                                                    </p>
                                                </div>
                                            </div>
                                        </button>

                                        {/* Expanded Details */}
                                        {isExpanded && order.order_items && order.order_items.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-[var(--border)]">
                                                <p className="text-xs sm:text-sm font-semibold text-[var(--fg)] mb-2">Order Items:</p>
                                                <div className="space-y-1.5">
                                                    {order.order_items.map((item: any, idx: number) => (
                                                        <div key={idx} className="flex justify-between text-xs sm:text-sm">
                                                            <span className="text-[var(--muted)]">
                                                                {item.quantity}x {item.menu_items?.name || 'Item'}
                                                            </span>
                                                            <span className="font-semibold text-[var(--fg)]">
                                                                PKR {item.total_price?.toLocaleString() || 0}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        {filtered.length === 0 && (
                            <div className="p-8 sm:p-12 text-center">
                                <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20 text-[var(--fg)]" />
                                <p className="text-[var(--fg)] font-medium text-sm sm:text-base">No orders found</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">Try adjusting your filters</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
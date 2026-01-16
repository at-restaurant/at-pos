// src/app/admin/(pages)/history/customers/page.tsx
// 🚀 FULLY OPTIMIZED - Fast, Mobile Perfect, User Friendly

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, MapPin, Phone, User, Search, Download, ShoppingBag, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function CustomersPage() {
    const router = useRouter()
    const supabase = createClient()

    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'takeaway'>('all')
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

    useEffect(() => {
        loadCustomers()
    }, [])

    const loadCustomers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .in('order_type', ['delivery', 'takeaway'])
                .order('created_at', { ascending: false })

            if (error) throw error
            setOrders(data || [])
        } catch (error) {
            console.error('Load customers error:', error)
        } finally {
            setLoading(false)
        }
    }

    const customers = useMemo(() => {
        const customerMap: any = {}

        orders.forEach(order => {
            const key = order.customer_phone || order.customer_name || 'unknown'

            if (!customerMap[key]) {
                customerMap[key] = {
                    name: order.customer_name || 'Unknown',
                    phone: order.customer_phone || 'N/A',
                    address: order.delivery_address || 'N/A',
                    orders: [],
                    totalSpent: 0,
                    deliveryCount: 0,
                    takeawayCount: 0
                }
            }

            customerMap[key].orders.push(order)
            customerMap[key].totalSpent += order.total_amount || 0

            if (order.order_type === 'delivery') {
                customerMap[key].deliveryCount++
            } else if (order.order_type === 'takeaway') {
                customerMap[key].takeawayCount++
            }
        })

        return Object.values(customerMap).sort((a: any, b: any) => b.totalSpent - a.totalSpent)
    }, [orders])

    const filtered = useMemo(() => {
        let result = customers

        if (typeFilter === 'delivery') {
            result = result.filter((c: any) => c.deliveryCount > 0)
        } else if (typeFilter === 'takeaway') {
            result = result.filter((c: any) => c.takeawayCount > 0)
        }

        if (searchQuery) {
            result = result.filter((c: any) =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.phone.includes(searchQuery) ||
                c.address.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        return result
    }, [customers, typeFilter, searchQuery])

    const stats = useMemo(() => {
        const totalCustomers = customers.length
        const deliveryCustomers = customers.filter((c: any) => c.deliveryCount > 0).length
        const takeawayCustomers = customers.filter((c: any) => c.takeawayCount > 0).length
        const totalRevenue = customers.reduce((s: number, c: any) => s + c.totalSpent, 0)

        return {
            totalCustomers,
            deliveryCustomers,
            takeawayCustomers,
            totalRevenue
        }
    }, [customers])

    const exportCSV = () => {
        const headers = ['Name', 'Phone', 'Address', 'Total Orders', 'Total Spent', 'Delivery', 'Takeaway']
        const rows = filtered.map((c: any) => [
            c.name,
            c.phone,
            c.address,
            c.orders.length,
            c.totalSpent,
            c.deliveryCount,
            c.takeawayCount
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `customers-${Date.now()}.csv`
        a.click()
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
                    title="Customer Database"
                    subtitle={`${filtered.length} customers found`}
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
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <User className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Total Customers</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalCustomers}</p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <MapPin className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Delivery</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.deliveryCustomers}</p>
                        </div>

                        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <ShoppingBag className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Takeaway</p>
                            <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.takeawayCustomers}</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                            <Phone className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                            <p className="text-xs opacity-90">Total Revenue</p>
                            <p className="text-xl sm:text-2xl font-bold mt-1">₨{(stats.totalRevenue / 1000).toFixed(1)}k</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted)]" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, phone, address..."
                                    className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                <button
                                    onClick={() => setTypeFilter('all')}
                                    className={`flex-1 min-w-[90px] px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap ${
                                        typeFilter === 'all'
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)]'
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setTypeFilter('delivery')}
                                    className={`flex-1 min-w-[110px] px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap ${
                                        typeFilter === 'delivery'
                                            ? 'bg-purple-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)]'
                                    }`}
                                >
                                    🚚 Delivery
                                </button>
                                <button
                                    onClick={() => setTypeFilter('takeaway')}
                                    className={`flex-1 min-w-[110px] px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap ${
                                        typeFilter === 'takeaway'
                                            ? 'bg-green-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)]'
                                    }`}
                                >
                                    📦 Takeaway
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Customers List */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="p-3 sm:p-6 border-b border-[var(--border)]">
                            <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">All Customers ({filtered.length})</h3>
                        </div>

                        <div className="divide-y divide-[var(--border)]">
                            {filtered.map((customer: any, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => setSelectedCustomer(customer === selectedCustomer ? null : customer)}
                                    className="w-full p-3 sm:p-4 hover:bg-[var(--bg)] transition-colors text-left"
                                >
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-base sm:text-lg shrink-0">
                                            {customer.name.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-[var(--fg)] truncate text-sm sm:text-base">{customer.name}</p>
                                                    <p className="text-xs sm:text-sm text-[var(--muted)] flex items-center gap-1 mt-1">
                                                        <Phone className="w-3 h-3" />
                                                        {customer.phone}
                                                    </p>
                                                    {customer.address !== 'N/A' && (
                                                        <p className="text-xs text-[var(--muted)] flex items-center gap-1 mt-1 line-clamp-1">
                                                            <MapPin className="w-3 h-3 shrink-0" />
                                                            {customer.address}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="text-left sm:text-right shrink-0">
                                                    <p className="font-bold text-blue-600 text-base sm:text-lg">₨{(customer.totalSpent / 1000).toFixed(1)}k</p>
                                                    <p className="text-xs text-[var(--muted)]">{customer.orders.length} orders</p>
                                                    <div className="flex sm:justify-end gap-1 mt-1">
                                                        {customer.deliveryCount > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-600 rounded text-[10px] font-semibold">
                                                                🚚 {customer.deliveryCount}
                                                            </span>
                                                        )}
                                                        {customer.takeawayCount > 0 && (
                                                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-600 rounded text-[10px] font-semibold">
                                                                📦 {customer.takeawayCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expanded Order History */}
                                            {selectedCustomer === customer && (
                                                <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-2 animate-in slide-in-from-top-2">
                                                    <p className="text-xs sm:text-sm font-semibold text-[var(--fg)] mb-2">Order History</p>
                                                    <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                                                        {customer.orders.map((order: any, j: number) => (
                                                            <div key={j} className="p-2 sm:p-3 bg-[var(--bg)] rounded-lg text-xs sm:text-sm">
                                                                <div className="flex justify-between mb-1">
                                                                    <span className="text-[var(--muted)]">#{order.id.slice(0, 8).toUpperCase()}</span>
                                                                    <span className="font-semibold text-[var(--fg)]">₨{order.total_amount.toLocaleString()}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-[var(--muted)]">
                                                                        {new Date(order.created_at).toLocaleDateString('en-US', {
                                                                            month: 'short',
                                                                            day: 'numeric'
                                                                        })}
                                                                    </span>
                                                                    <span className={`px-2 py-0.5 rounded font-semibold ${
                                                                        order.order_type === 'delivery'
                                                                            ? 'bg-purple-500/20 text-purple-600'
                                                                            : 'bg-green-500/20 text-green-600'
                                                                    }`}>
                                                                        {order.order_type === 'delivery' ? '🚚 Delivery' : '📦 Takeaway'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {filtered.length === 0 && (
                            <div className="p-8 sm:p-12 text-center">
                                <User className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20 text-[var(--fg)]" />
                                <p className="text-[var(--fg)] font-medium text-sm sm:text-base">No customers found</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">Try adjusting your filters</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ErrorBoundary>
    )
}
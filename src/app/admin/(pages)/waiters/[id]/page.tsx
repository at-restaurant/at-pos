"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, DollarSign, ShoppingBag, Clock, TrendingUp, Calendar } from 'lucide-react'
import {ErrorBoundary} from "@/components/ErrorBoundary";

export default function WaiterStatsPage() {
    const params = useParams()
    const router = useRouter()
    const waiterId = params.id as string

    const [waiter, setWaiter] = useState<any>(null)
    const [todayStats, setTodayStats] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (waiterId) {
            loadWaiterData()
        }
    }, [waiterId])

    const loadWaiterData = async () => {
        setLoading(true)
        try {
            // Load waiter info
            const { data: waiterData, error: waiterError } = await supabase
                .from('waiters')
                .select('*')
                .eq('id', waiterId)
                .single()

            if (waiterError) throw waiterError
            setWaiter(waiterData)

            // Get today's date range
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            // Load today's orders
            const { data: ordersData } = await supabase
                .from('orders')
                .select('*, restaurant_tables(table_number), order_items(*, menu_items(name))')
                .eq('waiter_id', waiterId)
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString())
                .order('created_at', { ascending: false })

            setOrders(ordersData || [])

            // Calculate today's stats
            const completed = ordersData?.filter(o => o.status === 'completed') || []
            const totalRevenue = completed.reduce((sum, o) => sum + o.total_amount, 0)
            const avgOrder = completed.length > 0 ? totalRevenue / completed.length : 0

            setTodayStats({
                totalOrders: ordersData?.length || 0,
                completedOrders: completed.length,
                pendingOrders: ordersData?.filter(o => o.status === 'pending').length || 0,
                totalRevenue,
                avgOrder
            })

        } catch (error) {
            console.error('Failed to load waiter data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    if (!waiter) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <p className="text-[var(--fg)] font-medium mb-2">Waiter not found</p>
                    <button
                        onClick={() => router.push('/admin/waiters')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
                    >
                        Back to Waiters
                    </button>
                </div>
            </div>
        )
    }

    const getPerformanceLevel = () => {
        if (todayStats.completedOrders >= 10) return { label: 'Excellent', color: '#10b981', emoji: '🌟' }
        if (todayStats.completedOrders >= 5) return { label: 'Good', color: '#3b82f6', emoji: '👍' }
        if (todayStats.completedOrders >= 1) return { label: 'Average', color: '#f59e0b', emoji: '📊' }
        return { label: 'Started', color: '#6b7280', emoji: '🆕' }
    }

    const performance = getPerformanceLevel()

    return (
        <ErrorBoundary>
        <div className="min-h-screen bg-[var(--bg)]">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/admin/waiters')}
                            className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-[var(--muted)]" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-[var(--fg)]">{waiter.name}'s Performance</h1>
                            <p className="text-sm text-[var(--muted)] mt-1">
                                Today's Statistics - {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                {/* Waiter Profile Card */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                    <div className="flex items-center gap-6">
                        {waiter.profile_pic ? (
                            <img
                                src={waiter.profile_pic}
                                alt={waiter.name}
                                className="w-24 h-24 rounded-full object-cover border-4 border-blue-600"
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-4xl">
                                {waiter.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div className="flex-1">
                            <h2 className="text-3xl font-bold text-[var(--fg)] mb-2">{waiter.name}</h2>
                            <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                                <span className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${waiter.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                    {waiter.is_on_duty ? 'On Duty' : 'Off Duty'}
                                </span>
                                {waiter.phone && (
                                    <>
                                        <span>•</span>
                                        <span>📞 {waiter.phone}</span>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="text-center px-6 py-4 bg-[var(--bg)] rounded-xl border-2" style={{ borderColor: performance.color }}>
                            <div className="text-3xl mb-2">{performance.emoji}</div>
                            <div className="font-bold text-lg" style={{ color: performance.color }}>
                                {performance.label}
                            </div>
                            <div className="text-xs text-[var(--muted)] mt-1">Performance</div>
                        </div>
                    </div>
                </div>

                {/* Today's Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        {
                            label: 'Total Orders',
                            value: todayStats.totalOrders,
                            icon: ShoppingBag,
                            color: '#3b82f6',
                            subtext: `${todayStats.completedOrders} completed`
                        },
                        {
                            label: 'Revenue Generated',
                            value: `PKR ${todayStats.totalRevenue.toLocaleString()}`,
                            icon: DollarSign,
                            color: '#10b981',
                            subtext: `Avg: PKR ${Math.round(todayStats.avgOrder)}`
                        },
                        {
                            label: 'Pending Orders',
                            value: todayStats.pendingOrders,
                            icon: Clock,
                            color: '#f59e0b',
                            subtext: 'Active orders'
                        },
                        {
                            label: 'Avg per Order',
                            value: `PKR ${Math.round(todayStats.avgOrder)}`,
                            icon: TrendingUp,
                            color: '#8b5cf6',
                            subtext: 'From completed'
                        }
                    ].map(stat => {
                        const Icon = stat.icon
                        return (
                            <div key={stat.label} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 hover:shadow-lg transition-all">
                                <Icon className="w-8 h-8 mb-3" style={{ color: stat.color }} />
                                <p className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-2">{stat.label}</p>
                                <p className="text-2xl font-bold text-[var(--fg)] mb-1">{stat.value}</p>
                                <p className="text-xs text-[var(--muted)]">{stat.subtext}</p>
                            </div>
                        )
                    })}
                </div>

                {/* Today's Orders List */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-[var(--border)]">
                        <h3 className="text-xl font-bold text-[var(--fg)] flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            Today's Orders ({orders.length})
                        </h3>
                    </div>

                    {orders.length === 0 ? (
                        <div className="p-12 text-center">
                            <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--fg)' }} />
                            <p className="text-[var(--fg)] font-medium mb-1">No orders yet today</p>
                            <p className="text-sm text-[var(--muted)]">Orders will appear here as they come in</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border)]">
                            {orders.map(order => (
                                <div key={order.id} className="p-4 hover:bg-[var(--bg)] transition-colors">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-[var(--fg)]">
                                                    Order #{order.id.slice(0, 8).toUpperCase()}
                                                </h4>
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                    order.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                                                        'bg-yellow-500/20 text-yellow-600'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-[var(--muted)]">
                                                Table {order.restaurant_tables?.table_number} • {new Date(order.created_at).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-bold text-blue-600">
                                                PKR {order.total_amount.toLocaleString()}
                                            </p>
                                            <p className="text-xs text-[var(--muted)]">
                                                {order.order_items?.length} items
                                            </p>
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="flex flex-wrap gap-2">
                                        {order.order_items?.map((item: any, idx: number) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-1 bg-[var(--bg)] rounded text-xs text-[var(--muted)]"
                                            >
                                                {item.quantity}x {item.menu_items?.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Overall Performance */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                    <h3 className="text-xl font-bold text-[var(--fg)] mb-4">Overall Career Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-[var(--muted)] mb-1">Total Career Orders</p>
                            <p className="text-2xl font-bold text-[var(--fg)]">{waiter.total_orders || 0}</p>
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted)] mb-1">Total Revenue</p>
                            <p className="text-2xl font-bold text-[var(--fg)]">
                                PKR {(waiter.total_revenue || 0).toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-[var(--muted)] mb-1">Average Rating</p>
                            <p className="text-2xl font-bold text-[var(--fg)]">
                                ⭐ {(waiter.avg_rating || 0).toFixed(1)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        </ErrorBoundary>
    )
}
// src/app/admin/page.tsx - FIXED: TypeScript errors
'use client'

import { getBusinessDateRange } from '@/lib/utils/businessDay'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AdminProfileBadge from '@/components/ui/AdminProfileBadge'
import AdminProfileModal from '@/components/admin/AdminProfileModal'
import Link from 'next/link'
import {
    Package, Users, LayoutGrid, ShoppingBag, UtensilsCrossed,
    DollarSign, Clock, AlertCircle, ArrowRight,
    Calendar, Target, Award, Activity, BarChart3, PieChart
} from 'lucide-react'
import UniversalModal from '@/components/ui/UniversalModal'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts'

// ✅ ADD TYPE DEFINITIONS
type OrderData = {
    total_amount?: number
    status?: string
}

type TodayOrderData = {
    id?: string
    total_amount?: number
    status?: string
    created_at?: string
    order_type?: string
}

type ActiveOrder = {
    id: string
    total_amount: number
    status: string
    order_type: string
    created_at: string
    table_id?: string | null
}

type InventoryData = {
    id?: string
    name?: string
    quantity?: number
    reorder_level?: number
    unit?: string
    type?: string
}

type MenuItemData = {
    id?: string
    name?: string
    stock_quantity?: number | null
    track_stock?: boolean
    type?: string
}

type WaiterData = {
    id?: string
    name?: string
    is_on_duty?: boolean
    phone?: string
}

type HourlyData = {
    hour: number
    orders: number
    revenue: number
}

export default function AdminDashboard() {
    const [data, setData] = useState({
        inventory: 0, waiters: 0, tables: 0, orders: 0,
        revenue: 0, todayOrders: 0, activeWaiters: 0,
        lowStock: 0, pendingOrders: 0, todayRevenue: 0,
        completedToday: 0,
        todayOrdersList: [] as TodayOrderData[],
        staffList: [] as WaiterData[],
        lowStockList: [] as (MenuItemData | InventoryData)[]
    })
    const [loading, setLoading] = useState(true)
    const [hourlyData, setHourlyData] = useState<HourlyData[]>([])
    const [showProfileModal, setShowProfileModal] = useState(false)
    const [activeModal, setActiveModal] = useState<'orders' | 'revenue' | 'staff' | 'inventory' | 'end_day' | null>(null)
    const [closingShift, setClosingShift] = useState(false)
    const [activeOrdersList, setActiveOrdersList] = useState<ActiveOrder[]>([])
    const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
    const [shiftStep, setShiftStep] = useState<'confirm' | 'resolve' | 'done'>('confirm')
    const supabase = createClient()

    // Step 1: Check for active orders before closing shift
    const handleInitiateCloseShift = async () => {
        setClosingShift(true)
        try {
            const { data: activeOrders } = await supabase
                .from('orders')
                .select('id, total_amount, status, order_type, created_at, table_id')
                .in('status', ['pending', 'preparing'])
            
            if (activeOrders && activeOrders.length > 0) {
                setActiveOrdersList(activeOrders as ActiveOrder[])
                setShiftStep('resolve')
            } else {
                // No active orders — free tables directly
                await supabase.from('restaurant_tables').update({ status: 'available' }).neq('status', 'available')
                setShiftStep('done')
                load()
            }
        } catch (err) {
            console.error(err)
        }
        setClosingShift(false)
    }

    // Step 2: Resolve a single active order (done → completed, or cancel → cancelled)
    const resolveOrder = async (orderId: string, resolution: 'completed' | 'cancelled') => {
        setProcessingOrderId(orderId)
        try {
            await supabase
                .from('orders')
                .update({ status: resolution, updated_at: new Date().toISOString() })
                .eq('id', orderId)
            
            // Remove from local list
            setActiveOrdersList(prev => {
                const remaining = prev.filter(o => o.id !== orderId)
                // If all resolved, free tables and finish
                if (remaining.length === 0) {
                    supabase.from('restaurant_tables').update({ status: 'available' }).neq('status', 'available').then(() => {
                        setShiftStep('done')
                        load()
                    })
                }
                return remaining
            })
        } catch (err) {
            console.error(err)
        }
        setProcessingOrderId(null)
    }

    // Reset shift modal state on close
    const handleCloseShiftModal = () => {
        setActiveModal(null)
        setShiftStep('confirm')
        setActiveOrdersList([])
    }

    useEffect(() => {
        load()
        const interval = setInterval(load, 30000)
        return () => clearInterval(interval)
    }, [])

    const load = async () => {
        setLoading(true)
        try {
            const { startDate: start, endDate: end } = getBusinessDateRange('today')

            const [menuItemCount, wait, tab, ord, todayOrd, invItems, menuItemsData, waitersFull] = await Promise.all([
                supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('is_available', true),
                supabase.from('waiters').select('id, is_on_duty', { count: 'exact' }).eq('is_active', true),
                supabase.from('restaurant_tables').select('id', { count: 'exact', head: true }),
                supabase.from('orders').select('total_amount, status'),
                supabase.from('orders').select('id, total_amount, status, created_at, order_type')
                    .gte('created_at', start)
                    .lt('created_at', end),
                supabase.from('inventory_items').select('id, name, quantity, reorder_level, unit').eq('is_active', true),
                supabase.from('menu_items').select('id, name, stock_quantity, track_stock').eq('is_available', true),
                supabase.from('waiters').select('id, name, is_on_duty, phone').eq('is_active', true)
            ])

            const ordersData = (Array.isArray(ord.data) ? ord.data : []) as OrderData[]
            const todayOrdersData = (Array.isArray(todayOrd.data) ? todayOrd.data : []) as TodayOrderData[]
            const inventoryData = (Array.isArray(invItems.data) ? invItems.data : []) as InventoryData[]
            // Use the full waiters fetch instead of the count-only one for drill down
            const waitersData = (Array.isArray(waitersFull.data) ? waitersFull.data : []) as any[]

            const revenue = ordersData
                .filter((o: OrderData) => o?.status === 'completed')
                .reduce((s: number, o: OrderData) => s + (o?.total_amount || 0), 0)
            const todayRevenue = todayOrdersData
                .filter((o: TodayOrderData) => o?.status === 'completed')
                .reduce((s: number, o: TodayOrderData) => s + (o?.total_amount || 0), 0)
            
            const rawItemsData = (Array.isArray(menuItemsData.data) ? menuItemsData.data : []) as MenuItemData[]
            
            const menuLowStockList = rawItemsData.filter((i: MenuItemData) => 
                i?.track_stock && i?.stock_quantity !== null && i?.stock_quantity !== 999 && i.stock_quantity! <= 10
            )
            const inventoryLowStockList = inventoryData.filter((i: InventoryData) => (i?.quantity || 0) <= (i?.reorder_level || 0))
            const lowStock = menuLowStockList.length + inventoryLowStockList.length
            
            const pendingOrders = ordersData.filter((o: OrderData) => o?.status === 'pending').length
            const activeWaiters = waitersData.filter((w: any) => w?.is_on_duty).length
            const completedToday = todayOrdersData.filter((o: TodayOrderData) => o?.status === 'completed').length

            // Hourly breakdown
            const hourly: HourlyData[] = Array.from({ length: 24 }, (_, i) => ({
                hour: i,
                orders: 0,
                revenue: 0
            }))

            todayOrdersData.forEach((order: TodayOrderData) => {
                if (order?.created_at && order.status === 'completed') {
                    const hour = new Date(order.created_at).getHours()
                    hourly[hour].orders++
                    hourly[hour].revenue += order.total_amount || 0
                }
            })

            setHourlyData(hourly.filter(h => h.orders > 0 || h.revenue > 0))

            setData({
                inventory: menuItemCount.count || 0,
                waiters: wait.count || 0,
                tables: tab.count || 0,
                orders: ordersData.length,
                revenue,
                todayOrders: todayOrdersData.length,
                activeWaiters,
                lowStock,
                pendingOrders,
                todayRevenue,
                completedToday,
                // Add drill-down lists
                todayOrdersList: todayOrdersData,
                staffList: waitersData,
                lowStockList: [...menuLowStockList.map(i => ({...i, type: 'menu'})), ...inventoryLowStockList.map(i => ({...i, type: 'raw'}))]
            } as any)
        } catch (error) {
            console.error('Failed to load dashboard:', error)
        }
        setLoading(false)
    }

    const quickActions = [
        {
            id: 'inventory',
            label: 'Menu Items',
            icon: Package,
            href: '/admin/inventory',
            color: '#3b82f6',
            badge: data.lowStock > 0 ? data.lowStock : null,
            description: `${data.inventory} active`
        },
        {
            id: 'staff',
            label: 'Staff',
            icon: Users,
            href: '/admin/waiters',
            color: '#8b5cf6',
            badge: data.activeWaiters > 0 ? data.activeWaiters : null,
            description: `${data.waiters} active • ${data.activeWaiters} on duty`
        },
        {
            id: 'tables',
            label: 'Tables',
            icon: LayoutGrid,
            href: '/admin/tables',
            color: '#10b981',
            description: `${data.tables} tables`
        },
        {
            id: 'menu',
            label: 'Menu',
            icon: UtensilsCrossed,
            href: '/admin/menu',
            color: '#f59e0b',
            description: 'Manage items'
        },
        {
            id: 'history',
            label: 'History',
            icon: Clock,
            href: '/admin/history',
            color: '#06b6d4',
            description: 'Reports'
        }
    ]

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-[var(--muted)] text-sm sm:text-base">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    const maxRevenue = Math.max(...hourlyData.map((h: HourlyData) => h.revenue), 1)

    return (
        <div className="min-h-screen bg-[var(--bg)]">
            <header className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)] backdrop-blur-lg bg-opacity-80">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <AdminProfileBadge onClick={() => setShowProfileModal(true)} />
                            <div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--fg)]">Dashboard</h1>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 flex items-center gap-2">
                                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                    {new Date().toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveModal('end_day')}
                                className="px-3 py-2 sm:px-4 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-lg text-sm sm:text-base font-medium flex items-center gap-2"
                            >
                                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                                <span className="hidden sm:inline">Close Shift</span>
                            </button>
                            <button
                                onClick={load}
                                className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg text-sm sm:text-base font-medium"
                            >
                                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Target className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg sm:text-xl font-bold text-[var(--fg)]">Today's Overview</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        {[
                            {
                                id: 'orders',
                                label: "Orders",
                                value: data.todayOrders,
                                icon: ShoppingBag,
                                color: '#3b82f6',
                                subtext: `${data.completedToday} completed`
                            },
                            {
                                id: 'revenue',
                                label: "Revenue",
                                value: `PKR ${data.todayRevenue.toLocaleString()}`,
                                icon: DollarSign,
                                color: '#10b981',
                                subtext: 'Today'
                            },
                            {
                                id: 'staff',
                                label: 'Staff',
                                value: `${data.activeWaiters}/${data.waiters}`,
                                icon: Users,
                                color: '#f59e0b',
                                subtext: 'On duty'
                            },
                            {
                                id: 'inventory',
                                label: 'Low Stock',
                                value: data.lowStock,
                                icon: AlertCircle,
                                color: data.lowStock > 0 ? '#ef4444' : '#10b981',
                                subtext: data.lowStock > 0 ? 'Alert!' : 'All good'
                            }
                        ].map((stat, idx) => {
                            const Icon = stat.icon
                            return (
                                <div key={idx} 
                                     onClick={() => stat.id && setActiveModal(stat.id as any)}
                                     className="p-4 sm:p-5 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:border-blue-600 transition-all cursor-pointer hover:shadow-md">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${stat.color}20` }}>
                                            <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color }} />
                                        </div>
                                    </div>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mb-1">{stat.label}</p>
                                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--fg)]">{stat.value}</p>
                                    <p className="text-xs text-[var(--muted)] mt-1">{stat.subtext}</p>
                                </div>
                            )
                        })}
                    </div>
                </section>

                <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                            <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">Hourly Orders</h3>
                        </div>

                        {hourlyData.length > 0 ? (
                            <div className="h-64 mt-4 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <RechartsTooltip cursor={{fill: 'var(--bg)'}} contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px'}} formatter={(val) => [`${val} orders`, 'Orders']} labelFormatter={(l) => `${l}:00`} />
                                        <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-[var(--muted)] text-sm">No orders yet today</div>
                        )}
                    </div>

                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <PieChart className="w-5 h-5 text-green-600" />
                            <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">Hourly Revenue</h3>
                        </div>

                        {hourlyData.length > 0 ? (
                            <div className="h-64 mt-4 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={hourlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                        <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `PKR ${(v/1000)}k`} />
                                        <RechartsTooltip contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px'}} formatter={(val) => [`PKR ${val}`, 'Revenue']} labelFormatter={(l) => `${l}:00`} />
                                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-[var(--muted)] text-sm">No revenue yet today</div>
                        )}
                    </div>
                </section>

                {(data.lowStock > 0 || data.pendingOrders > 5) && (
                    <section
                        className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-5 flex gap-3 items-start overflow-hidden"
                    >
                        <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: 'var(--status-warning)' }} />

                        <div className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--status-warning-bg)' }}>
                            <AlertCircle className="w-4 h-4" style={{ color: 'var(--status-warning)' }} />
                        </div>

                        <div className="flex-1">
                            <h3 className="font-semibold text-sm sm:text-base text-[var(--fg)] mb-1">Attention Required</h3>
                            <ul className="space-y-1 text-xs sm:text-sm text-[var(--fg-secondary)]">
                                {data.lowStock > 0 && (
                                    <li>• <span className="font-medium text-[var(--fg)]">{data.lowStock}</span> inventory items are low on stock</li>
                                )}
                                {data.pendingOrders > 5 && (
                                    <li>• <span className="font-medium text-[var(--fg)]">{data.pendingOrders}</span> orders are pending</li>
                                )}
                            </ul>
                        </div>
                    </section>
                )}

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Award className="w-5 h-5 text-blue-600" />
                        <h2 className="text-lg sm:text-xl font-bold text-[var(--fg)]">Quick Actions</h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        {quickActions.map(action => {
                            const Icon = action.icon
                            return (
                                <Link
                                    key={action.id}
                                    href={action.href}
                                    className="group relative bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6 hover:border-blue-600 hover:shadow-xl transition-all duration-300 active:scale-95"
                                >
                                    {action.badge !== null && action.badge !== undefined && (
                                        <div className="absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 bg-red-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg animate-pulse">
                                            {action.badge}
                                        </div>
                                    )}

                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg" style={{ backgroundColor: `${action.color}20` }}>
                                        <Icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: action.color }} />
                                    </div>

                                    <div>
                                        <h3 className="font-bold text-[var(--fg)] mb-1 text-sm sm:text-base">{action.label}</h3>
                                        <p className="text-xs sm:text-sm text-[var(--muted)]">{action.description}</p>
                                    </div>

                                    <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-[var(--muted)] group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                </Link>
                            )
                        })}
                    </div>
                </section>
            </div>
            <AdminProfileModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />

            {/* Drill Down Modals */}
            {activeModal === 'orders' && (
                <UniversalModal open={true} onClose={() => setActiveModal(null)} title="Today's Orders" size="xl">
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {data.todayOrdersList.length === 0 ? (
                            <div className="text-center py-8 text-[var(--muted)]">No orders today</div>
                        ) : (
                            data.todayOrdersList.map(order => (
                                <div key={order.id} className="flex justify-between items-center p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg">
                                    <div>
                                        <p className="font-semibold text-[var(--fg)]">Order #{order.id?.split('-')[0]}</p>
                                        <p className="text-xs text-[var(--muted)]">{new Date(order.created_at || '').toLocaleTimeString()} • <span className="capitalize">{order.order_type || 'Unknown'}</span></p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-600">PKR {order.total_amount?.toLocaleString()}</p>
                                        <p className={`text-xs font-semibold capitalize ${order.status === 'completed' ? 'text-green-600' : 'text-orange-600'}`}>
                                            {order.status}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </UniversalModal>
            )}

            {activeModal === 'revenue' && (
                <UniversalModal open={true} onClose={() => setActiveModal(null)} title="Revenue Breakdown" size="md">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            {['dine-in', 'takeaway', 'delivery'].map(type => {
                                const total = data.todayOrdersList.filter(o => o.order_type === type && o.status === 'completed').reduce((s, o) => s + (o.total_amount || 0), 0);
                                return (
                                    <div key={type} className="p-4 bg-[var(--card)] border border-[var(--border)] rounded-xl text-center">
                                        <p className="text-xs text-[var(--muted)] capitalize">{type}</p>
                                        <p className="font-bold text-[var(--fg)] mt-1">PKR {total.toLocaleString()}</p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </UniversalModal>
            )}

            {activeModal === 'staff' && (
                <UniversalModal open={true} onClose={() => setActiveModal(null)} title="Active Staff" size="md">
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {data.staffList.filter(s => s.is_on_duty).length === 0 ? (
                            <div className="text-center py-8 text-[var(--muted)]">No staff on duty</div>
                        ) : (
                            data.staffList.filter(s => s.is_on_duty).map(staff => (
                                <div key={staff.id} className="flex justify-between items-center p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center">
                                            <Users className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-[var(--fg)]">{staff.name}</p>
                                            <p className="text-xs text-green-600 font-medium">On Duty</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </UniversalModal>
            )}

            {activeModal === 'inventory' && (
                <UniversalModal open={true} onClose={() => setActiveModal(null)} title="Low Stock Alerts" size="xl">
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {data.lowStockList.length === 0 ? (
                            <div className="text-center py-8 text-[var(--muted)]">Inventory looks good!</div>
                        ) : (
                            data.lowStockList.map((item, idx) => (
                                <div key={item.id || idx} className="flex justify-between items-center p-3 bg-[var(--card)] border border-red-500/30 rounded-lg">
                                    <div>
                                        <p className="font-semibold text-[var(--fg)] flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                                            {item.name}
                                            <span className="text-[10px] px-1.5 py-0.5 bg-[var(--bg)] border border-[var(--border)] rounded-sm capitalize text-[var(--muted)]">{item.type}</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-[var(--muted)]">Remaining:</p>
                                        <p className="font-bold text-red-600 text-sm">
                                            {'stock_quantity' in item ? item.stock_quantity : (item as any).quantity} {'unit' in item && (item as any).unit ? (item as any).unit : ''}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </UniversalModal>
            )}

            {activeModal === 'end_day' && (
                <UniversalModal
                    open={true}
                    onClose={handleCloseShiftModal}
                    title={
                        shiftStep === 'confirm' ? 'Close Shift & End Day' :
                        shiftStep === 'resolve' ? `Resolve Active Orders (${activeOrdersList.length} remaining)` :
                        'Shift Closed'
                    }
                    size={shiftStep === 'resolve' ? 'xl' : 'sm'}
                >
                    {/* ── Step 1: Confirmation ── */}
                    {shiftStep === 'confirm' && (
                        <div className="space-y-4">
                            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl text-center">
                                <AlertCircle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
                                <p className="text-sm text-[var(--fg)] font-medium mb-1">Are you sure you want to end the shift?</p>
                                <p className="text-xs text-[var(--muted)]">If there are active orders, you will be asked to resolve each one before tables are freed.</p>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleCloseShiftModal}
                                    disabled={closingShift}
                                    className="flex-1 px-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-[var(--border)] transition-colors"
                                >
                                    Go Back
                                </button>
                                <button
                                    onClick={handleInitiateCloseShift}
                                    disabled={closingShift}
                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
                                >
                                    {closingShift
                                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : 'Continue'
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Resolve each active order ── */}
                    {shiftStep === 'resolve' && (
                        <div className="space-y-3">
                            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                <p className="text-xs text-blue-600 font-medium text-center">
                                    Mark each active order as <span className="font-bold">Done</span> (saved to sales history) or <span className="font-bold">Cancel</span> it. Tables will be freed automatically when all are resolved.
                                </p>
                            </div>
                            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                                {activeOrdersList.map(order => {
                                    const isProcessing = processingOrderId === order.id
                                    return (
                                        <div key={order.id} className="flex items-center justify-between gap-3 p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-[var(--fg)] truncate">Order #{order.id.split('-')[0].toUpperCase()}</p>
                                                <p className="text-xs text-[var(--muted)]">
                                                    <span className="capitalize">{order.order_type}</span>
                                                    {' • '}
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {' • '}
                                                    <span className={order.status === 'preparing' ? 'text-orange-500 font-medium' : 'text-yellow-600 font-medium'}>
                                                        {order.status}
                                                    </span>
                                                </p>
                                                <p className="text-sm font-bold text-blue-600 mt-0.5">PKR {order.total_amount?.toLocaleString()}</p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button
                                                    onClick={() => resolveOrder(order.id, 'completed')}
                                                    disabled={isProcessing}
                                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                >
                                                    {isProcessing
                                                        ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        : '✓ Done'
                                                    }
                                                </button>
                                                <button
                                                    onClick={() => resolveOrder(order.id, 'cancelled')}
                                                    disabled={isProcessing}
                                                    className="px-3 py-1.5 bg-[var(--bg)] border border-red-500/50 text-red-500 rounded-lg text-xs font-semibold hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                                >
                                                    ✕ Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Done ── */}
                    {shiftStep === 'done' && (
                        <div className="space-y-4">
                            <div className="p-5 bg-green-500/10 border border-green-500/30 rounded-xl text-center">
                                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <span className="text-2xl">✓</span>
                                </div>
                                <p className="text-sm font-semibold text-green-600 mb-1">Shift Closed Successfully</p>
                                <p className="text-xs text-[var(--muted)]">All tables are now available. Sales history has been preserved.</p>
                            </div>
                            <button
                                onClick={handleCloseShiftModal}
                                className="w-full px-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm font-semibold hover:bg-[var(--border)] transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    )}
                </UniversalModal>
            )}
        </div>
    )
}
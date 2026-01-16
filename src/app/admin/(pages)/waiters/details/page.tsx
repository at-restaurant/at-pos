// src/app/admin/(pages)/waiters/details/page.tsx
// ✅ FIXED: Added Suspense wrapper for useSearchParams

"use client"

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    ArrowLeft, DollarSign, ShoppingBag, Clock, TrendingUp,
    Calendar, Wallet, Plus, Banknote, AlertCircle, X, Phone,
    CreditCard, User, ChevronDown, ChevronUp, TrendingDown
} from 'lucide-react'
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useToast } from '@/components/ui/Toast'

function WaiterDetailsContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const toast = useToast()
    const waiterId = searchParams.get('id')

    const [waiter, setWaiter] = useState<any>(null)
    const [advances, setAdvances] = useState<any[]>([])
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdvanceModal, setShowAdvanceModal] = useState(false)
    const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' })
    const [processing, setProcessing] = useState(false)
    const [expandedSections, setExpandedSections] = useState({
        advances: true,
        todayOrders: true
    })
    const supabase = createClient()

    useEffect(() => {
        if (waiterId) loadAllData()
    }, [waiterId])

    const loadAllData = async () => {
        setLoading(true)
        try {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            const [waiterRes, advancesRes, todayOrdersRes] = await Promise.all([
                supabase.from('waiters').select('*').eq('id', waiterId).single(),
                supabase.from('salary_advances').select('*').eq('waiter_id', waiterId).order('advance_date', { ascending: false }),
                supabase.from('orders').select('*, restaurant_tables(table_number), order_items(*, menu_items(name))').eq('waiter_id', waiterId).gte('created_at', today.toISOString()).lt('created_at', tomorrow.toISOString()).order('created_at', { ascending: false })
            ])

            if (waiterRes.error) throw waiterRes.error

            setWaiter(waiterRes.data)
            setAdvances(advancesRes.data || [])
            setOrders(todayOrdersRes.data || [])
        } catch (error) {
            console.error('Failed to load:', error)
            toast.add('error', '❌ Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    const stats = useMemo(() => {
        const completed = orders.filter(o => o.status === 'completed')
        const totalRevenue = completed.reduce((sum, o) => sum + (o.total_amount || 0), 0)

        return {
            todayOrders: orders.length,
            completedOrders: completed.length,
            pendingOrders: orders.filter(o => o.status === 'pending').length,
            totalRevenue,
            avgOrder: completed.length > 0 ? totalRevenue / completed.length : 0,
            allTimeOrders: waiter?.total_orders || 0,
            allTimeRevenue: waiter?.total_revenue || 0
        }
    }, [orders, waiter])

    const salaryInfo = useMemo(() => {
        const totalAdvances = advances.reduce((sum, adv) => sum + parseFloat(adv.amount), 0)
        const monthlySalary = parseFloat(waiter?.monthly_salary || 0)
        const remaining = monthlySalary - totalAdvances

        return {
            monthlySalary,
            totalAdvances,
            remaining,
            isOverpaid: remaining < 0,
            advanceCount: advances.length
        }
    }, [advances, waiter])

    const performance = useMemo(() => {
        if (stats.completedOrders >= 15) return { label: 'Excellent', color: '#10b981', emoji: '🌟', bg: 'from-green-500 to-green-600' }
        if (stats.completedOrders >= 10) return { label: 'Great', color: '#3b82f6', emoji: '⭐', bg: 'from-blue-500 to-blue-600' }
        if (stats.completedOrders >= 5) return { label: 'Good', color: '#f59e0b', emoji: '👍', bg: 'from-orange-500 to-orange-600' }
        if (stats.completedOrders >= 1) return { label: 'Average', color: '#8b5cf6', emoji: '📊', bg: 'from-purple-500 to-purple-600' }
        return { label: 'Started', color: '#6b7280', emoji: '🆕', bg: 'from-gray-500 to-gray-600' }
    }, [stats.completedOrders])

    const handleAddAdvance = async () => {
        const amount = parseFloat(advanceForm.amount)
        if (!amount || amount <= 0) {
            toast.add('error', '❌ Enter valid amount')
            return
        }

        setProcessing(true)
        try {
            const { error } = await supabase.from('salary_advances').insert({
                waiter_id: waiterId,
                amount,
                reason: advanceForm.reason || 'Advance payment'
            })

            if (error) throw error
            toast.add('success', `✅ PKR ${amount.toLocaleString()} advance added`)
            setShowAdvanceModal(false)
            setAdvanceForm({ amount: '', reason: '' })
            loadAllData()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        } finally {
            setProcessing(false)
        }
    }

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)]">
                <div className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)] animate-pulse">
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                        <div className="h-8 bg-[var(--bg)] rounded w-48" />
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
                    <div className="h-32 bg-[var(--card)] rounded-xl animate-pulse" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                        {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--card)] rounded-xl animate-pulse" />)}
                    </div>
                </div>
            </div>
        )
    }

    if (!waiter) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
                <div className="text-center">
                    <div className="text-4xl mb-3">😕</div>
                    <p className="text-[var(--fg)] font-medium mb-3">Waiter not found</p>
                    <button onClick={() => router.push('/admin/waiters')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm active:scale-95">
                        Back to Staff
                    </button>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <header className="sticky top-0 z-30 bg-[var(--card)]/95 backdrop-blur-lg border-b border-[var(--border)] shadow-sm">
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.push('/admin/waiters')} className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors shrink-0">
                                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted)]" />
                            </button>
                            <div className="flex-1 min-w-0">
                                <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">{waiter.name}</h1>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">Staff Performance Dashboard</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                {waiter.profile_pic ? (
                                    <img src={waiter.profile_pic} alt={waiter.name} className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-blue-600 shadow-lg shrink-0" />
                                ) : (
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-3xl sm:text-4xl shadow-lg shrink-0">
                                        {waiter.name.charAt(0).toUpperCase()}
                                    </div>
                                )}

                                <div className="sm:hidden flex-1 min-w-0">
                                    <h2 className="text-2xl font-bold text-[var(--fg)] truncate">{waiter.name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`w-2 h-2 rounded-full ${waiter.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                                        <span className="text-xs text-[var(--muted)]">{waiter.is_on_duty ? 'On Duty' : 'Off Duty'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="hidden sm:block flex-1">
                                <h2 className="text-2xl sm:text-3xl font-bold text-[var(--fg)] mb-2">{waiter.name}</h2>
                                <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-[var(--muted)]">
                                    <span className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full ${waiter.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                                        {waiter.is_on_duty ? 'On Duty' : 'Off Duty'}
                                    </span>
                                    {waiter.phone && (
                                        <>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {waiter.phone}
                                            </span>
                                        </>
                                    )}
                                    {waiter.employee_type && (
                                        <>
                                            <span>•</span>
                                            <span className="px-2 py-1 bg-blue-600/10 text-blue-600 rounded capitalize font-medium">
                                                {waiter.employee_type}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={`w-full sm:w-auto text-center px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-br ${performance.bg} rounded-xl shadow-lg shrink-0`}>
                                <div className="text-3xl sm:text-4xl mb-2">{performance.emoji}</div>
                                <div className="font-bold text-base sm:text-lg text-white">{performance.label}</div>
                                <div className="text-xs text-white/80 mt-1">Today's Performance</div>
                            </div>
                        </div>

                        <div className="sm:hidden mt-4 pt-4 border-t border-[var(--border)] space-y-2">
                            {waiter.phone && (
                                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                                    <Phone className="w-4 h-4" />
                                    <span>{waiter.phone}</span>
                                </div>
                            )}
                            {waiter.cnic && (
                                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                                    <CreditCard className="w-4 h-4" />
                                    <span>{waiter.cnic}</span>
                                </div>
                            )}
                            {waiter.employee_type && (
                                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                                    <User className="w-4 h-4" />
                                    <span className="capitalize">{waiter.employee_type}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                            <Wallet className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2 sm:mb-4" />
                            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">Monthly Salary</p>
                            <p className="text-2xl sm:text-3xl font-bold">PKR {salaryInfo.monthlySalary.toLocaleString()}</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 sm:p-6 text-white shadow-lg">
                            <div className="flex items-center justify-between mb-2 sm:mb-4">
                                <Banknote className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" />
                                <button onClick={() => setShowAdvanceModal(true)} className="text-xs bg-white/20 px-2 sm:px-3 py-1 rounded-lg hover:bg-white/30 flex items-center gap-1 active:scale-95">
                                    <Plus className="w-3 h-3" /> Add
                                </button>
                            </div>
                            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">Total Advances</p>
                            <p className="text-2xl sm:text-3xl font-bold">PKR {salaryInfo.totalAdvances.toLocaleString()}</p>
                            <p className="text-xs opacity-75 mt-1 sm:mt-2">{salaryInfo.advanceCount} payments</p>
                        </div>

                        <div className={`bg-gradient-to-br ${salaryInfo.isOverpaid ? 'from-red-500 to-red-600' : 'from-green-500 to-green-600'} rounded-xl p-4 sm:p-6 text-white shadow-lg`}>
                            {salaryInfo.isOverpaid ? (
                                <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2 sm:mb-4" />
                            ) : (
                                <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2 sm:mb-4" />
                            )}
                            <p className="text-xs sm:text-sm opacity-90 mb-1 sm:mb-2">{salaryInfo.isOverpaid ? 'Overpaid' : 'Remaining'}</p>
                            <p className="text-2xl sm:text-3xl font-bold">PKR {Math.abs(salaryInfo.remaining).toLocaleString()}</p>
                            <p className="text-xs opacity-75 mt-1 sm:mt-2">
                                {salaryInfo.isOverpaid ? 'Deduct next month' : 'To be paid'}
                            </p>
                        </div>
                    </div>

                    {salaryInfo.isOverpaid && (
                        <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-[var(--fg)] text-sm sm:text-base">⚠️ Overpayment Alert</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                                    This staff has received PKR {Math.abs(salaryInfo.remaining).toLocaleString()} more than monthly salary.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {[
                            { label: 'Today Orders', value: stats.todayOrders, icon: ShoppingBag, color: '#3b82f6', sub: `${stats.completedOrders} done` },
                            { label: 'Revenue', value: `₨${(stats.totalRevenue / 1000).toFixed(1)}k`, icon: DollarSign, color: '#10b981', sub: `Avg: ${Math.round(stats.avgOrder)}` },
                            { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: '#f59e0b', sub: 'Active now' },
                            { label: 'All Time', value: stats.allTimeOrders, icon: TrendingUp, color: '#8b5cf6', sub: `₨${(stats.allTimeRevenue / 1000).toFixed(1)}k` }
                        ].map((stat, i) => {
                            const Icon = stat.icon
                            return (
                                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
                                    <Icon className="w-6 h-6 sm:w-8 sm:h-8 mb-2 sm:mb-3" style={{ color: stat.color }} />
                                    <p className="text-[10px] sm:text-xs font-medium text-[var(--muted)] uppercase mb-1 sm:mb-2">{stat.label}</p>
                                    <p className="text-xl sm:text-2xl font-bold text-[var(--fg)] mb-1">{stat.value}</p>
                                    <p className="text-xs text-[var(--muted)]">{stat.sub}</p>
                                </div>
                            )
                        })}
                    </div>

                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection('advances')} className="w-full p-4 sm:p-6 border-b border-[var(--border)] flex items-center justify-between hover:bg-[var(--bg)]">
                            <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)] flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-orange-600" />
                                Advances ({salaryInfo.advanceCount})
                            </h3>
                            {expandedSections.advances ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>

                        {expandedSections.advances && (
                            advances.length > 0 ? (
                                <div className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
                                    {advances.map(adv => (
                                        <div key={adv.id} className="p-3 sm:p-4 hover:bg-[var(--bg)]">
                                            <div className="flex justify-between mb-2">
                                                <p className="font-bold text-orange-600">PKR {parseFloat(adv.amount).toLocaleString()}</p>
                                                <p className="text-xs text-[var(--muted)]">{new Date(adv.advance_date).toLocaleDateString()}</p>
                                            </div>
                                            <p className="text-sm text-[var(--muted)]">{adv.reason || 'Advance payment'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <Wallet className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--fg)' }} />
                                    <p className="text-[var(--fg)] font-medium">No advances yet</p>
                                </div>
                            )
                        )}
                    </div>

                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <button onClick={() => toggleSection('todayOrders')} className="w-full p-4 sm:p-6 border-b border-[var(--border)] flex items-center justify-between hover:bg-[var(--bg)]">
                            <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)] flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-600" />
                                Today's Orders ({stats.todayOrders})
                            </h3>
                            {expandedSections.todayOrders ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>

                        {expandedSections.todayOrders && (
                            orders.length > 0 ? (
                                <div className="divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
                                    {orders.map(order => (
                                        <div key={order.id} className="p-3 sm:p-4 hover:bg-[var(--bg)]">
                                            <div className="flex justify-between mb-3">
                                                <div>
                                                    <h4 className="font-semibold text-[var(--fg)]">#{order.id.slice(0, 8).toUpperCase()}</h4>
                                                    <p className="text-sm text-[var(--muted)]">Table {order.restaurant_tables?.table_number}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xl font-bold text-blue-600">PKR {order.total_amount.toLocaleString()}</p>
                                                    <span className={`text-xs px-2 py-1 rounded ${
                                                        order.status === 'completed' ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-600'
                                                    }`}>{order.status}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {order.order_items?.slice(0, 3).map((item: any, idx: number) => (
                                                    <span key={idx} className="px-2 py-1 bg-[var(--bg)] rounded text-xs">
                                                        {item.quantity}x {item.menu_items?.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--fg)' }} />
                                    <p className="text-[var(--fg)] font-medium">No orders today</p>
                                </div>
                            )
                        )}
                    </div>
                </div>

                {showAdvanceModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)]">
                            <div className="p-4 sm:p-6 border-b border-[var(--border)] flex justify-between">
                                <h3 className="text-xl font-bold text-[var(--fg)]">Add Advance</h3>
                                <button onClick={() => setShowAdvanceModal(false)} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 sm:p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Amount (PKR) *</label>
                                    <input
                                        type="number"
                                        value={advanceForm.amount}
                                        onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                        placeholder="500, 1000, 2000..."
                                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">Reason (Optional)</label>
                                    <textarea
                                        value={advanceForm.reason}
                                        onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 resize-none"
                                    />
                                </div>
                            </div>
                            <div className="p-4 sm:p-6 border-t border-[var(--border)] flex gap-3">
                                <button onClick={() => setShowAdvanceModal(false)} className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAdvance}
                                    disabled={processing || !advanceForm.amount}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {processing ? 'Adding...' : <><Plus className="w-4 h-4" /> Add</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    )
}

// ✅ Main export with Suspense wrapper
export default function WaiterDetailsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[var(--bg)]">
                <div className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)] animate-pulse">
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                        <div className="h-8 bg-[var(--bg)] rounded w-48" />
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
                    <div className="h-32 bg-[var(--card)] rounded-xl animate-pulse" />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                        {[1,2,3].map(i => <div key={i} className="h-24 bg-[var(--card)] rounded-xl animate-pulse" />)}
                    </div>
                </div>
            </div>
        }>
            <WaiterDetailsContent />
        </Suspense>
    )
}
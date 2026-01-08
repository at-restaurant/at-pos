// src/app/admin/(pages)/waiters/details/page.tsx - COMPLETE WITH SALARY & THEME
"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
    ArrowLeft, DollarSign, ShoppingBag, Clock, TrendingUp,
    Calendar, Wallet, Plus, Banknote, AlertCircle, X
} from 'lucide-react'
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useToast } from '@/components/ui/Toast'

export default function WaiterStatsPage() {
    const params = useParams()
    const router = useRouter()
    const toast = useToast()
    const waiterId = params.id as string

    const [waiter, setWaiter] = useState<any>(null)
    const [todayStats, setTodayStats] = useState<any>(null)
    const [orders, setOrders] = useState<any[]>([])
    const [advances, setAdvances] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdvanceModal, setShowAdvanceModal] = useState(false)
    const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' })
    const [processing, setProcessing] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (waiterId) loadWaiterData()
    }, [waiterId])

    const loadWaiterData = async () => {
        setLoading(true)
        try {
            // Load waiter
            const { data: waiterData, error: waiterError } = await supabase
                .from('waiters')
                .select('*')
                .eq('id', waiterId)
                .single()

            if (waiterError) throw waiterError
            setWaiter(waiterData)

            // Load advances
            const { data: advancesData } = await supabase
                .from('salary_advances')
                .select('*')
                .eq('waiter_id', waiterId)
                .order('advance_date', { ascending: false })

            setAdvances(advancesData || [])

            // Today's orders
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)

            const { data: ordersData } = await supabase
                .from('orders')
                .select('*, restaurant_tables(table_number), order_items(*, menu_items(name))')
                .eq('waiter_id', waiterId)
                .gte('created_at', today.toISOString())
                .lt('created_at', tomorrow.toISOString())
                .order('created_at', { ascending: false })

            setOrders(ordersData || [])

            const completed = ordersData?.filter(o => o.status === 'completed') || []
            const totalRevenue = completed.reduce((sum, o) => sum + o.total_amount, 0)

            setTodayStats({
                totalOrders: ordersData?.length || 0,
                completedOrders: completed.length,
                pendingOrders: ordersData?.filter(o => o.status === 'pending').length || 0,
                totalRevenue,
                avgOrder: completed.length > 0 ? totalRevenue / completed.length : 0
            })
        } catch (error) {
            console.error('Failed to load:', error)
        } finally {
            setLoading(false)
        }
    }

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
            loadWaiterData()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        } finally {
            setProcessing(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!waiter) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
                <div className="text-center">
                    <p className="text-[var(--fg)] font-medium mb-2">Waiter not found</p>
                    <button onClick={() => router.push('/admin/waiters')} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
                        Back to Staff
                    </button>
                </div>
            </div>
        )
    }

    const totalAdvances = advances.reduce((sum, adv) => sum + parseFloat(adv.amount), 0)
    const monthlySalary = parseFloat(waiter.monthly_salary || 0)
    const remainingSalary = monthlySalary - totalAdvances
    const performance = todayStats.completedOrders >= 10 ? { label: 'Excellent', color: '#10b981', emoji: '🌟' } :
        todayStats.completedOrders >= 5 ? { label: 'Good', color: '#3b82f6', emoji: '👍' } :
            todayStats.completedOrders >= 1 ? { label: 'Average', color: '#f59e0b', emoji: '📊' } :
                { label: 'Started', color: '#6b7280', emoji: '🆕' }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                {/* Header */}
                <header className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)]">
                    <div className="max-w-7xl mx-auto px-4 py-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => router.push('/admin/waiters')} className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors">
                                <ArrowLeft className="w-5 h-5 text-[var(--muted)]" />
                            </button>
                            <div className="flex-1">
                                <h1 className="text-2xl font-bold text-[var(--fg)]">{waiter.name}&apos;s Dashboard</h1>
                                <p className="text-sm text-[var(--muted)] mt-1">Performance & Salary</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    {/* Profile Card */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                        <div className="flex items-center gap-6">
                            {waiter.profile_pic ? (
                                <img src={waiter.profile_pic} alt={waiter.name} className="w-24 h-24 rounded-full object-cover border-4 border-blue-600" />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-4xl">
                                    {waiter.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1">
                                <h2 className="text-3xl font-bold text-[var(--fg)] mb-2">{waiter.name}</h2>
                                <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
                                    <span className="flex items-center gap-2">
                                        <span className={`w-3 h-3 rounded-full ${waiter.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                                        {waiter.is_on_duty ? 'On Duty' : 'Off Duty'}
                                    </span>
                                    {waiter.phone && <><span>•</span><span>📞 {waiter.phone}</span></>}
                                </div>
                            </div>
                            <div className="text-center px-6 py-4 bg-[var(--bg)] rounded-xl border-2" style={{ borderColor: performance.color }}>
                                <div className="text-3xl mb-2">{performance.emoji}</div>
                                <div className="font-bold text-lg" style={{ color: performance.color }}>{performance.label}</div>
                                <div className="text-xs text-[var(--muted)] mt-1">Performance</div>
                            </div>
                        </div>
                    </div>

                    {/* Salary Cards */}
                    <div className="grid lg:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
                            <Wallet className="w-8 h-8 opacity-80 mb-4" />
                            <p className="text-sm opacity-90 mb-2">Monthly Salary</p>
                            <p className="text-3xl font-bold">PKR {monthlySalary.toLocaleString()}</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <Banknote className="w-8 h-8 opacity-80" />
                                <button onClick={() => setShowAdvanceModal(true)} className="text-xs bg-white/20 px-3 py-1 rounded-lg hover:bg-white/30 flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add
                                </button>
                            </div>
                            <p className="text-sm opacity-90 mb-2">Total Advances</p>
                            <p className="text-3xl font-bold">PKR {totalAdvances.toLocaleString()}</p>
                            <p className="text-xs opacity-75 mt-2">{advances.length} payments</p>
                        </div>

                        <div className={`bg-gradient-to-br ${remainingSalary >= 0 ? 'from-green-600 to-green-700' : 'from-red-600 to-red-700'} rounded-xl p-6 text-white`}>
                            <DollarSign className="w-8 h-8 opacity-80 mb-4" />
                            <p className="text-sm opacity-90 mb-2">Remaining</p>
                            <p className="text-3xl font-bold">PKR {Math.abs(remainingSalary).toLocaleString()}</p>
                            <p className="text-xs opacity-75 mt-2">
                                {remainingSalary >= 0 ? 'To be paid' : 'Overpaid - deduct next month'}
                            </p>
                        </div>
                    </div>

                    {/* Overpayment Alert */}
                    {remainingSalary < 0 && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="font-semibold text-[var(--fg)]">⚠️ Overpayment Alert</p>
                                <p className="text-sm text-[var(--muted)] mt-1">
                                    This staff has received PKR {Math.abs(remainingSalary).toLocaleString()} more than monthly salary.
                                    Deduct from next month&apos;s payment.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Advance History */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)]">
                            <h3 className="text-xl font-bold text-[var(--fg)] flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-orange-600" /> Advance History ({advances.length})
                            </h3>
                        </div>

                        {advances.length > 0 ? (
                            <div className="divide-y divide-[var(--border)]">
                                {advances.map(adv => (
                                    <div key={adv.id} className="p-4 hover:bg-[var(--bg)] transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="font-bold text-orange-600 text-lg">PKR {parseFloat(adv.amount).toLocaleString()}</p>
                                            <p className="text-xs text-[var(--muted)]">{new Date(adv.advance_date).toLocaleString()}</p>
                                        </div>
                                        <p className="text-sm text-[var(--muted)]">{adv.reason || 'Advance payment'}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <Wallet className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--fg)' }} />
                                <p className="text-[var(--fg)] font-medium">No advances yet</p>
                                <p className="text-sm text-[var(--muted)] mt-1">Advances will appear here</p>
                            </div>
                        )}
                    </div>

                    {/* Today's Stats */}
                    <div className="grid md:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Orders', value: todayStats.totalOrders, icon: ShoppingBag, color: '#3b82f6', sub: `${todayStats.completedOrders} done` },
                            { label: 'Revenue', value: `PKR ${todayStats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: '#10b981', sub: `Avg: ${Math.round(todayStats.avgOrder)}` },
                            { label: 'Pending', value: todayStats.pendingOrders, icon: Clock, color: '#f59e0b', sub: 'Active' },
                            { label: 'Avg/Order', value: `PKR ${Math.round(todayStats.avgOrder)}`, icon: TrendingUp, color: '#8b5cf6', sub: 'Today' }
                        ].map((stat, i) => {
                            const Icon = stat.icon
                            return (
                                <div key={i} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
                                    <Icon className="w-8 h-8 mb-3" style={{ color: stat.color }} />
                                    <p className="text-xs font-medium text-[var(--muted)] uppercase mb-2">{stat.label}</p>
                                    <p className="text-2xl font-bold text-[var(--fg)] mb-1">{stat.value}</p>
                                    <p className="text-xs text-[var(--muted)]">{stat.sub}</p>
                                </div>
                            )
                        })}
                    </div>

                    {/* Today's Orders */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="p-6 border-b border-[var(--border)]">
                            <h3 className="text-xl font-bold text-[var(--fg)] flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-blue-600" /> Today&apos;s Orders ({orders.length})
                            </h3>
                        </div>

                        {orders.length > 0 ? (
                            <div className="divide-y divide-[var(--border)]">
                                {orders.map(order => (
                                    <div key={order.id} className="p-4 hover:bg-[var(--bg)] transition-colors">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-semibold text-[var(--fg)]">#{order.id.slice(0, 8).toUpperCase()}</h4>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                                                        order.status === 'completed' ? 'bg-green-500/20 text-green-600' : 'bg-yellow-500/20 text-yellow-600'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--muted)]">
                                                    Table {order.restaurant_tables?.table_number} • {new Date(order.created_at).toLocaleTimeString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-bold text-blue-600">PKR {order.total_amount.toLocaleString()}</p>
                                                <p className="text-xs text-[var(--muted)]">{order.order_items?.length} items</p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {order.order_items?.map((item: any, idx: number) => (
                                                <span key={idx} className="px-2 py-1 bg-[var(--bg)] rounded text-xs text-[var(--muted)]">
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
                                <p className="text-[var(--fg)] font-medium">No orders yet</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Advance Modal */}
                {showAdvanceModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)]">
                            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                                <h3 className="text-xl font-bold text-[var(--fg)]">Add Advance Payment</h3>
                                <button
                                    onClick={() => {
                                        setShowAdvanceModal(false)
                                        setAdvanceForm({ amount: '', reason: '' })
                                    }}
                                    className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-[var(--muted)]" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                        Amount (PKR) <span className="text-red-600">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={advanceForm.amount}
                                        onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })}
                                        placeholder="500, 1000, 2000..."
                                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">Reason (Optional)</label>
                                    <textarea
                                        value={advanceForm.reason}
                                        onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                                        placeholder="Emergency, personal need, etc."
                                        rows={3}
                                        className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                                    />
                                </div>

                                {/* Summary */}
                                <div className="p-4 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                                    <p className="text-sm text-[var(--muted)] mb-2">After this advance:</p>
                                    <div className="space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-[var(--fg)]">Total Advances:</span>
                                            <span className="font-semibold text-[var(--fg)]">PKR {(totalAdvances + parseFloat(advanceForm.amount || '0')).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[var(--fg)]">Remaining:</span>
                                            <span className="font-semibold text-[var(--fg)]">PKR {(monthlySalary - totalAdvances - parseFloat(advanceForm.amount || '0')).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-[var(--border)] flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowAdvanceModal(false)
                                        setAdvanceForm({ amount: '', reason: '' })
                                    }}
                                    className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAdvance}
                                    disabled={processing || !advanceForm.amount}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {processing ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                                    ) : (
                                        <><Plus className="w-4 h-4" /> Add Advance</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    )
}
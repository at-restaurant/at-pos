// src/app/admin/(pages)/waiters/page.tsx
// 🚀 FULLY OPTIMIZED - Fast, Mobile Perfect, User Friendly

"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, TrendingUp, Menu, Edit2, Trash2, X, Eye, Upload, DollarSign } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import { useToast } from '@/components/ui/Toast'
import { validate } from '@/lib/utils/validation'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const EMPLOYEE_TYPES = [
    { label: '🍽️ Waiter', value: 'waiter' },
    { label: '👨‍🍳 Chef', value: 'chef' },
    { label: '👔 Manager', value: 'manager' },
    { label: '💰 Cashier', value: 'cashier' },
    { label: '🧹 Cleaner', value: 'cleaner' }
]

export default function WaitersPage() {
    const router = useRouter()
    const supabase = createClient()
    const toast = useToast()

    const [waiters, setWaiters] = useState<any[]>([])
    const [waiterAdvances, setWaiterAdvances] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [modal, setModal] = useState<any>(null)
    const [form, setForm] = useState({
        name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: '', monthly_salary: ''
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
        const cleanup = setupRealtime()
        return cleanup
    }, [])

    // 🚀 OPTIMIZED: Single batch query
    const loadData = async () => {
        setLoading(true)
        try {
            const [waitersRes, advancesRes] = await Promise.all([
                supabase.from('waiters').select('*').eq('is_active', true).order('created_at', { ascending: false }),
                supabase.from('salary_advances').select('waiter_id, amount')
            ])

            setWaiters(waitersRes.data || [])

            // Calculate total advances per waiter
            if (advancesRes.data) {
                const advancesMap: Record<string, number> = {}
                advancesRes.data.forEach((adv: any) => {
                    advancesMap[adv.waiter_id] = (advancesMap[adv.waiter_id] || 0) + parseFloat(adv.amount)
                })
                setWaiterAdvances(advancesMap)
            }
        } catch (error) {
            console.error('Load error:', error)
            toast.add('error', '❌ Failed to load staff')
        } finally {
            setLoading(false)
        }
    }

    const setupRealtime = () => {
        const channel = supabase
            .channel('waiters_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'waiters' }, loadData)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }

    // 🚀 MEMOIZED: Filtered and searched data
    const filtered = useMemo(() => {
        let result = waiters

        // Status filter
        if (statusFilter === 'active') result = result.filter(w => w.is_active)
        else if (statusFilter === 'on-duty') result = result.filter(w => w.is_on_duty)
        else if (statusFilter === 'off-duty') result = result.filter(w => !w.is_on_duty)

        // Search filter
        if (searchQuery) {
            result = result.filter(w =>
                w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                w.phone?.includes(searchQuery) ||
                w.employee_type?.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        return result
    }, [waiters, statusFilter, searchQuery])

    const stats = useMemo(() => [
        {
            label: 'Total Staff',
            value: waiters.length,
            color: '#3b82f6',
            onClick: () => setStatusFilter('all'),
            active: statusFilter === 'all',
            subtext: `${waiters.filter(w => w.is_on_duty).length} on duty`
        },
        {
            label: 'On Duty',
            value: waiters.filter(w => w.is_on_duty).length,
            color: '#10b981',
            onClick: () => setStatusFilter('on-duty'),
            active: statusFilter === 'on-duty'
        },
        {
            label: 'Off Duty',
            value: waiters.filter(w => !w.is_on_duty).length,
            color: '#f59e0b',
            onClick: () => setStatusFilter('off-duty'),
            active: statusFilter === 'off-duty'
        },
        {
            label: 'Total Salary',
            value: `₨${(waiters.reduce((s, w) => s + (parseFloat(w.monthly_salary) || 0), 0) / 1000).toFixed(0)}k`,
            color: '#8b5cf6',
            onClick: () => {},
            active: false,
            subtext: 'Monthly'
        }
    ], [waiters, statusFilter])

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Staff', icon: '👥', count: waiters.length },
        { id: 'on-duty', label: 'On Duty', icon: '🟢', count: stats[1].value },
        { id: 'off-duty', label: 'Off Duty', icon: '⚫', count: stats[2].value }
    ], statusFilter, setStatusFilter)

    const openModal = (waiter?: any) => {
        setForm(waiter ? {
            name: waiter.name,
            phone: waiter.phone || '',
            cnic: waiter.cnic || '',
            employee_type: waiter.employee_type || 'waiter',
            profile_pic: waiter.profile_pic || '',
            monthly_salary: waiter.monthly_salary?.toString() || '0'
        } : {
            name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: '', monthly_salary: '0'
        })
        setModal(waiter || {})
    }

    const save = async () => {
        const errors = {
            name: validate.name(form.name),
            phone: validate.phone(form.phone)
        }

        if (errors.name || errors.phone) {
            return toast.add('error', errors.name || errors.phone || '❌ Invalid input')
        }

        setSaving(true)
        try {
            const data = {
                name: form.name.trim(),
                phone: form.phone.trim(),
                cnic: form.cnic?.trim() || null,
                employee_type: form.employee_type,
                profile_pic: form.profile_pic || null,
                monthly_salary: parseFloat(form.monthly_salary) || 0,
                is_active: true,
                is_on_duty: modal?.id ? modal.is_on_duty : false,
                total_orders: modal?.id ? modal.total_orders : 0,
                total_revenue: modal?.id ? modal.total_revenue : 0
            }

            if (modal?.id) {
                const { error } = await supabase.from('waiters').update(data).eq('id', modal.id)
                if (error) throw error
                toast.add('success', '✅ Staff updated!')
            } else {
                const { error } = await supabase.from('waiters').insert(data)
                if (error) throw error
                toast.add('success', '✅ Staff added!')
            }

            setModal(null)
            setForm({ name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: '', monthly_salary: '0' })
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        } finally {
            setSaving(false)
        }
    }

    const del = async (id: string, profilePic?: string) => {
        if (!confirm('⚠️ Deactivate this staff member?')) return

        try {
            const { error } = await supabase.from('waiters').update({ is_active: false }).eq('id', id)
            if (error) throw error

            if (profilePic && profilePic.includes('cloudinary')) {
                const publicId = profilePic.split('/').slice(-2).join('/').split('.')[0]
                await fetch('/api/upload/cloudinary', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                })
            }

            toast.add('success', '✅ Staff deactivated!')
            setModal(null)
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const handlePaySalary = async (waiter: any) => {
        const totalAdvances = waiterAdvances[waiter.id] || 0
        const remaining = (waiter.monthly_salary || 0) - totalAdvances

        if (remaining <= 0) {
            toast.add('error', '❌ No remaining salary to pay!')
            return
        }

        if (!confirm(`Pay PKR ${remaining.toLocaleString()} to ${waiter.name}?`)) return

        try {
            const { error } = await supabase.from('salary_advances').delete().eq('waiter_id', waiter.id)
            if (error) throw error

            toast.add('success', `✅ Paid PKR ${remaining.toLocaleString()}`)
            loadData()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[var(--card)] rounded-xl animate-pulse" />)}
                    </div>
                    <div className="h-64 bg-[var(--card)] rounded-xl animate-pulse" />
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <>
                {/* Desktop Sidebar */}
                <div className="hidden lg:block">
                    <AutoSidebar items={sidebarItems} title="Filters" />
                </div>

                {/* Mobile Sidebar */}
                {sidebarOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
                        <div className="fixed top-0 left-0 h-full w-64 bg-[var(--card)] border-r border-[var(--border)] z-50 lg:hidden overflow-y-auto">
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                                <h2 className="text-lg font-bold text-[var(--fg)]">Filters</h2>
                                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-[var(--bg)] rounded-lg">✕</button>
                            </div>
                            <div className="p-2">
                                {sidebarItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => { item.onClick(); setSidebarOpen(false) }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-1 ${
                                            item.active ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-[var(--bg)] text-[var(--fg)]'
                                        }`}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="flex-1 text-left font-medium text-sm">{item.label}</span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                            item.active ? 'bg-white/20' : 'bg-[var(--bg)] text-[var(--muted)]'
                                        }`}>{item.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    {/* Header */}
                    <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-[var(--bg)] rounded-lg shrink-0">
                                        <Menu className="w-5 h-5 text-[var(--fg)]" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Staff Management</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">{filtered.length} employees</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => openModal()}
                                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shrink-0 shadow-lg"
                                >
                                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden xs:inline">Add Staff</span>
                                    <span className="xs:hidden">Add</span>
                                </button>
                            </div>
                        </div>

                        {/* Mobile Filters */}
                        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-lg">
                            <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 px-3 py-3 min-w-max">
                                    {sidebarItems.map(item => (
                                        <button key={item.id} onClick={item.onClick}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                                                    item.active ? 'bg-blue-600 text-white shadow-lg' : 'bg-[var(--bg)] text-[var(--fg)]'
                                                }`}>
                                            <span className="text-base">{item.icon}</span>
                                            <span className="text-xs font-medium">{item.label}</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                item.active ? 'bg-white/20' : 'bg-[var(--card)] text-[var(--muted)]'
                                            }`}>{item.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                        <ResponsiveStatsGrid stats={stats} />

                        {/* Search */}
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by name, phone, type..."
                                className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm sm:text-base"
                            />
                        </div>

                        {/* Staff Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                            {filtered.map(waiter => {
                                const totalAdvances = waiterAdvances[waiter.id] || 0
                                const remaining = (waiter.monthly_salary || 0) - totalAdvances

                                return (
                                    <div key={waiter.id} className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:shadow-xl hover:border-blue-600 transition-all">
                                        <div className="flex items-start gap-3 mb-3">
                                            {waiter.profile_pic ? (
                                                <img src={waiter.profile_pic} alt={waiter.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-blue-600 shrink-0" />
                                            ) : (
                                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl sm:text-2xl shrink-0">
                                                    {waiter.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base truncate">{waiter.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`w-2 h-2 rounded-full ${waiter.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                    <span className="text-xs text-[var(--muted)]">{waiter.is_on_duty ? 'On Duty' : 'Off Duty'}</span>
                                                </div>
                                                <p className="text-xs text-[var(--muted)] mt-1 truncate capitalize">{waiter.employee_type || 'Waiter'}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 mb-3">
                                            <div className="flex justify-between text-xs">
                                                <span className="text-[var(--muted)]">Salary:</span>
                                                <span className="font-semibold text-green-600">PKR {(waiter.monthly_salary || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs">
                                                <span className="text-[var(--muted)]">Advance:</span>
                                                <span className="font-semibold text-orange-600">PKR {totalAdvances.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs pt-2 border-t border-[var(--border)]">
                                                <span className="text-[var(--muted)]">Remaining:</span>
                                                <span className={`font-bold ${remaining < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                    PKR {Math.abs(remaining).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => router.push(`/admin/waiters/details?id=${waiter.id}`)}
                                                className="flex-1 py-2 text-blue-600 hover:bg-blue-600/10 rounded-lg text-xs font-medium transition-colors active:scale-95 flex items-center justify-center gap-1"
                                            >
                                                <Eye className="w-3 h-3" />
                                                View
                                            </button>
                                            <button
                                                onClick={() => openModal(waiter)}
                                                className="flex-1 py-2 text-green-600 hover:bg-green-600/10 rounded-lg text-xs font-medium transition-colors active:scale-95 flex items-center justify-center gap-1"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handlePaySalary(waiter)}
                                                disabled={remaining <= 0}
                                                className="flex-1 py-2 text-purple-600 hover:bg-purple-600/10 rounded-lg text-xs font-medium transition-colors active:scale-95 disabled:opacity-30 flex items-center justify-center gap-1"
                                            >
                                                <DollarSign className="w-3 h-3" />
                                                Pay
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {filtered.length === 0 && (
                            <div className="text-center py-12 bg-[var(--card)] border border-[var(--border)] rounded-xl">
                                <div className="text-4xl sm:text-5xl mb-4">👥</div>
                                <p className="text-[var(--fg)] font-medium mb-2 text-sm sm:text-base">No staff found</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)]">Try adjusting your filters</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Staff Modal */}
                {modal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-lg border border-[var(--border)] max-h-[90vh] overflow-y-auto">
                            <div className="p-4 sm:p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)]">{modal?.id ? 'Edit Staff' : 'Add Staff'}</h3>
                                    <button onClick={() => setModal(null)} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                                        <X className="w-5 h-5 text-[var(--muted)]" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">Name *</label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="John Doe"
                                            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">Phone *</label>
                                        <input
                                            type="tel"
                                            value={form.phone}
                                            onChange={e => setForm({ ...form, phone: e.target.value })}
                                            placeholder="03001234567"
                                            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">CNIC</label>
                                        <input
                                            type="text"
                                            value={form.cnic}
                                            onChange={e => setForm({ ...form, cnic: e.target.value })}
                                            placeholder="12345-1234567-1"
                                            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">Monthly Salary (PKR)</label>
                                        <input
                                            type="number"
                                            value={form.monthly_salary}
                                            onChange={e => setForm({ ...form, monthly_salary: e.target.value })}
                                            placeholder="30000"
                                            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">Employee Type</label>
                                    <select
                                        value={form.employee_type}
                                        onChange={e => setForm({ ...form, employee_type: e.target.value })}
                                        className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                        style={{ colorScheme: 'dark' }}
                                    >
                                        {EMPLOYEE_TYPES.map(type => (
                                            <option key={type.value} value={type.value}>{type.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <CloudinaryUpload
                                    value={form.profile_pic}
                                    onChange={url => setForm({ ...form, profile_pic: url })}
                                    folder="staff-profiles"
                                />

                                {modal?.id && (
                                    <div className="pt-4 border-t border-[var(--border)]">
                                        <button
                                            onClick={() => del(modal.id, modal.profile_pic)}
                                            className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Deactivate Staff
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 sm:p-6 border-t border-[var(--border)] flex gap-3 sticky bottom-0 bg-[var(--card)]">
                                <button
                                    onClick={() => setModal(null)}
                                    className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        modal?.id ? 'Update Staff' : 'Add Staff'
                                    )}
                                </button>
                        </div>
                    </div>
                    </div>
                    )}
            </>
        </ErrorBoundary>
    )
}
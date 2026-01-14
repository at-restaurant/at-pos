"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/lib/hooks/useSupabase'
import { Plus, TrendingUp, Wallet, DollarSign, X, Menu } from 'lucide-react'
import { useSidebarItems } from '@/lib/hooks/useSidebarItems'
import AutoSidebar from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput, { FormGrid } from '@/components/ui/ResponsiveInput'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import { useToast } from '@/components/ui/Toast'
import { createClient } from '@/lib/supabase/client'
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
    const { data: waiters, loading } = useSupabase('waiters', {
        filter: { is_active: true },
        order: { column: 'created_at', ascending: false },
        realtime: true
    })
    const [statusFilter, setStatusFilter] = useState('all')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [modal, setModal] = useState<any>(null)
    const [salaryModal, setSalaryModal] = useState<any>(null)
    const [advanceModal, setAdvanceModal] = useState<any>(null)
    const [form, setForm] = useState({
        name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: '', monthly_salary: ''
    })
    const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' })
    const [saving, setSaving] = useState(false)
    const [advances, setAdvances] = useState<any[]>([])
    const toast = useToast()
    const supabase = createClient()

    const filtered = waiters.filter(w => {
        if (statusFilter === 'active') return w.is_active
        if (statusFilter === 'on-duty') return w.is_on_duty
        if (statusFilter === 'inactive') return !w.is_active
        return true
    })

    const loadAdvances = async (waiterId: string) => {
        const { data } = await supabase
            .from('salary_advances')
            .select('*')
            .eq('waiter_id', waiterId)
            .order('advance_date', { ascending: false })
        setAdvances(data || [])
    }

    const stats = [
        { label: 'Total', value: waiters.length, color: '#3b82f6', onClick: () => setStatusFilter('all'), active: statusFilter === 'all' },
        { label: 'Active', value: waiters.filter(w => w.is_active).length, color: '#10b981', onClick: () => setStatusFilter('active'), active: statusFilter === 'active' },
        { label: 'On Duty', value: waiters.filter(w => w.is_on_duty).length, color: '#f59e0b', onClick: () => setStatusFilter('on-duty'), active: statusFilter === 'on-duty' }
    ]

    const [waiterAdvances, setWaiterAdvances] = useState<Record<string, number>>({})

    useEffect(() => {
        if (waiters.length > 0) {
            loadAllAdvances()
        }
    }, [waiters])

    const loadAllAdvances = async () => {
        const { data } = await supabase
            .from('salary_advances')
            .select('waiter_id, amount')

        if (data) {
            const advancesMap: Record<string, number> = {}
            data.forEach((adv: any) => {
                advancesMap[adv.waiter_id] = (advancesMap[adv.waiter_id] || 0) + parseFloat(adv.amount)
            })
            setWaiterAdvances(advancesMap)
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
            const { error } = await supabase
                .from('salary_advances')
                .delete()
                .eq('waiter_id', waiter.id)

            if (error) throw error

            toast.add('success', `✅ Paid PKR ${remaining.toLocaleString()} to ${waiter.name}`)
            loadAllAdvances()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    const columns = [
        {
            key: 'staff',
            label: 'Staff',
            render: (row: any) => (
                <div className="flex items-center gap-3">
                    {row.profile_pic ? (
                        <img src={row.profile_pic} alt={row.name} className="w-10 h-10 rounded-full object-cover border-2 border-blue-600" />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                            {row.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-medium text-[var(--fg)] text-sm truncate">{row.name}</p>
                        <p className="text-xs text-[var(--muted)] truncate">{row.phone}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Type',
            mobileHidden: true,
            render: (row: any) => <span className="px-2 py-1 rounded text-xs font-medium bg-blue-600/10 text-blue-600 capitalize">{row.employee_type}</span>
        },
        {
            key: 'salary_info',
            label: 'Salary Info',
            render: (row: any) => {
                const totalAdvances = waiterAdvances[row.id] || 0
                const remaining = (row.monthly_salary || 0) - totalAdvances
                return (
                    <div className="text-right">
                        <p className="text-sm font-bold text-green-600">PKR {(row.monthly_salary || 0).toLocaleString()}</p>
                        <p className="text-xs text-orange-600">Advance: {totalAdvances.toLocaleString()}</p>
                        <p className={`text-xs font-semibold ${remaining < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            Remaining: {Math.abs(remaining).toLocaleString()}
                        </p>
                    </div>
                )
            }
        },
        {
            key: 'status',
            label: 'Status',
            mobileHidden: true,
            render: (row: any) => (
                <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${row.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-sm text-[var(--fg)]">{row.is_on_duty ? 'On' : 'Off'}</span>
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            align: 'right' as const,
            render: (row: any) => {
                const totalAdvances = waiterAdvances[row.id] || 0
                const remaining = (row.monthly_salary || 0) - totalAdvances
                return (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            handlePaySalary(row)
                        }}
                        disabled={remaining <= 0}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 font-medium"
                    >
                        💰 Pay
                    </button>
                )
            }
        }
    ]

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
                name: form.name,
                phone: form.phone,
                cnic: form.cnic || null,
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
                toast.add('success', '✅ Updated!')
            } else {
                const { error } = await supabase.from('waiters').insert(data)
                if (error) throw error
                toast.add('success', '✅ Added!')
            }

            setModal(null)
            setForm({ name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: '', monthly_salary: '0' })
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        } finally {
            setSaving(false)
        }
    }

    const handleAddAdvance = async () => {
        const amount = parseFloat(advanceForm.amount)
        if (!amount || amount <= 0) {
            return toast.add('error', '❌ Enter valid amount')
        }

        try {
            const { error } = await supabase.from('salary_advances').insert({
                waiter_id: advanceModal.id,
                amount,
                reason: advanceForm.reason || 'Advance payment'
            })

            if (error) throw error
            toast.add('success', `✅ PKR ${amount.toLocaleString()} advance added`)
            setAdvanceForm({ amount: '', reason: '' })
            loadAdvances(advanceModal.id)
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
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

            toast.add('success', '✅ Deactivated!')
            setModal(null)
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Staff', icon: '👥', count: waiters.length },
        { id: 'active', label: 'Active', icon: '✅', count: stats[1].value },
        { id: 'on-duty', label: 'On Duty', icon: '🟢', count: stats[2].value }
    ], statusFilter, setStatusFilter)

    return (
        <ErrorBoundary>
            <>
                {/* Desktop Sidebar */}
                <div className="hidden lg:block">
                    <AutoSidebar items={sidebarItems} title="Filters" />
                </div>

                {/* Mobile Sidebar Overlay */}
                {sidebarOpen && (
                    <>
                        <div
                            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        />

                        <div className="fixed top-0 left-0 h-full w-64 bg-[var(--card)] border-r border-[var(--border)] z-50 lg:hidden overflow-y-auto">
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                                <h2 className="text-lg font-bold text-[var(--fg)]">Filters</h2>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="p-2">
                                {sidebarItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            item.onClick()
                                            setSidebarOpen(false)
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all mb-1 ${
                                            item.active
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'hover:bg-[var(--bg)] text-[var(--fg)]'
                                        }`}
                                    >
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="flex-1 text-left font-medium text-sm">
                                            {item.label}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                            item.active
                                                ? 'bg-white/20'
                                                : 'bg-[var(--bg)] text-[var(--muted)]'
                                        }`}>
                                            {item.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    {/* Fixed Header */}
                    <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    {/* Mobile Menu Button */}
                                    <button
                                        onClick={() => setSidebarOpen(true)}
                                        className="lg:hidden p-2 hover:bg-[var(--bg)] rounded-lg transition-colors shrink-0"
                                    >
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

                        {/* Horizontal Scrollable Filters - Mobile Only */}
                        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-lg">
                            <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 px-3 py-3 min-w-max">
                                    {sidebarItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={item.onClick}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                                                item.active
                                                    ? 'bg-blue-600 text-white shadow-lg'
                                                    : 'bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--bg)]/80'
                                            }`}
                                        >
                                            <span className="text-base">{item.icon}</span>
                                            <span className="text-xs font-medium">
                                                {item.label}
                                            </span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                                item.active
                                                    ? 'bg-white/20'
                                                    : 'bg-[var(--card)] text-[var(--muted)]'
                                            }`}>
                                                {item.count}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable
                            columns={columns}
                            data={filtered}
                            loading={loading}
                            searchable
                            searchPlaceholder="Search staff..."
                            onRowClick={openModal}
                        />
                    </div>
                </div>

                {/* Staff Modal */}
                <FormModal
                    open={!!modal}
                    onClose={() => setModal(null)}
                    title={modal?.id ? 'Edit Staff' : 'Add Staff'}
                    onSubmit={save}
                    submitLabel={saving ? 'Saving...' : (modal?.id ? 'Update' : 'Add')}
                >
                    <FormGrid>
                        <ResponsiveInput label="Name" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} required />
                        <ResponsiveInput label="Phone" type="tel" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} required />
                        <ResponsiveInput label="CNIC" value={form.cnic} onChange={(e: any) => setForm({ ...form, cnic: e.target.value })} hint="Optional" />
                        <ResponsiveInput label="Type" type="select" value={form.employee_type} onChange={(e: any) => setForm({ ...form, employee_type: e.target.value })} options={EMPLOYEE_TYPES} />
                        <ResponsiveInput label="Monthly Salary (PKR)" type="number" value={form.monthly_salary} onChange={(e: any) => setForm({ ...form, monthly_salary: e.target.value })} placeholder="30000" />
                    </FormGrid>

                    <div className="mt-4">
                        <CloudinaryUpload
                            value={form.profile_pic}
                            onChange={url => setForm({ ...form, profile_pic: url })}
                            folder="staff-profiles"
                        />
                    </div>

                    {modal?.id && (
                        <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
                            <div className="grid grid-cols-2 gap-3 p-3 bg-[var(--bg)] rounded-lg">
                                <div>
                                    <p className="text-xs text-[var(--muted)]">Total Orders</p>
                                    <p className="text-lg font-bold text-[var(--fg)]">{modal.total_orders || 0}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-[var(--muted)]">Revenue</p>
                                    <p className="text-lg font-bold text-blue-600">PKR {(modal.total_revenue || 0).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => {
                                        setSalaryModal(modal)
                                        loadAdvances(modal.id)
                                        setModal(null)
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Wallet className="w-4 h-4" />
                                    Salary
                                </button>
                                <button
                                    onClick={() => router.push(`/admin/waiters/details?id=${modal.id}`)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    Stats
                                </button>
                            </div>

                            <button onClick={() => del(modal.id, modal.profile_pic)} className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm active:scale-95">
                                Deactivate Staff
                            </button>
                        </div>
                    )}
                </FormModal>

                {/* Salary Management Modal */}
                {salaryModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-2xl border border-[var(--border)] max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between sticky top-0 bg-[var(--card)] z-10">
                                <div>
                                    <h3 className="text-xl font-bold text-[var(--fg)]">Salary Management</h3>
                                    <p className="text-sm text-[var(--muted)]">{salaryModal.name}</p>
                                </div>
                                <button onClick={() => setSalaryModal(null)} className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-[var(--muted)]" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Salary Overview */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl text-white">
                                        <p className="text-sm opacity-90 mb-2">Monthly Salary</p>
                                        <p className="text-2xl font-bold">PKR {(salaryModal.monthly_salary || 0).toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl text-white">
                                        <p className="text-sm opacity-90 mb-2">Total Advances</p>
                                        <p className="text-2xl font-bold">
                                            PKR {advances.reduce((s, a) => s + parseFloat(a.amount), 0).toLocaleString()}
                                        </p>
                                        <p className="text-xs opacity-75 mt-1">{advances.length} payments</p>
                                    </div>
                                    <div className="p-4 bg-gradient-to-br from-green-600 to-green-700 rounded-xl text-white">
                                        <p className="text-sm opacity-90 mb-2">Remaining</p>
                                        <p className="text-2xl font-bold">
                                            PKR {Math.max(0, (salaryModal.monthly_salary || 0) - advances.reduce((s, a) => s + parseFloat(a.amount), 0)).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Add Advance Button */}
                                <button
                                    onClick={() => setAdvanceModal(salaryModal)}
                                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <DollarSign className="w-5 h-5" />
                                    Add Advance Payment
                                </button>

                                {/* Advance History */}
                                <div>
                                    <h4 className="font-bold text-[var(--fg)] mb-3 flex items-center gap-2">
                                        📋 Advance History ({advances.length})
                                    </h4>
                                    {advances.length > 0 ? (
                                        <div className="space-y-2">
                                            {advances.map(adv => (
                                                <div key={adv.id} className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <p className="font-bold text-orange-600">PKR {parseFloat(adv.amount).toLocaleString()}</p>
                                                        <p className="text-xs text-[var(--muted)]">{new Date(adv.advance_date).toLocaleDateString()}</p>
                                                    </div>
                                                    <p className="text-sm text-[var(--muted)]">{adv.reason || 'Advance payment'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-[var(--muted)] text-sm bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                            No advance payments yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Advance Modal */}
                {advanceModal && (
                    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)]">
                            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                                <h3 className="text-xl font-bold text-[var(--fg)]">Add Advance Payment</h3>
                                <button onClick={() => setAdvanceModal(null)} className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors">
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
                            </div>
                            <div className="p-6 border-t border-[var(--border)] flex gap-3">
                                <button
                                    onClick={() => {
                                        setAdvanceModal(null)
                                        setAdvanceForm({ amount: '', reason: '' })
                                    }}
                                    className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddAdvance}
                                    disabled={!advanceForm.amount}
                                    className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <DollarSign className="w-4 h-4" />
                                    Add Advance
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </ErrorBoundary>
    )
}
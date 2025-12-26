"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabase } from '@/lib/hooks/useSupabase'
import { Plus, TrendingUp } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
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
    const [modal, setModal] = useState<any>(null)
    const [form, setForm] = useState({
        name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: ''
    })
    const [saving, setSaving] = useState(false)
    const toast = useToast()
    const supabase = createClient()

    const filtered = waiters.filter(w => {
        if (statusFilter === 'active') return w.is_active
        if (statusFilter === 'on-duty') return w.is_on_duty
        if (statusFilter === 'inactive') return !w.is_active
        return true
    })

    const stats = [
        { label: 'Total', value: waiters.length, color: '#3b82f6', onClick: () => setStatusFilter('all'), active: statusFilter === 'all' },
        { label: 'Active', value: waiters.filter(w => w.is_active).length, color: '#10b981', onClick: () => setStatusFilter('active'), active: statusFilter === 'active' },
        { label: 'On Duty', value: waiters.filter(w => w.is_on_duty).length, color: '#f59e0b', onClick: () => setStatusFilter('on-duty'), active: statusFilter === 'on-duty' },
        { label: 'Inactive', value: waiters.filter(w => !w.is_active).length, color: '#ef4444', onClick: () => setStatusFilter('inactive'), active: statusFilter === 'inactive' }
    ]

    const columns = [
        {
            key: 'staff',
            label: 'Staff',
            render: (row: any) => (
                <div className="flex items-center gap-2 sm:gap-3">
                    {row.profile_pic ? (
                        <img src={row.profile_pic} alt={row.name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-blue-600" />
                    ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                            {row.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-medium text-[var(--fg)] text-sm truncate">{row.name}</p>
                        <p className="text-xs text-[var(--muted)] truncate">{row.cnic || row.phone}</p>
                    </div>
                </div>
            )
        },
        { key: 'phone', label: 'Contact', mobileHidden: true, render: (row: any) => <span className="text-sm text-[var(--muted)]">{row.phone}</span> },
        { key: 'type', label: 'Type', mobileHidden: true, render: (row: any) => <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-blue-600/10 text-blue-600 capitalize">{row.employee_type}</span> },
        {
            key: 'status',
            label: 'Status',
            render: (row: any) => (
                <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${row.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-xs sm:text-sm text-[var(--fg)]">{row.is_on_duty ? 'On' : 'Off'}</span>
                </div>
            )
        },
        {
            key: 'performance',
            label: 'Performance',
            align: 'right' as const,
            render: (row: any) => (
                <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--fg)]">{row.total_orders || 0}</p>
                    <p className="text-xs text-[var(--muted)]">PKR {(row.total_revenue || 0).toLocaleString()}</p>
                </div>
            )
        }
    ]

    const openModal = (waiter?: any) => {
        setForm(waiter ? {
            name: waiter.name,
            phone: waiter.phone || '',
            cnic: waiter.cnic || '',
            employee_type: waiter.employee_type || 'waiter',
            profile_pic: waiter.profile_pic || ''
        } : {
            name: '',
            phone: '',
            cnic: '',
            employee_type: 'waiter',
            profile_pic: ''
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
            setForm({ name: '', phone: '', cnic: '', employee_type: 'waiter', profile_pic: '' })
        } catch (error: any) {
            console.error('Save error:', error)
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

            // Delete image from Cloudinary if exists
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

    const viewDetails = (row: any) => {
        router.push(`/admin/waiters/${row.id}`)
    }

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={useSidebarItems([
                    { id: 'all', label: 'All Staff', icon: '👥', count: waiters.length },
                    { id: 'active', label: 'Active', icon: '✅', count: stats[1].value },
                    { id: 'on-duty', label: 'On Duty', icon: '🟢', count: stats[2].value },
                    { id: 'inactive', label: 'Inactive', icon: '⭕', count: stats[3].value }
                ], statusFilter, setStatusFilter)} title="Filters" />

                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    <header className="sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)]">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[var(--fg)] truncate">Staff</h1>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">{filtered.length} employees</p>
                                </div>
                                <button onClick={() => openModal()} className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium text-sm active:scale-95">
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Add</span>
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable
                            columns={columns}
                            data={filtered}
                            loading={loading}
                            searchable
                            searchPlaceholder="Search..."
                            onRowClick={openModal}
                            renderMobileCard={(row) => (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        {row.profile_pic ? (
                                            <img src={row.profile_pic} alt={row.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                                                {row.name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-[var(--fg)] text-sm truncate">{row.name}</p>
                                            <p className="text-xs text-[var(--muted)]">{row.phone}</p>
                                        </div>
                                        <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${row.is_on_duty ? 'bg-green-500' : 'bg-gray-500'}`} />
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[var(--muted)]">{row.total_orders || 0} orders</span>
                                        <span className="font-semibold">PKR {(row.total_revenue || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}
                        />
                    </div>
                </div>

                <FormModal
                    open={!!modal}
                    onClose={() => setModal(null)}
                    title={modal?.id ? 'Edit Staff' : 'Add Staff'}
                    onSubmit={save}
                    submitLabel={saving ? 'Saving...' : (modal?.id ? 'Update' : 'Add')}
                >
                    <FormGrid>
                        <ResponsiveInput label="Name" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" required />
                        <ResponsiveInput label="Phone" type="tel" value={form.phone} onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 1234567" required />
                        <ResponsiveInput label="CNIC" value={form.cnic} onChange={(e: any) => setForm({ ...form, cnic: e.target.value })} placeholder="12345-1234567-1" hint="Optional" />
                        <ResponsiveInput label="Type" type="select" value={form.employee_type} onChange={(e: any) => setForm({ ...form, employee_type: e.target.value })} options={EMPLOYEE_TYPES} />
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

                            <div className="flex gap-2">
                                <button onClick={() => viewDetails(modal)} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm active:scale-95 flex items-center justify-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    View Stats
                                </button>
                                <button onClick={() => del(modal.id, modal.profile_pic)} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm active:scale-95">
                                    Deactivate
                                </button>
                            </div>
                        </div>
                    )}
                </FormModal>
            </>
        </ErrorBoundary>
    )
}
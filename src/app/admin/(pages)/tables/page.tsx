// src/app/admin/(pages)/tables/page.tsx - WITH CATEGORIES & BULK ADD
"use client"

import { useState } from 'react'
import { useSupabase } from '@/lib/hooks/useSupabase'
import { Plus, X } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput, { FormGrid } from '@/components/ui/ResponsiveInput'
import CategoryManager from '@/components/ui/CategoryManager'
import { useToast } from '@/components/ui/Toast'
import { validate } from '@/lib/utils/validation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getTableStatusColor } from '@/lib/utils/statusHelpers'

export default function AdminTablesPage() {
    const { data: tables, loading, insert, update, remove } = useSupabase('restaurant_tables', { order: { column: 'table_number' }, realtime: true })
    const { data: categories } = useSupabase('table_categories', { order: { column: 'name' } } as any)
    const [sectionFilter, setSectionFilter] = useState('all')
    const [modal, setModal] = useState<any>(null)
    const [bulkModal, setBulkModal] = useState(false)
    const [form, setForm] = useState({ table_number: '', capacity: '', category_id: '' })
    const [bulkForm, setBulkForm] = useState({
        start_number: '',
        end_number: '',
        capacity: '4',
        category_id: ''
    })
    const [refreshKey, setRefreshKey] = useState(0)
    const toast = useToast()

    const filtered = tables.filter((t: any) =>
        sectionFilter === 'all' || t.table_categories?.id === sectionFilter
    )

    const categoryStats = categories.map((cat: any) => ({
        id: cat.id,
        label: `${cat.icon || '📍'} ${cat.name}`,
        value: tables.filter((t: any) => t.category_id === cat.id).length,
        color: '#10b981',
        onClick: () => setSectionFilter(cat.id),
        active: sectionFilter === cat.id
    }))

    const stats = [
        {
            label: 'Total',
            value: tables.length,
            color: '#3b82f6',
            onClick: () => setSectionFilter('all'),
            active: sectionFilter === 'all',
            subtext: `${categories.length} categories`
        },
        ...categoryStats
    ]

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Tables', icon: '🏠', count: tables.length },
        ...categories.map((cat: any) => ({
            id: cat.id,
            label: cat.name,
            icon: cat.icon || '📍',
            count: tables.filter((t: any) => t.category_id === cat.id).length
        }))
    ], sectionFilter, setSectionFilter)

    const openModal = (table?: any) => {
        if (table) {
            setForm({
                table_number: table.table_number.toString(),
                capacity: table.capacity.toString(),
                category_id: table.category_id || ''
            })
        } else {
            setForm({ table_number: '', capacity: '', category_id: '' })
        }
        setModal(table || {})
    }

    const save = async () => {
        const errors = {
            table_number: validate.tableNumber(form.table_number),
            capacity: validate.capacity(form.capacity)
        }

        if (errors.table_number || errors.capacity) {
            toast.add('error', errors.table_number || errors.capacity || 'Invalid input')
            return
        }

        if (!modal?.id) {
            if (tables.find((t: any) => t.table_number === parseInt(form.table_number))) {
                return toast.add('error', `Table ${form.table_number} exists!`)
            }
        } else {
            if (tables.find((t: any) => t.table_number === parseInt(form.table_number) && t.id !== modal.id)) {
                return toast.add('error', `Table ${form.table_number} is used!`)
            }
        }

        const data = {
            table_number: parseInt(form.table_number),
            capacity: parseInt(form.capacity),
            category_id: form.category_id || null
        }

        try {
            if (modal?.id) {
                const { error } = await update(modal.id, data)
                if (error) throw error
                toast.add('success', '✅ Updated!')
            } else {
                const { error } = await insert({ ...data, status: 'available' })
                if (error) throw error
                toast.add('success', '✅ Added!')
            }
            setModal(null)
            setForm({ table_number: '', capacity: '', category_id: '' })
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const bulkAdd = async () => {
        const start = parseInt(bulkForm.start_number)
        const end = parseInt(bulkForm.end_number)
        const capacity = parseInt(bulkForm.capacity)

        if (!start || !end || start < 1 || end < start) {
            return toast.add('error', '❌ Invalid range')
        }

        if (end - start > 50) {
            return toast.add('error', '❌ Maximum 50 tables at once')
        }

        if (!capacity || capacity < 1) {
            return toast.add('error', '❌ Invalid capacity')
        }

        const existingNumbers = tables.map((t: any) => t.table_number)
        const newTables = []

        for (let i = start; i <= end; i++) {
            if (existingNumbers.includes(i)) {
                toast.add('warning', `⚠️ Table ${i} already exists, skipped`)
                continue
            }
            newTables.push({
                table_number: i,
                capacity,
                category_id: bulkForm.category_id || null,
                status: 'available'
            })
        }

        if (newTables.length === 0) {
            return toast.add('error', '❌ All tables already exist')
        }

        try {
            const { error } = await insert(newTables as any)
            if (error) throw error
            toast.add('success', `✅ Added ${newTables.length} tables!`)
            setBulkModal(false)
            setBulkForm({ start_number: '', end_number: '', capacity: '4', category_id: '' })
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const deleteTable = async (id: string) => {
        const table = tables.find((t: any) => t.id === id)
        if (table?.status === 'occupied' || table?.status === 'reserved') {
            return toast.add('error', '❌ Cannot delete occupied/reserved tables')
        }
        if (confirm('Delete this table?')) {
            try {
                const { error } = await remove(id)
                if (error) throw error
                toast.add('success', '✅ Table deleted!')
            } catch (error) {
                toast.add('error', '❌ Failed to delete')
            }
        }
    }

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Categories" />

                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    <header className="sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)]">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[var(--fg)] truncate">Tables Setup</h1>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                                        {filtered.length} tables • {categories.length} categories
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setBulkModal(true)}
                                        className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span className="hidden sm:inline">Bulk</span>
                                    </button>
                                    <button
                                        onClick={() => openModal()}
                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span className="hidden sm:inline">Add</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
                        {/* Category Manager */}
                        <CategoryManager
                            type="table"
                            onCategoryChange={() => setRefreshKey(prev => prev + 1)}
                        />

                        <ResponsiveStatsGrid stats={stats} />

                        <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-blue-600 font-medium">
                                ℹ️ <strong>Admin:</strong> You manage table details. Status is auto-updated by staff.
                            </p>
                        </div>

                        {loading ? (
                            <div className="flex justify-center py-12">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 sm:p-12 text-center">
                                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🪑</div>
                                <p className="text-[var(--fg)] font-medium mb-1 text-sm sm:text-base">No tables found</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)] mb-3 sm:mb-4">Add your first table</p>
                                <div className="flex gap-2 justify-center">
                                    <button
                                        onClick={() => openModal()}
                                        className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm active:scale-95"
                                    >
                                        Add Single
                                    </button>
                                    <button
                                        onClick={() => setBulkModal(true)}
                                        className="px-4 sm:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm active:scale-95"
                                    >
                                        Add Multiple
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3 lg:gap-4">
                                {filtered.map((table: any) => (
                                    <div key={table.id} className="p-2.5 sm:p-3 lg:p-4 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:shadow-lg hover:border-blue-600 transition-all group">
                                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg flex items-center justify-center text-white font-bold text-base sm:text-lg lg:text-xl shadow-sm" style={{ backgroundColor: getTableStatusColor(table.status) }}>
                                                {table.table_number}
                                            </div>
                                            <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md text-xs font-medium capitalize" style={{ backgroundColor: `${getTableStatusColor(table.status)}20`, color: getTableStatusColor(table.status) }}>
                                                {table.status}
                                            </span>
                                        </div>

                                        <div className="mb-2 sm:mb-3">
                                            <p className="text-xs sm:text-sm font-medium text-[var(--fg)] mb-0.5 sm:mb-1">{table.capacity} Seats</p>
                                            <p className="text-xs text-[var(--muted)]">
                                                {table.table_categories ? `${table.table_categories.icon || '📍'} ${table.table_categories.name}` : '📍 Uncategorized'}
                                            </p>
                                        </div>

                                        <div className="flex gap-1.5 sm:gap-2">
                                            <button
                                                onClick={() => openModal(table)}
                                                className="flex-1 py-1 sm:py-1.5 text-blue-600 hover:bg-blue-600/10 rounded text-xs font-medium transition-colors active:scale-95"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteTable(table.id)}
                                                disabled={table.status === 'occupied' || table.status === 'reserved'}
                                                className="flex-1 py-1 sm:py-1.5 text-red-600 hover:bg-red-600/10 rounded text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Single Table Modal */}
                <FormModal
                    open={!!modal}
                    onClose={() => setModal(null)}
                    title={modal?.id ? 'Edit Table' : 'Add Table'}
                    onSubmit={save}
                    submitLabel={modal?.id ? 'Update' : 'Add'}
                >
                    <div className="space-y-4">
                        {modal?.id && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
                                <p className="text-xs text-yellow-600">
                                    ⚠️ Status: <strong className="capitalize">{modal.status}</strong><br/>
                                    <span className="text-yellow-600/80">(Cannot be changed)</span>
                                </p>
                            </div>
                        )}
                        <FormGrid>
                            <ResponsiveInput
                                label="Table Number"
                                type="number"
                                value={form.table_number}
                                onChange={(e: any) => setForm({ ...form, table_number: e.target.value })}
                                placeholder="1, 2, 3..."
                                required
                                hint="Unique number"
                            />
                            <ResponsiveInput
                                label="Capacity"
                                type="number"
                                value={form.capacity}
                                onChange={(e: any) => setForm({ ...form, capacity: e.target.value })}
                                placeholder="4, 6, 8..."
                                required
                                hint="Max people"
                            />
                        </FormGrid>
                        <ResponsiveInput
                            label="Category"
                            type="select"
                            value={form.category_id}
                            onChange={(e: any) => setForm({ ...form, category_id: e.target.value })}
                            options={categories.map((c: any) => ({ label: `${c.icon || '📍'} ${c.name}`, value: c.id }))}
                            hint="Optional"
                            key={refreshKey}
                        />
                    </div>
                </FormModal>

                {/* Bulk Add Modal */}
                {bulkModal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)]">
                            <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold text-[var(--fg)]">Bulk Add Tables</h3>
                                    <p className="text-sm text-[var(--muted)] mt-1">Add multiple tables at once</p>
                                </div>
                                <button
                                    onClick={() => setBulkModal(false)}
                                    className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-[var(--muted)]" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                                    <p className="text-sm text-purple-600">
                                        💡 <strong>Example:</strong> Start: 1, End: 10 will create tables 1 through 10
                                    </p>
                                </div>

                                <FormGrid>
                                    <ResponsiveInput
                                        label="Start Number"
                                        type="number"
                                        value={bulkForm.start_number}
                                        onChange={(e: any) => setBulkForm({ ...bulkForm, start_number: e.target.value })}
                                        placeholder="1"
                                        required
                                    />
                                    <ResponsiveInput
                                        label="End Number"
                                        type="number"
                                        value={bulkForm.end_number}
                                        onChange={(e: any) => setBulkForm({ ...bulkForm, end_number: e.target.value })}
                                        placeholder="10"
                                        required
                                    />
                                </FormGrid>

                                <ResponsiveInput
                                    label="Capacity (All Tables)"
                                    type="number"
                                    value={bulkForm.capacity}
                                    onChange={(e: any) => setBulkForm({ ...bulkForm, capacity: e.target.value })}
                                    placeholder="4"
                                    required
                                    hint="Same capacity for all tables"
                                />

                                <ResponsiveInput
                                    label="Category (Optional)"
                                    type="select"
                                    value={bulkForm.category_id}
                                    onChange={(e: any) => setBulkForm({ ...bulkForm, category_id: e.target.value })}
                                    options={categories.map((c: any) => ({ label: `${c.icon || '📍'} ${c.name}`, value: c.id }))}
                                    key={refreshKey}
                                />

                                <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                    <p className="text-sm text-[var(--muted)]">
                                        Will create: <strong className="text-[var(--fg)]">
                                        {bulkForm.start_number && bulkForm.end_number && parseInt(bulkForm.end_number) >= parseInt(bulkForm.start_number)
                                            ? `${parseInt(bulkForm.end_number) - parseInt(bulkForm.start_number) + 1} tables`
                                            : '0 tables'
                                        }
                                    </strong>
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 border-t border-[var(--border)] flex gap-3">
                                <button
                                    onClick={() => setBulkModal(false)}
                                    className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={bulkAdd}
                                    className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors active:scale-95"
                                >
                                    Add Tables
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </ErrorBoundary>
    )
}
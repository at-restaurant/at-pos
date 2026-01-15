// src/app/admin/(pages)/tables/page.tsx
// ✅ SIMPLIFIED: Single "Add Table" button with smart modal

"use client"

import { useState, useEffect } from 'react'
import { Plus, X, Menu } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import CategoryManager from '@/components/ui/CategoryManager'
import { useToast } from '@/components/ui/Toast'
import { validate } from '@/lib/utils/validation'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { getTableStatusColor } from '@/lib/utils/statusHelpers'
import { createClient } from '@/lib/supabase/client'

export default function AdminTablesPage() {
    const supabase = createClient()
    const toast = useToast()

    const [tables, setTables] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [sectionFilter, setSectionFilter] = useState('all')
    const [sidebarOpen, setSidebarOpen] = useState(false)

    // ✅ SINGLE MODAL STATE
    const [modal, setModal] = useState<any>(null)
    const [addMode, setAddMode] = useState<'single' | 'multiple'>('single')

    // Single table form
    const [form, setForm] = useState({ table_number: '', capacity: '', category_id: '' })

    // Multiple tables form
    const [bulkForm, setBulkForm] = useState({ start: '', end: '', capacity: '4', category_id: '' })

    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
        setupRealtimeSubscriptions()
    }, [])

    const loadData = async () => {
        await Promise.all([loadTables(), loadCategories()])
    }

    const loadTables = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('restaurant_tables')
                .select('*')
                .order('table_number')

            if (error) throw error
            setTables(data || [])
        } catch (error) {
            console.error('Failed to load tables:', error)
            setTables([])
        } finally {
            setLoading(false)
        }
    }

    const loadCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('table_categories')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (error) throw error
            setCategories(data || [])
        } catch (error) {
            console.error('Failed to load categories:', error)
            setCategories([])
        }
    }

    const setupRealtimeSubscriptions = () => {
        const tablesChannel = supabase
            .channel('tables_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, loadTables)
            .subscribe()

        const categoriesChannel = supabase
            .channel('table_categories_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'table_categories' }, loadCategories)
            .subscribe()

        return () => {
            supabase.removeChannel(tablesChannel)
            supabase.removeChannel(categoriesChannel)
        }
    }

    const filtered = tables.filter((t: any) => {
        if (sectionFilter === 'all') return true
        if (sectionFilter === 'uncategorized') return !t.category_id
        return t.category_id === sectionFilter
    })

    const uncategorizedCount = tables.filter((t: any) => !t.category_id).length

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
        ...categoryStats,
        ...(uncategorizedCount > 0 ? [{
            label: 'Uncategorized',
            value: uncategorizedCount,
            color: '#6b7280',
            onClick: () => setSectionFilter('uncategorized'),
            active: sectionFilter === 'uncategorized'
        }] : [])
    ]

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Tables', icon: '🏠', count: tables.length },
        ...categories.map((cat: any) => ({
            id: cat.id,
            label: cat.name,
            icon: cat.icon || '📍',
            count: tables.filter((t: any) => t.category_id === cat.id).length
        })),
        ...(uncategorizedCount > 0 ? [{
            id: 'uncategorized',
            label: 'Uncategorized',
            icon: '❓',
            count: uncategorizedCount
        }] : [])
    ], sectionFilter, setSectionFilter)

    // ✅ OPEN MODAL - Single entry point
    const openModal = (table?: any) => {
        if (table) {
            // Edit mode
            setForm({
                table_number: table.table_number.toString(),
                capacity: table.capacity.toString(),
                category_id: table.category_id || ''
            })
            setAddMode('single')
        } else {
            // Add mode - default to single
            setForm({ table_number: '', capacity: '', category_id: '' })
            setBulkForm({ start: '', end: '', capacity: '4', category_id: '' })
            setAddMode('single')
        }
        setModal(table || {})
    }

    // ✅ SAVE - Handles both single & multiple
    const save = async () => {
        setSaving(true)

        try {
            if (addMode === 'single') {
                // Single table logic
                const errors = {
                    table_number: validate.tableNumber(form.table_number),
                    capacity: validate.capacity(form.capacity)
                }

                if (errors.table_number || errors.capacity) {
                    toast.add('error', errors.table_number || errors.capacity || 'Invalid input')
                    setSaving(false)
                    return
                }

                if (!modal?.id) {
                    if (tables.find((t: any) => t.table_number === parseInt(form.table_number))) {
                        toast.add('error', `❌ Table ${form.table_number} already exists!`)
                        setSaving(false)
                        return
                    }
                } else {
                    if (tables.find((t: any) => t.table_number === parseInt(form.table_number) && t.id !== modal.id)) {
                        toast.add('error', `❌ Table ${form.table_number} is already used!`)
                        setSaving(false)
                        return
                    }
                }

                const data = {
                    table_number: parseInt(form.table_number),
                    capacity: parseInt(form.capacity),
                    category_id: form.category_id || null
                }

                if (modal?.id) {
                    const { error } = await supabase
                        .from('restaurant_tables')
                        .update(data)
                        .eq('id', modal.id)

                    if (error) throw error
                    toast.add('success', '✅ Table updated!')
                } else {
                    const { error } = await supabase
                        .from('restaurant_tables')
                        .insert({ ...data, status: 'available' })

                    if (error) throw error
                    toast.add('success', '✅ Table added!')
                }
            } else {
                // Multiple tables logic
                const start = parseInt(bulkForm.start)
                const end = parseInt(bulkForm.end)
                const capacity = parseInt(bulkForm.capacity)

                if (!start || !end || start < 1 || end < start) {
                    toast.add('error', '❌ Invalid range')
                    setSaving(false)
                    return
                }

                if (end - start > 50) {
                    toast.add('error', '❌ Maximum 50 tables at once')
                    setSaving(false)
                    return
                }

                if (!capacity || capacity < 1) {
                    toast.add('error', '❌ Invalid capacity')
                    setSaving(false)
                    return
                }

                const existingNumbers = tables.map((t: any) => t.table_number)
                const newTables = []

                for (let i = start; i <= end; i++) {
                    if (existingNumbers.includes(i)) {
                        toast.add('warning', `⚠️ Table ${i} exists, skipped`)
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
                    toast.add('error', '❌ All tables already exist')
                    setSaving(false)
                    return
                }

                const { error } = await supabase
                    .from('restaurant_tables')
                    .insert(newTables)

                if (error) throw error
                toast.add('success', `✅ Added ${newTables.length} tables!`)
            }

            setModal(null)
            setForm({ table_number: '', capacity: '', category_id: '' })
            setBulkForm({ start: '', end: '', capacity: '4', category_id: '' })
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        } finally {
            setSaving(false)
        }
    }

    const deleteTable = async (id: string) => {
        const table = tables.find((t: any) => t.id === id)
        if (table?.status === 'occupied' || table?.status === 'reserved') {
            return toast.add('error', '❌ Cannot delete occupied/reserved tables')
        }

        if (!confirm('⚠️ Delete this table?')) return

        try {
            const { error } = await supabase
                .from('restaurant_tables')
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.add('success', '✅ Table deleted!')
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const getCategoryDisplay = (categoryId: string | null) => {
        if (!categoryId) return '❓ Uncategorized'
        const cat = categories.find(c => c.id === categoryId)
        if (!cat) return '❓ Unknown'
        return `${cat.icon || '📍'} ${cat.name}`
    }

    return (
        <ErrorBoundary>
            <>
                <div className="hidden lg:block">
                    <AutoSidebar items={sidebarItems} title="Categories" />
                </div>

                {sidebarOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
                        <div className="fixed top-0 left-0 h-full w-64 bg-[var(--card)] border-r border-[var(--border)] z-50 lg:hidden overflow-y-auto">
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                                <h2 className="text-lg font-bold text-[var(--fg)]">Categories</h2>
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
                    <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-[var(--bg)] rounded-lg shrink-0">
                                        <Menu className="w-5 h-5 text-[var(--fg)]" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Tables Setup</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">{filtered.length} tables • {categories.length} categories</p>
                                    </div>
                                </div>
                                {/* ✅ SINGLE BUTTON */}
                                <button
                                    onClick={() => openModal()}
                                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-lg shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden xs:inline">Add Table</span>
                                    <span className="xs:hidden">Add</span>
                                </button>
                            </div>
                        </div>

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
                        <CategoryManager type="table" onCategoryChange={loadCategories} />
                        <ResponsiveStatsGrid stats={stats} />

                        <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-blue-600 font-medium">
                                ℹ️ <strong>Admin:</strong> Manage table details. Status is auto-updated by staff.
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
                                <button onClick={() => openModal()} className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm active:scale-95">
                                    Add Table
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                {filtered.map((table: any) => (
                                    <div key={table.id} className="p-3 sm:p-4 bg-[var(--card)] border-2 border-[var(--border)] rounded-xl hover:shadow-lg hover:border-blue-600 transition-all group">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-md"
                                                 style={{ backgroundColor: getTableStatusColor(table.status) }}>
                                                {table.table_number}
                                            </div>
                                            <span className="px-2 py-1 rounded-lg text-xs font-bold capitalize"
                                                  style={{ backgroundColor: `${getTableStatusColor(table.status)}20`, color: getTableStatusColor(table.status) }}>
                                                {table.status}
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <p className="text-sm font-bold text-[var(--fg)] mb-1">{table.capacity} Seats</p>
                                            <p className="text-xs text-[var(--muted)] truncate">{getCategoryDisplay(table.category_id)}</p>
                                        </div>

                                        <div className="flex gap-2">
                                            <button onClick={() => openModal(table)} className="flex-1 py-1.5 text-blue-600 hover:bg-blue-600/10 rounded-lg text-xs font-medium transition-colors active:scale-95">
                                                Edit
                                            </button>
                                            <button onClick={() => deleteTable(table.id)} disabled={table.status === 'occupied' || table.status === 'reserved'}
                                                    className="flex-1 py-1.5 text-red-600 hover:bg-red-600/10 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ✅ SINGLE SMART MODAL */}
                {modal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)] max-h-[90vh] overflow-y-auto">
                            <div className="p-4 sm:p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)]">
                                            {modal?.id ? 'Edit Table' : 'Add Table'}
                                        </h3>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                                            {modal?.id ? 'Update table details' : 'Choose how to add tables'}
                                        </p>
                                    </div>
                                    <button onClick={() => setModal(null)} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                                        <X className="w-5 h-5 text-[var(--muted)]" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 space-y-4">
                                {/* ✅ MODE SELECTOR (only for new tables) */}
                                {!modal?.id && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setAddMode('single')}
                                            className={`p-3 rounded-lg border-2 transition-all ${
                                                addMode === 'single'
                                                    ? 'border-blue-600 bg-blue-600/20'
                                                    : 'border-[var(--border)] bg-[var(--bg)]'
                                            }`}
                                        >
                                            <div className="text-2xl mb-2">🪑</div>
                                            <p className={`text-xs font-semibold ${addMode === 'single' ? 'text-blue-600' : 'text-[var(--fg)]'}`}>
                                                Add One
                                            </p>
                                        </button>
                                        <button
                                            onClick={() => setAddMode('multiple')}
                                            className={`p-3 rounded-lg border-2 transition-all ${
                                                addMode === 'multiple'
                                                    ? 'border-purple-600 bg-purple-600/20'
                                                    : 'border-[var(--border)] bg-[var(--bg)]'
                                            }`}
                                        >
                                            <div className="text-2xl mb-2">🪑🪑</div>
                                            <p className={`text-xs font-semibold ${addMode === 'multiple' ? 'text-purple-600' : 'text-[var(--fg)]'}`}>
                                                Add Multiple
                                            </p>
                                        </button>
                                    </div>
                                )}

                                {/* ✅ SINGLE TABLE FORM */}
                                {(modal?.id || addMode === 'single') && (
                                    <>
                                        {modal?.id && modal.status && (
                                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                                                <p className="text-xs text-yellow-600">
                                                    ⚠️ Status: <strong className="capitalize">{modal.status}</strong><br/>
                                                    <span className="text-yellow-600/80">(Cannot be changed)</span>
                                                </p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                                    Table Number <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={form.table_number}
                                                    onChange={e => setForm({ ...form, table_number: e.target.value })}
                                                    placeholder="1, 2, 3..."
                                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                                    Capacity <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={form.capacity}
                                                    onChange={e => setForm({ ...form, capacity: e.target.value })}
                                                    placeholder="4, 6, 8..."
                                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">Category (Optional)</label>
                                            <select
                                                value={form.category_id}
                                                onChange={e => setForm({ ...form, category_id: e.target.value })}
                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                                style={{ colorScheme: 'dark' }}
                                            >
                                                <option value="">❓ No Category</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.icon || '📍'} {c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                {/* ✅ MULTIPLE TABLES FORM */}
                                {!modal?.id && addMode === 'multiple' && (
                                    <>
                                        <div className="p-3 sm:p-4 bg-purple-600/10 border border-purple-600/30 rounded-lg">
                                            <p className="text-xs sm:text-sm text-purple-600">
                                                💡 <strong>Example:</strong> Start: 1, End: 10 creates tables 1-10
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                                    Start Number <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={bulkForm.start}
                                                    onChange={e => setBulkForm({ ...bulkForm, start: e.target.value })}
                                                    placeholder="1"
                                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                                    End Number <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="number"
                                                    value={bulkForm.end}
                                                    onChange={e => setBulkForm({ ...bulkForm, end: e.target.value })}
                                                    placeholder="10"
                                                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                                Capacity (All Tables) <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                value={bulkForm.capacity}
                                                onChange={e => setBulkForm({ ...bulkForm, capacity: e.target.value })}
                                                placeholder="4"
                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">Category (Optional)</label>
                                            <select
                                                value={bulkForm.category_id}
                                                onChange={e => setBulkForm({ ...bulkForm, category_id: e.target.value })}
                                                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                                style={{ colorScheme: 'dark' }}
                                            >
                                                <option value="">❓ No Category</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.icon || '📍'} {c.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                            <p className="text-xs sm:text-sm text-[var(--muted)]">
                                                Will create: <strong className="text-[var(--fg)]">
                                                {bulkForm.start && bulkForm.end && parseInt(bulkForm.end) >= parseInt(bulkForm.start)
                                                    ? `${parseInt(bulkForm.end) - parseInt(bulkForm.start) + 1} tables`
                                                    : '0 tables'
                                                }
                                            </strong>
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="p-4 sm:p-6 border-t border-[var(--border)] flex gap-3 sticky bottom-0 bg-[var(--card)]">
                                <button
                                    onClick={() => setModal(null)}
                                    className="flex-1 px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)] transition-colors text-sm sm:text-base"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={save}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors active:scale-95 text-sm sm:text-base disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        modal?.id ? 'Update' : addMode === 'single' ? 'Add Table' : 'Add Tables'
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
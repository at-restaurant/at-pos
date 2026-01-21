// src/app/admin/(pages)/inventory/raw/page.tsx
// 🚀 Raw Materials Management - Add/Edit/Delete

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Menu, Package, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput from '@/components/ui/ResponsiveInput'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import CategoryManager from '@/components/ui/CategoryManager'
import { useToast } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const UNITS = [
    { value: 'kg', label: '⚖️ Kilogram (kg)' },
    { value: 'g', label: '📏 Gram (g)' },
    { value: 'liter', label: '🧃 Liter (L)' },
    { value: 'ml', label: '💧 Milliliter (ml)' },
    { value: 'piece', label: '🔢 Piece' },
    { value: 'dozen', label: '📦 Dozen' },
    { value: 'box', label: '📦 Box' },
    { value: 'pack', label: '📦 Pack' },
]

export default function RawMaterialsPage() {
    const router = useRouter()
    const [items, setItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [modal, setModal] = useState<any>(null)
    const [form, setForm] = useState({
        name: '',
        category_id: '',
        quantity: '',
        unit: 'kg',
        purchase_price: '',
        reorder_level: '10',
        supplier_name: '',
        image_url: '',
        notes: ''
    })
    const [refreshKey, setRefreshKey] = useState(0)
    const supabase = createClient()
    const toast = useToast()

    useEffect(() => { load() }, [])

    const load = async () => {
        const [cats, raw] = await Promise.all([
            supabase.from('inventory_categories').select('*').eq('is_active', true).order('display_order'),
            supabase.from('inventory_items').select('*, inventory_categories(name, icon)').eq('is_active', true).order('created_at', { ascending: false })
        ])
        setCategories(cats.data || [])
        setItems(raw.data || [])
    }

    const save = async () => {
        if (!form.name || !form.category_id || !form.quantity || !form.purchase_price) {
            return toast.add('error', '❌ Fill required fields')
        }

        const qty = parseFloat(form.quantity)
        const price = parseFloat(form.purchase_price)
        const reorder = parseFloat(form.reorder_level)

        if (isNaN(qty) || qty < 0) return toast.add('error', '❌ Quantity must be ≥ 0')
        if (isNaN(price) || price <= 0) return toast.add('error', '❌ Price must be > 0')
        if (isNaN(reorder) || reorder < 0) return toast.add('error', '❌ Reorder level must be ≥ 0')

        const data = {
            name: form.name,
            category_id: form.category_id,
            quantity: qty,
            unit: form.unit,
            purchase_price: price,
            reorder_level: reorder,
            supplier_name: form.supplier_name || null,
            image_url: form.image_url || null,
            notes: form.notes || null,
            is_active: true
        }

        try {
            if (modal?.id) {
                const { error } = await supabase.from('inventory_items').update(data).eq('id', modal.id)
                if (error) throw error
                toast.add('success', '✅ Updated!')
            } else {
                const { error } = await supabase.from('inventory_items').insert(data)
                if (error) throw error
                toast.add('success', '✅ Added!')
            }

            await load()
            setModal(null)
            resetForm()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    const resetForm = () => {
        setForm({
            name: '', category_id: '', quantity: '', unit: 'kg',
            purchase_price: '', reorder_level: '10', supplier_name: '',
            image_url: '', notes: ''
        })
    }

    const deleteItem = async (id: string, imageUrl?: string) => {
        if (!confirm('⚠️ Delete permanently?')) return

        try {
            const { error } = await supabase.from('inventory_items').delete().eq('id', id)
            if (error) throw error

            if (imageUrl?.includes('cloudinary')) {
                const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0]
                await fetch('/api/upload/cloudinary', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                })
            }

            toast.add('success', '✅ Deleted!')
            await load()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    const openModal = (item?: any) => {
        if (item) {
            setForm({
                name: item.name,
                category_id: item.category_id,
                quantity: item.quantity.toString(),
                unit: item.unit,
                purchase_price: item.purchase_price.toString(),
                reorder_level: (item.reorder_level || 10).toString(),
                supplier_name: item.supplier_name || '',
                image_url: item.image_url || '',
                notes: item.notes || ''
            })
        } else {
            resetForm()
        }
        setModal(item || {})
    }

    const getStockStatus = (qty: number, reorder: number) => {
        if (qty === 0) return { label: 'Out', color: '#ef4444' }
        if (qty <= reorder) return { label: 'Low', color: '#f59e0b' }
        if (qty <= reorder * 2) return { label: 'Medium', color: '#3b82f6' }
        return { label: 'Good', color: '#10b981' }
    }

    const filtered = selectedCategory === 'all' ? items : items.filter(i => i.category_id === selectedCategory)

    const lowStockCount = items.filter(i => i.quantity <= (i.reorder_level || 10)).length

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All', icon: '📦', count: items.length },
        ...categories.map(c => ({
            id: c.id,
            label: c.name,
            icon: c.icon || '📦',
            count: items.filter(i => i.category_id === c.id).length
        }))
    ], selectedCategory, setSelectedCategory)

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
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 ${
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
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Raw Materials</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                                            {filtered.length} items
                                            {lowStockCount > 0 && (
                                                <span className="ml-2 text-orange-600 font-medium">• {lowStockCount} low stock</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => router.push('/admin/inventory')}
                                        className="px-3 sm:px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center gap-2 text-xs sm:text-sm"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        <span className="hidden xs:inline">Back</span>
                                    </button>
                                    <button
                                        onClick={() => openModal()}
                                        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-lg"
                                    >
                                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="hidden xs:inline">Add Item</span>
                                        <span className="xs:hidden">Add</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--card)]/95">
                            <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 px-3 py-3 min-w-max">
                                    {sidebarItems.map(item => (
                                        <button key={item.id} onClick={item.onClick}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap shrink-0 ${
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
                        <CategoryManager type="inventory" onCategoryChange={() => { load(); setRefreshKey(p => p + 1) }} />

                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {filtered.map(i => {
                                const status = getStockStatus(i.quantity, i.reorder_level || 10)

                                return (
                                    <div key={i.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group">
                                        {i.image_url && (
                                            <div className="relative h-32 sm:h-40 overflow-hidden">
                                                <img src={i.image_url} alt={i.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                <div className="absolute top-2 right-2">
                                                    <div className="px-2 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-lg" style={{ backgroundColor: status.color }}>
                                                        <Package className="w-3 h-3" />
                                                        {i.quantity}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-3 sm:p-4">
                                            <div className="mb-2">
                                                <h3 className="font-semibold text-sm sm:text-base text-[var(--fg)] truncate">{i.name}</h3>
                                                <p className="text-xs text-[var(--muted)] truncate">
                                                    {i.inventory_categories?.icon || '📦'} {i.inventory_categories?.name}
                                                </p>
                                            </div>

                                            <div className="mb-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-[var(--muted)]">Stock: {i.quantity} {i.unit}</span>
                                                    <span className="text-xs font-bold" style={{ color: status.color }}>{status.label}</span>
                                                </div>
                                                <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all" style={{
                                                        backgroundColor: status.color,
                                                        width: `${Math.min((i.quantity / (i.reorder_level * 3)) * 100, 100)}%`
                                                    }} />
                                                </div>
                                            </div>

                                            <div className="mb-3 text-xs text-[var(--muted)]">
                                                <p>Price: PKR {i.purchase_price}/{i.unit}</p>
                                                {i.supplier_name && <p className="truncate">Supplier: {i.supplier_name}</p>}
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-base sm:text-lg font-bold text-blue-600 truncate">
                                                    PKR {(i.quantity * i.purchase_price).toLocaleString()}
                                                </span>
                                                <div className="flex gap-1 sm:gap-2">
                                                    <button onClick={() => openModal(i)} className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-600/10 rounded">
                                                        <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    </button>
                                                    <button onClick={() => deleteItem(i.id, i.image_url)} className="p-1.5 sm:p-2 text-red-600 hover:bg-red-600/10 rounded">
                                                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {filtered.length === 0 && (
                            <div className="text-center py-12 bg-[var(--card)] border border-[var(--border)] rounded-xl">
                                <div className="text-4xl sm:text-5xl mb-4">📦</div>
                                <p className="text-[var(--fg)] font-medium mb-2">No raw materials yet</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)]">Add your first raw material</p>
                            </div>
                        )}
                    </div>
                </div>

                <FormModal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit Item' : 'Add Item'} onSubmit={save}>
                    <div className="space-y-4">
                        <ResponsiveInput
                            label="Name"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="Chicken Breast"
                            required
                        />
                        <ResponsiveInput
                            label="Category"
                            type="select"
                            value={form.category_id}
                            onChange={e => setForm({ ...form, category_id: e.target.value })}
                            options={categories.map(c => ({ label: `${c.icon || '📦'} ${c.name}`, value: c.id }))}
                            required
                            key={refreshKey}
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <ResponsiveInput
                                label="Quantity"
                                type="number"
                                value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: e.target.value })}
                                placeholder="10"
                                required
                            />
                            <ResponsiveInput
                                label="Unit"
                                type="select"
                                value={form.unit}
                                onChange={e => setForm({ ...form, unit: e.target.value })}
                                options={UNITS}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <ResponsiveInput
                                label="Unit Price (PKR)"
                                type="number"
                                value={form.purchase_price}
                                onChange={e => setForm({ ...form, purchase_price: e.target.value })}
                                placeholder="500"
                                required
                            />
                            <ResponsiveInput
                                label="Reorder Level"
                                type="number"
                                value={form.reorder_level}
                                onChange={e => setForm({ ...form, reorder_level: e.target.value })}
                                placeholder="10"
                                required
                            />
                        </div>

                        <ResponsiveInput
                            label="Supplier Name"
                            value={form.supplier_name}
                            onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                            placeholder="ABC Suppliers (Optional)"
                        />

                        <ResponsiveInput
                            label="Notes"
                            type="textarea"
                            value={form.notes}
                            onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={2}
                            placeholder="Optional notes..."
                        />

                        <CloudinaryUpload
                            value={form.image_url}
                            onChange={url => setForm({ ...form, image_url: url })}
                            folder="raw-materials"
                        />
                    </div>
                </FormModal>
            </>
        </ErrorBoundary>
    )
}
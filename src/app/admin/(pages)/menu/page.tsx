// src/app/admin/(pages)/menu/page.tsx - CLEAN & SMART
"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, Menu, Package, AlertTriangle, Link2, ChevronDown, X } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput from '@/components/ui/ResponsiveInput'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import CategoryManager from '@/components/ui/CategoryManager'
import { useToast } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const STOCK_UNITS = [
    { value: 'piece', label: '🔢 Piece' },
    { value: 'kg', label: '⚖️ Kilogram' },
    { value: 'g', label: '📏 Gram' },
    { value: 'liter', label: '🧃 Liter' },
    { value: 'ml', label: '💧 Milliliter' },
    { value: 'dozen', label: '📦 Dozen' },
    { value: 'plate', label: '🍽️ Plate' },
]

type IngredientLink = { ingredient_id: string; quantity_needed: number }

export default function MenuPage() {
    const [items, setItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [rawMaterials, setRawMaterials] = useState<any[]>([])
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [modal, setModal] = useState<any>(null)
    const [showIngredients, setShowIngredients] = useState(false)
        const [form, setForm] = useState({
        name: '', category_id: '', price: '', description: '', image_url: '',
        stock_quantity: '1', stock_unit: 'piece', linked_ingredients: [] as IngredientLink[],
        track_stock: false,
        variants: [] as Array<{ name: string; price: number }>
    })
    const [refreshKey, setRefreshKey] = useState(0)
    const supabase = createClient()
    const toast = useToast()

    useEffect(() => { load() }, [])

    const load = async () => {
        const [cats, menu, raw] = await Promise.all([
            supabase.from('menu_categories').select('*').eq('is_active', true).order('display_order'),
            supabase.from('menu_items').select('*, menu_categories(name, icon)').eq('is_available', true).order('created_at', { ascending: false }),
            supabase.from('inventory_items').select('*').eq('is_active', true).order('name')
        ])
        setCategories(cats.data || [])
        setItems(menu.data || [])
        setRawMaterials(raw.data || [])
    }

    const save = async () => {
        if (!form.name || !form.category_id) return toast.add('error', '❌ Fill required fields')

        const hasVariants = form.variants && form.variants.length > 0
        if (!hasVariants && !form.price) return toast.add('error', '❌ Price is required')

        const stockQty = form.track_stock ? parseFloat(form.stock_quantity) : 999
        if (form.track_stock && (isNaN(stockQty) || stockQty < 0)) return toast.add('error', '❌ Stock quantity must be ≥ 0')

        const invalidLinks = form.linked_ingredients.filter(l => !l.quantity_needed || l.quantity_needed <= 0)
        if (invalidLinks.length > 0) return toast.add('error', '❌ All ingredient quantities must be > 0')

        if (hasVariants) {
            const invalidVariants = form.variants.filter(v => !v.name?.trim() || isNaN(parseFloat(String(v.price))) || parseFloat(String(v.price)) <= 0)
            if (invalidVariants.length > 0) return toast.add('error', '❌ All variants must have a name and a price > 0')
        }

        const basePrice = parseFloat(form.price)

        const data = {
            name: form.name, category_id: form.category_id, price: basePrice,
            description: form.description || null, image_url: form.image_url || null,
            stock_quantity: stockQty, stock_unit: form.stock_unit,
            track_stock: form.track_stock,
            variants: hasVariants ? form.variants : null,
            linked_ingredients: form.linked_ingredients.length > 0 ? form.linked_ingredients : null,
            is_available: true
        }

        try {
            const { error } = modal?.id
                ? await supabase.from('menu_items').update(data).eq('id', modal.id)
                : await supabase.from('menu_items').insert(data)

            if (error) throw error
            toast.add('success', `✅ ${modal?.id ? 'Updated' : 'Added'}!`)
            await load()
            setModal(null)
            resetForm()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    const resetForm = () => {
        setForm({ name: '', category_id: '', price: '', description: '', image_url: '',
            stock_quantity: '1', stock_unit: 'piece', linked_ingredients: [], track_stock: false, variants: [] })
        setShowIngredients(false)
    }

    const deleteItem = async (id: string, imageUrl?: string) => {
        if (!confirm('⚠️ Delete permanently?')) return
        try {
            await supabase.from('menu_items').delete().eq('id', id)
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
                name: item.name, category_id: item.category_id, price: item.price.toString(),
                description: item.description || '', image_url: item.image_url || '',
                stock_quantity: (item.stock_quantity ?? 1).toString(), stock_unit: item.stock_unit || 'piece',
                linked_ingredients: item.linked_ingredients || [],
                track_stock: item.track_stock ?? false,
                variants: item.variants || []
            })
            setShowIngredients(item.linked_ingredients?.length > 0)
        } else {
            resetForm()
        }
        setModal(item || {})
    }

    const updateIngredient = (id: string, qty: number | null) => {
        setForm(prev => ({
            ...prev,
            linked_ingredients: qty === null || qty <= 0
                ? prev.linked_ingredients.filter(l => l.ingredient_id !== id)
                : prev.linked_ingredients.find(l => l.ingredient_id === id)
                    ? prev.linked_ingredients.map(l => l.ingredient_id === id ? { ...l, quantity_needed: qty } : l)
                    : [...prev.linked_ingredients, { ingredient_id: id, quantity_needed: qty }]
        }))
    }

    const canMakeQuantity = (item: any) => {
        if (item.track_stock === false) return 999
        if (!item.linked_ingredients?.length) return item.stock_quantity ?? 1

        const maxPossible = item.linked_ingredients.map((link: IngredientLink) => {
            const ing = rawMaterials.find(i => i.id === link.ingredient_id)
            return ing ? Math.floor(ing.quantity / link.quantity_needed) : 0
        })
        return Math.min(...maxPossible, 999)
    }

    const getStockStatus = (qty: number) => {
        if (qty === 0) return { label: 'Out', color: '#ef4444' }
        if (qty <= 10) return { label: 'Low', color: '#f59e0b' }
        if (qty <= 50) return { label: 'Medium', color: '#3b82f6' }
        return { label: 'Good', color: '#10b981' }
    }

    const filtered = selectedCategory === 'all' ? items : items.filter(i => i.category_id === selectedCategory)
    const lowStockCount = items.filter(i => canMakeQuantity(i) <= 10).length

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All', icon: '🍽️', count: items.length },
        ...categories.map(c => ({ id: c.id, label: c.name, icon: c.icon || '📋', count: items.filter(i => i.category_id === c.id).length }))
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
                                    <button key={item.id} onClick={() => { item.onClick(); setSidebarOpen(false) }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1 ${item.active ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-[var(--bg)] text-[var(--fg)]'}`}>
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="flex-1 text-left font-medium text-sm">{item.label}</span>
                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.active ? 'bg-white/20' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>{item.count}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                <div className="min-h-screen bg-[var(--bg)] lg:ml-80">
                    <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-[var(--bg)] rounded-lg shrink-0">
                                        <Menu className="w-5 h-5 text-[var(--fg)]" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Menu & Inventory</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                                            {filtered.length} items
                                            {lowStockCount > 0 && (
                                                <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-600 font-medium">
                                                    <AlertTriangle className="w-3 h-3" /> {lowStockCount} low
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => openModal()}
                                        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-lg">
                                    <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden xs:inline">Add</span>
                                </button>
                            </div>
                        </div>

                        <div className="lg:hidden border-t border-[var(--border)] bg-[var(--card)]/95">
                            <div className="max-w-7xl mx-auto overflow-x-auto scrollbar-hide">
                                <div className="flex gap-2 px-3 py-3 min-w-max">
                                    {sidebarItems.map(item => (
                                        <button key={item.id} onClick={item.onClick}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap shrink-0 ${item.active ? 'bg-blue-600 text-white shadow-lg' : 'bg-[var(--bg)] text-[var(--fg)]'}`}>
                                            <span className="text-base">{item.icon}</span>
                                            <span className="text-xs font-medium">{item.label}</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.active ? 'bg-white/20' : 'bg-[var(--card)] text-[var(--muted)]'}`}>{item.count}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                        <CategoryManager type="menu" onCategoryChange={() => { load(); setRefreshKey(p => p + 1) }} />

                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {filtered.map(i => {
                                const tracksStock = i.track_stock ?? false
                                const availableQty = canMakeQuantity(i)
                                const status = getStockStatus(availableQty)
                                const hasLinks = i.linked_ingredients?.length > 0

                                return (
                                    <div key={i.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group">
                                        {i.image_url && (
                                            <div className="relative h-32 sm:h-40 overflow-hidden">
                                                <img src={i.image_url} alt={i.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    {hasLinks && (
                                                        <div className="px-2 py-1 rounded-full text-xs font-bold bg-purple-600 text-white shadow-lg flex items-center gap-1">
                                                            <Link2 className="w-3 h-3" />{i.linked_ingredients.length}
                                                        </div>
                                                    )}
                                                    {tracksStock && (
                                                        <div className="px-2 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-lg" style={{ backgroundColor: status.color }}>
                                                            <Package className="w-3 h-3" />{availableQty}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-3 sm:p-4">
                                            <div className="mb-2">
                                                <h3 className="font-semibold text-sm sm:text-base text-[var(--fg)] truncate">{i.name}</h3>
                                                <p className="text-xs text-[var(--muted)] truncate">
                                                    {i.menu_categories?.icon || '📋'} {i.menu_categories?.name}
                                                </p>
                                            </div>

                                            <div className="mb-3">
                                                {tracksStock ? (
                                                    <>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-xs text-[var(--muted)]">
                                                                {hasLinks ? 'Can Make' : 'Stock'}: {availableQty} {i.stock_unit}
                                                            </span>
                                                            <span className="text-xs font-bold" style={{ color: status.color }}>{status.label}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                                                            <div className="h-full rounded-full transition-all" style={{ backgroundColor: status.color, width: `${Math.min((availableQty / 100) * 100, 100)}%` }} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-green-600 font-medium">✨ Unlimited Stock</span>
                                                    </div>
                                                )}
                                            </div>

                                            {i.description && <p className="text-xs text-[var(--muted)] mb-3 line-clamp-2">{i.description}</p>}

                                            {/* Price Variants list in admin card */}
                                            {i.variants && i.variants.length > 0 && (
                                                <div className="flex flex-wrap gap-1 text-[9px] sm:text-[10px] text-[var(--muted)] mb-3 pt-1 border-t border-[var(--border)]/45">
                                                    {i.variants.map((v: any, idx: number) => (
                                                        <span key={idx} className="bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--border)] font-medium">
                                                            {v.name}: <span className="text-blue-600 font-bold">₨{v.price}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-base sm:text-lg font-bold text-blue-600 truncate">
                                                    ₨{i.price}
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
                                <div className="text-4xl sm:text-5xl mb-4">🍽️</div>
                                <p className="text-[var(--fg)] font-medium mb-2">No items yet</p>
                                <p className="text-xs sm:text-sm text-[var(--muted)]">Add your first menu item</p>
                            </div>
                        )}
                    </div>
                </div>

                <FormModal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit Item' : 'Add Item'} onSubmit={save}>
                    <div className="space-y-4">
                        <ResponsiveInput label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Chicken Biryani" required />
                        <ResponsiveInput label="Category" type="select" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
                                         options={categories.map(c => ({ label: `${c.icon || '📋'} ${c.name}`, value: c.id }))} required key={refreshKey} />

                        <div className="flex items-center gap-2 p-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                            <input
                                type="checkbox"
                                id="track_stock"
                                checked={form.track_stock}
                                onChange={e => setForm({ ...form, track_stock: e.target.checked })}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-[var(--card)] border-[var(--border)]"
                            />
                            <label htmlFor="track_stock" className="text-xs font-semibold text-[var(--fg)] cursor-pointer select-none">
                                Track Inventory/Stock Quantity
                            </label>
                        </div>

                        {form.track_stock && (
                            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                <ResponsiveInput label="Stock Qty" type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: e.target.value })} placeholder="1" required />
                                <ResponsiveInput label="Unit" type="select" value={form.stock_unit} onChange={e => setForm({ ...form, stock_unit: e.target.value })} options={STOCK_UNITS} required />
                            </div>
                        )}

                        <ResponsiveInput 
                            label="Price (PKR) / Base Price"
                            type="number" 
                            value={form.price} 
                            onChange={e => setForm({ ...form, price: e.target.value })} 
                            placeholder="450" 
                            required
                        />

                        {/* Price Variants (Portions/Sizes) */}
                        <div className="border border-[var(--border)] rounded-lg p-3 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs text-[var(--fg)]">Price Variants (Portions/Sizes)</span>
                                <button
                                    type="button"
                                    onClick={() => setForm(prev => ({
                                        ...prev,
                                        variants: [...prev.variants, { name: '', price: 0 }]
                                    }))}
                                    className="px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 active:scale-95 transition-all font-semibold flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Add Portion
                                </button>
                            </div>

                            {form.variants.length > 0 ? (
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {form.variants.map((v, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={v.name}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setForm(prev => {
                                                        const copy = [...prev.variants];
                                                        copy[index] = { ...copy[index], name: val };
                                                        return { ...prev, variants: copy };
                                                    });
                                                }}
                                                placeholder="Portion name (e.g. Half KG)"
                                                className="flex-1 px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-[var(--fg)] text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                            />
                                            <input
                                                type="number"
                                                value={v.price || ''}
                                                onChange={e => {
                                                    const val = e.target.value ? parseFloat(e.target.value) : 0;
                                                    setForm(prev => {
                                                        const copy = [...prev.variants];
                                                        copy[index] = { ...copy[index], price: val };
                                                        return { ...prev, variants: copy };
                                                    });
                                                }}
                                                placeholder="Price (PKR)"
                                                className="w-24 px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-[var(--fg)] text-xs text-center focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        variants: prev.variants.filter((_, i) => i !== index)
                                                    }));
                                                }}
                                                className="p-1 hover:bg-red-500/10 text-red-500 rounded transition-colors shrink-0"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <p className="text-[10px] text-[var(--muted)]">Note: portion prices will override the base price in public menu.</p>
                                </div>
                            ) : (
                                <p className="text-xs text-[var(--muted)] italic">No portions defined. Item has a single standard price.</p>
                            )}
                        </div>

                        <ResponsiveInput label="Description" type="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional..." />

                        {/* ✅ SMART INGREDIENT LINKING */}
                        <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                            <button type="button" onClick={() => setShowIngredients(!showIngredients)}
                                    className="w-full flex items-center justify-between p-4 bg-purple-500/5 hover:bg-purple-500/10 transition-colors">
                                <div className="flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-purple-600" />
                                    <span className="font-semibold text-[var(--fg)] text-sm">Link Ingredients (Optional)</span>
                                    {form.linked_ingredients.length > 0 && (
                                        <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">{form.linked_ingredients.length}</span>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-[var(--muted)] transition-transform ${showIngredients ? 'rotate-180' : ''}`} />
                            </button>

                            {showIngredients && (
                                <div className="p-4 space-y-3">
                                    <p className="text-xs text-[var(--muted)]">💡 Enter quantity needed per item. Set to 0 to remove. Auto-calculates available stock.</p>

                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {rawMaterials.map(ing => {
                                            const link = form.linked_ingredients.find(l => l.ingredient_id === ing.id)
                                            const canMake = link ? Math.floor(ing.quantity / link.quantity_needed) : 0

                                            return (
                                                <div key={ing.id} className="flex items-center gap-3 p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-[var(--fg)] truncate">{ing.name}</p>
                                                        <p className="text-xs text-[var(--muted)]">Stock: {ing.quantity} {ing.unit}</p>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={link?.quantity_needed || ''}
                                                        onChange={(e) => updateIngredient(ing.id, e.target.value ? parseFloat(e.target.value) : null)}
                                                        placeholder="0"
                                                        className="w-20 px-2 py-1 bg-[var(--card)] border border-[var(--border)] rounded text-[var(--fg)] text-sm text-center focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                                    />
                                                    {link && (
                                                        <div className="text-xs font-semibold text-purple-600 w-12 text-right">
                                                            ={canMake}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {form.linked_ingredients.length > 0 && (
                                        <div className="p-2 bg-purple-600/10 border border-purple-600/30 rounded">
                                            <p className="text-xs text-purple-600 font-semibold">
                                                ✨ {form.linked_ingredients.length} linked • Auto-deduct on sale
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <CloudinaryUpload value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} folder="menu-items" />
                    </div>
                </FormModal>
            </>
        </ErrorBoundary>
    )
}
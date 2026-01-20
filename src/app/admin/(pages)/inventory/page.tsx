// src/app/admin/(pages)/inventory/page.tsx
// ✅ REFACTORED: Shows menu_items as inventory with search + filters

'use client'

import { useState, useMemo, useEffect } from 'react'
import { Search, Menu, Edit2, Trash2, X, Upload, Package, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { createClient } from '@/lib/supabase/client'

export default function InventoryPage() {
    const router = useRouter()
    const supabase = createClient()

    const [items, setItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [stockFilter, setStockFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [modal, setModal] = useState<any>(null)
    const [form, setForm] = useState({
        name: '',
        category_id: '',
        price: '',
        stock_quantity: '',
        description: '',
        image_url: ''
    })
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)

    useEffect(() => {
        loadData()
        const cleanup = setupRealtime()
        return cleanup
    }, [])

    const loadData = async () => {
        setLoading(true)
        await Promise.all([loadItems(), loadCategories()])
        setLoading(false)
    }

    const loadItems = async () => {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*, menu_categories(name, icon)')
            .eq('is_available', true)
            .order('created_at', { ascending: false })

        if (!error) setItems(data || [])
    }

    const loadCategories = async () => {
        const { data, error } = await supabase
            .from('menu_categories')
            .select('*')
            .eq('is_active', true)
            .order('name')

        if (!error) setCategories(data || [])
    }

    const setupRealtime = () => {
        const channel = supabase
            .channel('inventory_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'menu_items'
            }, loadItems)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'menu_categories'
            }, loadCategories)
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }

    const getStockStatus = (qty: number) => {
        if (qty === 999) return 'unlimited'
        if (qty === 0) return 'critical'
        if (qty <= 10) return 'low'
        if (qty <= 50) return 'medium'
        return 'high'
    }

    const getStockColor = (status: string) => {
        const colors = {
            critical: '#ef4444',
            low: '#f59e0b',
            medium: '#3b82f6',
            high: '#10b981',
            unlimited: '#8b5cf6'
        }
        return colors[status as keyof typeof colors] || '#6b7280'
    }

    const filtered = useMemo(() => {
        let result = items

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(i =>
                i.name.toLowerCase().includes(query) ||
                i.menu_categories?.name?.toLowerCase().includes(query) ||
                i.description?.toLowerCase().includes(query)
            )
        }

        // Stock filter
        if (stockFilter !== 'all') {
            result = result.filter(i =>
                getStockStatus(i.stock_quantity ?? 999) === stockFilter
            )
        }

        return result
    }, [items, stockFilter, searchQuery])

    const stats = useMemo(() => {
        const itemsWithStock = items.filter(i => (i.stock_quantity ?? 999) !== 999)
        const totalValue = itemsWithStock.reduce((s, i) => s + ((i.stock_quantity ?? 0) * i.price), 0)

        return [
            {
                label: 'Out of Stock',
                value: items.filter(i => getStockStatus(i.stock_quantity ?? 999) === 'critical').length,
                color: '#ef4444',
                onClick: () => setStockFilter('critical'),
                active: stockFilter === 'critical'
            },
            {
                label: 'Low Stock',
                value: items.filter(i => getStockStatus(i.stock_quantity ?? 999) === 'low').length,
                color: '#f59e0b',
                onClick: () => setStockFilter('low'),
                active: stockFilter === 'low'
            },
            {
                label: 'Medium',
                value: items.filter(i => getStockStatus(i.stock_quantity ?? 999) === 'medium').length,
                color: '#3b82f6',
                onClick: () => setStockFilter('medium'),
                active: stockFilter === 'medium'
            },
            {
                label: 'High Stock',
                value: items.filter(i => getStockStatus(i.stock_quantity ?? 999) === 'high').length,
                color: '#10b981',
                onClick: () => setStockFilter('high'),
                active: stockFilter === 'high'
            },
            {
                label: 'Unlimited',
                value: items.filter(i => getStockStatus(i.stock_quantity ?? 999) === 'unlimited').length,
                color: '#8b5cf6',
                onClick: () => setStockFilter('unlimited'),
                active: stockFilter === 'unlimited'
            },
            {
                label: 'Total Value',
                value: `PKR ${(totalValue / 1000).toFixed(1)}k`,
                color: '#10b981',
                onClick: () => setStockFilter('all'),
                active: stockFilter === 'all'
            }
        ]
    }, [items, stockFilter])

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Items', icon: '📦', count: items.length },
        { id: 'critical', label: 'Out of Stock', icon: '🔴', count: stats[0]?.value || 0 },
        { id: 'low', label: 'Low Stock', icon: '🟡', count: stats[1]?.value || 0 },
        { id: 'medium', label: 'Medium', icon: '🔵', count: stats[2]?.value || 0 },
        { id: 'high', label: 'High Stock', icon: '🟢', count: stats[3]?.value || 0 },
        { id: 'unlimited', label: 'Unlimited', icon: '♾️', count: stats[4]?.value || 0 }
    ], stockFilter, setStockFilter)

    const openModal = (item?: any) => {
        if (item) {
            setForm({
                name: item.name,
                category_id: item.category_id || '',
                price: item.price.toString(),
                stock_quantity: (item.stock_quantity ?? 999).toString(),
                description: item.description || '',
                image_url: item.image_url || ''
            })
        } else {
            setForm({
                name: '',
                category_id: '',
                price: '',
                stock_quantity: '999',
                description: '',
                image_url: ''
            })
        }
        setModal(item || {})
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            alert('❌ Please upload an image file')
            return
        }

        if (file.size > 5 * 1024 * 1024) {
            alert('❌ Image must be less than 5MB')
            return
        }

        setUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('upload_preset', 'menu-items')
            formData.append('folder', 'menu-items')

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                { method: 'POST', body: formData }
            )

            if (!response.ok) throw new Error('Upload failed')

            const data = await response.json()
            setForm({ ...form, image_url: data.secure_url })
        } catch (error: any) {
            alert(`❌ ${error.message || 'Upload failed'}`)
        } finally {
            setUploadingImage(false)
        }
    }

    const save = async () => {
        if (!form.name || !form.price || !form.stock_quantity) {
            alert('❌ Fill all required fields')
            return
        }

        setSaving(true)
        try {
            const data = {
                name: form.name,
                category_id: form.category_id || null,
                price: parseFloat(form.price),
                stock_quantity: parseInt(form.stock_quantity),
                description: form.description || null,
                image_url: form.image_url || null,
                is_available: true
            }

            if (modal?.id) {
                const { error } = await supabase
                    .from('menu_items')
                    .update(data)
                    .eq('id', modal.id)

                if (error) throw error
                alert('✅ Item updated!')
            } else {
                const { error } = await supabase
                    .from('menu_items')
                    .insert(data)

                if (error) throw error
                alert('✅ Item added!')
            }

            setModal(null)
            setForm({
                name: '',
                category_id: '',
                price: '',
                stock_quantity: '999',
                description: '',
                image_url: ''
            })
        } catch (error: any) {
            alert(`❌ ${error.message || 'Failed'}`)
        } finally {
            setSaving(false)
        }
    }

    const deleteItem = async (id: string, imageUrl?: string) => {
        if (!confirm('⚠️ Delete this item permanently?')) return

        try {
            const { error } = await supabase
                .from('menu_items')
                .update({ is_available: false })
                .eq('id', id)

            if (error) throw error

            if (imageUrl && imageUrl.includes('cloudinary')) {
                const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0]
                await fetch('/api/upload/cloudinary', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                })
            }

            alert('✅ Item deleted!')
            setModal(null)
        } catch (error: any) {
            alert(`❌ ${error.message || 'Failed'}`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <>
                {/* Desktop Sidebar */}
                <div className="hidden lg:block">
                    <AutoSidebar items={sidebarItems} title="Stock Status" />
                </div>

                {/* Mobile Sidebar */}
                {sidebarOpen && (
                    <>
                        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
                        <div className="fixed top-0 left-0 h-full w-64 bg-[var(--card)] border-r border-[var(--border)] z-50 lg:hidden overflow-y-auto">
                            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                                <h2 className="text-lg font-bold text-[var(--fg)]">Stock Status</h2>
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
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Inventory</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                                            {filtered.length} items • PKR {filtered.reduce((s, i) => {
                                            const stock = i.stock_quantity ?? 999
                                            return stock === 999 ? s : s + (stock * i.price)
                                        }, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-lg">
                            <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted)]" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search by name, category, description..."
                                        className="w-full pl-10 sm:pl-12 pr-4 py-2 sm:py-2.5 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm sm:text-base text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                    />
                                    {searchQuery && (
                                        <button
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--border)] rounded transition-colors"
                                        >
                                            <X className="w-4 h-4 text-[var(--muted)]" />
                                        </button>
                                    )}
                                </div>
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
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-blue-600">
                                💡 <strong>Note:</strong> This inventory shows your menu items with stock tracking. Items are sold on the public menu and stock reduces automatically.
                            </p>
                        </div>

                        <ResponsiveStatsGrid stats={stats} />

                        {/* Items Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {filtered.map(item => {
                                const status = getStockStatus(item.stock_quantity ?? 999)
                                const statusColor = getStockColor(status)
                                const stock = item.stock_quantity ?? 999

                                return (
                                    <div key={item.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg sm:rounded-xl overflow-hidden hover:shadow-xl hover:border-blue-600 transition-all group">
                                        {item.image_url && (
                                            <div className="relative h-32 sm:h-40 overflow-hidden">
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                <div className="absolute top-2 right-2">
                                                    <div
                                                        className="px-2 py-1 rounded-full text-xs font-bold text-white flex items-center gap-1 shadow-lg"
                                                        style={{ backgroundColor: statusColor }}
                                                    >
                                                        <Package className="w-3 h-3" />
                                                        {stock === 999 ? '∞' : stock}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="p-3 sm:p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold text-sm sm:text-base text-[var(--fg)] truncate">{item.name}</h3>
                                                    <p className="text-xs text-[var(--muted)] truncate">
                                                        {item.menu_categories?.icon || '📦'} {item.menu_categories?.name || 'N/A'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs text-[var(--muted)]">Stock</span>
                                                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                                                          style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                                                        {stock === 999 ? 'Unlimited' : `${stock} units`}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-[var(--muted)]">Price: PKR {item.price}</p>
                                                {stock !== 999 && (
                                                    <p className="text-base font-bold text-blue-600">Value: PKR {(stock * item.price).toLocaleString()}</p>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => openModal(item)}
                                                    className="flex-1 py-1.5 text-blue-600 hover:bg-blue-600/10 rounded-lg text-xs font-medium transition-colors active:scale-95"
                                                >
                                                    <Edit2 className="w-3 h-3 inline mr-1" />
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteItem(item.id, item.image_url)}
                                                    className="flex-1 py-1.5 text-red-600 hover:bg-red-600/10 rounded-lg text-xs font-medium transition-colors active:scale-95"
                                                >
                                                    <Trash2 className="w-3 h-3 inline mr-1" />
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {filtered.length === 0 && (
                            <div className="text-center py-12 bg-[var(--card)] border border-[var(--border)] rounded-xl">
                                <div className="text-4xl sm:text-5xl mb-4">📦</div>
                                <p className="text-[var(--fg)] font-medium mb-2 text-sm sm:text-base">
                                    {searchQuery ? 'No items match your search' : 'No items found'}
                                </p>
                                <p className="text-xs sm:text-sm text-[var(--muted)]">
                                    {searchQuery ? 'Try a different search term' : 'Add items from the menu page'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal */}
                {modal && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-[var(--card)] rounded-xl w-full max-w-2xl border border-[var(--border)] max-h-[90vh] overflow-y-auto">
                            <div className="p-4 sm:p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)]">
                                        {modal?.id ? 'Edit Item' : 'Add Item'}
                                    </h3>
                                    <button onClick={() => setModal(null)} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                                        <X className="w-5 h-5 text-[var(--muted)]" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 sm:p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Item Name <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={e => setForm({ ...form, name: e.target.value })}
                                            placeholder="Chicken Biryani..."
                                            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">Category</label>
                                        <select
                                            value={form.category_id}
                                            onChange={e => setForm({ ...form, category_id: e.target.value })}
                                            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                            style={{ colorScheme: 'dark' }}
                                        >
                                            <option value="">❓ No Category</option>
                                            {categories.map(c => (
                                                <option key={c.id} value={c.id}>{c.icon || '📦'} {c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Price (PKR) <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={form.price}
                                            onChange={e => setForm({ ...form, price: e.target.value })}
                                            placeholder="450"
                                            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                            Stock Quantity <span className="text-red-600">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            value={form.stock_quantity}
                                            onChange={e => setForm({ ...form, stock_quantity: e.target.value })}
                                            placeholder="999 for unlimited"
                                            className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                        />
                                        <p className="text-xs text-[var(--muted)] mt-1">💡 Use 999 for unlimited stock</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">Description</label>
                                    <textarea
                                        value={form.description}
                                        onChange={e => setForm({ ...form, description: e.target.value })}
                                        placeholder="Optional description..."
                                        rows={3}
                                        className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-[var(--fg)] mb-2">Item Image</label>
                                    <div className="flex items-center gap-3">
                                        {form.image_url && (
                                            <img src={form.image_url} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-[var(--border)]" />
                                        )}
                                        <label className="flex-1 cursor-pointer">
                                            <div className="border-2 border-dashed border-[var(--border)] rounded-lg p-4 hover:border-blue-600 transition-colors text-center">
                                                {uploadingImage ? (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                        <span className="text-sm text-[var(--muted)]">Uploading...</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--muted)]" />
                                                        <p className="text-sm text-[var(--fg)] mb-1">Click to upload image</p>
                                                        <p className="text-xs text-[var(--muted)]">PNG, JPG up to 5MB</p>
                                                    </>
                                                )}
                                            </div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                className="hidden"
                                                disabled={uploadingImage}
                                            />
                                        </label>
                                        {form.image_url && (
                                            <button
                                                onClick={() => setForm({ ...form, image_url: '' })}
                                                className="p-2 text-red-600 hover:bg-red-600/10 rounded-lg"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setModal(null)}
                                        className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--bg)] transition-colors"
                                        disabled={saving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={save}
                                        disabled={saving || uploadingImage}
                                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {saving ? 'Saving...' : modal?.id ? 'Update' : 'Add Item'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </ErrorBoundary>
    )
}
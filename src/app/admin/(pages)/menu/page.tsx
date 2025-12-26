"use client"

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, FolderPlus } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput, { FormGrid } from '@/components/ui/ResponsiveInput'
import IconPicker from '@/components/ui/IconPicker'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import { useToast } from '@/components/ui/Toast'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function MenuPage() {
    const [items, setItems] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [selectedCategory, setSelectedCategory] = useState('all')
    const [modal, setModal] = useState<any>(null)
    const [categoryModal, setCategoryModal] = useState<any>(null)
    const [showIconPicker, setShowIconPicker] = useState(false)
    const [form, setForm] = useState({
        name: '', category_id: '', price: '', description: '', image_url: ''
    })
    const [categoryForm, setCategoryForm] = useState({
        name: '', icon: '📋'
    })
    const supabase = createClient()
    const toast = useToast()

    useEffect(() => { load() }, [])

    const load = async () => {
        const [cats, menu] = await Promise.all([
            supabase.from('menu_categories').select('*').eq('is_active', true).order('display_order'),
            supabase.from('menu_items').select('*, menu_categories(name, icon)').eq('is_available', true).order('created_at', { ascending: false })
        ])
        setCategories(cats.data || [])
        setItems(menu.data || [])
    }

    const save = async () => {
        if (!form.name || !form.category_id || !form.price) {
            return toast.add('error', '❌ Fill required fields')
        }

        const data = {
            name: form.name,
            category_id: form.category_id,
            price: +form.price,
            description: form.description || null,
            image_url: form.image_url || null,
            is_available: true
        }

        try {
            if (modal?.id) {
                const { error } = await supabase.from('menu_items').update(data).eq('id', modal.id)
                if (error) throw error
                toast.add('success', '✅ Menu item updated!')
            } else {
                const { error } = await supabase.from('menu_items').insert(data)
                if (error) throw error
                toast.add('success', '✅ Menu item added!')
            }

            setModal(null)
            setForm({ name: '', category_id: '', price: '', description: '', image_url: '' })
            load()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const saveCategory = async () => {
        if (!categoryForm.name.trim()) {
            return toast.add('error', '❌ Category name required')
        }

        try {
            if (categoryModal?.id) {
                const { error } = await supabase
                    .from('menu_categories')
                    .update({ name: categoryForm.name, icon: categoryForm.icon || '📋' })
                    .eq('id', categoryModal.id)
                if (error) throw error
                toast.add('success', '✅ Category updated!')
            } else {
                const { error } = await supabase
                    .from('menu_categories')
                    .insert({
                        name: categoryForm.name,
                        icon: categoryForm.icon || '📋',
                        display_order: categories.length,
                        is_active: true
                    })
                if (error) throw error
                toast.add('success', '✅ Category added!')
            }

            setCategoryModal(null)
            setCategoryForm({ name: '', icon: '📋' })
            load()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const deleteCategory = async (id: string) => {
        const itemsInCategory = items.filter(i => i.category_id === id)
        if (itemsInCategory.length > 0) {
            return toast.add('error', `❌ Cannot delete! ${itemsInCategory.length} items in this category`)
        }

        if (!confirm('⚠️ Delete this category permanently?')) return

        try {
            const { error } = await supabase.from('menu_categories').delete().eq('id', id)
            if (error) throw error
            toast.add('success', '✅ Category deleted!')
            load()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const deleteItem = async (id: string, imageUrl?: string) => {
        if (!confirm('⚠️ Delete this menu item permanently?')) return

        try {
            // Delete from database
            const { error } = await supabase.from('menu_items').delete().eq('id', id)
            if (error) throw error

            // Delete image from Cloudinary if exists
            if (imageUrl && imageUrl.includes('cloudinary')) {
                const publicId = imageUrl.split('/').slice(-2).join('/').split('.')[0]
                await fetch('/api/upload/cloudinary', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ public_id: publicId })
                })
            }

            toast.add('success', '✅ Item deleted!')
            load()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Failed'}`)
        }
    }

    const openModal = (item?: any) => {
        if (item) {
            setForm({
                name: item.name,
                category_id: item.category_id,
                price: item.price.toString(),
                description: item.description || '',
                image_url: item.image_url || ''
            })
        } else {
            setForm({ name: '', category_id: '', price: '', description: '', image_url: '' })
        }
        setModal(item || {})
    }

    const openCategoryModal = (category?: any) => {
        if (category) {
            setCategoryForm({ name: category.name, icon: category.icon || '📋' })
        } else {
            setCategoryForm({ name: '', icon: '📋' })
        }
        setCategoryModal(category || {})
    }

    const filtered = selectedCategory === 'all' ? items : items.filter(i => i.category_id === selectedCategory)

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Items', icon: '🍽️', count: items.length },
        ...categories.map(cat => ({
            id: cat.id,
            label: cat.name,
            icon: cat.icon || '📋',
            count: items.filter(i => i.category_id === cat.id).length
        }))
    ], selectedCategory, setSelectedCategory)

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Categories" />

                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    <header className="sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)]">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Menu</h1>
                                    <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">{filtered.length} items • {categories.length} categories</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openCategoryModal()} className="px-3 py-2 sm:px-4 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95">
                                        <FolderPlus className="w-4 h-4" />
                                        <span className="hidden sm:inline">Category</span>
                                    </button>
                                    <button onClick={() => openModal()} className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm active:scale-95">
                                        <Plus className="w-4 h-4" />
                                        <span className="hidden sm:inline">Item</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Categories Section */}
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4">
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                            <h3 className="text-base sm:text-lg font-bold text-[var(--fg)] mb-3">Manage Categories</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                                {categories.map(cat => (
                                    <div key={cat.id} className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-2 sm:p-3 hover:border-blue-600 transition-all group">
                                        <div className="flex items-center justify-between mb-1 sm:mb-2">
                                            <span className="text-xl sm:text-2xl">{cat.icon || '📋'}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openCategoryModal(cat)} className="p-1 text-blue-600 hover:bg-blue-600/10 rounded">
                                                    <Edit2 className="w-3 h-3" />
                                                </button>
                                                <button onClick={() => deleteCategory(cat.id)} className="p-1 text-red-600 hover:bg-red-600/10 rounded">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs sm:text-sm font-medium text-[var(--fg)] truncate">{cat.name}</p>
                                        <p className="text-xs text-[var(--muted)]">{items.filter(i => i.category_id === cat.id).length} items</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-6">
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                            {filtered.map(i => (
                                <div key={i.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg sm:rounded-xl overflow-hidden hover:shadow-lg transition-all group">
                                    {i.image_url && (
                                        <div className="relative h-32 sm:h-40 overflow-hidden">
                                            <img src={i.image_url} alt={i.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                        </div>
                                    )}
                                    <div className="p-2.5 sm:p-4">
                                        <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-sm sm:text-base text-[var(--fg)] truncate">{i.name}</h3>
                                                <p className="text-xs text-[var(--muted)]">
                                                    {i.menu_categories?.icon || '📋'} {i.menu_categories?.name}
                                                </p>
                                            </div>
                                        </div>
                                        {i.description && (
                                            <p className="text-xs sm:text-sm text-[var(--muted)] mb-2 sm:mb-3 line-clamp-2">{i.description}</p>
                                        )}
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-base sm:text-lg font-bold text-blue-600 truncate">PKR {i.price}</span>
                                            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
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
                            ))}
                        </div>
                    </div>
                </div>

                {/* Item Modal */}
                <FormModal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit Item' : 'Add Item'} onSubmit={save}>
                    <div className="space-y-4">
                        <ResponsiveInput label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Chicken Biryani" required />
                        <ResponsiveInput label="Category" type="select" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} options={categories.map(c => ({ label: `${c.icon || '📋'} ${c.name}`, value: c.id }))} required />
                        <ResponsiveInput label="Price (PKR)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="450" required />
                        <ResponsiveInput label="Description" type="textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Optional description..." />
                        <CloudinaryUpload value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} folder="menu-items" />
                    </div>
                </FormModal>

                {/* Category Modal */}
                <FormModal open={!!categoryModal} onClose={() => setCategoryModal(null)} title={categoryModal?.id ? 'Edit Category' : 'Add Category'} onSubmit={saveCategory}>
                    <div className="space-y-4">
                        <ResponsiveInput label="Name" value={categoryForm.name} onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="Main Course" required />
                        <div>
                            <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                Icon <span className="text-xs text-[var(--muted)]">(Optional)</span>
                            </label>
                            <button onClick={() => setShowIconPicker(true)} className="w-full px-4 py-3 bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg hover:border-blue-600 transition-all flex items-center justify-center gap-3">
                                <span className="text-4xl">{categoryForm.icon || '📋'}</span>
                                <span className="text-sm text-[var(--muted)]">Click to change (optional)</span>
                            </button>
                        </div>
                    </div>
                </FormModal>

                {showIconPicker && (
                    <IconPicker
                        selected={categoryForm.icon}
                        onSelect={icon => setCategoryForm({ ...categoryForm, icon })}
                        onClose={() => setShowIconPicker(false)}
                    />
                )}
            </>
        </ErrorBoundary>
    )
}
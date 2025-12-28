// src/components/ui/CategoryManager.tsx - REUSABLE COMPONENT
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Edit2, Trash2, FolderPlus, X, ChevronDown, ChevronUp } from 'lucide-react'
import IconPicker from '@/components/ui/IconPicker'
import { useToast } from '@/components/ui/Toast'

interface CategoryManagerProps {
    type: 'menu' | 'inventory' | 'table'
    onCategoryChange?: () => void
}

export default function CategoryManager({ type, onCategoryChange }: CategoryManagerProps) {
    const [categories, setCategories] = useState<any[]>([])
    const [showModal, setShowModal] = useState(false)
    const [showIconPicker, setShowIconPicker] = useState(false)
    const [form, setForm] = useState({ name: '', icon: '📋' })
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [isExpanded, setIsExpanded] = useState(false)
    const toast = useToast()
    const supabase = createClient()

    const tableName = type === 'menu' ? 'menu_categories' : 'inventory_categories'
    const itemsTable = type === 'menu' ? 'menu_items' : 'inventory_items'

    useEffect(() => {
        loadCategories()
    }, [type])

    const loadCategories = async () => {
        const { data } = await supabase
            .from(tableName)
            .select('*')
            .eq('is_active', true)
            .order('display_order')

        setCategories(data || [])
    }

    const openModal = (category?: any) => {
        if (category) {
            setForm({ name: category.name, icon: category.icon || '📋' })
            setEditingId(category.id)
        } else {
            setForm({ name: '', icon: '📋' })
            setEditingId(null)
        }
        setShowModal(true)
        setIsExpanded(true) // Auto-expand when adding category
    }

    const save = async () => {
        if (!form.name.trim()) {
            toast.add('error', '❌ Category name required')
            return
        }

        setLoading(true)
        try {
            if (editingId) {
                const { error } = await supabase
                    .from(tableName)
                    .update({ name: form.name, icon: form.icon })
                    .eq('id', editingId)

                if (error) throw error
                toast.add('success', '✅ Category updated!')
            } else {
                const { error } = await supabase
                    .from(tableName)
                    .insert({
                        name: form.name,
                        icon: form.icon,
                        display_order: categories.length,
                        is_active: true
                    })

                if (error) throw error
                toast.add('success', '✅ Category added!')
            }

            setShowModal(false)
            setForm({ name: '', icon: '📋' })
            setEditingId(null)
            loadCategories()
            onCategoryChange?.()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    const deleteCategory = async (id: string) => {
        const { data: items } = await supabase
            .from(itemsTable)
            .select('id')
            .eq('category_id', id)

        if (items && items.length > 0) {
            toast.add('error', `❌ Cannot delete! ${items.length} items in this category`)
            return
        }

        if (!confirm('⚠️ Delete this category?')) return

        try {
            const { error } = await supabase
                .from(tableName)
                .delete()
                .eq('id', id)

            if (error) throw error
            toast.add('success', '✅ Category deleted!')
            loadCategories()
            onCategoryChange?.()
        } catch (error: any) {
            toast.add('error', `❌ ${error.message}`)
        }
    }

    return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-6">
            {/* Header - Always visible on mobile, with toggle and add buttons */}
            <div className="flex items-center justify-between gap-2 mb-4">
                {/* Toggle button - Only on mobile */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="md:hidden flex items-center gap-2 text-[var(--fg)] hover:text-blue-600 transition-colors"
                >
                    <FolderPlus className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-bold">Manage Categories</h3>
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                    ) : (
                        <ChevronDown className="w-5 h-5" />
                    )}
                </button>

                {/* Desktop title - Always visible */}
                <h3 className="hidden md:flex text-lg font-bold text-[var(--fg)] items-center gap-2">
                    <FolderPlus className="w-5 h-5 text-green-600" />
                    Manage Categories
                </h3>

                {/* Add Category Button */}
                <button
                    onClick={() => openModal()}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95 whitespace-nowrap"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Category</span>
                    <span className="sm:hidden">Add</span>
                </button>
            </div>

            {/* Collapsible content - Hidden on mobile by default */}
            <div className={`${isExpanded ? 'block' : 'hidden'} md:block`}>
                {categories.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {categories.map(cat => (
                            <div
                                key={cat.id}
                                className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3 hover:border-blue-600 transition-all group"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-2xl">{cat.icon || '📋'}</span>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => openModal(cat)}
                                            className="p-1 text-blue-600 hover:bg-blue-600/10 rounded"
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => deleteCategory(cat.id)}
                                            className="p-1 text-red-600 hover:bg-red-600/10 rounded"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-[var(--fg)] truncate">{cat.name}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-[var(--muted)] text-sm">
                        No categories yet. Click "Add Category" to create one.
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)]">
                        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
                            <h3 className="text-xl font-bold text-[var(--fg)]">
                                {editingId ? 'Edit Category' : 'Add Category'}
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-[var(--muted)]" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                    Name <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g., Main Course, Raw Materials"
                                    className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                    Icon <span className="text-xs text-[var(--muted)]">(Optional)</span>
                                </label>
                                <button
                                    onClick={() => setShowIconPicker(true)}
                                    className="w-full px-4 py-3 bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg hover:border-blue-600 transition-all flex items-center justify-center gap-3"
                                >
                                    <span className="text-4xl">{form.icon}</span>
                                    <span className="text-sm text-[var(--muted)]">Click to change</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--border)] flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={save}
                                disabled={loading || !form.name.trim()}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        {editingId ? 'Update' : 'Add'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Icon Picker */}
            {showIconPicker && (
                <div style={{ zIndex: 9999 }}>
                    <IconPicker
                        selected={form.icon}
                        onSelect={icon => {
                            setForm({ ...form, icon })
                            setShowIconPicker(false)
                        }}
                        onClose={() => setShowIconPicker(false)}
                    />
                </div>
            )}
        </div>
    )
}
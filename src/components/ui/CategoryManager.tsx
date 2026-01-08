// src/components/ui/CategoryManager.tsx - FIXED NESTED BUTTON ERROR
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

    const tableName = type === 'menu' ? 'menu_categories' :
        type === 'inventory' ? 'inventory_categories' :
            'table_categories'

    const itemsTable = type === 'menu' ? 'menu_items' :
        type === 'inventory' ? 'inventory_items' :
            'restaurant_tables'

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
        setIsExpanded(true)
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
        <div className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl overflow-hidden transition-all hover:border-green-600/30">
            {/* ✅ FIXED: Changed button to div to avoid nested button error */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[var(--bg)] transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FolderPlus className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    </div>
                    <div className="text-left">
                        <h3 className="text-base sm:text-lg font-bold text-[var(--fg)] flex items-center gap-2">
                            Manage Categories
                            {categories.length > 0 && (
                                <span className="px-2 py-0.5 bg-green-600/10 text-green-600 rounded-full text-xs font-bold">
                                    {categories.length}
                                </span>
                            )}
                        </h3>
                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                            {isExpanded ? 'Click to collapse' : 'Click to expand'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* ✅ FIXED: stopPropagation to prevent parent div click */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            openModal()
                        }}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95 whitespace-nowrap shadow-lg"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add</span>
                    </button>

                    {/* Toggle Icon */}
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[var(--muted)] flex-shrink-0" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-[var(--muted)] flex-shrink-0" />
                    )}
                </div>
            </div>

            {/* Collapsible content */}
            {isExpanded && (
                <div className="p-4 sm:p-5 pt-0 border-t border-[var(--border)] animate-in slide-in-from-top-2">
                    {categories.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {categories.map(cat => (
                                <div
                                    key={cat.id}
                                    className="bg-[var(--bg)] border-2 border-[var(--border)] rounded-xl p-3 sm:p-4 hover:border-green-600 hover:shadow-lg transition-all group"
                                >
                                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                                        <span className="text-2xl sm:text-3xl">{cat.icon || '📋'}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openModal(cat)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-600/10 rounded-lg active:scale-95"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => deleteCategory(cat.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-600/10 rounded-lg active:scale-95"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm sm:text-base font-semibold text-[var(--fg)] truncate">{cat.name}</p>
                                    <p className="text-xs text-[var(--muted)] mt-1">Category</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-[var(--bg)] rounded-xl border-2 border-dashed border-[var(--border)]">
                            <div className="text-5xl mb-4">📁</div>
                            <p className="font-semibold text-[var(--fg)] mb-2">No categories yet</p>
                            <p className="text-sm text-[var(--muted)] mb-4">Create your first category to organize items</p>
                            <button
                                onClick={() => openModal()}
                                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium inline-flex items-center gap-2 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Create Category
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-[var(--card)] rounded-xl w-full max-w-md border border-[var(--border)] shadow-2xl">
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
                                    placeholder="e.g., Main Course, Raw Materials, VIP Section"
                                    autoFocus
                                    className="w-full px-4 py-3 bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-green-600 focus:border-transparent focus:outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                                    Icon <span className="text-xs text-[var(--muted)]">(Optional)</span>
                                </label>
                                <button
                                    onClick={() => setShowIconPicker(true)}
                                    className="w-full px-4 py-4 bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg hover:border-green-600 transition-all flex items-center justify-center gap-3"
                                >
                                    <span className="text-5xl">{form.icon}</span>
                                    <span className="text-sm text-[var(--muted)]">Click to change icon</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--border)] flex gap-3">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-4 py-3 bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg font-medium text-[var(--fg)] hover:bg-[var(--card)] hover:border-red-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={save}
                                disabled={loading || !form.name.trim()}
                                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        {editingId ? 'Update' : 'Create'}
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
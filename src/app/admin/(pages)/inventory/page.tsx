// src/app/admin/(pages)/inventory/page.tsx
// ✅ INVENTORY PAGE: Only shows active items (is_active = true)

'use client'

import { useState, useMemo } from 'react'
import { Plus, Download, Archive, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput, { FormGrid } from '@/components/ui/ResponsiveInput'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import CategoryManager from '@/components/ui/CategoryManager'
import { useInventoryItems, useInventoryTracking, useInventorySync, useFormManager } from '@/lib/hooks'
import { validate } from '@/lib/utils/validation'
import { createClient } from '@/lib/supabase/client'

export default function InventoryPage() {
    const router = useRouter()
    const [stockFilter, setStockFilter] = useState('all')
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [modal, setModal] = useState<any>(null)
    const [refreshKey, setRefreshKey] = useState(0)

    // ✅ Only fetch ACTIVE items (is_active = true)
    const { data: allItems, loading, refresh } = useInventoryItems()
    const items = useMemo(() => allItems.filter(item => item.is_active !== false), [allItems])

    const { data: categories } = useInventoryItems({ table: 'inventory_categories' } as any)
    const { createItem, updateItem, deleteItem, getStockStatus, getStockColor } = useInventoryTracking()
    const supabase = createClient()

    useInventorySync(refresh)

    const { values, getFieldProps, handleSubmit, reset } = useFormManager({
        initialValues: {
            name: '',
            category_id: '',
            quantity: '',
            unit: 'kg',
            reorder_level: '10',
            purchase_price: '',
            supplier_name: '',
            image_url: ''
        },
        validate: (v) => ({
            name: validate.name(v.name),
            quantity: validate.price(v.quantity),
            price: validate.price(v.purchase_price)
        }),
        onSubmit: async (v) => {
            const data = {
                name: v.name,
                category_id: v.category_id || null,
                quantity: parseFloat(v.quantity),
                unit: v.unit,
                reorder_level: parseFloat(v.reorder_level),
                purchase_price: parseFloat(v.purchase_price),
                supplier_name: v.supplier_name || null,
                image_url: v.image_url || null,
                is_active: true // ✅ Always set new items as active
            }

            let result
            if (modal?.id) {
                const oldQty = modal.quantity
                const newQty = data.quantity

                if (newQty > oldQty) {
                    const purchaseQty = newQty - oldQty
                    const purchaseAmount = purchaseQty * data.purchase_price

                    await supabase.from('inventory_purchases').insert({
                        inventory_item_id: modal.id,
                        quantity: purchaseQty,
                        unit: data.unit,
                        purchase_price: data.purchase_price,
                        total_amount: purchaseAmount,
                        supplier_name: data.supplier_name,
                        notes: `Stock update from ${oldQty} to ${newQty}`
                    })
                }

                result = await updateItem(modal.id, data)
            } else {
                result = await createItem(data)

                if (result.success) {
                    const { data: newItems } = await supabase
                        .from('inventory_items')
                        .select('id')
                        .eq('name', data.name)
                        .order('created_at', { ascending: false })
                        .limit(1)

                    if (newItems && newItems.length > 0) {
                        const purchaseAmount = data.quantity * data.purchase_price
                        await supabase.from('inventory_purchases').insert({
                            inventory_item_id: newItems[0].id,
                            quantity: data.quantity,
                            unit: data.unit,
                            purchase_price: data.purchase_price,
                            total_amount: purchaseAmount,
                            supplier_name: data.supplier_name,
                            notes: 'Initial stock'
                        })
                    }
                }
            }

            if (result.success) {
                setModal(null)
                reset()
                refresh()
            }
            return result
        }
    })

    const filtered = useMemo(() => {
        let result = items

        if (stockFilter !== 'all') {
            result = result.filter(i =>
                getStockStatus(i.quantity, i.reorder_level) === stockFilter
            )
        }

        return result
    }, [items, stockFilter, getStockStatus])

    const stats = useMemo(() => [
        {
            label: 'Critical',
            value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'critical').length,
            color: '#ef4444',
            onClick: () => setStockFilter('critical'),
            active: stockFilter === 'critical'
        },
        {
            label: 'Low Stock',
            value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'low').length,
            color: '#f59e0b',
            onClick: () => setStockFilter('low'),
            active: stockFilter === 'low'
        },
        {
            label: 'Medium',
            value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'medium').length,
            color: '#3b82f6',
            onClick: () => setStockFilter('medium'),
            active: stockFilter === 'medium'
        },
        {
            label: 'High Stock',
            value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'high').length,
            color: '#10b981',
            onClick: () => setStockFilter('high'),
            active: stockFilter === 'high'
        }
    ], [items, getStockStatus, stockFilter])

    const itemColumns = [
        {
            key: 'item',
            label: 'Item',
            render: (row: any) => (
                <div className="flex items-center gap-2">
                    {row.image_url && <img src={row.image_url} alt={row.name} className="w-10 h-10 rounded object-cover" />}
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">{row.name}</p>
                        {row.supplier_name && <p className="text-xs text-[var(--muted)]">{row.supplier_name}</p>}
                    </div>
                </div>
            )
        },
        {
            key: 'category',
            label: 'Category',
            mobileHidden: true,
            render: (row: any) => (
                <span className="text-sm text-[var(--fg)]">{row.inventory_categories?.icon || '📦'} {row.inventory_categories?.name || 'N/A'}</span>
            )
        },
        {
            key: 'stock',
            label: 'Stock',
            render: (row: any) => {
                const status = getStockStatus(row.quantity, row.reorder_level)
                const statusColor = getStockColor(status)
                return (
                    <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                        {row.quantity} {row.unit}
                    </span>
                )
            }
        },
        {
            key: 'price',
            label: 'Price',
            align: 'right' as const,
            render: (row: any) => <span className="text-sm text-[var(--fg)]">PKR {row.purchase_price.toLocaleString()}</span>
        },
        {
            key: 'value',
            label: 'Value',
            align: 'right' as const,
            render: (row: any) => <span className="font-bold text-[var(--fg)]">PKR {(row.total_value || 0).toLocaleString()}</span>
        }
    ]

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Items', icon: '📦', count: items.length },
        { id: 'critical', label: 'Critical', icon: '🔴', count: stats[0]?.value || 0 },
        { id: 'low', label: 'Low Stock', icon: '🟡', count: stats[1]?.value || 0 },
        { id: 'medium', label: 'Medium', icon: '🔵', count: stats[2]?.value || 0 },
        { id: 'high', label: 'High Stock', icon: '🟢', count: stats[3]?.value || 0 }
    ], stockFilter, setStockFilter)

    const exportCSV = () => {
        if (filtered.length === 0) return

        const headers = ['Name', 'Category', 'Quantity', 'Unit', 'Price', 'Total Value', 'Supplier']
        const rows = filtered.map(r => [
            r.name,
            r.inventory_categories?.name || 'N/A',
            r.quantity,
            r.unit,
            r.purchase_price,
            r.total_value || 0,
            r.supplier_name || 'N/A'
        ])

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-${Date.now()}.csv`
        a.click()
    }

    return (
        <ErrorBoundary>
            <>
                {/* Desktop Sidebar */}
                <div className="hidden lg:block">
                    <AutoSidebar items={sidebarItems} title="Stock Status" />
                </div>

                {/* Mobile Sidebar Overlay */}
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
                    {/* Fixed Header */}
                    <header className="sticky top-0 z-40 bg-[var(--card)]/95 border-b border-[var(--border)] backdrop-blur-lg shadow-sm">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5">
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                    <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-[var(--bg)] rounded-lg shrink-0">
                                        <Menu className="w-5 h-5 text-[var(--fg)]" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Current Inventory</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                                            {filtered.length} items • PKR {filtered.reduce((s, i) => s + (i.total_value || 0), 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => router.push('/admin/history/inventory')}
                                        className="px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-lg"
                                    >
                                        <Archive className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Archive</span>
                                    </button>
                                    <button
                                        onClick={exportCSV}
                                        className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-lg"
                                    >
                                        <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">Export</span>
                                    </button>
                                    <button
                                        onClick={() => setModal({})}
                                        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 shadow-lg"
                                    >
                                        <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="hidden xs:inline">Add</span>
                                    </button>
                                </div>
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
                                                item.active ? 'bg-blue-600 text-white shadow-lg' : 'bg-[var(--bg)] text-[var(--fg)]'
                                            }`}
                                        >
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
                        {/* Info Banner */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
                            <p className="text-xs sm:text-sm text-blue-600">
                                💡 <strong>Note:</strong> This page shows current month inventory. Click "Archive" button to move items to History when starting a new month.
                            </p>
                        </div>

                        <CategoryManager
                            type="inventory"
                            onCategoryChange={() => {
                                refresh()
                                setRefreshKey(prev => prev + 1)
                            }}
                        />

                        <ResponsiveStatsGrid stats={stats} />

                        <UniversalDataTable
                            columns={itemColumns}
                            data={filtered}
                            loading={loading}
                            searchable
                            onRowClick={setModal}
                            emptyMessage="No inventory items. Add items or check History for archived data."
                        />
                    </div>
                </div>

                <FormModal
                    open={!!modal}
                    onClose={() => setModal(null)}
                    title={modal?.id ? 'Edit Item' : 'Add Item'}
                    onSubmit={handleSubmit}
                >
                    <FormGrid>
                        <ResponsiveInput label="Item Name" {...getFieldProps('name')} required />
                        <ResponsiveInput
                            label="Category"
                            type="select"
                            {...getFieldProps('category_id')}
                            options={categories.map(c => ({ label: `${c.icon || '📦'} ${c.name}`, value: c.id }))}
                            key={refreshKey}
                        />
                        <ResponsiveInput label="Quantity" type="number" {...getFieldProps('quantity')} required />
                        <ResponsiveInput
                            label="Unit"
                            type="select"
                            {...getFieldProps('unit')}
                            options={['kg', 'gram', 'liter', 'ml', 'pieces', 'dozen'].map(u => ({ label: u, value: u }))}
                        />
                        <ResponsiveInput label="Price (PKR)" type="number" {...getFieldProps('purchase_price')} required />
                        <ResponsiveInput label="Reorder Level" type="number" {...getFieldProps('reorder_level')} />
                    </FormGrid>
                    <ResponsiveInput label="Supplier" {...getFieldProps('supplier_name')} className="mt-4" />

                    {modal?.id && (
                        <div className="mt-4 p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                            <p className="text-xs sm:text-sm text-blue-600">
                                💡 <strong>Tip:</strong> Increasing quantity will automatically log as a new purchase
                            </p>
                        </div>
                    )}

                    <div className="mt-4">
                        <CloudinaryUpload
                            value={values.image_url}
                            onChange={url => getFieldProps('image_url').onChange(url)}
                            folder="inventory-items"
                        />
                    </div>
                </FormModal>
            </>
        </ErrorBoundary>
    )
}
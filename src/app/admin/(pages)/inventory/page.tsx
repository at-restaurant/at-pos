'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import ResponsiveStatsGrid from '@/components/ui/ResponsiveStatsGrid'
import { UniversalDataTable } from '@/components/ui/UniversalDataTable'
import { FormModal } from '@/components/ui/UniversalModal'
import ResponsiveInput, { FormGrid } from '@/components/ui/ResponsiveInput'
import CloudinaryUpload from '@/components/ui/CloudinaryUpload'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useInventoryItems, useInventoryTracking, useInventorySync, useFormManager } from '@/lib/hooks'
import { validate } from '@/lib/utils/validation'

export default function InventoryPage() {
    const [stockFilter, setStockFilter] = useState('all')
    const [modal, setModal] = useState<any>(null)

    const { data: items, loading, refresh } = useInventoryItems()
    const { data: categories } = useInventoryItems({ table: 'inventory_categories' } as any)
    const { createItem, updateItem, deleteItem, getStockStatus, getStockColor } = useInventoryTracking()

    useInventorySync(refresh)

    const { values, getFieldProps, handleSubmit, reset } = useFormManager({
        initialValues: { name: '', category_id: '', quantity: '', unit: 'kg', reorder_level: '10', purchase_price: '', supplier_name: '', image_url: '' },
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
                image_url: v.image_url || null
            }

            const result = modal?.id
                ? await updateItem(modal.id, data)
                : await createItem(data)

            if (result.success) {
                setModal(null)
                reset()
                refresh()
            }
            return result
        }
    })

    const filtered = useMemo(() =>
            items.filter(i => stockFilter === 'all' || getStockStatus(i.quantity, i.reorder_level) === stockFilter)
        , [items, stockFilter, getStockStatus])

    const stats = useMemo(() => [
        { label: 'Critical', value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'critical').length, color: '#ef4444', onClick: () => setStockFilter('critical'), active: stockFilter === 'critical' },
        { label: 'Low Stock', value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'low').length, color: '#f59e0b', onClick: () => setStockFilter('low'), active: stockFilter === 'low' },
        { label: 'Medium', value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'medium').length, color: '#3b82f6', onClick: () => setStockFilter('medium'), active: stockFilter === 'medium' },
        { label: 'High Stock', value: items.filter(i => getStockStatus(i.quantity, i.reorder_level) === 'high').length, color: '#10b981', onClick: () => setStockFilter('high'), active: stockFilter === 'high' }
    ], [items, getStockStatus, stockFilter])

    const columns = [
        { key: 'item', label: 'Item', render: (row: any) => (
                <div className="flex items-center gap-2">
                    {row.image_url && <img src={row.image_url} alt={row.name} className="w-10 h-10 rounded object-cover" />}
                    <div>
                        <p className="font-medium text-[var(--fg)] text-sm">{row.name}</p>
                        {row.supplier_name && <p className="text-xs text-[var(--muted)]">{row.supplier_name}</p>}
                    </div>
                </div>
            )},
        { key: 'category', label: 'Category', mobileHidden: true, render: (row: any) => (
                <span className="text-sm text-[var(--fg)]">{row.inventory_categories?.icon || '📦'} {row.inventory_categories?.name || 'N/A'}</span>
            )},
        { key: 'stock', label: 'Stock', render: (row: any) => {
                const status = getStockStatus(row.quantity, row.reorder_level)
                const statusColor = getStockColor(status)
                return (
                    <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium" style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                    {row.quantity} {row.unit}
                </span>
                )
            }},
        { key: 'price', label: 'Price', align: 'right' as const, render: (row: any) => <span className="text-sm text-[var(--fg)]">PKR {row.purchase_price.toLocaleString()}</span> },
        { key: 'value', label: 'Value', align: 'right' as const, render: (row: any) => <span className="font-bold text-[var(--fg)]">PKR {(row.total_value || 0).toLocaleString()}</span> }
    ]

    const sidebarItems = useSidebarItems([
        { id: 'all', label: 'All Items', icon: '📦', count: items.length },
        { id: 'critical', label: 'Critical', icon: '🔴', count: stats[0].value },
        { id: 'low', label: 'Low Stock', icon: '🟡', count: stats[1].value },
        { id: 'medium', label: 'Medium', icon: '🔵', count: stats[2].value },
        { id: 'high', label: 'High Stock', icon: '🟢', count: stats[3].value }
    ], stockFilter, setStockFilter)

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Stock Status" />
                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    <header className="sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)]">
                        <div className="max-w-7xl mx-auto px-4 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-[var(--fg)]">Inventory</h1>
                                    <p className="text-sm text-[var(--muted)]">{filtered.length} items • PKR {items.reduce((s, i) => s + (i.total_value || 0), 0).toLocaleString()}</p>
                                </div>
                                <button onClick={() => setModal({})} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm">
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        <ResponsiveStatsGrid stats={stats} />
                        <UniversalDataTable columns={columns} data={filtered} loading={loading} searchable onRowClick={setModal} />
                    </div>
                </div>

                <FormModal open={!!modal} onClose={() => setModal(null)} title={modal?.id ? 'Edit Item' : 'Add Item'} onSubmit={handleSubmit}>
                    <FormGrid>
                        <ResponsiveInput label="Item Name" {...getFieldProps('name')} required />
                        <ResponsiveInput label="Category" type="select" {...getFieldProps('category_id')} options={categories.map(c => ({ label: `${c.icon || '📦'} ${c.name}`, value: c.id }))} />
                        <ResponsiveInput label="Quantity" type="number" {...getFieldProps('quantity')} required />
                        <ResponsiveInput label="Unit" type="select" {...getFieldProps('unit')} options={['kg', 'gram', 'liter', 'ml', 'pieces', 'dozen'].map(u => ({ label: u, value: u }))} />
                        <ResponsiveInput label="Price (PKR)" type="number" {...getFieldProps('purchase_price')} required />
                        <ResponsiveInput label="Reorder Level" type="number" {...getFieldProps('reorder_level')} />
                    </FormGrid>
                    <ResponsiveInput label="Supplier" {...getFieldProps('supplier_name')} className="mt-4" />
                    <div className="mt-4">
                        <CloudinaryUpload value={values.image_url} onChange={url => getFieldProps('image_url').onChange(url)} folder="inventory-items" />
                    </div>
                </FormModal>
            </>
        </ErrorBoundary>
    )
}

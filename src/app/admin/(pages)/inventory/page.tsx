// src/app/admin/(pages)/inventory/page.tsx - SIMPLIFIED WITH MONTHLY FILTER
'use client'

import { useState, useMemo } from 'react'
import { Plus, Download, Calendar } from 'lucide-react'
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
    const [stockFilter, setStockFilter] = useState('all')
    const [modal, setModal] = useState<any>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [monthFilter, setMonthFilter] = useState<string>('all') // Format: "2024-12" or "all"

    const { data: items, loading, refresh } = useInventoryItems()
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
                image_url: v.image_url || null
            }

            let result
            if (modal?.id) {
                // If updating and quantity increased, log it as a purchase
                const oldQty = modal.quantity
                const newQty = data.quantity

                if (newQty > oldQty) {
                    const purchaseQty = newQty - oldQty
                    const purchaseAmount = purchaseQty * data.purchase_price

                    // Log the purchase for history tracking
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

                // ✅ FIX: Type-safe check for result data
                if (result.success) {
                    // Get the newly created item ID from the refresh
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

    // Get available months from items
    const availableMonths = useMemo(() => {
        const months = new Set<string>()
        items.forEach(item => {
            if (item.created_at) {
                const date = new Date(item.created_at)
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                months.add(monthKey)
            }
        })
        return Array.from(months).sort().reverse()
    }, [items])

    // Filter items by month
    const filtered = useMemo(() => {
        let result = items

        // Filter by month
        if (monthFilter !== 'all') {
            result = result.filter(item => {
                if (!item.created_at) return false
                const date = new Date(item.created_at)
                const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                return itemMonth === monthFilter
            })
        }

        // Filter by stock status
        if (stockFilter !== 'all') {
            result = result.filter(i =>
                getStockStatus(i.quantity, i.reorder_level) === stockFilter
            )
        }

        return result
    }, [items, stockFilter, monthFilter, getStockStatus])

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
        },
        {
            key: 'added',
            label: 'Added',
            mobileHidden: true,
            render: (row: any) => (
                <span className="text-xs text-[var(--muted)]">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString() : 'N/A'}
                </span>
            )
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

        const headers = Object.keys(filtered[0]).join(',')
        const rows = filtered.map(r => Object.values(r).join(',')).join('\n')
        const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-${Date.now()}.csv`
        a.click()
    }

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    return (
        <ErrorBoundary>
            <>
                <AutoSidebar items={sidebarItems} title="Stock Status" />

                <div className="min-h-screen bg-[var(--bg)] lg:ml-64">
                    <header className="sticky top-0 z-20 bg-[var(--card)] border-b border-[var(--border)]">
                        <div className="max-w-7xl mx-auto px-4 py-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-2xl font-bold text-[var(--fg)]">Inventory Management</h1>
                                    <p className="text-sm text-[var(--muted)]">
                                        {filtered.length} items • PKR {filtered.reduce((s, i) => s + (i.total_value || 0), 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={exportCSV}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span className="hidden sm:inline">Export</span>
                                    </button>
                                    <button
                                        onClick={() => setModal({})}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" /> Add Item
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                        {/* Monthly Filter */}
                        <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-600/30 rounded-lg p-4">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <div className="flex-1">
                                <p className="font-semibold text-[var(--fg)]">📅 Filter by Month</p>
                                <p className="text-sm text-[var(--muted)]">View inventory items added in specific months</p>
                            </div>
                            <select
                                value={monthFilter}
                                onChange={(e) => setMonthFilter(e.target.value)}
                                className="px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                style={{
                                    colorScheme: typeof window !== 'undefined' &&
                                    document.documentElement.classList.contains('dark')
                                        ? 'dark' : 'light'
                                }}
                            >
                                <option value="all">All Months</option>
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {formatMonthLabel(month)}
                                    </option>
                                ))}
                            </select>
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
                            emptyMessage="No inventory items"
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
                            <p className="text-sm text-blue-600">
                                💡 <strong>Tip:</strong> Increasing quantity will automatically log as a new purchase in History
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
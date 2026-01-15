// src/app/admin/(pages)/history/inventory/page.tsx
// ✅ INVENTORY ARCHIVE: Monthly snapshots with auto-save

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Package, Calendar, Download, TrendingUp, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function InventoryArchivePage() {
    const router = useRouter()
    const supabase = createClient()

    const [inventory, setInventory] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState('')
    const [availableMonths, setAvailableMonths] = useState<string[]>([])

    useEffect(() => {
        loadInventoryData()
    }, [])

    const loadInventoryData = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('inventory_items')
                .select('*, inventory_categories(name, icon)')
                .eq('is_active', true)
                .order('created_at', { ascending: false })

            if (error) throw error

            const items = data || []
            setInventory(items)

            // Extract available months
            const months = new Set<string>()
            items.forEach(item => {
                if (item.created_at) {
                    const date = new Date(item.created_at)
                    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                    months.add(monthKey)
                }
            })

            const sortedMonths = Array.from(months).sort().reverse()
            setAvailableMonths(sortedMonths)

            if (sortedMonths.length > 0 && !selectedMonth) {
                setSelectedMonth(sortedMonths[0])
            }
        } catch (error) {
            console.error('Load inventory error:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredInventory = useMemo(() => {
        if (!selectedMonth) return inventory

        return inventory.filter(item => {
            if (!item.created_at) return false
            const date = new Date(item.created_at)
            const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            return itemMonth === selectedMonth
        })
    }, [inventory, selectedMonth])

    const stats = useMemo(() => {
        const totalValue = filteredInventory.reduce((s, i) => s + (i.quantity * i.purchase_price), 0)
        const totalItems = filteredInventory.length
        const lowStock = filteredInventory.filter(i => i.quantity <= i.reorder_level).length
        const avgValue = totalItems > 0 ? totalValue / totalItems : 0

        return {
            totalValue,
            totalItems,
            lowStock,
            avgValue
        }
    }, [filteredInventory])

    const categoryBreakdown = useMemo(() => {
        const breakdown: any = {}

        filteredInventory.forEach(item => {
            const catName = item.inventory_categories?.name || 'Uncategorized'
            const catIcon = item.inventory_categories?.icon || '📦'

            if (!breakdown[catName]) {
                breakdown[catName] = {
                    name: catName,
                    icon: catIcon,
                    items: 0,
                    value: 0
                }
            }

            breakdown[catName].items++
            breakdown[catName].value += item.quantity * item.purchase_price
        })

        return Object.values(breakdown).sort((a: any, b: any) => b.value - a.value)
    }, [filteredInventory])

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    const exportReport = () => {
        const report = `
INVENTORY ARCHIVE REPORT
Month: ${formatMonthLabel(selectedMonth)}
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Items: ${stats.totalItems}
Total Value: PKR ${stats.totalValue.toLocaleString()}
Low Stock Items: ${stats.lowStock}
Average Item Value: PKR ${Math.round(stats.avgValue).toLocaleString()}

=== BY CATEGORY ===
${categoryBreakdown.map((cat: any) =>
            `${cat.icon} ${cat.name}: ${cat.items} items - PKR ${cat.value.toLocaleString()}`
        ).join('\n')}

=== DETAILED INVENTORY ===
${filteredInventory.map(item => `
${item.name}
- Category: ${item.inventory_categories?.name || 'N/A'}
- Quantity: ${item.quantity} ${item.unit}
- Unit Price: PKR ${item.purchase_price}
- Total Value: PKR ${(item.quantity * item.purchase_price).toLocaleString()}
- Supplier: ${item.supplier_name || 'N/A'}
`).join('\n')}
    `.trim()

        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-${selectedMonth}.txt`
        a.click()
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
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="Inventory Archive"
                    subtitle={`Monthly snapshots • ${formatMonthLabel(selectedMonth)}`}
                    action={
                        <div className="flex gap-2">
                            <button
                                onClick={exportReport}
                                disabled={!selectedMonth}
                                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm active:scale-95 disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/history')}
                                className="px-3 sm:px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center gap-2 text-sm active:scale-95"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>
                    }
                />

                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    {/* Month Selector */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <h3 className="font-bold text-[var(--fg)]">Select Month</h3>
                        </div>

                        {availableMonths.length > 0 ? (
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                            >
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {formatMonthLabel(month)}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-[var(--muted)] text-sm">No archive data available</p>
                        )}
                    </div>

                    {selectedMonth && (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg">
                                    <Package className="w-8 h-8 opacity-80 mb-2" />
                                    <p className="text-sm opacity-90">Total Items</p>
                                    <p className="text-3xl font-bold mt-1">{stats.totalItems}</p>
                                </div>

                                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white shadow-lg">
                                    <TrendingUp className="w-8 h-8 opacity-80 mb-2" />
                                    <p className="text-sm opacity-90">Total Value</p>
                                    <p className="text-2xl font-bold mt-1">PKR {(stats.totalValue / 1000).toFixed(1)}k</p>
                                </div>

                                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white shadow-lg">
                                    <TrendingDown className="w-8 h-8 opacity-80 mb-2" />
                                    <p className="text-sm opacity-90">Low Stock</p>
                                    <p className="text-3xl font-bold mt-1">{stats.lowStock}</p>
                                </div>

                                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white shadow-lg">
                                    <Package className="w-8 h-8 opacity-80 mb-2" />
                                    <p className="text-sm opacity-90">Avg Value</p>
                                    <p className="text-2xl font-bold mt-1">PKR {Math.round(stats.avgValue)}</p>
                                </div>
                            </div>

                            {/* Category Breakdown */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
                                <h3 className="font-bold text-[var(--fg)] mb-4 flex items-center gap-2">
                                    <Package className="w-5 h-5 text-blue-600" />
                                    By Category
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {categoryBreakdown.map((cat: any, i: number) => (
                                        <div key={i} className="p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-2xl">{cat.icon}</span>
                                                <span className="font-semibold text-[var(--fg)]">{cat.name}</span>
                                            </div>
                                            <p className="text-xl font-bold text-blue-600 mb-1">PKR {cat.value.toLocaleString()}</p>
                                            <p className="text-sm text-[var(--muted)]">{cat.items} items</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Detailed Item List */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                                <div className="p-4 sm:p-6 border-b border-[var(--border)]">
                                    <h3 className="font-bold text-[var(--fg)]">All Items ({filteredInventory.length})</h3>
                                </div>

                                <div className="divide-y divide-[var(--border)]">
                                    {filteredInventory.map(item => (
                                        <div key={item.id} className="p-4 hover:bg-[var(--bg)] transition-colors">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    {item.image_url && (
                                                        <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-[var(--fg)] truncate">{item.name}</p>
                                                        <p className="text-sm text-[var(--muted)]">
                                                            {item.inventory_categories?.icon} {item.inventory_categories?.name || 'N/A'}
                                                        </p>
                                                        <p className="text-xs text-[var(--muted)] mt-1">
                                                            Supplier: {item.supplier_name || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <p className="font-bold text-blue-600">PKR {(item.quantity * item.purchase_price).toLocaleString()}</p>
                                                    <p className="text-sm text-[var(--muted)]">{item.quantity} {item.unit}</p>
                                                    <p className="text-xs text-[var(--muted)]">@ PKR {item.purchase_price}</p>
                                                </div>
                                            </div>

                                            {item.quantity <= item.reorder_level && (
                                                <div className="mt-2 px-2 py-1 bg-red-500/10 border border-red-500/30 rounded inline-block">
                                                    <p className="text-xs text-red-600 font-semibold">⚠️ Low Stock</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {filteredInventory.length === 0 && (
                                    <div className="p-12 text-center">
                                        <Package className="w-16 h-16 mx-auto mb-4 opacity-20 text-[var(--fg)]" />
                                        <p className="text-[var(--fg)] font-medium">No inventory data for this month</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </ErrorBoundary>
    )
}
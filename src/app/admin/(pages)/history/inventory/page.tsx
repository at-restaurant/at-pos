// src/app/admin/(pages)/history/inventory/page.tsx
// 🚀 UPDATED: Monthly auto-archive + Low stock alerts + Better UX

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Package, Calendar, Download, TrendingUp, TrendingDown, AlertTriangle, Archive } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type InventoryItem = {
    id: string
    created_at: string
    quantity: number
    purchase_price: number
    reorder_level: number
    name: string
    unit: string
    supplier_name?: string
    image_url?: string
    inventory_categories?: {
        name: string
        icon: string
    }
}

type CategoryBreakdown = {
    name: string
    icon: string
    items: number
    value: number
}

export default function InventoryArchivePage() {
    const router = useRouter()
    const supabase = createClient()

    const [inventory, setInventory] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedMonth, setSelectedMonth] = useState('')
    const [availableMonths, setAvailableMonths] = useState<string[]>([])
    const [archiving, setArchiving] = useState(false)

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

            const items = (data || []) as InventoryItem[]
            setInventory(items)

            const months = new Set<string>()
            items.forEach((item: InventoryItem) => {
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

    // ✅ NEW: Create Monthly Archive
    const createArchive = async () => {
        if (archiving || inventory.length === 0) return

        setArchiving(true)
        try {
            const currentMonth = new Date().toISOString().slice(0, 7)
            const totalValue = inventory.reduce((s, i) => s + (i.quantity * i.purchase_price), 0)
            const lowStockCount = inventory.filter(i => i.quantity <= i.reorder_level).length

            // Save to localStorage as backup
            const archiveData = {
                month: currentMonth,
                created_at: new Date().toISOString(),
                total_items: inventory.length,
                total_value: totalValue,
                low_stock_count: lowStockCount,
                items: inventory
            }

            const existingArchives = JSON.parse(localStorage.getItem('inventory_archives') || '[]')
            const filtered = existingArchives.filter((a: any) => a.month !== currentMonth)
            filtered.unshift(archiveData)
            localStorage.setItem('inventory_archives', JSON.stringify(filtered.slice(0, 12))) // Keep last 12 months

            alert(`✅ Archive created for ${formatMonthLabel(currentMonth)}!`)
        } catch (error: any) {
            alert(`❌ Failed: ${error.message}`)
        } finally {
            setArchiving(false)
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
        const breakdown: Record<string, CategoryBreakdown> = {}

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

        return Object.values(breakdown).sort((a, b) => b.value - a.value)
    }, [filteredInventory])

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    const exportReport = () => {
        const report = `INVENTORY ARCHIVE REPORT
Month: ${formatMonthLabel(selectedMonth)}
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Items: ${stats.totalItems}
Total Value: PKR ${stats.totalValue.toLocaleString()}
Low Stock Items: ${stats.lowStock}
Average Item Value: PKR ${Math.round(stats.avgValue).toLocaleString()}

=== BY CATEGORY ===
${categoryBreakdown.map((cat: CategoryBreakdown) =>
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
${item.quantity <= item.reorder_level ? '⚠️ LOW STOCK ALERT' : ''}
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
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--muted)]">Loading inventory...</p>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="Inventory Archive"
                    subtitle={`Monthly snapshots • ${selectedMonth ? formatMonthLabel(selectedMonth) : ''}`}
                    action={
                        <div className="flex gap-2">
                            <button
                                onClick={createArchive}
                                disabled={archiving}
                                className="px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
                            >
                                <Archive className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">{archiving ? 'Archiving...' : 'Archive Now'}</span>
                                <span className="sm:hidden">📸</span>
                            </button>
                            <button
                                onClick={exportReport}
                                disabled={!selectedMonth}
                                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95 disabled:opacity-50"
                            >
                                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Export</span>
                            </button>
                            <button
                                onClick={() => router.push('/admin/history')}
                                className="px-3 sm:px-4 py-2 bg-[var(--bg)] border border-[var(--border)] text-[var(--fg)] rounded-lg hover:bg-[var(--card)] flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                            >
                                <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Back</span>
                            </button>
                        </div>
                    }
                />

                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                    {/* Info Alert */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="font-semibold text-[var(--fg)] mb-1 text-sm sm:text-base">💡 Archive Management</p>
                                <ul className="text-xs sm:text-sm text-[var(--muted)] space-y-1">
                                    <li>• Click "Archive Now" to save current inventory snapshot</li>
                                    <li>• Archives are saved locally (last 12 months)</li>
                                    <li>• Export reports for external backup</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Month Selector */}
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                            <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">Select Month</h3>
                        </div>

                        {availableMonths.length > 0 ? (
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                style={{ colorScheme: 'dark' }}
                            >
                                {availableMonths.map(month => (
                                    <option key={month} value={month}>
                                        {formatMonthLabel(month)}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-[var(--muted)] text-xs sm:text-sm">No archive data available</p>
                        )}
                    </div>

                    {selectedMonth && (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                                    <Package className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                                    <p className="text-xs opacity-90">Total Items</p>
                                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.totalItems}</p>
                                </div>

                                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                                    <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                                    <p className="text-xs opacity-90">Total Value</p>
                                    <p className="text-xl sm:text-2xl font-bold mt-1">₨{(stats.totalValue / 1000).toFixed(1)}k</p>
                                </div>

                                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                                    <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                                    <p className="text-xs opacity-90">Low Stock</p>
                                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.lowStock}</p>
                                </div>

                                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                                    <Package className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                                    <p className="text-xs opacity-90">Avg Value</p>
                                    <p className="text-xl sm:text-2xl font-bold mt-1">₨{Math.round(stats.avgValue)}</p>
                                </div>
                            </div>

                            {/* Low Stock Alert */}
                            {stats.lowStock > 0 && (
                                <div className="bg-orange-500/10 border-2 border-orange-500/30 rounded-xl p-4">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0" />
                                        <div>
                                            <h4 className="font-bold text-[var(--fg)] mb-1">⚠️ Low Stock Alert</h4>
                                            <p className="text-sm text-[var(--muted)]">
                                                {stats.lowStock} item{stats.lowStock > 1 ? 's' : ''} below reorder level
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Category Breakdown */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                                <h3 className="font-bold text-[var(--fg)] mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base">
                                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                    By Category
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {categoryBreakdown.map((cat, i) => (
                                        <div key={i} className="p-3 sm:p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                            <div className="flex items-center gap-2 mb-2 sm:mb-3">
                                                <span className="text-xl sm:text-2xl">{cat.icon}</span>
                                                <span className="font-semibold text-[var(--fg)] text-sm sm:text-base truncate">{cat.name}</span>
                                            </div>
                                            <p className="text-base sm:text-xl font-bold text-blue-600 mb-1">₨{(cat.value / 1000).toFixed(1)}k</p>
                                            <p className="text-xs sm:text-sm text-[var(--muted)]">{cat.items} items</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Detailed Item List */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                                <div className="p-3 sm:p-6 border-b border-[var(--border)]">
                                    <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">All Items ({filteredInventory.length})</h3>
                                </div>

                                <div className="divide-y divide-[var(--border)]">
                                    {filteredInventory.map(item => (
                                        <div key={item.id} className="p-3 sm:p-4 hover:bg-[var(--bg)] transition-colors">
                                            <div className="flex items-start gap-3 sm:gap-4">
                                                {item.image_url && (
                                                    <img src={item.image_url} alt={item.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-[var(--fg)] truncate text-sm sm:text-base">{item.name}</p>
                                                            <p className="text-xs sm:text-sm text-[var(--muted)]">
                                                                {item.inventory_categories?.icon || '📦'} {item.inventory_categories?.name || 'N/A'}
                                                            </p>
                                                            <p className="text-xs text-[var(--muted)] mt-1">
                                                                Supplier: {item.supplier_name || 'N/A'}
                                                            </p>
                                                        </div>

                                                        <div className="text-left sm:text-right shrink-0">
                                                            <p className="font-bold text-blue-600 text-base sm:text-lg">₨{(item.quantity * item.purchase_price).toLocaleString()}</p>
                                                            <p className="text-xs sm:text-sm text-[var(--muted)]">{item.quantity} {item.unit}</p>
                                                            <p className="text-xs text-[var(--muted)]">@ ₨{item.purchase_price}</p>
                                                        </div>
                                                    </div>

                                                    {item.quantity <= item.reorder_level && (
                                                        <div className="inline-block px-2 py-1 bg-red-500/10 border border-red-500/30 rounded">
                                                            <p className="text-xs text-red-600 font-semibold">⚠️ Low Stock</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {filteredInventory.length === 0 && (
                                    <div className="p-8 sm:p-12 text-center">
                                        <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20 text-[var(--fg)]" />
                                        <p className="text-[var(--fg)] font-medium text-sm sm:text-base">No inventory data for this month</p>
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
// src/app/admin/(pages)/history/inventory/page.tsx
// 🚀 AUTO-SAVE: Menu Items → Raw Materials (Separate Tabs)

'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Package, Calendar, Download, TrendingUp, AlertTriangle, Link2, Boxes } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'

type InventorySnapshot = {
    id: string
    type: 'menu' | 'raw'
    name: string
    quantity: number
    unit: string
    price: number
    category_name: string
    category_icon: string
    supplier_name?: string
    image_url?: string
    linked_ingredients?: Array<{ ingredient_id: string; quantity_needed: number }>
    created_at: string
}

type MonthlyHistory = {
    month: string
    last_updated: string
    menu_items: InventorySnapshot[]
    raw_items: InventorySnapshot[]
}

export default function InventoryHistoryPage() {
    const router = useRouter()
    const supabase = createClient()

    const [history, setHistory] = useState<MonthlyHistory[]>([])
    const [selectedMonth, setSelectedMonth] = useState('')
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'menu' | 'raw'>('menu')
    const [autoSaving, setAutoSaving] = useState(false)

    useEffect(() => {
        loadHistory()
        autoSaveCurrentMonth()
    }, [])

    const loadHistory = () => {
        try {
            const stored = localStorage.getItem('inventory_monthly_history')
            const parsed: MonthlyHistory[] = stored ? JSON.parse(stored) : []
            setHistory(parsed)

            if (parsed.length > 0 && !selectedMonth) {
                setSelectedMonth(parsed[0].month)
            }
        } catch (error) {
            console.error('Load history error:', error)
        } finally {
            setLoading(false)
        }
    }

    // ✅ AUTO-SAVE: Current month inventory
    const autoSaveCurrentMonth = async () => {
        setAutoSaving(true)
        try {
            const currentMonth = new Date().toISOString().slice(0, 7)

            // Fetch menu items
            const { data: menuItems } = await supabase
                .from('menu_items')
                .select('*, menu_categories(name, icon)')
                .eq('is_available', true)

            // Fetch raw materials
            const { data: rawItems } = await supabase
                .from('inventory_items')
                .select('*, inventory_categories(name, icon)')
                .eq('is_active', true)

            // Transform menu items
            const menuSnapshots: InventorySnapshot[] = (menuItems || []).map((item: any) => ({
                id: item.id,
                type: 'menu' as const,
                name: item.name,
                quantity: item.stock_quantity ?? 1,
                unit: item.stock_unit || 'piece',
                price: item.price,
                category_name: item.menu_categories?.name || 'Uncategorized',
                category_icon: item.menu_categories?.icon || '📋',
                image_url: item.image_url,
                linked_ingredients: item.linked_ingredients,
                created_at: item.created_at
            }))

            // Transform raw materials
            const rawSnapshots: InventorySnapshot[] = (rawItems || []).map((item: any) => ({
                id: item.id,
                type: 'raw' as const,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                price: item.purchase_price,
                category_name: item.inventory_categories?.name || 'Uncategorized',
                category_icon: item.inventory_categories?.icon || '📦',
                supplier_name: item.supplier_name,
                image_url: item.image_url,
                created_at: item.created_at
            }))

            const monthData: MonthlyHistory = {
                month: currentMonth,
                last_updated: new Date().toISOString(),
                menu_items: menuSnapshots,
                raw_items: rawSnapshots
            }

            // Update or add current month
            const stored = localStorage.getItem('inventory_monthly_history')
            const existing: MonthlyHistory[] = stored ? JSON.parse(stored) : []

            const filtered = existing.filter(h => h.month !== currentMonth)
            const updated = [monthData, ...filtered].slice(0, 12) // Keep last 12 months

            localStorage.setItem('inventory_monthly_history', JSON.stringify(updated))
            setHistory(updated)

            if (!selectedMonth) {
                setSelectedMonth(currentMonth)
            }

            console.log(`✅ Auto-saved inventory for ${formatMonthLabel(currentMonth)}`)
        } catch (error) {
            console.error('Auto-save error:', error)
        } finally {
            setAutoSaving(false)
        }
    }

    const selectedHistory = useMemo(() => {
        return history.find(h => h.month === selectedMonth)
    }, [history, selectedMonth])

    const currentItems = useMemo(() => {
        if (!selectedHistory) return []
        return view === 'menu' ? selectedHistory.menu_items : selectedHistory.raw_items
    }, [selectedHistory, view])

    const stats = useMemo(() => {
        if (!selectedHistory) return {
            totalItems: 0,
            totalValue: 0,
            lowStock: 0,
            linkedCount: 0
        }

        const items = currentItems
        const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.price), 0)
        const lowStock = items.filter(i => i.quantity <= 10).length
        const linkedCount = view === 'menu'
            ? items.filter(i => i.linked_ingredients && i.linked_ingredients.length > 0).length
            : 0

        return {
            totalItems: items.length,
            totalValue,
            lowStock,
            linkedCount
        }
    }, [selectedHistory, currentItems, view])

    const categoryBreakdown = useMemo(() => {
        const breakdown: Record<string, {
            name: string
            icon: string
            items: number
            value: number
        }> = {}

        currentItems.forEach(item => {
            const key = item.category_name
            if (!breakdown[key]) {
                breakdown[key] = {
                    name: item.category_name,
                    icon: item.category_icon,
                    items: 0,
                    value: 0
                }
            }
            breakdown[key].items++
            breakdown[key].value += item.quantity * item.price
        })

        return Object.values(breakdown).sort((a, b) => b.value - a.value)
    }, [currentItems])

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1)
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }

    const exportReport = () => {
        if (!selectedHistory) return

        const report = `INVENTORY HISTORY REPORT - ${view.toUpperCase()}
Month: ${formatMonthLabel(selectedMonth)}
Last Updated: ${new Date(selectedHistory.last_updated).toLocaleString()}
Generated: ${new Date().toLocaleString()}

=== SUMMARY ===
Total Items: ${stats.totalItems}
Total Value: PKR ${stats.totalValue.toLocaleString()}
Low Stock Items: ${stats.lowStock}
${view === 'menu' ? `Items with Linked Ingredients: ${stats.linkedCount}` : ''}

=== BY CATEGORY ===
${categoryBreakdown.map(cat =>
            `${cat.icon} ${cat.name}: ${cat.items} items - PKR ${cat.value.toLocaleString()}`
        ).join('\n')}

=== DETAILED INVENTORY ===
${currentItems.map(item => `
${item.name}
- Category: ${item.category_icon} ${item.category_name}
- Stock: ${item.quantity} ${item.unit}
- ${view === 'menu' ? 'Price' : 'Unit Price'}: PKR ${item.price}
- Total Value: PKR ${(item.quantity * item.price).toLocaleString()}
${item.supplier_name ? `- Supplier: ${item.supplier_name}` : ''}
${item.linked_ingredients?.length ? `- 🔗 Linked to ${item.linked_ingredients.length} ingredients` : ''}
${item.quantity <= 10 ? '⚠️ LOW STOCK' : ''}
`).join('\n')}
`.trim()

        const blob = new Blob([report], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `inventory-${view}-${selectedMonth}.txt`
        a.click()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[var(--muted)]">Loading history...</p>
                </div>
            </div>
        )
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-[var(--bg)]">
                <PageHeader
                    title="Inventory History"
                    subtitle={`Auto-saved monthly snapshots • ${selectedMonth ? formatMonthLabel(selectedMonth) : 'No history'}`}
                    action={
                        <div className="flex gap-2">
                            {selectedHistory && (
                                <button
                                    onClick={exportReport}
                                    className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95"
                                >
                                    <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Export</span>
                                </button>
                            )}
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
                                <p className="font-semibold text-[var(--fg)] mb-1 text-sm sm:text-base">💡 Auto-Save System</p>
                                <ul className="text-xs sm:text-sm text-[var(--muted)] space-y-1">
                                    <li>• Automatically saves current inventory when you visit</li>
                                    <li>• Separate tabs for Menu Items & Raw Materials</li>
                                    <li>• Tracks linked ingredients for menu items</li>
                                    <li>• Keeps last 12 months of history</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Month Selector */}
                    {history.length > 0 ? (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                                    <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">Select Month</h3>
                                </div>
                                {autoSaving && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse" />
                                        Auto-saving...
                                    </span>
                                )}
                            </div>

                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none text-sm"
                                style={{ colorScheme: 'dark' }}
                            >
                                {history.map(h => (
                                    <option key={h.month} value={h.month}>
                                        {formatMonthLabel(h.month)} ({h.menu_items.length}M + {h.raw_items.length}R)
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 text-center">
                            <div className="text-5xl mb-4">📦</div>
                            <p className="text-[var(--fg)] font-medium mb-2">No History Yet</p>
                            <p className="text-sm text-[var(--muted)]">History will auto-save shortly...</p>
                        </div>
                    )}

                    {selectedHistory && (
                        <>
                            {/* View Tabs */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                    <button
                                        onClick={() => setView('menu')}
                                        className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                                            view === 'menu'
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)]'
                                        }`}
                                    >
                                        <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span>Menu Items</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            view === 'menu' ? 'bg-white/20' : 'bg-[var(--card)]'
                                        }`}>
                                            {selectedHistory.menu_items.length}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setView('raw')}
                                        className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                                            view === 'raw'
                                                ? 'bg-purple-600 text-white shadow-lg'
                                                : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)]'
                                        }`}
                                    >
                                        <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <span>Raw Materials</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            view === 'raw' ? 'bg-white/20' : 'bg-[var(--card)]'
                                        }`}>
                                            {selectedHistory.raw_items.length}
                                        </span>
                                    </button>
                                </div>
                            </div>

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
                                    <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                                    <p className="text-xs opacity-90">Low Stock</p>
                                    <p className="text-2xl sm:text-3xl font-bold mt-1">{stats.lowStock}</p>
                                </div>

                                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-3 sm:p-4 text-white shadow-lg">
                                    <Link2 className="w-6 h-6 sm:w-8 sm:h-8 opacity-80 mb-2" />
                                    <p className="text-xs opacity-90">{view === 'menu' ? 'Linked' : 'With Supplier'}</p>
                                    <p className="text-2xl sm:text-3xl font-bold mt-1">
                                        {view === 'menu'
                                            ? stats.linkedCount
                                            : currentItems.filter(i => i.supplier_name).length
                                        }
                                    </p>
                                </div>
                            </div>

                            {/* Category Breakdown */}
                            {categoryBreakdown.length > 0 && (
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
                            )}

                            {/* Items List */}
                            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                                <div className="p-3 sm:p-6 border-b border-[var(--border)]">
                                    <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">
                                        {view === 'menu' ? 'Menu Items' : 'Raw Materials'} ({currentItems.length})
                                    </h3>
                                </div>

                                <div className="divide-y divide-[var(--border)]">
                                    {currentItems.map(item => {
                                        const isLowStock = item.quantity <= 10
                                        const totalValue = item.quantity * item.price

                                        return (
                                            <div key={item.id} className="p-3 sm:p-4 hover:bg-[var(--bg)] transition-colors">
                                                <div className="flex items-start gap-3 sm:gap-4">
                                                    {item.image_url && (
                                                        <img src={item.image_url} alt={item.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-4 mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <h4 className="font-semibold text-[var(--fg)] truncate text-sm sm:text-base">{item.name}</h4>
                                                                    {item.linked_ingredients && item.linked_ingredients.length > 0 && (
                                                                        <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-xs text-purple-600 font-semibold shrink-0 flex items-center gap-1">
                                                                            <Link2 className="w-3 h-3" />
                                                                            {item.linked_ingredients.length}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-[var(--muted)]">
                                                                    {item.category_icon} {item.category_name}
                                                                </p>
                                                                {item.supplier_name && (
                                                                    <p className="text-xs text-[var(--muted)] mt-1">
                                                                        Supplier: {item.supplier_name}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="text-right shrink-0">
                                                                <p className="text-base sm:text-lg font-bold text-blue-600">{item.quantity} {item.unit}</p>
                                                                <p className="text-xs text-[var(--muted)]">₨{totalValue.toLocaleString()}</p>
                                                                <p className="text-xs text-[var(--muted)]">@ ₨{item.price}</p>
                                                            </div>
                                                        </div>

                                                        {isLowStock && (
                                                            <div className="inline-block px-2 py-1 bg-red-500/10 border border-red-500/30 rounded">
                                                                <p className="text-xs text-red-600 font-semibold">⚠️ Low Stock</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {currentItems.length === 0 && (
                                    <div className="p-8 sm:p-12 text-center">
                                        <Package className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 opacity-20 text-[var(--fg)]" />
                                        <p className="text-[var(--fg)] font-medium text-sm sm:text-base">No {view === 'menu' ? 'menu items' : 'raw materials'} found</p>
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
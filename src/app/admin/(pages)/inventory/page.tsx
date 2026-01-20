// src/app/admin/(pages)/inventory/page.tsx
// 🎯 SIMPLE: Menu Items Tracking + Optional Raw Materials + Search + Filters

'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Package, Plus, AlertTriangle, TrendingDown, TrendingUp, Calendar, Boxes, Search, X, Menu as MenuIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import AutoSidebar, { useSidebarItems } from '@/components/layout/AutoSidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function InventoryPage() {
    const router = useRouter()
    const supabase = createClient()
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'menu' | 'raw'>('menu')
    const [searchQuery, setSearchQuery] = useState('')
    const [stockFilter, setStockFilter] = useState('all')
    const [sidebarOpen, setSidebarOpen] = useState(false)

    const currentMonth = new Date().toISOString().slice(0, 7)

    useEffect(() => {
        loadData()
    }, [view])

    const loadData = async () => {
        setLoading(true)

        if (view === 'menu') {
            const { data } = await supabase
                .from('menu_items')
                .select('*, menu_categories(name, icon)')
                .eq('is_available', true)
                .order('name')
            setItems(data || [])
        } else {
            const { data } = await supabase
                .from('inventory_items')
                .select('*, inventory_categories(name, icon)')
                .eq('is_active', true)
                .order('name')
            setItems(data || [])
        }

        setLoading(false)
    }

    // ✅ Get stock status
    const getStockStatus = (item: any) => {
        const stock = view === 'menu' ? (item.stock_quantity ?? 999) : item.quantity
        const reorder = view === 'menu' ? 10 : (item.reorder_level || 10)

        if (stock === 999) return 'unlimited'
        if (stock === 0) return 'critical'
        if (stock <= reorder) return 'low'
        if (stock <= reorder * 2) return 'medium'
        return 'high'
    }

    // ✅ Filtered Items
    const filtered = useMemo(() => {
        let result = items

        // Search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase()
            result = result.filter(i => {
                const category = view === 'menu' ? i.menu_categories : i.inventory_categories
                return (
                    i.name.toLowerCase().includes(query) ||
                    category?.name?.toLowerCase().includes(query) ||
                    i.description?.toLowerCase().includes(query) ||
                    (view === 'raw' && i.supplier_name?.toLowerCase().includes(query))
                )
            })
        }

        // Stock filter
        if (stockFilter !== 'all') {
            result = result.filter(i => getStockStatus(i) === stockFilter)
        }

        return result
    }, [items, searchQuery, stockFilter, view])

    // ✅ Monthly Summary
    const monthlySummary = useMemo(() => {
        const startingStock = items.reduce((sum, i) => {
            const stock = view === 'menu' ? (i.stock_quantity ?? 999) : i.quantity
            const price = view === 'menu' ? i.price : i.purchase_price
            return stock === 999 ? sum : sum + (stock * price)
        }, 0)

        const estimatedUsed = startingStock * 0.3
        const remaining = startingStock - estimatedUsed

        return {
            starting: startingStock,
            used: estimatedUsed,
            remaining,
            totalItems: items.length,
            lowStock: items.filter(i => {
                const status = getStockStatus(i)
                return status === 'critical' || status === 'low'
            }).length
        }
    }, [items, view])

    // ✅ Sidebar Stats
    const sidebarStats = useMemo(() => {
        const critical = items.filter(i => getStockStatus(i) === 'critical').length
        const low = items.filter(i => getStockStatus(i) === 'low').length
        const medium = items.filter(i => getStockStatus(i) === 'medium').length
        const high = items.filter(i => getStockStatus(i) === 'high').length
        const unlimited = items.filter(i => getStockStatus(i) === 'unlimited').length

        return [
            { id: 'all', label: 'All Items', icon: '📦', count: items.length },
            { id: 'critical', label: 'Out of Stock', icon: '🔴', count: critical },
            { id: 'low', label: 'Low Stock', icon: '🟡', count: low },
            { id: 'medium', label: 'Medium', icon: '🔵', count: medium },
            { id: 'high', label: 'High Stock', icon: '🟢', count: high },
            { id: 'unlimited', label: 'Unlimited', icon: '♾️', count: unlimited }
        ]
    }, [items])

    const sidebarItems = useSidebarItems(sidebarStats, stockFilter, setStockFilter)

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
                                        <MenuIcon className="w-5 h-5 text-[var(--fg)]" />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h1 className="text-lg sm:text-2xl font-bold text-[var(--fg)] truncate">Inventory Tracker</h1>
                                        <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5">
                                            {filtered.length} of {items.length} items
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(view === 'menu' ? '/admin/menu' : '/admin/inventory/raw')}
                                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs sm:text-sm font-medium flex items-center gap-2 shrink-0"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden xs:inline">Add</span>
                                </button>
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
                                        placeholder="Search by name, category, supplier..."
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
                        {/* Toggle View */}
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 sm:p-4">
                            <div className="flex flex-wrap gap-2 sm:gap-3">
                                <button
                                    onClick={() => setView('menu')}
                                    className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                                        view === 'menu'
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)]'
                                    }`}
                                >
                                    <Package className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                                    Menu Items
                                </button>
                                <button
                                    onClick={() => setView('raw')}
                                    className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-all text-sm sm:text-base ${
                                        view === 'raw'
                                            ? 'bg-purple-600 text-white shadow-lg'
                                            : 'bg-[var(--bg)] text-[var(--fg)] border border-[var(--border)]'
                                    }`}
                                >
                                    <Boxes className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" />
                                    Raw Materials
                                </button>
                            </div>
                        </div>

                        {/* Monthly Flow Tracker */}
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl p-4 sm:p-6 text-white">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
                                <h2 className="text-lg sm:text-xl font-bold">
                                    {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h2>
                            </div>

                            {/* Visual Flow */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4">
                                    <p className="text-xs opacity-90 mb-1">Month Starting</p>
                                    <p className="text-xl sm:text-2xl font-bold">₨{(monthlySummary.starting / 1000).toFixed(1)}k</p>
                                    <p className="text-xs opacity-75 mt-1">{monthlySummary.totalItems} items</p>
                                </div>

                                <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <p className="text-xs opacity-90">Used This Month</p>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-orange-300">-₨{(monthlySummary.used / 1000).toFixed(1)}k</p>
                                    <p className="text-xs opacity-75 mt-1">~30% consumed</p>
                                </div>

                                <div className="bg-white/10 backdrop-blur rounded-lg p-3 sm:p-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <p className="text-xs opacity-90">Remaining</p>
                                    </div>
                                    <p className="text-xl sm:text-2xl font-bold text-green-300">₨{(monthlySummary.remaining / 1000).toFixed(1)}k</p>
                                    <p className="text-xs opacity-75 mt-1">Next month</p>
                                </div>
                            </div>

                            {monthlySummary.lowStock > 0 && (
                                <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-orange-500/20 rounded-lg border border-orange-300/30">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                                        <p className="text-xs sm:text-sm font-semibold">
                                            ⚠️ {monthlySummary.lowStock} items need restocking
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Items List */}
                        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                            <div className="p-3 sm:p-4 border-b border-[var(--border)]">
                                <h3 className="font-bold text-[var(--fg)] text-sm sm:text-base">
                                    {view === 'menu' ? 'Menu Items' : 'Raw Materials'} ({filtered.length})
                                </h3>
                            </div>

                            <div className="divide-y divide-[var(--border)]">
                                {filtered.map(item => {
                                    const stock = view === 'menu' ? (item.stock_quantity ?? 999) : item.quantity
                                    const price = view === 'menu' ? item.price : item.purchase_price
                                    const unit = view === 'menu' ? 'units' : item.unit
                                    const category = view === 'menu' ? item.menu_categories : item.inventory_categories
                                    const status = getStockStatus(item)
                                    const reorder = view === 'menu' ? 10 : (item.reorder_level || 10)

                                    const isLowStock = status === 'critical' || status === 'low'
                                    const totalValue = stock === 999 ? 0 : stock * price

                                    return (
                                        <div key={item.id} className="p-3 sm:p-4 hover:bg-[var(--bg)] transition-colors">
                                            <div className="flex items-start gap-3 sm:gap-4">
                                                {item.image_url && (
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.name}
                                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover shrink-0"
                                                    />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4 mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-semibold text-[var(--fg)] truncate text-sm sm:text-base">{item.name}</h4>
                                                            <p className="text-xs text-[var(--muted)]">
                                                                {category?.icon || '📦'} {category?.name || 'N/A'}
                                                            </p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-base sm:text-lg font-bold text-blue-600">
                                                                {stock === 999 ? '∞' : `${stock} ${unit}`}
                                                            </p>
                                                            {stock !== 999 && (
                                                                <p className="text-xs text-[var(--muted)]">₨{totalValue.toLocaleString()}</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isLowStock && (
                                                        <div className="inline-block px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded">
                                                            <p className="text-xs text-orange-600 font-semibold">
                                                                ⚠️ {status === 'critical' ? 'Out of stock!' : `Reorder at ${reorder} ${unit}`}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {filtered.length === 0 && (
                                <div className="p-8 sm:p-12 text-center">
                                    <div className="text-4xl sm:text-5xl mb-4">{view === 'menu' ? '🍽️' : '📦'}</div>
                                    <p className="text-[var(--fg)] font-medium mb-2 text-sm sm:text-base">
                                        {searchQuery ? 'No items match your search' : 'No items yet'}
                                    </p>
                                    <p className="text-xs sm:text-sm text-[var(--muted)]">
                                        {searchQuery ? 'Try a different search term' : `Add your first ${view === 'menu' ? 'menu item' : 'raw material'}`}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Info Card */}
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 sm:p-4">
                            <div className="flex items-start gap-3">
                                <Package className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold text-[var(--fg)] mb-1 text-xs sm:text-sm">💡 How It Works</p>
                                    <ul className="text-xs text-[var(--muted)] space-y-1">
                                        <li>• <strong>Menu Items:</strong> Main inventory (sold to customers)</li>
                                        <li>• <strong>Raw Materials:</strong> Optional - ingredients & supplies</li>
                                        <li>• <strong>Monthly:</strong> Start → Used → Remaining → Next month</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        </ErrorBoundary>
    )
}
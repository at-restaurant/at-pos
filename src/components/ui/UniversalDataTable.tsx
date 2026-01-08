'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react'

interface Column<T> {
    key: string
    label: string
    render?: (row: T) => React.ReactNode
    align?: 'left' | 'right' | 'center'
    sortable?: boolean
    mobileHidden?: boolean
}

interface Props<T> {
    columns: Column<T>[]
    data: T[]
    loading?: boolean
    emptyMessage?: string
    searchable?: boolean
    searchPlaceholder?: string
    onRowClick?: (row: T) => void
    renderMobileCard?: (row: T) => React.ReactNode
}

export function UniversalDataTable<T extends Record<string, any>>({
                                                                      columns, data, loading, emptyMessage = 'No data', searchable, searchPlaceholder = 'Search...', onRowClick, renderMobileCard
                                                                  }: Props<T>) {
    const [search, setSearch] = useState('')
    const [sortKey, setSortKey] = useState<string>('')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

    const filtered = useMemo(() => {
        if (!search) return data
        return data.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(search.toLowerCase())))
    }, [data, search])

    const sorted = useMemo(() => {
        if (!sortKey) return filtered
        return [...filtered].sort((a, b) => {
            const aVal = a?.[sortKey]
            const bVal = b?.[sortKey]

            if (aVal == null && bVal == null) return 0
            if (aVal == null) return 1
            if (bVal == null) return -1

            if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
            if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
            return 0
        })
    }, [filtered, sortKey, sortDir])

    const handleSort = (key: string) => {
        if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('asc') }
    }

    if (loading) return <div className="flex justify-center py-12"><div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

    return (
        <div className="space-y-3 sm:space-y-4">
            {searchable && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted)]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
                           className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm sm:text-base text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-blue-600" />
                </div>
            )}

            {sorted.length === 0 ? (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 sm:p-12 text-center">
                    <p className="text-sm sm:text-base text-[var(--muted)]">{emptyMessage}</p>
                </div>
            ) : (
                <>
                    {/* Mobile: Card View */}
                    <div className="block lg:hidden space-y-2 sm:space-y-3">
                        {sorted.map((row, idx) => (
                            <div key={idx} onClick={() => onRowClick?.(row)}
                                 className={`bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 sm:p-4 ${onRowClick ? 'cursor-pointer active:scale-98 hover:border-blue-600' : ''} transition-all`}>
                                {renderMobileCard ? renderMobileCard(row) : (
                                    <div className="space-y-2">
                                        {columns.filter(col => !col.mobileHidden).map(col => (
                                            <div key={col.key} className="flex justify-between items-start gap-3">
                                                <span className="text-xs font-medium text-[var(--muted)] uppercase">{col.label}</span>
                                                <div className="text-sm text-[var(--fg)] text-right">{col.render
                                                    ? col.render(row)
                                                    : row?.[col.key] !== undefined
                                                        ? row[col.key]
                                                        : '—'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop: Table View */}
                    <div className="hidden lg:block bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                                    {columns.map(col => (
                                        <th key={col.key} className={`px-4 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider text-${col.align || 'left'}`}>
                                            {col.sortable ? (
                                                <button onClick={() => handleSort(col.key)} className="flex items-center gap-2 hover:text-[var(--fg)] transition-colors">
                                                    {col.label}
                                                    {sortKey === col.key ? (sortDir === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-30" />}
                                                </button>
                                            ) : col.label}
                                        </th>
                                    ))}
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border)]">
                                {sorted.map((row, idx) => (
                                    <tr key={idx} onClick={() => onRowClick?.(row)}
                                        className={`hover:bg-[var(--bg)] transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}>
                                        {columns.map(col => (
                                            <td key={col.key} className={`px-4 py-4 text-${col.align || 'left'}`}>
                                                {col.render ? col.render(row) : row[col.key]}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
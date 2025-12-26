// src/features/reports/ReportFilters.tsx
'use client'

import { Download } from 'lucide-react'

type DateRange = 'today' | 'week' | 'month' | 'year'

interface ReportFiltersProps {
    dateRange: DateRange
    onDateRangeChange: (range: DateRange) => void
    onExport: () => void
}

export default function ReportFilters({ dateRange, onDateRangeChange, onExport }: ReportFiltersProps) {
    return (
        <div className="flex gap-2">
            <select
                value={dateRange}
                onChange={(e) => onDateRangeChange(e.target.value as DateRange)}
                className="px-2 sm:px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-xs sm:text-sm text-[var(--fg)]"
            >
                <option value="today">Today</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
            </select>

            <button
                onClick={onExport}
                className="px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-xs sm:text-sm active:scale-95"
            >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">CSV</span>
            </button>
        </div>
    )
}
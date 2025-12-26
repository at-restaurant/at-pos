// src/features/reports/ComparisonBanner.tsx
'use client'

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

interface ComparisonBannerProps {
    comparison: {
        change: number
        trend: 'up' | 'down' | 'neutral'
    }
}

export default function ComparisonBanner({ comparison }: ComparisonBannerProps) {
    const colors = {
        up: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-600', text: 'text-green-600' },
        down: { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-600', text: 'text-red-600' },
        neutral: { bg: 'bg-gray-50 dark:bg-gray-900/20', border: 'border-gray-600', text: 'text-gray-600' }
    }

    const icons = {
        up: ArrowUp,
        down: ArrowDown,
        neutral: Minus
    }

    const Icon = icons[comparison.trend]
    const style = colors[comparison.trend]

    return (
        <div className={`p-3 sm:p-4 rounded-lg border-2 ${style.bg} ${style.border}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${style.text}`} />
                    <div>
                        <p className="text-xs sm:text-sm font-medium text-[var(--muted)]">vs Previous Period</p>
                        <p className={`text-xl sm:text-2xl font-bold ${style.text}`}>
                            {comparison.change.toFixed(1)}%
                        </p>
                    </div>
                </div>
                <div className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm sm:text-base ${style.bg} ${style.text}`}>
                    {comparison.trend === 'up' ? '↑' : comparison.trend === 'down' ? '↓' : '→'}
                </div>
            </div>
        </div>
    )
}
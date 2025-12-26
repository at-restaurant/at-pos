'use client'

import { LucideIcon } from 'lucide-react'
import React, { ReactElement } from 'react'

interface StatCard {
    label: string
    value: string | number
    icon?: string | LucideIcon | ReactElement // ✅ Support JSX elements
    color?: string
    trend?: number
    subtext?: string
    onClick?: () => void
    active?: boolean
}

export default function ResponsiveStatsGrid({ stats }: { stats: StatCard[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4">
            {stats.map((stat, idx) => {
                // ✅ FIX: Properly handle all icon types
                const renderIcon = () => {
                    if (!stat.icon) return null

                    // If it's already a React element, return it directly
                    if (React.isValidElement(stat.icon)) {
                        return stat.icon
                    }

                    // If it's a Lucide icon component, render it
                    if (typeof stat.icon === 'function') {
                        const IconComp = stat.icon as LucideIcon
                        return <IconComp className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: stat.color || '#3b82f6' }} />
                    }

                    // If it's an emoji string
                    if (typeof stat.icon === 'string') {
                        return <span className="text-2xl">{stat.icon}</span>
                    }

                    return null
                }

                const displayValue = stat.value !== undefined && stat.value !== null
                    ? (typeof stat.value === 'number' && isNaN(stat.value) ? '0' : String(stat.value))
                    : '0'

                return (
                    <button
                        key={idx}
                        onClick={stat.onClick}
                        disabled={!stat.onClick}
                        className={`p-3 sm:p-4 lg:p-5 rounded-lg border transition-all text-left active:scale-95 ${
                            stat.active
                                ? 'bg-blue-600/10 border-blue-600 shadow-lg'
                                : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--fg)]'
                        } ${stat.onClick ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                        {stat.icon && <div className="mb-2 sm:mb-3">{renderIcon()}</div>}
                        <p className="text-xs sm:text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1.5 sm:mb-2 line-clamp-1">
                            {stat.label}
                        </p>
                        <div className="flex items-end justify-between gap-2">
                            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-[var(--fg)] truncate">
                                {displayValue}
                            </p>
                            {stat.trend !== undefined && !isNaN(stat.trend) && (
                                <span className={`text-xs font-semibold px-1.5 sm:px-2 py-0.5 rounded ${
                                    stat.trend > 0
                                        ? 'bg-green-500/20 text-green-600'
                                        : 'bg-red-500/20 text-red-600'
                                }`}>
                                    {stat.trend > 0 ? '↑' : '↓'} {Math.abs(stat.trend).toFixed(1)}%
                                </span>
                            )}
                        </div>
                        {stat.subtext && (
                            <p className="text-xs text-[var(--muted)] mt-1.5 sm:mt-2 line-clamp-1">
                                {stat.subtext}
                            </p>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
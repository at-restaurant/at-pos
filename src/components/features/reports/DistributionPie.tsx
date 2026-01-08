// src/features/reports/DistributionPie.tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

interface DistributionPieProps {
    data: Array<{ name: string; [key: string]: any }>
    dataKey: string
    title: string
}

export default function DistributionPie({ data, dataKey, title }: DistributionPieProps) {
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload?.[0]) {
            return (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium text-[var(--fg)]">{payload[0].name}</p>
                    <p className="text-xs text-[var(--fg)]">
                        {typeof payload[0].value === 'number'
                            ? payload[0].value.toLocaleString()
                            : payload[0].value}
                    </p>
                </div>
            )
        }
        return null
    }

    return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
            <h3 className="font-bold text-[var(--fg)] mb-4 text-sm sm:text-base">{title}</h3>
            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie
                        data={data.slice(0, 6)}
                        cx="50%"
                        cy="50%"
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey={dataKey}
                    >
                        {data.slice(0, 6).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        wrapperStyle={{ fontSize: '10px' }}
                        iconSize={8}
                        formatter={(value, entry: any) => {
                            const val = entry.payload[dataKey] || 0
                            const tot = data.slice(0, 6).reduce((s, d) => s + (d[dataKey] || 0), 0)
                            const pct = tot > 0 ? ((val / tot) * 100).toFixed(0) : 0
                            return `${value.substring(0, 12)} (${pct}%)`
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
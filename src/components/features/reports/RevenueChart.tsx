// src/features/reports/RevenueChart.tsx
'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3 } from 'lucide-react'

interface RevenueChartProps {
    data: Array<{ name: string; revenue?: number; orders?: number; quantity?: number; amount?: number; value?: number }>
    dataKey: string
    title: string
}

export default function RevenueChart({ data, dataKey, title }: RevenueChartProps) {
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload?.[0]) {
            return (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 shadow-lg">
                    <p className="text-sm font-medium text-[var(--fg)]">{payload[0].name}</p>
                    <p className="text-xs text-[var(--fg)]">
                        {payload[0].dataKey}: {typeof payload[0].value === 'number'
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
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base sm:text-lg font-bold text-[var(--fg)]">{title}</h3>
            </div>

            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                        dataKey="name"
                        stroke="var(--muted)"
                        tick={{ fill: 'var(--fg)', fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                        interval={0}
                    />
                    <YAxis stroke="var(--muted)" tick={{ fill: 'var(--fg)', fontSize: 10 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey={dataKey} fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
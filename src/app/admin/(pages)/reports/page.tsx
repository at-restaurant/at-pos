// src/app/admin/(pages)/reports/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, DollarSign, ShoppingCart, Users, Package, Activity, BarChart3, PieChart } from 'lucide-react'
import ResponsiveStatsGrid from '@/components/ResponsiveStatsGrid'
import { PageHeader } from '@/components/PageHeader'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import Link from 'next/link'

export default function ReportsPage() {
    const [stats, setStats] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const { data: orders, error } = await supabase
                .from('orders')
                .select('total_amount, tax')
                .eq('status', 'completed')

            if (error) throw error

            const totalOrders = orders.length
            const totalRevenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0)
            const estimatedCost = totalRevenue * 0.7
            const grossProfit = totalRevenue - estimatedCost
            const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

            setStats([
                { label: 'Total Orders', value: totalOrders, color: '#3b82f6', icon: <ShoppingCart className="w-6 h-6" /> },
                { label: 'Revenue', value: `PKR ${totalRevenue.toLocaleString()}`, color: '#10b981', icon: <DollarSign className="w-6 h-6" /> },
                { label: 'Gross Profit', value: `PKR ${Math.round(grossProfit).toLocaleString()}`, color: '#8b5cf6', icon: <TrendingUp className="w-6 h-6" /> },
                { label: 'Profit Margin', value: `${profitMargin.toFixed(1)}%`, color: '#f59e0b', icon: <BarChart3 className="w-6 h-6" /> }
            ])
        } catch (error) {
            console.error('Error loading data:', error)
            setStats([])
        }
        setLoading(false)
    }

    return (
        <ErrorBoundary>
            <div className="lg:ml-64">
                <PageHeader
                    title="Reports"
                    subtitle="High-level overview of your business"
                    action={
                        <Link href="/admin/reports/history">
                            <a className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                View History
                            </a>
                        </Link>
                    }
                />
                <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                    <ResponsiveStatsGrid stats={stats} />
                </div>
            </div>
        </ErrorBoundary>
    )
}
// src/lib/hooks/useDataLoader.ts - FIXED
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LoaderOptions<T> {
    table: string
    select?: string
    filter?: Record<string, any>
    order?: { column: string; ascending?: boolean }
    limit?: number
    transform?: (data: any[]) => T[]
}

export function useDataLoader<T = any>(options: LoaderOptions<T>) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            let query = supabase
                .from(options.table)
                .select(options.select || '*')

            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        query = query.eq(key, value)
                    }
                })
            }

            if (options.order) {
                query = query.order(options.order.column, {
                    ascending: options.order.ascending ?? true
                })
            }

            if (options.limit) {
                query = query.limit(options.limit)
            }

            const { data: result, error: err } = await query

            if (err) throw err

            const finalData = options.transform && result
                ? options.transform(result)
                : (result as T[] || [])

            setData(finalData)
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to load data'
            setError(errorMsg)
            console.error(`Error loading ${options.table}:`, err)
            setData([])
        } finally {
            setLoading(false)
        }
    }, [options.table, JSON.stringify(options.filter), JSON.stringify(options.order)])

    useEffect(() => {
        load()
    }, [load])

    return { data, loading, error, refresh: load }
}

export function useInventoryItems(filter?: Record<string, any>) {
    return useDataLoader({
        table: 'inventory_items',
        select: '*, inventory_categories(name, icon)',
        filter: filter || { is_active: true },
        order: { column: 'created_at', ascending: false },
        transform: (items) => items.map(item => ({
            ...item,
            total_value: (Number(item.quantity) || 0) * (Number(item.purchase_price) || 0)
        }))
    })
}

export function useOrders(filter?: Record<string, any>) {
    return useDataLoader({
        table: 'orders',
        select: `
            *,
            restaurant_tables!orders_table_id_fkey(id, table_number),
            waiters(id, name),
            order_items(*, menu_items(name, price, category_id))
        `,
        filter,
        order: { column: 'created_at', ascending: false }
    })
}

export function useTables() {
    return useDataLoader({
        table: 'restaurant_tables',
        select: '*',
        order: { column: 'table_number' }
    })
}

export function useWaiters(filter?: Record<string, any>) {
    return useDataLoader({
        table: 'waiters',
        select: '*',
        filter: filter || { is_active: true },
        order: { column: 'name' }
    })
}

export function useMenuItems(filter?: Record<string, any>) {
    return useDataLoader({
        table: 'menu_items',
        select: '*, menu_categories(name, icon)',
        filter: filter || { is_available: true },
        order: { column: 'created_at', ascending: false }
    })
}
// src/lib/hooks/useDataLoader.ts - DEXIE VERSION
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/dexie'

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
            // Try Dexie first for supported tables
            const dexieTables = ['menu_items', 'menu_categories', 'restaurant_tables', 'waiters', 'orders']

            if (dexieTables.includes(options.table)) {
                let dexieData: any[] = []

                switch (options.table) {
                    case 'menu_items':
                        dexieData = await db.menu_items.toArray()
                        break
                    case 'menu_categories':
                        dexieData = await db.menu_categories.toArray()
                        break
                    case 'restaurant_tables':
                        dexieData = await db.restaurant_tables.toArray()
                        break
                    case 'waiters':
                        dexieData = await db.waiters.toArray()
                        break
                    case 'orders':
                        dexieData = await db.orders.toArray()
                        break
                }

                // Apply filters
                if (options.filter && dexieData.length > 0) {
                    dexieData = dexieData.filter(item =>
                        Object.entries(options.filter!).every(([key, value]) =>
                            (item as any)[key] === value
                        )
                    )
                }

                // Apply sorting
                if (options.order && dexieData.length > 0) {
                    dexieData.sort((a, b) => {
                        const aVal = (a as any)[options.order!.column]
                        const bVal = (b as any)[options.order!.column]
                        const direction = options.order!.ascending ?? true ? 1 : -1

                        if (aVal < bVal) return -direction
                        if (aVal > bVal) return direction
                        return 0
                    })
                }

                if (dexieData.length > 0) {
                    const finalData = options.transform
                        ? options.transform(dexieData)
                        : (dexieData as T[])

                    setData(finalData)
                }
            }

            // Try online update (background)
            if (navigator.onLine) {
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

                if (!err && result) {
                    const finalData = options.transform && result
                        ? options.transform(result)
                        : (result as T[] || [])

                    setData(finalData)
                }
            }
        } catch (err: any) {
            const errorMsg = err.message || 'Failed to load data'
            setError(errorMsg)
            console.error(`Error loading ${options.table}:`, err)
        } finally {
            setLoading(false)
        }
    }, [options.table, JSON.stringify(options.filter), JSON.stringify(options.order)])

    useEffect(() => {
        load()
    }, [load])

    return { data, loading, error, refresh: load }
}
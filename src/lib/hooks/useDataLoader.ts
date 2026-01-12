// src/lib/hooks/useDataLoader.ts - WITH OFFLINE FALLBACK
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { offlineManager } from '@/lib/db/offlineManager'
import { STORES } from '@/lib/db/schema'

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

    const getStoreName = (tableName: string) => {
        const map: Record<string, string> = {
            'restaurant_tables': 'restaurant_tables',
            'waiters': 'waiters',
            'menu_items': STORES.MENU_ITEMS,
            'menu_categories': STORES.MENU_CATEGORIES,
            'orders': STORES.ORDERS
        }
        return map[tableName] || tableName
    }

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            // ✅ Try offline first
            const storeName = getStoreName(options.table)
            let offlineData = await offlineManager.getOfflineData(storeName)

            if (Array.isArray(offlineData) && offlineData.length > 0) {
                // Apply filters
                if (options.filter) {
                    offlineData = offlineData.filter(item =>
                        Object.entries(options.filter!).every(([key, value]) =>
                            (item as any)[key] === value
                        )
                    )
                }

                // Apply sorting
                if (options.order) {
                    offlineData.sort((a, b) => {
                        const aVal = (a as any)[options.order!.column]
                        const bVal = (b as any)[options.order!.column]
                        const direction = options.order!.ascending ?? true ? 1 : -1

                        if (aVal < bVal) return -direction
                        if (aVal > bVal) return direction
                        return 0
                    })
                }

                // Apply transform
                const finalData = options.transform
                    ? options.transform(offlineData)
                    : (offlineData as T[])

                setData(finalData)
            }

            // ✅ Try online update (background)
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

                if (err) throw err

                const finalData = options.transform && result
                    ? options.transform(result)
                    : (result as T[] || [])

                setData(finalData)
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
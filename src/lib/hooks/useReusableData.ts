// src/lib/hooks/useReusableData.ts - FIXED sortBy issue
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/db/dexie'

type TableName = 'menu_items' | 'menu_categories' | 'orders' | 'order_items' |
    'restaurant_tables' | 'waiters' | 'waiter_shifts'

interface UseDataOptions {
    table: TableName
    filter?: Record<string, any>
    orderBy?: string
    relations?: string[]
    refreshInterval?: number
}

export function useReusableData<T = any>(options: UseDataOptions) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [isOnline, setIsOnline] = useState(true)

    const supabase = createClient()

    const load = useCallback(async () => {
        try {
            // 1️⃣ Load from Dexie (instant)
            let dexieQuery = (db as any)[options.table]

            // ✅ FIX: Apply filter first, then convert to array
            if (options.filter) {
                const [key, value] = Object.entries(options.filter)[0]
                dexieQuery = dexieQuery.where(key).equals(value)
            }

            // ✅ FIX: Always convert to array first
            let dexieData = await dexieQuery.toArray()

            // ✅ FIX: Sort in JavaScript if needed
            if (options.orderBy && dexieData.length > 0) {
                dexieData = dexieData.sort((a: any, b: any) => {
                    const aVal = a[options.orderBy!]
                    const bVal = b[options.orderBy!]

                    // Handle different types
                    if (typeof aVal === 'string' && typeof bVal === 'string') {
                        return aVal.localeCompare(bVal)
                    }
                    if (typeof aVal === 'number' && typeof bVal === 'number') {
                        return aVal - bVal
                    }
                    return 0
                })
            }

            if (dexieData.length > 0) {
                setData(dexieData)
                setLoading(false)
            }

            // 2️⃣ Sync with Supabase (background)
            if (navigator.onLine) {
                let query = supabase.from(options.table).select(
                    options.relations ? `*, ${options.relations.join(', ')}` : '*'
                )

                if (options.filter) {
                    Object.entries(options.filter).forEach(([key, val]) => {
                        query = query.eq(key, val)
                    })
                }

                if (options.orderBy) {
                    query = query.order(options.orderBy)
                }

                const { data: onlineData } = await query

                if (onlineData && onlineData.length > 0) {
                    await (db as any)[options.table].bulkPut(onlineData)
                    setData(onlineData as T[])
                }
            }
        } catch (error) {
            console.error(`Load ${options.table} error:`, error)
        } finally {
            setLoading(false)
        }
    }, [options.table, JSON.stringify(options.filter), options.orderBy])

    useEffect(() => {
        setIsOnline(navigator.onLine)
        load()

        const interval = options.refreshInterval
            ? setInterval(load, options.refreshInterval)
            : null

        const handleOnline = () => {
            setIsOnline(true)
            load()
        }
        const handleOffline = () => setIsOnline(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            if (interval) clearInterval(interval)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [load, options.refreshInterval])

    return { data, loading, isOnline, refresh: load }
}

// ✅ Specialized hooks (Built on reusable hook)
export const useMenuItems = (categoryId?: string) =>
    useReusableData({
        table: 'menu_items',
        filter: categoryId ? { category_id: categoryId, is_available: true } : { is_available: true },
        orderBy: 'name',
        refreshInterval: 10000
    })

export const useMenuCategories = () =>
    useReusableData({
        table: 'menu_categories',
        filter: { is_active: true },
        orderBy: 'display_order',
        refreshInterval: 30000
    })

export const useTables = () =>
    useReusableData({
        table: 'restaurant_tables',
        orderBy: 'table_number',
        refreshInterval: 5000
    })

export const useWaiters = () =>
    useReusableData({
        table: 'waiters',
        filter: { is_active: true },
        orderBy: 'name',
        refreshInterval: 30000
    })

export const useOrders = (status?: string) =>
    useReusableData({
        table: 'orders',
        filter: status ? { status } : undefined,
        orderBy: 'created_at',
        refreshInterval: 5000
    })
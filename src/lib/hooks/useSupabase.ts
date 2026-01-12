// src/lib/hooks/useSupabase.ts - OFFLINE FIRST HOOK
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { offlineManager } from '@/lib/db/offlineManager'
import { STORES } from '@/lib/db/schema'

function ensureArray<T>(data: any): T[] {
    if (Array.isArray(data)) return data
    if (data === null || data === undefined) return []
    if (typeof data === 'object' && 'data' in data && Array.isArray(data.data)) return data.data
    return []
}

export function useSupabase<T = any>(
    table: string,
    options?: {
        select?: string
        filter?: Record<string, any>
        order?: { column: string; ascending?: boolean }
        realtime?: boolean
    }
) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isOffline, setIsOffline] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const supabase = createClient()

    const getStoreName = (tableName: string) => {
        const map: Record<string, string> = {
            'menu_items': STORES.MENU_ITEMS,
            'menu_categories': STORES.MENU_CATEGORIES,
            'restaurant_tables': 'restaurant_tables',
            'waiters': 'waiters'
        }
        return map[tableName] || tableName
    }

    const load = async () => {
        if (typeof window === 'undefined') return

        setLoading(true)
        setError(null)

        try {
            // ✅ STEP 1: Always load from IndexedDB first (instant)
            const storeName = getStoreName(table)
            let offlineData = await offlineManager.getOfflineData(storeName)
            offlineData = ensureArray<T>(offlineData)

            // Apply filters
            if (options?.filter && offlineData.length > 0) {
                offlineData = offlineData.filter(item =>
                    Object.entries(options.filter!).every(([key, value]) =>
                        (item as any)[key] === value
                    )
                )
            }

            // Apply sorting
            if (options?.order && offlineData.length > 0) {
                offlineData.sort((a, b) => {
                    const aVal = (a as any)[options.order!.column]
                    const bVal = (b as any)[options.order!.column]
                    const direction = options.order!.ascending ?? true ? 1 : -1

                    if (aVal < bVal) return -direction
                    if (aVal > bVal) return direction
                    return 0
                })
            }

            // ✅ Show offline data immediately
            if (offlineData.length > 0) {
                setData(offlineData)
                setIsOffline(true)
            }

            // ✅ STEP 2: Try to update from online (background)
            if (navigator.onLine) {
                try {
                    let query = supabase.from(table).select(options?.select || '*')

                    if (options?.filter) {
                        Object.entries(options.filter).forEach(([key, value]) => {
                            query = query.eq(key, value)
                        })
                    }

                    if (options?.order) {
                        query = query.order(options.order.column, {
                            ascending: options.order.ascending ?? true
                        })
                    }

                    const { data: result, error: err } = await query

                    if (!err && result) {
                        const validData = ensureArray<T>(result)

                        // Only update if we got data
                        if (validData.length > 0) {
                            setData(validData)
                            setIsOffline(false)
                        }
                    }
                } catch (onlineError) {
                    // Keep offline data, don't throw error
                    console.log('Using cached data for:', table)
                }
            }

        } catch (err: any) {
            console.error('Data load failed:', err)
            setError('Failed to load data')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        setIsMounted(true)
        setIsOffline(!navigator.onLine)

        load()

        const handleOnline = () => {
            setIsOffline(false)
            load()
        }
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        let channel: any
        if (options?.realtime && navigator.onLine) {
            channel = supabase
                .channel(`${table}_changes`)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table
                }, load)
                .subscribe()
        }

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            if (channel) supabase.removeChannel(channel)
        }
    }, [table, JSON.stringify(options)])

    const insert = async (values: Partial<T>) => {
        const { error } = await supabase.from(table).insert(values)
        if (!error) load()
        return { error }
    }

    const update = async (id: string, values: Partial<T>) => {
        const { error } = await supabase.from(table).update(values).eq('id', id)
        if (!error) load()
        return { error }
    }

    const remove = async (id: string) => {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (!error) load()
        return { error }
    }

    return {
        data,
        loading,
        error,
        isOffline,
        isMounted,
        refresh: load,
        insert,
        update,
        remove
    }
}
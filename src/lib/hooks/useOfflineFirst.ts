// src/lib/hooks/useOfflineFirst.ts
// ✅ TRUE OFFLINE-FIRST HOOK - Loads from IndexedDB first, syncs in background

'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/client'

interface UseOfflineFirstOptions {
    store: string // IndexedDB store name
    table: string // Supabase table name
    filter?: Record<string, any>
    order?: { column: string; ascending?: boolean }
    autoSync?: boolean // Auto-sync in background
}

export function useOfflineFirst<T = any>(options: UseOfflineFirstOptions) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [isOffline, setIsOffline] = useState(false)
    const supabase = createClient()

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: Load from IndexedDB FIRST (instant)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const loadFromCache = useCallback(async () => {
        try {
            let cachedData: any[] = []

            // Handle special cases (tables/waiters stored differently)
            if (options.store === 'restaurant_tables' || options.store === 'waiters') {
                const cached = await db.get(STORES.SETTINGS, options.store)
                cachedData = cached && (cached as any).value ? (cached as any).value : []
            } else {
                cachedData = await db.getAll(options.store) as any[]
            }

            // Apply filters
            if (options.filter && Array.isArray(cachedData)) {
                cachedData = cachedData.filter(item =>
                    Object.entries(options.filter!).every(([key, value]) =>
                        (item as any)[key] === value
                    )
                )
            }

            // Apply sorting
            if (options.order && Array.isArray(cachedData)) {
                cachedData.sort((a, b) => {
                    const aVal = (a as any)[options.order!.column]
                    const bVal = (b as any)[options.order!.column]
                    const direction = options.order!.ascending !== false ? 1 : -1

                    if (aVal < bVal) return -direction
                    if (aVal > bVal) return direction
                    return 0
                })
            }

            setData(cachedData as T[])
            setLoading(false)

            console.log(`✅ Loaded ${cachedData.length} items from cache:`, options.store)
        } catch (error) {
            console.error('Cache load failed:', error)
            setData([])
            setLoading(false)
        }
    }, [options.store, options.table, JSON.stringify(options.filter), JSON.stringify(options.order)])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: Sync from Supabase in BACKGROUND (if online)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const syncFromSupabase = useCallback(async () => {
        if (!navigator.onLine) {
            setIsOffline(true)
            return
        }

        setSyncing(true)
        try {
            let query = supabase.from(options.table).select('*')

            // Apply filters
            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    query = query.eq(key, value)
                })
            }

            // Apply sorting
            if (options.order) {
                query = query.order(options.order.column, {
                    ascending: options.order.ascending !== false
                })
            }

            const { data: freshData, error } = await query

            if (error) throw error

            if (freshData && freshData.length > 0) {
                // Update cache
                if (options.store === 'restaurant_tables' || options.store === 'waiters') {
                    await db.put(STORES.SETTINGS, {
                        key: options.store,
                        value: freshData
                    })
                } else {
                    await db.clear(options.store)
                    await db.bulkPut(options.store, freshData)
                }

                // Update state
                setData(freshData as T[])

                console.log(`✅ Synced ${freshData.length} items from Supabase:`, options.table)
            }

            setIsOffline(false)
        } catch (error) {
            console.error('Sync failed:', error)
            setIsOffline(true)
        } finally {
            setSyncing(false)
        }
    }, [options.table, options.store, JSON.stringify(options.filter), JSON.stringify(options.order)])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: Initial load + Auto-sync setup
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    useEffect(() => {
        // Load cache IMMEDIATELY
        loadFromCache()

        // Then sync in background (if online)
        if (options.autoSync !== false) {
            syncFromSupabase()
        }

        // Setup network listeners
        const handleOnline = () => {
            setIsOffline(false)
            syncFromSupabase()
        }
        const handleOffline = () => setIsOffline(true)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)

        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [loadFromCache, syncFromSupabase])

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Manual refresh
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const refresh = useCallback(async () => {
        await loadFromCache()
        if (navigator.onLine) {
            await syncFromSupabase()
        }
    }, [loadFromCache, syncFromSupabase])

    return {
        data,
        loading,
        syncing,
        isOffline,
        refresh
    }
}
// src/lib/hooks/useRealtimeSync.ts
import { useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

interface RealtimeOptions {
    table: string
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*'
    filter?: { column: string; value: any }
    onInsert?: (payload: any) => void
    onUpdate?: (payload: any) => void
    onDelete?: (payload: any) => void
    onChange?: (payload: any) => void
}

export function useRealtimeSync(options: RealtimeOptions) {
    const supabase = createClient()

    useEffect(() => {
        let channel: RealtimeChannel

        const subscribe = async () => {
            const channelName = `${options.table}_${Date.now()}`

            channel = supabase.channel(channelName)

            // Build filter
            let filterConfig: any = {
                event: options.event || '*',
                schema: 'public',
                table: options.table
            }

            if (options.filter) {
                filterConfig.filter = `${options.filter.column}=eq.${options.filter.value}`
            }

            // Subscribe to changes
            channel
                .on('postgres_changes', filterConfig, (payload) => {
                    // Call specific handlers
                    if (payload.eventType === 'INSERT' && options.onInsert) {
                        options.onInsert(payload.new)
                    } else if (payload.eventType === 'UPDATE' && options.onUpdate) {
                        options.onUpdate(payload.new)
                    } else if (payload.eventType === 'DELETE' && options.onDelete) {
                        options.onDelete(payload.old)
                    }

                    // Call generic handler
                    if (options.onChange) {
                        options.onChange(payload)
                    }
                })
                .subscribe()
        }

        subscribe()

        return () => {
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [options.table, options.event, options.filter?.column, options.filter?.value])
}

// ✅ Specialized hooks for common use cases

export function useOrdersSync(onUpdate?: () => void) {
    useRealtimeSync({
        table: 'orders',
        onChange: onUpdate
    })
}

export function useTablesSync(onUpdate?: () => void) {
    useRealtimeSync({
        table: 'restaurant_tables',
        onChange: onUpdate
    })
}

export function useInventorySync(onUpdate?: () => void) {
    useRealtimeSync({
        table: 'inventory_items',
        onChange: onUpdate
    })
}

export function useWaitersSync(onUpdate?: () => void) {
    useRealtimeSync({
        table: 'waiters',
        onChange: onUpdate
    })
}
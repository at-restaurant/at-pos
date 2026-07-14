'use client'
import { useState, useEffect } from 'react'
import { useNetworkStatus } from './useNetworkStatus'
import { realtimeSync } from '@/lib/db/realtimeSync'

export function useOfflineSync() {
    const isOnline = useNetworkStatus()
    const [syncing, setSyncing] = useState(false)
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        updatePendingCount()
        const interval = setInterval(updatePendingCount, 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (isOnline && pendingCount > 0 && !syncing) {
            handleSync()
        }
    }, [isOnline, pendingCount])

    async function updatePendingCount() {
        const count = await realtimeSync.getPendingCount()
        setPendingCount(count)
    }

    async function handleSync() {
        setSyncing(true)
        try {
            // Use requestSync() (not syncAll() directly) so this respects the
            // cross-tab lock if multiple tabs/pages are open at once.
            await realtimeSync.requestSync()
            await updatePendingCount()
        } finally {
            setSyncing(false)
        }
    }

    return { isOnline, syncing, pendingCount, sync: handleSync }
}
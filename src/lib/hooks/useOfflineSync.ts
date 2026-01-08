'use client'
import { useState, useEffect } from 'react'
import { useNetworkStatus } from './useNetworkStatus'
import { syncOrders } from '@/lib/sync/orderSync'
import { getPendingQueue } from '@/lib/db/syncQueue'

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
        const queue = await getPendingQueue()
        setPendingCount(queue.length)
    }

    async function handleSync() {
        setSyncing(true)
        try {
            await syncOrders()
            await updatePendingCount()
        } finally {
            setSyncing(false)
        }
    }

    return { isOnline, syncing, pendingCount, sync: handleSync }
}
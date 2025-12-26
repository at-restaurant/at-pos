// src/lib/hooks/useOfflineStatus.ts - OFFLINE STATUS HOOK
'use client'

import { useState, useEffect } from 'react'
import { realtimeSync } from '@/lib/db/realtimeSync'

export function useOfflineStatus() {
    const [isOnline, setIsOnline] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [pendingCount, setPendingCount] = useState(0)

    useEffect(() => {
        // Initial state
        setIsOnline(navigator.onLine)
        updatePendingCount()

        // Update every 5 seconds
        const interval = setInterval(updatePendingCount, 5000)

        // Listen to network events
        const handleOnline = () => {
            setIsOnline(true)
            realtimeSync.syncAll()
        }
        const handleOffline = () => setIsOnline(false)

        // Listen to sync events
        const handleSyncStart = () => setSyncing(true)
        const handleSyncComplete = () => {
            setSyncing(false)
            updatePendingCount()
        }
        const handleSyncError = () => setSyncing(false)

        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        window.addEventListener('sync-start', handleSyncStart)
        window.addEventListener('sync-complete', handleSyncComplete)
        window.addEventListener('sync-error', handleSyncError)

        return () => {
            clearInterval(interval)
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
            window.removeEventListener('sync-start', handleSyncStart)
            window.removeEventListener('sync-complete', handleSyncComplete)
            window.removeEventListener('sync-error', handleSyncError)
        }
    }, [])

    async function updatePendingCount() {
        const count = await realtimeSync.getPendingCount()
        setPendingCount(count)
    }

    const manualSync = async () => {
        if (!isOnline || syncing) return
        return await realtimeSync.syncAll()
    }

    return { isOnline, syncing, pendingCount, manualSync }
}
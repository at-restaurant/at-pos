// src/lib/hooks/useOfflineStatus.ts - DEXIE VERSION
'use client'

import { useState, useEffect } from 'react'
import { syncManager } from '@/lib/db/syncManager'
import { dbHelpers } from '@/lib/db/dexie'

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

        // Network events
        const handleOnline = () => {
            setIsOnline(true)
            syncManager.syncAll()
        }
        const handleOffline = () => setIsOnline(false)

        // Sync events
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
        const count = await dbHelpers.getPendingCount()
        setPendingCount(count)
    }

    const manualSync = async () => {
        if (!isOnline || syncing) return
        return await syncManager.syncAll()
    }

    return { isOnline, syncing, pendingCount, manualSync }
}
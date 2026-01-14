// src/components/OfflineInitializer.tsx - COMPLETE WITH FEATURES
'use client'

import { useEffect } from 'react'
import { syncManager } from '@/lib/db/syncManager'

export default function OfflineInitializer() {
    useEffect(() => {
        const initializeOfflineData = async () => {
            if (typeof navigator === 'undefined' || !navigator.onLine) {
                console.log('⚠️ Offline - skipping initial sync')
                return
            }

            try {
                // ✅ Check if data exists
                const isReady = await syncManager.isOfflineReady()

                if (!isReady) {
                    console.log('📥 First time - downloading offline data...')
                    const result = await syncManager.downloadEssentialData()

                    if (result?.success) {
                        console.log('✅ Offline data downloaded:', result)
                    }
                } else {
                    console.log('✅ Offline data already exists')

                    // Background sync to update stale data
                    syncManager.syncAll().then(result => {
                        if (result.success && result.uploaded) {
                            console.log('🔄 Background sync completed:', result.uploaded)
                        }
                    })
                }

                // Listen for sync events
                const handleSyncComplete = (e: any) => {
                    console.log('✅ Sync complete:', e.detail)
                }

                const handleSyncError = (e: any) => {
                    console.error('❌ Sync error:', e.detail)
                }

                window.addEventListener('sync-complete', handleSyncComplete)
                window.addEventListener('sync-error', handleSyncError)

                return () => {
                    window.removeEventListener('sync-complete', handleSyncComplete)
                    window.removeEventListener('sync-error', handleSyncError)
                }
            } catch (error) {
                console.error('❌ Failed to initialize offline data:', error)
            }
        }

        initializeOfflineData()
    }, [])

    return null
}
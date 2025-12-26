// src/components/ui/SyncProgressIndicator.tsx - NEW FILE
'use client'

import { useState, useEffect } from 'react'
import { Download, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

interface SyncStatus {
    syncing: boolean
    direction: 'download' | 'upload'
    progress: number
    itemsTotal: number
    itemsCurrent: number
    message: string
    error?: string
}

export default function SyncProgressIndicator() {
    const [status, setStatus] = useState<SyncStatus | null>(null)
    const [showSuccess, setShowSuccess] = useState(false)

    useEffect(() => {
        // Listen to custom sync events from offlineManager
        const handleSyncStart = (e: CustomEvent) => {
            setStatus({
                syncing: true,
                direction: e.detail.direction || 'download',
                progress: 0,
                itemsTotal: e.detail.total || 0,
                itemsCurrent: 0,
                message: e.detail.message || 'Starting sync...'
            })
            setShowSuccess(false)
        }

        const handleSyncProgress = (e: CustomEvent) => {
            setStatus(prev => prev ? {
                ...prev,
                progress: e.detail.progress || 0,
                itemsCurrent: e.detail.current || 0,
                message: e.detail.message || 'Syncing...'
            } : null)
        }

        const handleSyncComplete = (e: CustomEvent) => {
            setStatus(null)
            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 3000)
        }

        const handleSyncError = (e: CustomEvent) => {
            setStatus(prev => prev ? {
                ...prev,
                syncing: false,
                error: e.detail.error || 'Sync failed'
            } : null)
            setTimeout(() => setStatus(null), 5000)
        }

        window.addEventListener('sync-start', handleSyncStart as any)
        window.addEventListener('sync-progress', handleSyncProgress as any)
        window.addEventListener('sync-complete', handleSyncComplete as any)
        window.addEventListener('sync-error', handleSyncError as any)

        return () => {
            window.removeEventListener('sync-start', handleSyncStart as any)
            window.removeEventListener('sync-progress', handleSyncProgress as any)
            window.removeEventListener('sync-complete', handleSyncComplete as any)
            window.removeEventListener('sync-error', handleSyncError as any)
        }
    }, [])

    // Show success message
    if (showSuccess) {
        return (
            <div className="fixed bottom-24 right-4 bg-green-600 text-white rounded-lg p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6" />
                    <div>
                        <p className="font-semibold">✅ Sync Complete!</p>
                        <p className="text-xs opacity-90">All data is up to date</p>
                    </div>
                </div>
            </div>
        )
    }

    // Show sync progress
    if (status?.syncing) {
        return (
            <div className="fixed bottom-24 right-4 bg-[var(--card)] border-2 border-blue-600 rounded-xl p-4 shadow-2xl z-50 min-w-[300px] animate-in slide-in-from-bottom-2">
                <div className="flex items-start gap-3">
                    {status.direction === 'download' ? (
                        <Download className="w-6 h-6 text-blue-600 animate-bounce flex-shrink-0" />
                    ) : (
                        <Upload className="w-6 h-6 text-blue-600 animate-bounce flex-shrink-0" />
                    )}

                    <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <p className="font-semibold text-[var(--fg)]">
                                {status.direction === 'download' ? '📥 Downloading' : '📤 Uploading'}
                            </p>
                            <span className="text-sm font-bold text-blue-600">
                                {status.progress}%
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-2.5 bg-[var(--bg)] rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-500 rounded-full transition-all duration-300 relative overflow-hidden"
                                style={{ width: `${status.progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 animate-pulse" />
                            </div>
                        </div>

                        {/* Details */}
                        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                            <span>{status.message}</span>
                            {status.itemsTotal > 0 && (
                                <span className="font-medium">
                                    {status.itemsCurrent}/{status.itemsTotal}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Show error
    if (status?.error) {
        return (
            <div className="fixed bottom-24 right-4 bg-red-600 text-white rounded-lg p-4 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">❌ Sync Failed</p>
                        <p className="text-xs opacity-90">{status.error}</p>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
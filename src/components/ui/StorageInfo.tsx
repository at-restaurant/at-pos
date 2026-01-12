// src/components/ui/StorageInfo.tsx - DEXIE VERSION
'use client'

import { useState, useEffect } from 'react'
import { Database, Trash2, X, HardDrive, Image, ShoppingCart, RefreshCw } from 'lucide-react'
import { syncManager } from '@/lib/db/syncManager'
import { db, dbHelpers } from '@/lib/db/dexie'
import { useToast } from '@/components/ui/Toast'

export default function StorageInfo({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [info, setInfo] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [clearing, setClearing] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const toast = useToast()

    useEffect(() => {
        if (open) loadInfo()
    }, [open])

    const loadInfo = async () => {
        setLoading(true)
        try {
            const data = await dbHelpers.getStorageInfo()
            setInfo(data)
        } catch (error) {
            console.error('Failed to load storage info:', error)
        }
        setLoading(false)
    }

    const handleClear = async () => {
        if (!confirm('🗑️ Clear old completed orders? (Menu will be preserved)')) return

        setClearing(true)
        try {
            await dbHelpers.cleanOldOrders()
            await loadInfo()
            toast.add('success', '✅ Old orders cleared!')
        } catch (error) {
            console.error('Failed to clear data:', error)
            toast.add('error', '❌ Failed to clear data')
        }
        setClearing(false)
    }

    const handleForceSync = async () => {
        if (!navigator.onLine) {
            toast.add('error', '❌ You are offline! Connect to sync.')
            return
        }

        setSyncing(true)
        try {
            const result = await syncManager.downloadEssentialData()

            if (result.success) {
                await loadInfo()
                toast.add('success', '✅ Data synced from server!')
            } else {
                toast.add('error', '❌ Sync failed')
            }
        } catch (error) {
            console.error('Sync failed:', error)
            toast.add('error', '❌ Sync failed')
        }
        setSyncing(false)
    }

    if (!open) return null

    const hasData = info?.counts?.items > 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600/10 rounded-lg flex items-center justify-center">
                            <Database className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-[var(--fg)]">Storage Manager</h3>
                            <p className="text-xs text-[var(--muted)]">Offline data optimization</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors">
                        <X className="w-5 h-5 text-[var(--muted)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : info ? (
                        <>
                            {/* Total Storage */}
                            <div className="p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-[var(--fg)]">Total Storage</span>
                                    <span className="text-sm font-bold text-[var(--fg)]">
                                        {info.used} MB / {info.limit > 0 ? `${info.limit} MB` : '∞'}
                                    </span>
                                </div>
                                <div className="h-2 bg-[var(--border)] rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all ${
                                            info.percentage > 80 ? 'bg-red-600' :
                                                info.percentage > 60 ? 'bg-yellow-600' :
                                                    'bg-blue-600'
                                        }`}
                                        style={{ width: `${Math.min(info.percentage, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs text-[var(--muted)] mt-1">
                                    {info.percentage}% used
                                </p>
                            </div>

                            {/* Data Stats */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HardDrive className="w-3 h-3 text-blue-600" />
                                        <p className="text-xs text-[var(--muted)]">Menu</p>
                                    </div>
                                    <p className="text-xl font-bold text-[var(--fg)]">{info.counts.items}</p>
                                </div>
                                <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShoppingCart className="w-3 h-3 text-green-600" />
                                        <p className="text-xs text-[var(--muted)]">Orders</p>
                                    </div>
                                    <p className="text-xl font-bold text-[var(--fg)]">{info.counts.orders}</p>
                                </div>
                                <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Image className="w-3 h-3 text-purple-600" />
                                        <p className="text-xs text-[var(--muted)]">Tables</p>
                                    </div>
                                    <p className="text-xl font-bold text-[var(--fg)]">{info.counts.tables}</p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className={`p-3 rounded-lg border ${
                                hasData
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-yellow-500/10 border-yellow-500/30'
                            }`}>
                                <p className="text-sm font-medium text-[var(--fg)]">
                                    {hasData ? '✅ Ready for offline use' : '⚠️ No offline data available'}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleForceSync}
                                    disabled={syncing || !navigator.onLine}
                                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {syncing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            Sync
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleClear}
                                    disabled={clearing || info.counts.orders === 0}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95"
                                >
                                    {clearing ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Trash2 className="w-4 h-4" />
                                    )}
                                    {clearing ? 'Clearing...' : 'Clean'}
                                </button>
                            </div>

                            {/* Info Box */}
                            <div className="text-xs text-[var(--muted)] space-y-1 bg-[var(--bg)] p-3 rounded-lg">
                                <p className="font-semibold text-[var(--fg)] mb-2">📌 Info:</p>
                                <p className="text-[var(--fg)]">• Auto-sync on app load & network restore</p>
                                <p className="text-[var(--fg)]">• Orders kept (max 200, auto-clean)</p>
                                <p className="text-[var(--fg)]">• Images compressed for offline</p>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-[var(--muted)]">
                            Failed to load storage info
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
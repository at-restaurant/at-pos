// src/app/admin/(pages)/history/components/DataManagement.tsx - ENHANCED
'use client'

import { useState } from 'react'
import { Trash2, Calendar, AlertTriangle, Database, Shield } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function DataManagement() {
    const [deleting, setDeleting] = useState(false)
    const [selectedRange, setSelectedRange] = useState<'1month' | '3months' | '6months' | '1year'>('3months')
    const [keepImportant, setKeepImportant] = useState(true)
    const toast = useToast()

    const handleCleanup = async () => {
        const rangeNames = {
            '1month': '1 month',
            '3months': '3 months',
            '6months': '6 months',
            '1year': '1 year'
        }

        const confirmMsg = `⚠️ Delete data older than ${rangeNames[selectedRange]}?\n\n` +
            `This will permanently remove:\n` +
            `• Completed orders\n` +
            `• Order items\n` +
            `• Related images\n\n` +
            (keepImportant ? '✓ Important orders (>10,000 PKR) will be preserved\n' : '') +
            `\nMenu items will NOT be deleted.`

        if (!confirm(confirmMsg)) return

        setDeleting(true)
        try {
            const response = await fetch('/api/admin/cleanup-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timeRange: selectedRange, keepImportant })
            })

            const result = await response.json()

            if (result.success) {
                toast.add('success', result.message || '✅ Data cleanup completed!')
            } else {
                toast.add('error', result.error || '❌ Cleanup failed')
            }
        } catch (error: any) {
            toast.add('error', `❌ ${error.message || 'Network error'}`)
        } finally {
            setDeleting(false)
        }
    }

    return (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-600/10 rounded-lg flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-[var(--fg)]">Data Management</h3>
                    <p className="text-sm text-[var(--muted)]">Clean up old history data</p>
                </div>
            </div>

            {/* Warning */}
            <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold text-[var(--fg)] mb-1">⚠️ Important</p>
                        <ul className="space-y-1 text-[var(--muted)]">
                            <li>• Orders & history will be deleted</li>
                            <li>• Menu items are NEVER deleted</li>
                            <li>• This action cannot be undone</li>
                            <li>• Backup important data first</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Time Range Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-[var(--fg)] mb-3">
                    Select Time Range
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                        { value: '1month' as const, label: '1 Month', icon: '📅' },
                        { value: '3months' as const, label: '3 Months', icon: '🗓️' },
                        { value: '6months' as const, label: '6 Months', icon: '📆' },
                        { value: '1year' as const, label: '1 Year', icon: '🗓️' }
                    ].map(option => (
                        <button
                            key={option.value}
                            onClick={() => setSelectedRange(option.value)}
                            className={`p-3 rounded-lg border-2 transition-all ${
                                selectedRange === option.value
                                    ? 'border-blue-600 bg-blue-600/10'
                                    : 'border-[var(--border)] hover:border-blue-400'
                            }`}
                        >
                            <div className="text-2xl mb-1">{option.icon}</div>
                            <div className="text-xs font-medium text-[var(--fg)]">{option.label}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Keep Important Data Toggle */}
            <div className="mb-6 p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={keepImportant}
                        onChange={(e) => setKeepImportant(e.target.checked)}
                        className="w-5 h-5 rounded border-[var(--border)] text-blue-600 focus:ring-2 focus:ring-blue-600"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-green-600" />
                            <span className="font-medium text-sm text-[var(--fg)]">
                                Preserve Important Orders
                            </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1">
                            Keep orders with amount &gt; 10,000 PKR
                        </p>
                    </div>
                </label>
            </div>

            {/* Cleanup Button */}
            <button
                onClick={handleCleanup}
                disabled={deleting}
                className="w-full px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
                {deleting ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Cleaning up...
                    </>
                ) : (
                    <>
                        <Trash2 className="w-5 h-5" />
                        Clean Data Older Than {selectedRange === '1month' ? '1 Month' : selectedRange === '3months' ? '3 Months' : selectedRange === '6months' ? '6 Months' : '1 Year'}
                    </>
                )}
            </button>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-[var(--fg)] mb-2">💡 Storage Info:</p>
                        <ul className="text-xs text-[var(--muted)] space-y-1">
                            <li>• Offline cache auto-cleans after 30 days</li>
                            <li>• Manual cleanup gives you more control</li>
                            <li>• Menu items are permanently preserved</li>
                            <li>• Important orders can be protected</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
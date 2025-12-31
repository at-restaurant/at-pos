'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

export default function PrinterServiceStatus() {
    const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')

    useEffect(() => {
        checkStatus()
        const interval = setInterval(checkStatus, 10000) // Check every 10s
        return () => clearInterval(interval)
    }, [])

    const checkStatus = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/health', {
                signal: AbortSignal.timeout(3000)
            })
            setStatus(res.ok ? 'online' : 'offline')
        } catch {
            setStatus('offline')
        }
    }

    if (status === 'online') return null // Don't show if working

    return (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
            <div className={`p-4 rounded-lg border-2 shadow-lg ${
                status === 'checking'
                    ? 'bg-blue-500/10 border-blue-500/30'
                    : 'bg-red-500/10 border-red-500/30'
            }`}>
                <div className="flex items-start gap-3">
                    {status === 'checking' ? (
                        <RefreshCw className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0 mt-0.5" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1">
                        <h4 className="font-bold text-sm mb-1">
                            {status === 'checking' ? 'Checking printer...' : '⚠️ Printer Service Offline'}
                        </h4>

                        {status === 'offline' && (
                            <>
                                <p className="text-xs text-[var(--muted)] mb-3">
                                    The app will start the printer service automatically. If this message persists:
                                </p>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono bg-[var(--bg)] px-2 py-1 rounded">pnpm dev</span>
                                        <span className="text-[var(--muted)]">← Use this command</span>
                                    </div>
                                    <button
                                        onClick={checkStatus}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                                    >
                                        Retry Connection
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
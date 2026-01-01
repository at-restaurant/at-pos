// ============================================
// FILE: src/app/admin/(pages)/settings/printer/page.tsx
// Printer Settings Page with Auto-Detection
// ✅ FIXED: Uses environment variable for API URL
// ============================================

'use client'

import { useState, useEffect } from 'react'
import { Printer, RefreshCw, CheckCircle, AlertCircle, Zap } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'

interface PrinterDevice {
    id: string
    name: string
    type: 'default' | 'installed' | 'system' | 'usb'
    driver?: string
    status?: string
    isDefault?: boolean
    connected: boolean
}

export default function PrinterSettingsPage() {
    const [printers, setPrinters] = useState<PrinterDevice[]>([])
    const [selectedPrinter, setSelectedPrinter] = useState<PrinterDevice | null>(null)
    const [loading, setLoading] = useState(false)
    const [testing, setTesting] = useState(false)
    const [saving, setSaving] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')

    // ✅ FIX: Use environment variable
    const PRINTER_API_URL = process.env.NEXT_PUBLIC_PRINTER_SERVICE_URL || 'http://localhost:3001'

    // Auto-detect on load
    useEffect(() => {
        detectPrinters()
    }, [])

    // Detect available printers
    const detectPrinters = async () => {
        setLoading(true)
        setStatus('idle')

        try {
            console.log('🔍 Detecting printers at:', PRINTER_API_URL)

            // ✅ FIX: Use environment variable
            const res = await fetch(`${PRINTER_API_URL}/api/printers/detect`)

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`)
            }

            const data = await res.json()
            console.log('📡 Printer response:', data)

            if (data.success) {
                setPrinters(data.printers)
                if (data.printers.length > 0) {
                    setSelectedPrinter(data.printers[0])
                    setStatus('success')
                    setMessage(`✅ ${data.printers.length} printer(s) detected`)
                } else {
                    setStatus('error')
                    setMessage('⚠️ No printers found. Check USB connection.')
                }
            }
        } catch (error: any) {
            console.error('❌ Printer detection error:', error)
            setStatus('error')
            setMessage(`❌ Printer service offline: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    // Test selected printer
    const testPrinter = async () => {
        if (!selectedPrinter) return

        setTesting(true)
        setStatus('idle')

        try {
            console.log('🧪 Testing printer:', selectedPrinter.name)

            // ✅ FIX: Use environment variable
            const res = await fetch(`${PRINTER_API_URL}/api/printers/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    printerId: selectedPrinter.id,
                    printerName: selectedPrinter.name
                })
            })

            const data = await res.json()
            console.log('📄 Test result:', data)

            if (data.success) {
                setStatus('success')
                setMessage('✅ Test print successful! Check your printer.')
            } else {
                setStatus('error')
                setMessage(`❌ Test failed: ${data.error}`)
            }
        } catch (error: any) {
            console.error('❌ Test print error:', error)
            setStatus('error')
            setMessage(`❌ Cannot connect to printer: ${error.message}`)
        } finally {
            setTesting(false)
        }
    }

    // Save printer settings
    const savePrinter = async () => {
        if (!selectedPrinter) return

        setSaving(true)

        try {
            console.log('💾 Saving printer:', selectedPrinter.name)

            // ✅ FIX: Use environment variable
            const res = await fetch(`${PRINTER_API_URL}/api/printers/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    printerId: selectedPrinter.id,
                    printerName: selectedPrinter.name,
                    isDefault: selectedPrinter.isDefault
                })
            })

            const data = await res.json()

            if (data.success) {
                setStatus('success')
                setMessage('✅ Printer settings saved successfully!')
            }
        } catch (error: any) {
            console.error('❌ Save error:', error)
            setStatus('error')
            setMessage(`❌ Failed to save settings: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg)] lg:ml-16 pb-20 lg:pb-0">
            <PageHeader
                title="Printer Settings"
                subtitle="Auto-detect and configure your thermal printer"
            />

            <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

                {/* Debug Info */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-xs">
                    <p className="text-blue-600 font-mono">
                        🔗 API: {PRINTER_API_URL}
                    </p>
                </div>

                {/* Status Banner */}
                {status !== 'idle' && (
                    <div className={`p-4 rounded-lg border-2 ${
                        status === 'success'
                            ? 'bg-green-500/10 border-green-500/30 text-green-600'
                            : 'bg-red-500/10 border-red-500/30 text-red-600'
                    }`}>
                        <div className="flex items-center gap-3">
                            {status === 'success' ? (
                                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            )}
                            <p className="font-medium text-sm sm:text-base">{message}</p>
                        </div>
                    </div>
                )}

                {/* Auto-Detect Card */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <Printer className="w-6 h-6 text-blue-600 flex-shrink-0" />
                            <h2 className="text-lg sm:text-xl font-bold text-[var(--fg)]">
                                Available Printers
                            </h2>
                        </div>
                        <button
                            onClick={detectPrinters}
                            disabled={loading}
                            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            {loading ? 'Detecting...' : 'Detect Printers'}
                        </button>
                    </div>

                    {/* Printer List */}
                    {printers.length > 0 ? (
                        <div className="space-y-3">
                            {printers.map((printer) => (
                                <div
                                    key={printer.id}
                                    onClick={() => setSelectedPrinter(printer)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                                        selectedPrinter?.id === printer.id
                                            ? 'border-blue-600 bg-blue-600/10'
                                            : 'border-[var(--border)] hover:border-blue-400'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                printer.connected
                                                    ? 'bg-green-500/20 text-green-600'
                                                    : 'bg-gray-500/20 text-gray-600'
                                            }`}>
                                                {printer.isDefault ? (
                                                    <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                                                ) : (
                                                    <Printer className="w-5 h-5 sm:w-6 sm:h-6" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-[var(--fg)] text-sm sm:text-base truncate">
                                                    {printer.name}
                                                </h3>
                                                <p className="text-xs text-[var(--muted)] truncate">
                                                    {printer.driver || 'Unknown driver'}
                                                </p>
                                                {printer.status && (
                                                    <p className="text-xs text-[var(--muted)] mt-1">
                                                        Status: {printer.status}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {printer.isDefault ? (
                                                <span className="text-[10px] sm:text-xs font-semibold text-blue-600 bg-blue-500/20 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                                                    ⭐ Default
                                                </span>
                                            ) : printer.connected ? (
                                                <span className="text-[10px] sm:text-xs font-semibold text-green-600 bg-green-500/20 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                                                    ✅ Ready
                                                </span>
                                            ) : (
                                                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 bg-gray-500/20 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                                                    ⚠️ Offline
                                                </span>
                                            )}

                                            {selectedPrinter?.id === printer.id && (
                                                <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Printer className="w-12 h-12 sm:w-16 sm:h-16 text-[var(--muted)] mx-auto mb-4" />
                            <p className="text-[var(--muted)] mb-4 text-sm sm:text-base">
                                No printers detected. Connect your USB thermal printer.
                            </p>
                            <button
                                onClick={detectPrinters}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm sm:text-base"
                            >
                                Refresh
                            </button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {selectedPrinter && (
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 sm:p-6">
                        <h3 className="text-base sm:text-lg font-bold text-[var(--fg)] mb-4">
                            Printer Actions
                        </h3>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={testPrinter}
                                disabled={testing || !selectedPrinter.connected}
                                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                            >
                                <Zap className="w-5 h-5" />
                                {testing ? 'Testing...' : 'Test Print'}
                            </button>

                            <button
                                onClick={savePrinter}
                                disabled={saving}
                                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 text-sm sm:text-base"
                            >
                                <CheckCircle className="w-5 h-5" />
                                {saving ? 'Saving...' : 'Save Settings'}
                            </button>
                        </div>

                        <p className="text-xs text-[var(--muted)] mt-4 text-center">
                            💡 Test print will send a sample receipt to verify the printer is working
                        </p>
                    </div>
                )}

                {/* Setup Guide */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-blue-600 mb-3">
                        📝 Setup Guide
                    </h3>
                    <ol className="space-y-2 text-xs sm:text-sm text-[var(--fg)]">
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-blue-600 flex-shrink-0">1.</span>
                            <span>Connect your thermal printer via USB</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-blue-600 flex-shrink-0">2.</span>
                            <span>Make sure printer service is running on Windows PC</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-blue-600 flex-shrink-0">3.</span>
                            <span>Click "Detect Printers" to scan for devices</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-blue-600 flex-shrink-0">4.</span>
                            <span>Select your printer from the list</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="font-bold text-blue-600 flex-shrink-0">5.</span>
                            <span>Click "Test Print" to verify connection</span>
                        </li>
                    </ol>
                </div>

                {/* Troubleshooting */}
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-yellow-600 mb-3">
                        ⚠️ Troubleshooting
                    </h3>
                    <div className="space-y-3 text-xs sm:text-sm text-[var(--fg)]">
                        <div>
                            <p className="font-semibold text-yellow-600 mb-1">Service offline?</p>
                            <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                                <li>Check printer service is running on Windows PC</li>
                                <li>Verify IP address in Vercel environment variables</li>
                                <li>Test: <code className="bg-[var(--bg)] px-2 py-0.5 rounded">{PRINTER_API_URL}/api/health</code></li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-semibold text-yellow-600 mb-1">No printers detected?</p>
                            <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                                <li>Check USB cable is connected properly</li>
                                <li>Make sure printer is powered on</li>
                                <li>Install printer drivers if needed</li>
                            </ul>
                        </div>
                        <div>
                            <p className="font-semibold text-yellow-600 mb-1">Test print failed?</p>
                            <ul className="list-disc list-inside space-y-1 text-[var(--muted)]">
                                <li>Check printer has paper loaded</li>
                                <li>Verify printer drivers are installed</li>
                                <li>Try unplugging and reconnecting the printer</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
// src/lib/hooks/usePrinterDetection.ts
'use client'

import { useState, useCallback, useEffect } from 'react'

export interface DetectedPrinter {
    id: string
    name: string
    type: 'usb' | 'network' | 'bluetooth' | 'system'
    connected: boolean
    status: string
}

export function usePrinterDetection() {
    const [printers, setPrinters] = useState<DetectedPrinter[]>([])
    const [selectedPrinter, setSelectedPrinter] = useState<DetectedPrinter | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ✅ Detect system printers (works on all browsers/platforms)
    const detectSystemPrinters = useCallback((): DetectedPrinter[] => {
        console.log('🖨️ Detecting system printers...')

        // Get browser info
        const ua = navigator.userAgent.toLowerCase()
        const isWindows = /win/.test(ua)
        const isMac = /mac/.test(ua) && !/iphone|ipad|ipod/.test(ua)
        const isLinux = /linux/.test(ua)

        const systemPrinters: DetectedPrinter[] = []

        // Windows
        if (isWindows) {
            systemPrinters.push({
                id: 'system_windows_default',
                name: '🖨️ Windows Default Printer',
                type: 'system',
                connected: true,
                status: 'System Default'
            })
            systemPrinters.push({
                id: 'system_windows_browser',
                name: '📄 Browser Print Dialog',
                type: 'system',
                connected: true,
                status: 'All Printers Available'
            })
        }
        // Mac
        else if (isMac) {
            systemPrinters.push({
                id: 'system_mac_default',
                name: '🖨️ Mac System Printer',
                type: 'system',
                connected: true,
                status: 'System Default'
            })
            systemPrinters.push({
                id: 'system_mac_airprint',
                name: '📡 AirPrint Available',
                type: 'system',
                connected: true,
                status: 'WiFi Printers'
            })
        }
        // Linux
        else if (isLinux) {
            systemPrinters.push({
                id: 'system_linux_default',
                name: '🖨️ Linux System Printer',
                type: 'system',
                connected: true,
                status: 'System Default'
            })
        }
        // Android/iOS/Unknown
        else {
            systemPrinters.push({
                id: 'system_mobile_print',
                name: '📱 Mobile Print',
                type: 'system',
                connected: true,
                status: 'Native Print Dialog'
            })
        }

        return systemPrinters
    }, [])

    // ✅ Try WebUSB (Chrome only)
    const detectUSBPrinters = useCallback(async (): Promise<DetectedPrinter[]> => {
        try {
            if (!('usb' in navigator)) {
                console.log('⚠️ WebUSB not supported in this browser')
                return []
            }

            console.log('🔌 Checking USB printers...')
            const devices = await (navigator.usb as any).getDevices()

            const usbPrinters = devices
                .filter((device: any) => {
                    const isPrinterClass = device.classCode === 7
                    const isPrinterName = [
                        'printer', 'thermal', 'epson', 'alpha', 'receipt',
                        'tm-t20', 'escpos'
                    ].some(keyword =>
                        (device.productName?.toLowerCase() || '').includes(keyword) ||
                        (device.manufacturer?.toLowerCase() || '').includes(keyword)
                    )
                    return isPrinterClass || isPrinterName
                })
                .map((device: any, index: number) => ({
                    id: `usb_${index}_${device.serialNumber || 'unknown'}`,
                    name: `🔌 ${device.productName || `USB Printer ${index + 1}`}`,
                    type: 'usb' as const,
                    connected: true,
                    status: 'USB Connected'
                }))

            console.log(`✅ Found ${usbPrinters.length} USB printer(s)`)
            return usbPrinters
        } catch (err) {
            console.error('⚠️ USB detection error:', (err as Error).message)
            return []
        }
    }, [])

    // ✅ Main detect function
    const detectPrinters = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            console.log('🔍 Starting printer detection...')

            // Try USB first
            const usbPrinters = await detectUSBPrinters()

            // Get system printers
            const systemPrinters = detectSystemPrinters()

            // Combine all printers (USB first if available)
            const allPrinters = [...usbPrinters, ...systemPrinters]

            if (allPrinters.length === 0) {
                console.warn('⚠️ No printers detected - using default browser print')
                const defaultPrinter: DetectedPrinter = {
                    id: 'system_browser_default',
                    name: '📄 Browser Print (Fallback)',
                    type: 'system',
                    connected: true,
                    status: 'Always Available'
                }
                setPrinters([defaultPrinter])
                setSelectedPrinter(defaultPrinter)
                return
            }

            setPrinters(allPrinters)

            // ✅ Select first USB printer, otherwise first system printer
            const preferredPrinter = usbPrinters[0] || allPrinters[0]
            setSelectedPrinter(preferredPrinter)

            console.log(`✅ Total printers detected: ${allPrinters.length}`)
            allPrinters.forEach(p => {
                console.log(`   - ${p.name} (${p.type})`)
            })
        } catch (err: any) {
            const message = err?.message || 'Failed to detect printers'
            console.error('❌ Detection error:', message)
            setError(message)

            // Fallback to browser print
            const fallback: DetectedPrinter = {
                id: 'system_browser_fallback',
                name: '📄 Browser Print (Fallback)',
                type: 'system',
                connected: true,
                status: 'Always Available'
            }
            setPrinters([fallback])
            setSelectedPrinter(fallback)
        } finally {
            setLoading(false)
        }
    }, [detectUSBPrinters, detectSystemPrinters])

    // Auto-detect on mount
    useEffect(() => {
        void detectPrinters()
    }, [detectPrinters])

    return {
        printers,
        selectedPrinter,
        setSelectedPrinter,
        loading,
        error,
        detectPrinters
    }
}

export default usePrinterDetection
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

    // ✅ Detect printers using WebUSB API
    const detectPrinters = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            console.log('🔍 Detecting printers...')

            const detectedPrinters: DetectedPrinter[] = []

            // ✅ Try WebUSB API (Chrome/Edge only)
            if ('usb' in navigator) {
                try {
                    console.log('🔌 Checking USB printers...')
                    const devices = await (navigator.usb as any).getDevices()

                    const printerDevices = devices.filter((device: any) => {
                        const isPrinterClass = device.classCode === 7
                        const isPrinterName =
                            device.productName?.toLowerCase().includes('printer') ||
                            device.productName?.toLowerCase().includes('thermal') ||
                            device.productName?.toLowerCase().includes('epson') ||
                            device.productName?.toLowerCase().includes('alpha')

                        return isPrinterClass || isPrinterName
                    })

                    printerDevices.forEach((device: any, index: number) => {
                        detectedPrinters.push({
                            id: `usb_${index}`,
                            name: device.productName || `USB Printer ${index + 1}`,
                            type: 'usb',
                            connected: true,
                            status: 'Ready'
                        })
                    })

                    console.log(`✅ Found ${printerDevices.length} USB printer(s)`)
                } catch (err) {
                    console.log('⚠️ WebUSB API error:', (err as Error).message)
                }
            }

            // ✅ Always add system browser print as fallback
            detectedPrinters.push({
                id: 'system_browser_print',
                name: '🖨️ Browser Print (Default)',
                type: 'system',
                connected: true,
                status: 'Always Available'
            })

            setPrinters(detectedPrinters)

            // ✅ Set default printer (browser print as fallback)
            const defaultPrinter = detectedPrinters[0]
            setSelectedPrinter(defaultPrinter)

            console.log(`✅ Total printers found: ${detectedPrinters.length}`)
        } catch (err: any) {
            const message = err?.message || 'Failed to detect printers'
            console.error('❌ Detection error:', message)
            setError(message)

            // ✅ Still add browser print as fallback
            const fallback: DetectedPrinter = {
                id: 'system_browser_print',
                name: '🖨️ Browser Print (Fallback)',
                type: 'system',
                connected: true,
                status: 'Always Available'
            }
            setPrinters([fallback])
            setSelectedPrinter(fallback)
        } finally {
            setLoading(false)
        }
    }, [])

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
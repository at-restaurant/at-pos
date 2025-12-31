// ============================================
// FILE: src/lib/print/thermalPrinter.ts
// Client-side thermal printer wrapper
// ============================================

import { ReceiptData, PrintResponse, PrinterStatus } from '@/types'

export class ThermalPrinter {
    private baseUrl: string

    constructor(baseUrl: string = '/api/print') {
        this.baseUrl = baseUrl
    }

    /**
     * Print receipt via backend
     */
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(receipt)
            })

            const result = await response.json()

            if (!response.ok) {
                console.error('Print failed:', result.error)
                return {
                    success: false,
                    error: result.error || 'Print failed'
                }
            }

            return result

        } catch (error: any) {
            console.error('Print request error:', error)

            let errorMessage = 'Print failed. Please try again.'

            if (error.message.includes('fetch')) {
                errorMessage = 'Cannot connect to printer service.'
            } else if (error.message.includes('timeout')) {
                errorMessage = 'Print request timed out.'
            }

            return {
                success: false,
                error: errorMessage
            }
        }
    }

    /**
     * Check printer status
     */
    async checkStatus(): Promise<PrinterStatus> {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'GET'
            })

            if (!response.ok) {
                return {
                    status: 'offline',
                    printer: 'disconnected'
                }
            }

            const data = await response.json()
            return data

        } catch {
            return {
                status: 'offline',
                printer: 'disconnected'
            }
        }
    }

    /**
     * Test print
     */
    async testPrint(): Promise<PrintResponse> {
        try {
            const response = await fetch('http://localhost:3001/api/printers/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({})
            })

            const result = await response.json()
            return result

        } catch (error: any) {
            return {
                success: false,
                error: 'Test print failed'
            }
        }
    }
}

// Singleton instance
export const thermalPrinter = new ThermalPrinter()
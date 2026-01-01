// src/lib/print/thermalPrinter.ts - PRODUCTION READY
import { ReceiptData, PrintResponse, PrinterStatus } from '@/types'
import { detectDevice, shouldUseServicePrint } from './deviceDetection'
import BrowserPrint from './browserPrint'

export class ThermalPrinter {
    private getServiceURL(): string {
        // ✅ ONLY use environment variable, NO localhost fallback
        if (typeof window === 'undefined') {
            return ''
        }

        const url = process.env.NEXT_PUBLIC_PRINTER_SERVICE_URL

        if (!url) {
            console.error('❌ NEXT_PUBLIC_PRINTER_SERVICE_URL not configured!')
            return ''
        }

        return url
    }

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        const device = detectDevice()
        const serviceURL = this.getServiceURL()

        console.log('🖨️ Device:', device.type)
        console.log('🔗 Service URL:', serviceURL || 'Not configured')

        // Windows with service URL configured
        if (shouldUseServicePrint() && serviceURL) {
            try {
                console.log('📡 Sending to printer service...')

                const response = await fetch(`${serviceURL}/api/print`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(receipt),
                    mode: 'cors',
                    credentials: 'omit',
                    signal: AbortSignal.timeout(15000)
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                const result = await response.json()
                console.log('✅ Print successful!')
                return result

            } catch (error: any) {
                console.error('❌ Printer service failed:', error.message)
                console.log('🔄 Falling back to browser print...')
                return this.browserPrintFallback(receipt)
            }
        }

        // Fallback: Browser print
        console.log('🌐 Using browser print')
        return this.browserPrintFallback(receipt)
    }

    private async browserPrintFallback(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            const success = await BrowserPrint.print(receipt)
            return {
                success,
                message: success ? 'Browser print dialog opened' : 'Failed to open print dialog',
                orderNumber: receipt.orderNumber
            }
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Print failed'
            }
        }
    }

    async checkStatus(): Promise<PrinterStatus> {
        const device = detectDevice()
        const serviceURL = this.getServiceURL()

        if (shouldUseServicePrint() && serviceURL) {
            try {
                const response = await fetch(`${serviceURL}/api/health`, {
                    mode: 'cors',
                    credentials: 'omit',
                    signal: AbortSignal.timeout(5000)
                })

                if (!response.ok) throw new Error('Offline')

                return await response.json()
            } catch {
                return {
                    status: 'offline',
                    printer: 'disconnected',
                    platform: device.type
                }
            }
        }

        return {
            status: 'online',
            printer: 'configured',
            platform: device.type,
            timestamp: new Date().toISOString()
        }
    }

    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-' + Date.now().toString().slice(-6),
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            tableNumber: 1,
            waiter: 'Test Waiter',
            items: [
                { name: 'Test Item 1', quantity: 2, price: 100, total: 200, category: '🧪 Test' },
                { name: 'Test Item 2', quantity: 1, price: 150, total: 150, category: '🧪 Test' }
            ],
            subtotal: 350,
            tax: 35,
            total: 385,
            paymentMethod: 'cash',
            notes: 'This is a test receipt'
        }
        return this.print(testReceipt)
    }

    getDeviceInfo() {
        return detectDevice()
    }

    getConfiguredURL(): string {
        return this.getServiceURL()
    }
}

export const thermalPrinter = new ThermalPrinter()
export default ThermalPrinter
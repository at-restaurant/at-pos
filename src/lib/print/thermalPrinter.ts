// src/lib/print/thermalPrinter.ts - DIRECT CLIENT CONNECTION
import { ReceiptData, PrintResponse, PrinterStatus } from '@/types'
import { detectDevice, shouldUseServicePrint } from './deviceDetection'
import BrowserPrint from './browserPrint'

export class ThermalPrinter {
    private baseUrl: string

    constructor() {
        // ✅ FIX: Get URL directly from environment variable
        this.baseUrl = typeof window !== 'undefined'
            ? (process.env.NEXT_PUBLIC_PRINTER_SERVICE_URL || 'http://localhost:3001')
            : 'http://localhost:3001'

        console.log('🖨️ Printer Service URL:', this.baseUrl)
    }

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        const device = detectDevice()
        console.log('🖨️ Printing on:', device.type, 'Method:', device.printMethod)

        // Windows: Direct call to Cloudflare tunnel
        if (shouldUseServicePrint()) {
            try {
                console.log('📡 Connecting to printer service:', this.baseUrl)

                // ✅ FIX: Direct fetch from browser (bypasses Vercel API)
                const response = await fetch(`${this.baseUrl}/api/print`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(receipt),
                    mode: 'cors', // ✅ Enable CORS
                    signal: AbortSignal.timeout(15000)
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('❌ Printer service error:', response.status, errorText)
                    console.log('🔄 Falling back to browser print...')
                    return this.browserPrintFallback(receipt)
                }

                const result = await response.json()
                console.log('✅ Print successful:', result)
                return result

            } catch (error: any) {
                console.error('❌ Print error:', error.message)

                // Better error messages
                if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                    console.error('🔌 Cannot connect to printer service. Is it running?')
                    console.log('💡 Start: RUN-TUNNEL.bat and node printer-service/server.js')
                }

                console.log('🔄 Falling back to browser print...')
                return this.browserPrintFallback(receipt)
            }
        }

        // All other devices: Browser print
        console.log('🌐 Using browser print (non-Windows device)')
        return this.browserPrintFallback(receipt)
    }

    private async browserPrintFallback(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            console.log('📄 Opening browser print dialog...')
            const success = await BrowserPrint.print(receipt)
            return {
                success,
                message: success ? 'Print dialog opened' : 'Failed to open print dialog',
                orderNumber: receipt.orderNumber
            }
        } catch (error: any) {
            console.error('❌ Browser print failed:', error)
            return {
                success: false,
                error: error.message || 'Print failed'
            }
        }
    }

    async checkStatus(): Promise<PrinterStatus> {
        const device = detectDevice()

        if (shouldUseServicePrint()) {
            try {
                console.log('🔍 Checking printer status:', this.baseUrl)

                const response = await fetch(`${this.baseUrl}/api/health`, {
                    mode: 'cors',
                    signal: AbortSignal.timeout(5000)
                })

                if (!response.ok) {
                    throw new Error('Service offline')
                }

                const data = await response.json()
                console.log('✅ Printer online:', data)
                return data
            } catch (error: any) {
                console.error('❌ Printer offline:', error.message)
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
            phone: '+92-XXX-XXXXXXX',
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

    // ✅ NEW: Get current service URL
    getServiceURL(): string {
        return this.baseUrl
    }
}

export const thermalPrinter = new ThermalPrinter()
export default ThermalPrinter
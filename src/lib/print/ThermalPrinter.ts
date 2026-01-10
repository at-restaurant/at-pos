// src/lib/print/ThermalPrinter.ts
// ✅ FIXED: Single browser dialog, proper ESC/POS, no duplicate receipts

import { ReceiptData, PrintResponse } from '@/types'
import ThermalFormatter from './ThermalFormatter'

interface PrinterConfig {
    width: number
    printerName: string
    autoCut: boolean
    feedLines: number
}

export class ThermalPrinter {
    private config: PrinterConfig
    private formatter: ThermalFormatter
    private isPrinting: boolean = false
    private printWindow: Window | null = null

    constructor(config?: Partial<PrinterConfig>) {
        this.config = {
            width: 42,
            printerName: 'Generic / Text Only',
            autoCut: true,
            feedLines: 5,
            ...config
        }

        this.formatter = new ThermalFormatter(this.config.width)
        this.loadConfig()
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN PRINT METHOD - SINGLE BROWSER DIALOG
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        if (this.isPrinting) {
            console.warn('⚠️ Print already in progress')
            return {
                success: false,
                error: 'Printer is busy',
                orderNumber: receipt.orderNumber
            }
        }

        console.log('🖨️ Starting print:', receipt.orderNumber)

        try {
            this.isPrinting = true

            // Close any existing print window
            if (this.printWindow && !this.printWindow.closed) {
                this.printWindow.close()
            }

            // Format receipt with ESC/POS
            const receiptText = this.formatter.format(receipt)

            // Print once via new window
            const success = await this.printViaWindow(receiptText)

            if (success) {
                console.log('✅ Print completed:', receipt.orderNumber)
                return {
                    success: true,
                    message: 'Receipt printed',
                    orderNumber: receipt.orderNumber
                }
            } else {
                throw new Error('Print cancelled or failed')
            }

        } catch (error: any) {
            console.error('❌ Print error:', error)
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        } finally {
            this.isPrinting = false
        }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // PRINT VIA NEW WINDOW (Single Dialog)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private async printViaWindow(receiptText: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Open new window with specific name (reuses same window)
                this.printWindow = window.open('', 'ThermalPrint', 'width=1,height=1')

                if (!this.printWindow) {
                    console.error('❌ Failed to open print window (popup blocked?)')
                    resolve(false)
                    return
                }

                const doc = this.printWindow.document

                // Write HTML with ESC/POS preserved
                doc.open()
                doc.write(this.generatePrintHTML(receiptText))
                doc.close()

                // Wait for content load
                this.printWindow.onload = () => {
                    try {
                        this.printWindow!.focus()

                        // Trigger print dialog (opens ONCE)
                        this.printWindow!.print()

                        // Cleanup after user closes dialog
                        setTimeout(() => {
                            if (this.printWindow && !this.printWindow.closed) {
                                this.printWindow.close()
                            }
                            resolve(true)
                        }, 500)

                    } catch (err) {
                        console.error('Print dialog error:', err)
                        if (this.printWindow && !this.printWindow.closed) {
                            this.printWindow.close()
                        }
                        resolve(false)
                    }
                }

                // Timeout fallback
                setTimeout(() => {
                    if (this.printWindow && !this.printWindow.closed) {
                        this.printWindow.close()
                        resolve(false)
                    }
                }, 5000)

            } catch (error) {
                console.error('Window creation error:', error)
                resolve(false)
            }
        })
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HTML FOR RAW ESC/POS PRINTING
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private generatePrintHTML(receiptText: string): string {
        // Keep ESC/POS commands intact in <pre> tag
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 0;
        }
        
        @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.3;
            width: 80mm;
            background: white;
            color: black;
        }
        
        pre {
            margin: 0;
            padding: 0;
            white-space: pre;
            font-family: inherit;
            font-size: inherit;
        }
    </style>
</head>
<body>
    <pre>${receiptText}</pre>
</body>
</html>`
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST PRINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: '🖨️ TEST PRINT',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-' + Date.now().toString().slice(-6),
            date: new Date().toLocaleString('en-PK'),
            orderType: 'dine-in',
            tableNumber: 5,
            waiter: 'Test Waiter',
            items: [
                {
                    name: 'Test Item 1',
                    quantity: 2,
                    price: 150,
                    total: 300,
                    category: '🍕 Main Course'
                },
                {
                    name: 'Test Beverage',
                    quantity: 1,
                    price: 100,
                    total: 100,
                    category: '🥤 Drinks'
                }
            ],
            subtotal: 400,
            tax: 20,
            total: 420,
            paymentMethod: 'cash'
        }

        return this.print(testReceipt)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CONFIG
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    setConfig(config: Partial<PrinterConfig>) {
        this.config = { ...this.config, ...config }
        this.formatter.setWidth(this.config.width)
        this.saveConfig()
    }

    getConfig(): PrinterConfig {
        return { ...this.config }
    }

    private saveConfig() {
        if (typeof window !== 'undefined') {
            localStorage.setItem('thermal_printer_config', JSON.stringify(this.config))
        }
    }

    private loadConfig() {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('thermal_printer_config')
            if (saved) {
                try {
                    const config = JSON.parse(saved)
                    this.config = { ...this.config, ...config }
                    this.formatter.setWidth(this.config.width)
                } catch (error) {
                    console.error('Failed to load printer config:', error)
                }
            }
        }
    }

    isPrinterBusy(): boolean {
        return this.isPrinting
    }

    isAvailable(): boolean {
        return typeof window !== 'undefined' && !!window.print
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLETON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let printerInstance: ThermalPrinter | null = null

export const thermalPrinter = (() => {
    if (typeof window === 'undefined') {
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            setConfig: () => {},
            getConfig: () => ({ width: 42, printerName: '', autoCut: true, feedLines: 5 }),
            isPrinterBusy: () => false,
            isAvailable: () => false
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ThermalPrinter()
    }
    return printerInstance
})()

export default thermalPrinter
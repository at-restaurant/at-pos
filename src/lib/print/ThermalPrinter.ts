// src/lib/print/ThermalPrinter.ts - FIXED
// ✅ Proper browser dialog size, NO extra spacing, NO feedLines

import { ReceiptData, PrintResponse } from '@/types'
import ThermalFormatter from './ThermalFormatter'

interface PrinterConfig {
    width: number
    printerName: string
    autoCut: boolean
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
            ...config
        }

        this.formatter = new ThermalFormatter(this.config.width)
        this.loadConfig()
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN PRINT METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        if (this.isPrinting) {
            return {
                success: false,
                error: 'Printer is busy',
                orderNumber: receipt.orderNumber
            }
        }

        console.log('🖨️ Printing:', receipt.orderNumber)

        try {
            this.isPrinting = true

            if (this.printWindow && !this.printWindow.closed) {
                this.printWindow.close()
            }

            const receiptText = this.formatter.format(receipt)
            const success = await this.printViaWindow(receiptText)

            if (success) {
                console.log('✅ Print completed')
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
    // PRINT VIA IFRAME - NO LOCALHOST FETCH
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private async printViaWindow(receiptText: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // ✅ Create hidden iframe
                const iframe = document.createElement('iframe')
                iframe.style.position = 'fixed'
                iframe.style.right = '0'
                iframe.style.bottom = '0'
                iframe.style.width = '0'
                iframe.style.height = '0'
                iframe.style.border = 'none'
                document.body.appendChild(iframe)

                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                if (!iframeDoc) {
                    console.error('❌ Cannot access iframe document')
                    resolve(false)
                    return
                }

                // Write HTML to iframe
                iframeDoc.open()
                iframeDoc.write(this.generatePrintHTML(receiptText))
                iframeDoc.close()

                // Wait for content to load
                setTimeout(() => {
                    try {
                        // Trigger print dialog
                        iframe.contentWindow?.focus()
                        iframe.contentWindow?.print()

                        // Cleanup after print
                        setTimeout(() => {
                            document.body.removeChild(iframe)
                            resolve(true)
                        }, 1000)

                    } catch (err) {
                        console.error('Print error:', err)
                        document.body.removeChild(iframe)
                        resolve(false)
                    }
                }, 100)

            } catch (error) {
                console.error('iframe error:', error)
                resolve(false)
            }
        })
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HTML - WINDOWS THERMAL PRINTER OPTIMIZED
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private generatePrintHTML(receiptText: string): string {
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 0mm;
        }
        
        @media print {
            html, body { 
                margin: 0 !important; 
                padding: 0 !important;
                height: auto !important;
            }
            .no-print { display: none !important; }
            
            /* Windows Print Optimization */
            @page { margin: 0; }
            body { 
                margin: 0;
                padding: 0;
            }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        html {
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 12px;
            line-height: 1.2;
            width: 80mm;
            background: white;
            color: black;
            margin: 0;
            padding: 0;
        }
        
        pre {
            margin: 0;
            padding: 0;
            white-space: pre;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
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

let printerInstance: ThermalPrinter | null = null

export const thermalPrinter = (() => {
    if (typeof window === 'undefined') {
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            setConfig: () => {},
            getConfig: () => ({ width: 42, printerName: '', autoCut: true }),
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
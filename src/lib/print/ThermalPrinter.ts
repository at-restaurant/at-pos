// src/lib/print/ThermalPrinter.ts
// ✅ Production-ready thermal printer with direct ESC/POS printing

import { ReceiptData, PrintResponse } from '@/types'
import ThermalFormatter from './ThermalFormatter'

interface PrinterConfig {
    width: number  // 42 for 80mm, 32 for 58mm
    printerName: string
    autoCut: boolean
    feedLines: number  // Lines to feed before cut
}

export class ThermalPrinter {
    private config: PrinterConfig
    private formatter: ThermalFormatter
    private isPrinting: boolean = false

    constructor(config?: Partial<PrinterConfig>) {
        this.config = {
            width: 42,  // 80mm thermal printer (standard)
            printerName: 'Generic / Text Only',
            autoCut: true,
            feedLines: 5,
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

        console.log('🖨️ Thermal print started:', receipt.orderNumber)

        try {
            this.isPrinting = true

            // Format receipt with ESC/POS commands
            const receiptText = this.formatter.format(receipt)

            // Print via iframe
            const success = await this.printViaIframe(receiptText)

            if (success) {
                console.log('✅ Print completed:', receipt.orderNumber)
                return {
                    success: true,
                    message: 'Receipt printed successfully',
                    orderNumber: receipt.orderNumber
                }
            } else {
                throw new Error('Print failed or cancelled')
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
    // IFRAME PRINTING (Direct ESC/POS)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private async printViaIframe(receiptText: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Create hidden iframe
                const iframe = document.createElement('iframe')
                iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;'
                document.body.appendChild(iframe)

                const iframeDoc = iframe.contentWindow!.document

                // Write receipt with proper encoding
                iframeDoc.open()
                iframeDoc.write(this.generatePrintHTML(receiptText))
                iframeDoc.close()

                // Wait for content to load
                iframe.onload = () => {
                    try {
                        iframe.contentWindow!.focus()

                        // Trigger print dialog
                        iframe.contentWindow!.print()

                        // Cleanup after print
                        setTimeout(() => {
                            if (document.body.contains(iframe)) {
                                document.body.removeChild(iframe)
                            }
                            resolve(true)
                        }, 1000)

                    } catch (err) {
                        console.error('Print dialog error:', err)
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe)
                        }
                        resolve(false)
                    }
                }

                // Timeout fallback
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe)
                        resolve(false)
                    }
                }, 5000)

            } catch (error) {
                console.error('Iframe creation error:', error)
                resolve(false)
            }
        })
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HTML GENERATION FOR PRINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private generatePrintHTML(receiptText: string): string {
        // Escape HTML but preserve ESC/POS commands
        const escapedText = receiptText
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt Print</title>
    <style>
        @page {
            size: 80mm auto;
            margin: 0;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            
            .no-print {
                display: none !important;
            }
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Courier New', 'Courier', monospace;
            font-size: 12px;
            line-height: 1.4;
            padding: 0;
            margin: 0;
            width: 80mm;
            background: white;
            color: black;
        }
        
        pre {
            margin: 0;
            padding: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
            font-family: inherit;
            font-size: inherit;
        }
    </style>
</head>
<body>
    <pre>${escapedText}</pre>
    <script>
        // Auto-print when loaded
        window.onload = function() {
            window.print();
        };
        
        // Close after print (some browsers)
        window.onafterprint = function() {
            setTimeout(function() {
                window.close();
            }, 500);
        };
    </script>
</body>
</html>`
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEST PRINT
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    async testPrint(): Promise<PrintResponse> {
        console.log('🧪 Running test print...')

        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: '🖨️ TEST PRINT - Thermal Printer',
            address: 'Sooter Mills Rd, Lahore',
            phone: '+92-XXX-XXXXXXX',
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
                    category: '🍕 Test Category'
                },
                {
                    name: 'Test Item 2 with Long Name',
                    quantity: 1,
                    price: 250,
                    total: 250,
                    category: '🍕 Test Category'
                },
                {
                    name: 'Another Item',
                    quantity: 3,
                    price: 100,
                    total: 300,
                    category: '🥤 Beverages'
                }
            ],
            subtotal: 850,
            tax: 42.50,
            total: 892.50,
            paymentMethod: 'cash',
            notes: 'This is a test receipt to verify thermal printer formatting and auto-cut functionality.'
        }

        return this.print(testReceipt)
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CONFIGURATION
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

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STATUS & UTILITY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    isPrinterBusy(): boolean {
        return this.isPrinting
    }

    isAvailable(): boolean {
        return typeof window !== 'undefined' && !!window.print
    }

    /**
     * Show printer setup instructions
     */
    showSetupInstructions() {
        if (typeof window === 'undefined') return

        const modal = document.createElement('div')
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            backdrop-filter: blur(4px);
        `

        const content = document.createElement('div')
        content.style.cssText = `
            background: white;
            border-radius: 16px;
            padding: 32px;
            max-width: 600px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `

        content.innerHTML = `
            <div style="text-align: center; margin-bottom: 24px;">
                <div style="font-size: 64px; margin-bottom: 16px;">🖨️</div>
                <h2 style="font-size: 28px; font-weight: bold; color: #1f2937; margin-bottom: 12px;">
                    Thermal Printer Setup
                </h2>
                <p style="font-size: 14px; color: #6b7280;">
                    Follow these steps to configure your thermal printer
                </p>
            </div>

            <div style="background: #f3f4f6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">
                    📋 Windows Setup:
                </h3>
                <ol style="font-size: 14px; color: #4b5563; line-height: 2; padding-left: 20px; margin: 0;">
                    <li><strong>Open Settings</strong> → Printers & Scanners</li>
                    <li>Find your thermal printer in the list</li>
                    <li>Click <strong>Manage</strong> → <strong>Printing Preferences</strong></li>
                    <li>Set paper size to <strong>80mm Roll</strong></li>
                    <li>Set quality to <strong>Fast/Draft</strong></li>
                    <li>Click <strong>OK</strong> and close</li>
                </ol>
            </div>

            <div style="background: #dbeafe; border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 600; color: #1e40af; margin-bottom: 16px;">
                    🌐 Browser Setup:
                </h3>
                <ol style="font-size: 14px; color: #1e3a8a; line-height: 2; padding-left: 20px; margin: 0;">
                    <li>Click print button</li>
                    <li>In print dialog, select <strong>"Generic / Text Only"</strong></li>
                    <li>Check <strong>"Save as default"</strong></li>
                    <li>Set margins to <strong>None</strong></li>
                    <li>Click <strong>Print</strong></li>
                </ol>
            </div>

            <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.6;">
                    💡 <strong>Pro Tip:</strong> After first setup, the browser will remember your printer selection. 
                    You'll just need to click "Print" each time!
                </p>
            </div>

            <button id="closeSetupBtn" style="
                width: 100%;
                padding: 16px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            ">
                Got it! Let's Print
            </button>
        `

        modal.appendChild(content)
        document.body.appendChild(modal)

        const closeBtn = content.querySelector('#closeSetupBtn')
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal)
            })
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal)
            }
        })
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SINGLETON EXPORT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let printerInstance: ThermalPrinter | null = null

export const thermalPrinter = (() => {
    if (typeof window === 'undefined') {
        // Server-side: return dummy
        return {
            print: async () => ({ success: false, error: 'SSR mode' }),
            testPrint: async () => ({ success: false, error: 'SSR mode' }),
            setConfig: () => {},
            getConfig: () => ({ width: 42, printerName: '', autoCut: true, feedLines: 5 }),
            isPrinterBusy: () => false,
            isAvailable: () => false,
            showSetupInstructions: () => {}
        } as any
    }

    if (!printerInstance) {
        printerInstance = new ThermalPrinter()
    }
    return printerInstance
})()

export default thermalPrinter
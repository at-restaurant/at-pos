// src/lib/print/thermalPrinter.ts - PRODUCTION
import { ReceiptData, PrintResponse, PrinterStatus } from '@/types'

function isAndroid(): boolean {
    if (typeof window === 'undefined') return false
    return /android/i.test(navigator.userAgent)
}

function isMac(): boolean {
    if (typeof window === 'undefined') return false
    return /mac/i.test(navigator.userAgent) && !/iphone|ipad/i.test(navigator.userAgent)
}

export class ThermalPrinter {
    private baseUrl: string

    constructor() {
        this.baseUrl = process.env.NEXT_PUBLIC_PRINTER_SERVICE_URL || 'http://localhost:3001'
    }

    async print(receipt: ReceiptData): Promise<PrintResponse> {
        // Android: Browser print
        if (isAndroid()) {
            return this.printViaBrowser(receipt)
        }

        // Mac: Browser print
        if (isMac()) {
            return this.printViaBrowser(receipt)
        }

        // Windows: Thermal printer service
        try {
            const response = await fetch(`${this.baseUrl}/api/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(receipt)
            })

            if (!response.ok) throw new Error('Print service unavailable')

            return await response.json()
        } catch (error: any) {
            console.error('Print error:', error)
            return this.printViaBrowser(receipt)
        }
    }

    private printViaBrowser(receipt: ReceiptData): Promise<PrintResponse> {
        return new Promise((resolve) => {
            try {
                const printWindow = window.open('', '_blank', 'width=300,height=600')

                if (!printWindow) {
                    throw new Error('Popup blocked')
                }

                const html = this.formatReceiptHTML(receipt)
                printWindow.document.write(html)
                printWindow.document.close()

                printWindow.onload = () => {
                    printWindow.focus()
                    printWindow.print()
                    setTimeout(() => printWindow.close(), 1000)
                }

                resolve({ success: true, message: 'Printing via browser' })
            } catch (error: any) {
                resolve({ success: false, error: error.message })
            }
        })
    }

    private formatReceiptHTML(data: ReceiptData): string {
        const grouped: Record<string, typeof data.items> = {}
        data.items.forEach(item => {
            const cat = item.category || 'Other'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(item)
        })

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - ${data.orderNumber}</title>
    <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            padding: 10px;
            background: white;
            color: black;
            max-width: 300px;
            margin: 0 auto;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .large { font-size: 16px; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        .double-line { border-bottom: 2px solid #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .item { margin: 6px 0; }
        .category {
            font-weight: bold;
            background: #f0f0f0;
            padding: 4px;
            margin: 8px 0 4px 0;
            border-left: 3px solid #333;
        }
        .indent { padding-left: 16px; font-size: 11px; color: #666; }
        .total-row { font-size: 14px; font-weight: bold; margin-top: 8px; }
        .delivery-box {
            background: #f9f9f9;
            border: 1px solid #ddd;
            padding: 8px;
            margin: 10px 0;
        }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>
    <div class="center">
        <div class="large bold">${data.restaurantName || 'AT RESTAURANT'}</div>
        <div>${data.tagline || 'Delicious Food, Memorable Moments'}</div>
    </div>
    <div class="line"></div>
    <div class="center">
        <div>${data.address || 'Sooter Mills Rd, Lahore'}</div>
    </div>
    <div class="double-line"></div>

    <div class="row"><span>Order #:</span><span class="bold">${data.orderNumber}</span></div>
    <div class="row"><span>Date:</span><span>${data.date}</span></div>
    <div class="row"><span>Type:</span><span class="bold">${data.orderType === 'delivery' ? 'DELIVERY' : 'DINE-IN'}</span></div>
    ${data.tableNumber ? `<div class="row"><span>Table:</span><span>#${data.tableNumber}</span></div>` : ''}
    ${data.waiter ? `<div class="row"><span>Waiter:</span><span>${data.waiter}</span></div>` : ''}
    <div class="line"></div>

    ${data.orderType === 'delivery' && (data.customerName || data.customerPhone) ? `
    <div class="delivery-box">
        <div class="bold">DELIVERY DETAILS</div>
        ${data.customerName ? `<div>Name: ${data.customerName}</div>` : ''}
        ${data.customerPhone ? `<div>Phone: ${data.customerPhone}</div>` : ''}
        ${data.deliveryAddress ? `<div>Address: ${data.deliveryAddress}</div>` : ''}
    </div>
    <div class="line"></div>
    ` : ''}

    <div class="bold">ORDER ITEMS</div>
    <div class="line"></div>
    
    ${Object.entries(grouped).map(([category, items]) => `
        <div class="category">${category}</div>
        ${items.map(item => `
            <div class="item">
                <div class="row">
                    <span>${item.quantity}x ${item.name}</span>
                    <span class="bold">PKR ${item.total.toFixed(2)}</span>
                </div>
                <div class="indent">@ PKR ${item.price.toFixed(2)} each</div>
            </div>
        `).join('')}
    `).join('')}

    <div class="double-line"></div>

    <div class="row"><span>Subtotal:</span><span>PKR ${data.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>Tax:</span><span>PKR ${data.tax.toFixed(2)}</span></div>
    ${data.deliveryCharges && data.deliveryCharges > 0 ? `
    <div class="row"><span>Delivery:</span><span>PKR ${data.deliveryCharges.toFixed(2)}</span></div>
    ` : ''}
    <div class="line"></div>
    <div class="row total-row">
        <span>TOTAL:</span>
        <span>PKR ${data.total.toFixed(2)}</span>
    </div>

    ${data.paymentMethod ? `
    <div class="center" style="margin-top: 10px; padding: 8px; background: #f0f0f0;">
        <span class="bold">Payment: ${data.paymentMethod.toUpperCase()}</span>
    </div>
    ` : ''}

    ${data.notes ? `
    <div class="line"></div>
    <div class="bold">Special Instructions:</div>
    <div>${data.notes}</div>
    ` : ''}

    <div class="double-line"></div>

    <div class="center">
        <div class="bold">Thank you for dining with us!</div>
        <div>Please visit again</div>
        <div style="margin-top: 10px; font-size: 10px; color: #666;">Powered by AT Restaurant POS</div>
    </div>

    <script>
        window.onload = () => window.print();
        window.onafterprint = () => setTimeout(() => window.close(), 500);
    </script>
</body>
</html>
        `
    }

    async checkStatus(): Promise<PrinterStatus> {
        if (isAndroid() || isMac()) {
            return {
                status: 'online',
                printer: 'configured'
            }
        }

        try {
            const response = await fetch(`${this.baseUrl}/api/health`)
            if (!response.ok) return { status: 'offline', printer: 'disconnected' }
            return await response.json()
        } catch {
            return { status: 'offline', printer: 'disconnected' }
        }
    }

    async testPrint(): Promise<PrintResponse> {
        const testReceipt: ReceiptData = {
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-001',
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            items: [{ name: 'Test Item', quantity: 1, price: 100, total: 100, category: 'Test' }],
            subtotal: 100,
            tax: 0,
            total: 100
        }
        return this.print(testReceipt)
    }
}

export const thermalPrinter = new ThermalPrinter()
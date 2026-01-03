// src/lib/print/thermalPrinter.ts - CLEAN VERSION
import { ReceiptData, PrintResponse, } from '@/types'
import BrowserPrint from './browserPrint'

export class ThermalPrinter {
    private serviceURL = typeof window !== 'undefined' && (window as any).electron?.isElectron
        ? 'http://127.0.0.1:3001'
        : 'http://localhost:3001'

    // ✅ MAIN PRINT METHOD - 3 Tier Fallback
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Starting print job...')

        // ✅ TIER 1: Try Printer Service (USB/Direct)
        const servicePrint = await this.tryPrinterService(receipt)
        if (servicePrint.success) {
            console.log('✅ Printed via USB/Direct')
            return servicePrint
        }

        console.log('⚠️ Service failed, trying browser print...')

        // ✅ TIER 2: Browser Print (AUTO - NO CLICKS)
        return await this.autoBrowserPrint(receipt)
    }

    // ===================================
    // TIER 1: Printer Service (USB)
    // ===================================
    private async tryPrinterService(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            const response = await fetch(`${this.serviceURL}/api/print`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(receipt),
                signal: AbortSignal.timeout(5000)
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            return await response.json()
        } catch (error: any) {
            console.error('Printer service error:', error.message)
            return { success: false, error: error.message }
        }
    }

    // ===================================
    // TIER 2: Auto Browser Print (NO DIALOG)
    // ===================================
    private async autoBrowserPrint(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            // ✅ Use Blob URL (no doc.write warning)
            const html = this.generatePrintHTML(receipt)
            const blob = new Blob([html], { type: 'text/html' })
            const url = URL.createObjectURL(blob)

            const iframe = document.createElement('iframe')
            iframe.style.display = 'none'
            iframe.style.position = 'absolute'
            iframe.style.width = '0'
            iframe.style.height = '0'
            iframe.style.border = 'none'

            document.body.appendChild(iframe)
            iframe.src = url

            await new Promise<void>((resolve, reject) => {
                iframe.onload = () => resolve()
                iframe.onerror = () => reject(new Error('Failed to load'))
                setTimeout(() => reject(new Error('Timeout')), 5000)
            })

            iframe.contentWindow?.print()

            setTimeout(() => {
                URL.revokeObjectURL(url)
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe)
                }
            }, 2000)

            return {
                success: true,
                message: 'Printed via browser (auto)',
                orderNumber: receipt.orderNumber
            }
        } catch (error: any) {
            console.error('Browser print error:', error)
            const success = await BrowserPrint.print(receipt)
            return {
                success,
                message: success ? 'Browser print dialog opened' : 'Print failed'
            }
        }
    }

    // ===================================
    // HTML GENERATOR
    // ===================================
    private generatePrintHTML(data: ReceiptData): string {
        const grouped: Record<string, typeof data.items> = {}
        data.items.forEach(item => {
            const cat = item.category || '📋 Other'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(item)
        })

        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt ${data.orderNumber}</title>
    <style>
        @page { 
            size: 80mm 297mm; 
            margin: 0; 
        }
        @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none !important; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            padding: 10px;
            width: 80mm;
            background: white;
            color: black;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .large { font-size: 16px; font-weight: bold; }
        .line { border-bottom: 1px dashed #333; margin: 6px 0; }
        .double-line { border-bottom: 2px solid #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 3px 0; }
        .category { 
            font-weight: bold; 
            background: #f5f5f5; 
            padding: 3px 5px; 
            margin: 6px 0 3px 0; 
            border-left: 3px solid #333; 
        }
        .item { margin: 4px 0; }
        .indent { padding-left: 12px; font-size: 10px; color: #666; }
    </style>
</head>
<body>
    <div class="center large">${data.restaurantName || 'AT RESTAURANT'}</div>
    <div class="center">${data.tagline || 'Delicious Food, Memorable Moments'}</div>
    <div class="line"></div>
    <div class="center" style="font-size:10px">${data.address || 'Sooter Mills Rd, Lahore'}</div>
    <div class="double-line"></div>

    <div class="row"><span>Order #</span><span class="bold">${data.orderNumber}</span></div>
    <div class="row"><span>Date</span><span>${data.date}</span></div>
    <div class="row"><span>Type</span><span class="bold">${data.orderType === 'delivery' ? '🚚 DELIVERY' : '🍽️ DINE-IN'}</span></div>
    ${data.tableNumber ? `<div class="row"><span>Table</span><span class="bold">#${data.tableNumber}</span></div>` : ''}
    ${data.waiter ? `<div class="row"><span>Waiter</span><span>${data.waiter}</span></div>` : ''}
    <div class="line"></div>

    ${data.orderType === 'delivery' && (data.customerName || data.customerPhone) ? `
    <div style="background:#f0f8ff;padding:5px;margin:5px 0;border:1px solid #0066cc;">
        <div class="bold center">📦 DELIVERY</div>
        ${data.customerName ? `<div class="row"><span>Name:</span><span>${data.customerName}</span></div>` : ''}
        ${data.customerPhone ? `<div class="row"><span>Phone:</span><span>${data.customerPhone}</span></div>` : ''}
        ${data.deliveryAddress ? `<div style="margin-top:3px;font-size:10px"><strong>Address:</strong><br>${data.deliveryAddress}</div>` : ''}
    </div>
    ` : ''}

    <div class="bold">ORDER ITEMS</div>
    <div class="line"></div>
    
    ${Object.entries(grouped).map(([category, items]) => `
        <div class="category">${category}</div>
        ${items.map(item => `
            <div class="item">
                <div class="row">
                    <span>${item.quantity}× ${item.name}</span>
                    <span class="bold">PKR ${item.total.toFixed(2)}</span>
                </div>
                <div class="indent">@ PKR ${item.price.toFixed(2)} each</div>
            </div>
        `).join('')}
    `).join('')}

    <div class="double-line"></div>
    <div class="row"><span>Subtotal</span><span>PKR ${data.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>Tax</span><span>PKR ${data.tax.toFixed(2)}</span></div>
    ${data.deliveryCharges && data.deliveryCharges > 0 ? `<div class="row"><span>Delivery</span><span>PKR ${data.deliveryCharges.toFixed(2)}</span></div>` : ''}
    <div class="line"></div>
    <div class="row bold" style="font-size:14px">
        <span>TOTAL</span>
        <span>PKR ${data.total.toFixed(2)}</span>
    </div>

    ${data.paymentMethod ? `
    <div class="center" style="margin:8px 0;padding:5px;background:#4CAF50;color:white;border-radius:4px;font-weight:bold">
        ${data.paymentMethod === 'cash' ? '💵 CASH' : data.paymentMethod === 'online' ? '💳 ONLINE' : data.paymentMethod.toUpperCase()}
    </div>
    ` : ''}

    ${data.notes ? `
    <div class="line"></div>
    <div class="bold">Special Instructions:</div>
    <div style="padding:4px;background:#fffacd;margin:4px 0">${data.notes}</div>
    ` : ''}

    <div class="double-line"></div>
    <div class="center bold">Thank you for dining with us! 🙏</div>
    <div class="center" style="font-size:10px;margin-top:3px">Please visit again</div>
    <div class="center" style="font-size:9px;margin-top:5px;color:#666">Powered by AT Restaurant POS</div>

    <script>
        window.onload = () => {
            setTimeout(() => window.print(), 500);
        };
        window.onafterprint = () => {
            setTimeout(() => window.close(), 1000);
        };
    </script>
</body>
</html>
        `
    }
}

export const thermalPrinter = new ThermalPrinter()
export default ThermalPrinter
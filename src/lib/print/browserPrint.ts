// src/lib/print/browserPrint.ts
import { ReceiptData } from '@/types'

export class BrowserPrint {
    static print(receipt: ReceiptData): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const html = this.formatReceiptHTML(receipt)
                const blob = new Blob([html], { type: 'text/html' })
                const url = URL.createObjectURL(blob)

                const printWindow = window.open(url, '_blank', 'width=300,height=600')

                if (!printWindow) {
                    console.error('Popup blocked')
                    URL.revokeObjectURL(url)
                    resolve(false)
                    return
                }

                printWindow.onload = () => {
                    printWindow.focus()
                    setTimeout(() => {
                        printWindow.print()
                        setTimeout(() => {
                            printWindow.close()
                            URL.revokeObjectURL(url)
                            resolve(true)
                        }, 1000)
                    }, 500)
                }

                setTimeout(() => {
                    if (!printWindow.closed) {
                        printWindow.print()
                        URL.revokeObjectURL(url)
                        resolve(true)
                    }
                }, 2000)

            } catch (error) {
                console.error('Browser print error:', error)
                resolve(false)
            }
        })
    }

    private static formatReceiptHTML(data: ReceiptData): string {
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
        @page { size: 80mm auto; margin: 0; }
        @media print { body { padding: 0 !important; margin: 0 !important; } .no-print { display: none !important; } }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 12px;
            line-height: 1.5;
            padding: 10px;
            background: white;
            color: black;
            max-width: 300px;
            margin: 0 auto;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .large { font-size: 16px; font-weight: bold; }
        .small { font-size: 10px; }
        .line { border-bottom: 1px dashed #333; margin: 8px 0; }
        .double-line { border-bottom: 2px solid #000; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .category { font-weight: bold; background: #f5f5f5; padding: 4px 6px; margin: 8px 0 4px 0; border-left: 3px solid #333; font-size: 11px; }
        .item { margin: 6px 0; }
        .item-row { display: flex; justify-content: space-between; font-weight: 500; }
        .indent { padding-left: 16px; font-size: 10px; color: #666; margin-top: 2px; }
        .total-section { background: #f9f9f9; padding: 8px; margin: 10px 0; border: 1px solid #ddd; }
        .total-row { font-size: 15px; font-weight: bold; margin-top: 6px; padding-top: 6px; border-top: 2px solid #333; }
        .delivery-box { background: #f0f8ff; border: 1px solid #0066cc; padding: 8px; margin: 10px 0; border-radius: 4px; }
        .payment-badge { display: inline-block; padding: 6px 12px; background: #4CAF50; color: white; border-radius: 4px; font-weight: bold; margin: 8px 0; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="center">
        <div class="large">${data.restaurantName || 'AT RESTAURANT'}</div>
        <div class="small">${data.tagline || 'Delicious Food, Memorable Moments'}</div>
    </div>
    <div class="line"></div>
    <div class="center small">
        <div>${data.address || 'Sooter Mills Rd, Lahore'}</div>
        ${data.phone ? `<div>${data.phone}</div>` : ''}
    </div>
    <div class="double-line"></div>

    <div class="row"><span>Order #</span><span class="bold">${data.orderNumber}</span></div>
    <div class="row"><span>Date</span><span>${data.date}</span></div>
    <div class="row"><span>Type</span><span class="bold">${data.orderType === 'delivery' ? '🚚 DELIVERY' : '🍽️ DINE-IN'}</span></div>
    ${data.tableNumber ? `<div class="row"><span>Table</span><span class="bold">#${data.tableNumber}</span></div>` : ''}
    ${data.waiter ? `<div class="row"><span>Waiter</span><span>${data.waiter}</span></div>` : ''}
    <div class="line"></div>

    ${data.orderType === 'delivery' && (data.customerName || data.customerPhone) ? `
    <div class="delivery-box">
        <div class="bold center">📦 DELIVERY DETAILS</div>
        <div class="line" style="margin: 4px 0;"></div>
        ${data.customerName ? `<div class="row"><span>Name:</span><span>${data.customerName}</span></div>` : ''}
        ${data.customerPhone ? `<div class="row"><span>Phone:</span><span>${data.customerPhone}</span></div>` : ''}
        ${data.deliveryAddress ? `<div style="margin-top: 4px;"><strong>Address:</strong><br>${data.deliveryAddress}</div>` : ''}
    </div>
    ` : ''}

    <div class="bold">ORDER ITEMS</div>
    <div class="line"></div>
    
    ${Object.entries(grouped).map(([category, items]) => `
        <div class="category">${category}</div>
        ${items.map(item => `
            <div class="item">
                <div class="item-row">
                    <span>${item.quantity}× ${item.name}</span>
                    <span class="bold">PKR ${item.total.toFixed(2)}</span>
                </div>
                <div class="indent">@ PKR ${item.price.toFixed(2)} each</div>
            </div>
        `).join('')}
    `).join('')}

    <div class="double-line"></div>
    <div class="total-section">
        <div class="row"><span>Subtotal</span><span>PKR ${data.subtotal.toFixed(2)}</span></div>
        <div class="row"><span>Tax</span><span>PKR ${data.tax.toFixed(2)}</span></div>
        ${data.deliveryCharges && data.deliveryCharges > 0 ? `<div class="row"><span>Delivery</span><span>PKR ${data.deliveryCharges.toFixed(2)}</span></div>` : ''}
        <div class="total-row row">
            <span>TOTAL</span>
            <span>PKR ${data.total.toFixed(2)}</span>
        </div>
    </div>

    ${data.paymentMethod ? `
    <div class="center">
        <div class="payment-badge">
            ${data.paymentMethod === 'cash' ? '💵 CASH PAYMENT' : data.paymentMethod === 'online' ? '💳 ONLINE PAYMENT' : '💰 ' + data.paymentMethod.toUpperCase()}
        </div>
    </div>
    ` : ''}

    ${data.notes ? `
    <div class="line"></div>
    <div class="bold">Special Instructions:</div>
    <div style="padding: 6px; background: #fffacd; border-left: 3px solid #ffd700; margin: 6px 0;">${data.notes}</div>
    ` : ''}

    <div class="double-line"></div>
    <div class="footer center">
        <div class="bold">Thank you for dining with us! 🙏</div>
        <div class="small" style="margin-top: 4px;">Please visit again</div>
        <div class="small" style="margin-top: 8px; color: #666;">Powered by AT Restaurant POS</div>
    </div>

    <script>
        window.onload = () => window.print();
        window.onafterprint = () => setTimeout(() => window.close(), 500);
    </script>
</body>
</html>
        `
    }
}

export default BrowserPrint
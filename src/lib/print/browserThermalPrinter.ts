// src/lib/print/browserThermalPrinter.ts - BROWSER COMPATIBLE
export interface ReceiptData {
    orderNumber: string
    date: string
    orderType: 'dine-in' | 'delivery'
    items: Array<{
        name: string
        quantity: number
        price: number
        total: number
        category?: string
    }>
    subtotal: number
    tax: number
    total: number
    paymentMethod?: string
    customerName?: string
    customerPhone?: string
    deliveryAddress?: string
    deliveryCharges?: number
    waiter?: string
    tableNumber?: number
}

export class BrowserThermalPrinter {
    /**
     * Print receipt using browser's native print API
     * Optimized for 80mm thermal printers
     */
    async printReceipt(data: ReceiptData): Promise<boolean> {
        try {
            const printWindow = window.open('', '_blank', 'width=300,height=600')

            if (!printWindow) {
                throw new Error('Popup blocked. Please allow popups.')
            }

            const html = this.generateReceiptHTML(data)

            printWindow.document.write(html)
            printWindow.document.close()

            // Wait for content to load
            await new Promise(resolve => setTimeout(resolve, 100))

            // Print
            printWindow.print()

            // Close after print dialog
            setTimeout(() => {
                printWindow.close()
            }, 500)

            return true
        } catch (error) {
            console.error('Print failed:', error)
            return false
        }
    }

    /**
     * Generate thermal printer optimized HTML
     */
    private generateReceiptHTML(data: ReceiptData): string {
        // Group items by category
        const itemsByCategory = this.groupItemsByCategory(data.items)

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Receipt - ${data.orderNumber}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        @page {
            size: 80mm auto;
            margin: 0;
        }
        
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            padding: 5mm;
            background: white;
            color: black;
            width: 80mm;
        }
        
        .header {
            text-align: center;
            margin-bottom: 10px;
            border-bottom: 2px dashed #000;
            padding-bottom: 10px;
        }
        
        .header h1 {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 3px;
        }
        
        .header p {
            font-size: 11px;
            margin: 2px 0;
        }
        
        .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
        }
        
        .divider-solid {
            border-top: 2px solid #000;
            margin: 8px 0;
        }
        
        .info {
            margin-bottom: 10px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 11px;
        }
        
        .info-label {
            font-weight: bold;
        }
        
        .delivery-info {
            background: #f0f0f0;
            padding: 8px;
            margin: 10px 0;
            border-left: 3px solid #000;
        }
        
        .delivery-info h3 {
            font-size: 12px;
            margin-bottom: 5px;
        }
        
        .category-header {
            background: #f0f0f0;
            padding: 5px;
            margin: 8px 0 3px 0;
            border-left: 3px solid #000;
            font-weight: bold;
            font-size: 11px;
            text-transform: uppercase;
        }
        
        .item {
            margin: 3px 0;
            padding-left: 5px;
        }
        
        .item-name {
            font-weight: bold;
            font-size: 11px;
        }
        
        .item-details {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #333;
            padding-left: 10px;
        }
        
        .totals {
            margin-top: 10px;
        }
        
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
        }
        
        .total-row.grand-total {
            font-weight: bold;
            font-size: 14px;
            padding-top: 5px;
            border-top: 2px solid #000;
        }
        
        .payment-method {
            text-align: center;
            margin: 10px 0;
            padding: 5px;
            background: #f0f0f0;
            font-weight: bold;
            font-size: 12px;
        }
        
        .footer {
            text-align: center;
            margin-top: 15px;
            border-top: 2px dashed #000;
            padding-top: 10px;
        }
        
        .footer p {
            margin: 3px 0;
            font-size: 11px;
        }
        
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
        <h1>AT RESTAURANT</h1>
        <p>Delicious Food, Memorable Moments</p>
        <p>Sooter Mills Rd, Lahore</p>
    </div>

    <!-- Order Info -->
    <div class="info">
        <div class="info-row">
            <span class="info-label">Order #:</span>
            <span>${data.orderNumber}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${data.date}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Type:</span>
            <span>${data.orderType === 'delivery' ? '🚚 DELIVERY' : '🍽️ DINE-IN'}</span>
        </div>
        ${data.tableNumber ? `
        <div class="info-row">
            <span class="info-label">Table:</span>
            <span>#${data.tableNumber}</span>
        </div>
        ` : ''}
        ${data.waiter ? `
        <div class="info-row">
            <span class="info-label">Waiter:</span>
            <span>${data.waiter}</span>
        </div>
        ` : ''}
    </div>

    <!-- Delivery Details -->
    ${data.orderType === 'delivery' && (data.customerName || data.customerPhone || data.deliveryAddress) ? `
    <div class="delivery-info">
        <h3>📦 DELIVERY DETAILS</h3>
        ${data.customerName ? `<p><strong>Name:</strong> ${data.customerName}</p>` : ''}
        ${data.customerPhone ? `<p><strong>Phone:</strong> ${data.customerPhone}</p>` : ''}
        ${data.deliveryAddress ? `<p><strong>Address:</strong> ${data.deliveryAddress}</p>` : ''}
    </div>
    ` : ''}

    <div class="divider"></div>

    <!-- Items -->
    <div class="items">
        <h3 style="font-size: 12px; margin-bottom: 8px;">ORDER ITEMS</h3>
        ${this.renderItemsByCategory(itemsByCategory)}
    </div>

    <div class="divider-solid"></div>

    <!-- Totals -->
    <div class="totals">
        <div class="total-row">
            <span>Subtotal:</span>
            <span>PKR ${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
            <span>Tax:</span>
            <span>PKR ${data.tax.toFixed(2)}</span>
        </div>
        ${data.deliveryCharges && data.deliveryCharges > 0 ? `
        <div class="total-row">
            <span>Delivery:</span>
            <span>PKR ${data.deliveryCharges.toFixed(2)}</span>
        </div>
        ` : ''}
        <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>PKR ${data.total.toFixed(2)}</span>
        </div>
    </div>

    <!-- Payment Method -->
    ${data.paymentMethod ? `
    <div class="payment-method">
        Payment: ${data.paymentMethod.toUpperCase()}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
        <p style="font-weight: bold;">Thank you for dining with us!</p>
        <p>Please visit again</p>
        <p style="margin-top: 8px; font-size: 10px;">Powered by AT Restaurant POS</p>
    </div>
</body>
</html>
        `
    }

    /**
     * Group items by category
     */
    private groupItemsByCategory(items: ReceiptData['items']): Record<string, ReceiptData['items']> {
        const grouped: Record<string, ReceiptData['items']> = {}

        items.forEach(item => {
            const category = item.category || 'Other'
            if (!grouped[category]) {
                grouped[category] = []
            }
            grouped[category].push(item)
        })

        return grouped
    }

    /**
     * Render items grouped by category
     */
    private renderItemsByCategory(itemsByCategory: Record<string, ReceiptData['items']>): string {
        return Object.entries(itemsByCategory)
            .map(([category, items]) => `
                <div class="category-header">${category}</div>
                ${items.map(item => `
                    <div class="item">
                        <div class="item-name">${item.quantity}x ${item.name}</div>
                        <div class="item-details">
                            <span>@ PKR ${item.price.toFixed(2)}</span>
                            <span>PKR ${item.total.toFixed(2)}</span>
                        </div>
                    </div>
                `).join('')}
            `).join('')
    }

    /**
     * Direct print using window.print() with optimized thermal layout
     */
    async quickPrint(receiptElement: HTMLElement): Promise<void> {
        const originalContent = document.body.innerHTML

        try {
            // Inject print styles
            const style = document.createElement('style')
            style.textContent = `
                @media print {
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #print-receipt, #print-receipt * {
                        visibility: visible;
                    }
                    #print-receipt {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 80mm;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                    }
                }
            `
            document.head.appendChild(style)

            // Prepare content
            const printDiv = document.createElement('div')
            printDiv.id = 'print-receipt'
            printDiv.innerHTML = receiptElement.innerHTML
            document.body.appendChild(printDiv)

            // Print
            window.print()

            // Cleanup
            document.body.removeChild(printDiv)
            document.head.removeChild(style)
        } catch (error) {
            document.body.innerHTML = originalContent
            throw error
        }
    }
}

// Export singleton
export const browserThermalPrinter = new BrowserThermalPrinter()
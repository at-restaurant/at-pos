// src/lib/print/ThermalFormatter.ts
// ✅ ENHANCED: Better restaurant name display with AT on top, RESTAURANT below
// ✅ Tighter spacing, smaller fonts for more info

import type { ReceiptData } from '@/types'

export class ThermalFormatter {
    private width: number

    constructor(width: number = 42) {
        this.width = width
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MAIN FORMATTING METHOD
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    format(data: ReceiptData): string {
        let receipt = ''

        // ✅ ESC/POS Commands
        receipt += '\x1B\x40'           // ESC @ - Initialize printer
        receipt += '\x1D\x50\x50\x00'   // GS P 80 0 - Set 80mm width

        // Enhanced Header
        receipt += this.formatEnhancedHeader(data)

        // Order Info (compact)
        receipt += this.formatOrderInfo(data)

        // Delivery Details (if applicable)
        if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
            receipt += this.formatDeliveryDetails(data)
        }

        // Items (compact)
        receipt += this.formatItems(data)

        // Totals
        receipt += this.formatTotals(data)

        // Payment Method
        if (data.paymentMethod) {
            receipt += this.formatPaymentMethod(data.paymentMethod)
        }

        // Notes
        if (data.notes) {
            receipt += this.formatNotes(data.notes)
        }

        // Footer
        receipt += this.formatFooter(data.orderType)

        return receipt
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ✅ ENHANCED HEADER - AT on top, RESTAURANT below, both centered
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatEnhancedHeader(data: ReceiptData): string {
        let text = ''

        // Large "AT" on first line (clean, not too spread)
        text += this.centerLarge('AT')
        text += '\n'

        // "RESTAURANT" on second line (normal but bold)
        text += this.centerBold('RESTAURANT')
        text += '\n\n'

        // Tagline (small, normal)
        text += this.centerSmall(data.tagline || 'Delicious Food, Memorable Moments')
        text += '\n'

        // Separator
        text += this.line('-')

        // Address (small)
        text += this.centerSmall(data.address || 'Sooter Mills Rd, Lahore')
        text += '\n'

        if (data.phone) {
            text += this.centerSmall(data.phone)
            text += '\n'
        }

        text += this.line('=')

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ORDER INFO - Compact with smaller text
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatOrderInfo(data: ReceiptData): string {
        let text = '\n'

        // Order number in bold
        text += this.leftRightBold('Order #:', data.orderNumber)

        // Date and time (small)
        text += this.leftRightSmall('Date:', data.date)

        // Order type
        const orderTypeLabel =
            data.orderType === 'delivery' ? 'DELIVERY' :
                data.orderType === 'takeaway' ? 'TAKEAWAY' :
                    'DINE-IN'

        text += this.leftRightSmall('Type:', orderTypeLabel)

        if (data.tableNumber) {
            text += this.leftRightSmall('Table:', `#${data.tableNumber}`)
        }

        if (data.waiter) {
            text += this.leftRightSmall('Waiter:', data.waiter)
        }

        text += this.line('-')

        return text
    }

    private formatDeliveryDetails(data: ReceiptData): string {
        let text = '\n'
        text += this.bold('DELIVERY DETAILS')
        text += '\n'
        text += this.line('-')

        if (data.customerName) {
            text += this.leftRightSmall('Name:', data.customerName)
        }
        if (data.customerPhone) {
            text += this.leftRightSmall('Phone:', data.customerPhone)
        }
        if (data.deliveryAddress) {
            text += this.small('Address: ')
            text += this.wrapTextSmall(data.deliveryAddress, this.width)
        }

        text += this.line('-')

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ITEMS - Compact with smaller price info
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatItems(data: ReceiptData): string {
        let text = '\n'
        text += this.bold('ORDER ITEMS')
        text += '\n'
        text += this.line('-')

        const grouped = this.groupByCategory(data.items)

        Object.entries(grouped).forEach(([category, items]) => {
            if (category && category !== 'Other' && category !== 'Uncategorized') {
                text += this.small(category)
                text += '\n'
            }

            items.forEach(item => {
                // Item name and total (normal size)
                const itemLine = `${item.quantity}x ${item.name}`
                const price = `${item.total.toFixed(0)}`
                text += this.leftRight(itemLine, price)

                // Unit price (small)
                text += this.small(`   @ PKR ${item.price.toFixed(0)} each`)
                text += '\n'
            })
        })

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TOTALS - Clear hierarchy
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private formatTotals(data: ReceiptData): string {
        let text = '\n' + this.line('=')

        // Subtotal and tax (small)
        text += this.leftRightSmall('Subtotal:', `PKR ${data.subtotal.toFixed(0)}`)
        text += this.leftRightSmall('Tax:', `PKR ${data.tax.toFixed(0)}`)

        if (data.deliveryCharges && data.deliveryCharges > 0) {
            text += this.leftRightSmall('Delivery:', `PKR ${data.deliveryCharges.toFixed(0)}`)
        }

        if (data.discount && data.discount > 0) {
            text += this.leftRightSmall('Discount:', `-PKR ${data.discount.toFixed(0)}`)
        }

        text += this.line('-')

        // Total (BOLD and LARGE)
        text += this.leftRightLarge('TOTAL:', `PKR ${data.total.toFixed(0)}`)

        return text
    }

    private formatPaymentMethod(method: string): string {
        const display = method === 'cash' ? 'CASH' :
            method === 'online' ? 'ONLINE' :
                method === 'card' ? 'CARD' :
                    method.toUpperCase()

        let text = '\n' + this.centerBold(`Payment: ${display}`)

        return text
    }

    private formatNotes(notes: string): string {
        let text = '\n' + this.line('-')
        text += this.small('Special Instructions:')
        text += '\n'
        text += this.wrapTextSmall(notes, this.width)
        return text
    }

    private formatFooter(orderType?: 'dine-in' | 'delivery' | 'takeaway'): string {
        let text = '\n' + this.line('=')

        if (orderType === 'delivery') {
            text += this.center('Thank you for your order!')
            text += '\n'
            text += this.centerSmall('Order again soon!')
        } else if (orderType === 'takeaway') {
            text += this.center('Thank you for your order!')
            text += '\n'
            text += this.centerSmall('Enjoy your meal!')
        } else {
            text += this.center('Thank you for dining with us!')
            text += '\n'
            text += this.centerSmall('Visit us again!')
        }

        return text
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // TEXT FORMATTING HELPERS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    private bold(text: string): string {
        return `\x1B\x45\x01${text}\x1B\x45\x00` // ESC E 1 (bold on) ... ESC E 0 (bold off)
    }

    private small(text: string): string {
        return `\x1B\x21\x01${text}\x1B\x21\x00` // ESC ! 1 (small) ... ESC ! 0 (normal)
    }

    private large(text: string): string {
        return `\x1B\x21\x30${text}\x1B\x21\x00` // ESC ! 48 (double width+height) ... ESC ! 0 (normal)
    }

    private centerLarge(text: string): string {
        const effectiveWidth = Math.floor(this.width / 2) // Large text takes 2x space
        const pad = Math.max(0, Math.floor((effectiveWidth - text.length) / 2))
        return this.large(' '.repeat(pad) + text)
    }

    private centerBold(text: string): string {
        const pad = Math.max(0, Math.floor((this.width - text.length) / 2))
        return this.bold(' '.repeat(pad) + text)
    }

    private center(text: string): string {
        const pad = Math.max(0, Math.floor((this.width - text.length) / 2))
        return ' '.repeat(pad) + text
    }

    private centerSmall(text: string): string {
        const pad = Math.max(0, Math.floor((this.width - text.length) / 2))
        return this.small(' '.repeat(pad) + text)
    }

    private leftRight(left: string, right: string): string {
        const maxLeft = this.width - right.length - 1
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left
        const spaces = this.width - truncatedLeft.length - right.length
        const padding = ' '.repeat(Math.max(1, spaces))
        return truncatedLeft + padding + right + '\n'
    }

    private leftRightSmall(left: string, right: string): string {
        const maxLeft = this.width - right.length - 1
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left
        const spaces = this.width - truncatedLeft.length - right.length
        const padding = ' '.repeat(Math.max(1, spaces))
        return this.small(truncatedLeft + padding + right) + '\n'
    }

    private leftRightBold(left: string, right: string): string {
        const maxLeft = this.width - right.length - 1
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left
        const spaces = this.width - truncatedLeft.length - right.length
        const padding = ' '.repeat(Math.max(1, spaces))
        return this.bold(truncatedLeft + padding + right) + '\n'
    }

    private leftRightLarge(left: string, right: string): string {
        const effectiveWidth = Math.floor(this.width / 2)
        const maxLeft = effectiveWidth - right.length - 1
        const truncatedLeft = left.length > maxLeft
            ? left.substring(0, maxLeft - 3) + '...'
            : left
        const spaces = effectiveWidth - truncatedLeft.length - right.length
        const padding = ' '.repeat(Math.max(1, spaces))
        return this.large(truncatedLeft + padding + right) + '\n'
    }

    private line(char: string): string {
        return char.repeat(this.width) + '\n'
    }

    private wrapTextSmall(text: string, width: number): string {
        const words = text.split(' ')
        const lines: string[] = []
        let currentLine = ''

        words.forEach(word => {
            if ((currentLine + word).length <= width) {
                currentLine += (currentLine ? ' ' : '') + word
            } else {
                if (currentLine) lines.push(this.small(currentLine))
                currentLine = word
            }
        })
        if (currentLine) lines.push(this.small(currentLine))

        return lines.join('\n') + '\n'
    }

    private groupByCategory(items: any[]): Record<string, any[]> {
        const grouped: Record<string, any[]> = {}

        items.forEach(item => {
            let category = 'Other'

            if (item.category) {
                category = item.category.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
                if (!category) {
                    category = item.category
                }
            }

            if (!grouped[category]) {
                grouped[category] = []
            }
            grouped[category].push(item)
        })

        return grouped
    }

    setWidth(width: number) {
        this.width = width
    }

    getWidth(): number {
        return this.width
    }
}

export default ThermalFormatter
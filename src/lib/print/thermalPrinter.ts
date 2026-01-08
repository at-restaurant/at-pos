// src/lib/print/thermalPrinter.ts - COMPATIBLE WITH RAW PRINTER SERVICE
import { ReceiptData, PrintResponse } from '@/types'
import BrowserPrint from './browserPrint'

export class ThermalPrinter {
    private ws: WebSocket | null = null
    private reconnectTimeout: NodeJS.Timeout | null = null
    private messageHandlers: Map<string, (data: any) => void> = new Map()
    private connectionAttempts = 0
    private maxReconnectAttempts = 3 // Reduced for faster fallback
    private isManualDisconnect = false

    // Always localhost - printer service runs on client PC
    private readonly wsUrl = typeof window !== 'undefined' ? 'ws://localhost:3002' : ''

    constructor() {
        if (typeof window !== 'undefined') {
            console.log('🔌 ThermalPrinter: Initializing connection to local printer service')
            this.connect()
        }
    }

    // ===================================
    // CONNECTION MANAGEMENT
    // ===================================
    private connect() {
        if (!this.wsUrl || this.isManualDisconnect) return

        try {
            console.log(`🔌 Connecting to: ${this.wsUrl}`)
            this.ws = new WebSocket(this.wsUrl)

            this.ws.onopen = () => {
                console.log('✅ Printer service connected')
                this.connectionAttempts = 0

                if (this.reconnectTimeout) {
                    clearTimeout(this.reconnectTimeout)
                    this.reconnectTimeout = null
                }
            }

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log('📨 Received:', data.type)

                    const handler = this.messageHandlers.get(data.type)
                    if (handler) {
                        handler(data)
                    }
                } catch (error) {
                    console.error('Failed to parse message:', error)
                }
            }

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error)
            }

            this.ws.onclose = () => {
                console.log('👋 Printer service disconnected')
                this.ws = null

                if (!this.isManualDisconnect && this.connectionAttempts < this.maxReconnectAttempts) {
                    this.connectionAttempts++
                    const delay = Math.min(1000 * this.connectionAttempts, 3000) // Max 3s delay

                    console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.connectionAttempts}/${this.maxReconnectAttempts})`)

                    this.reconnectTimeout = setTimeout(() => {
                        this.connect()
                    }, delay)
                } else if (this.connectionAttempts >= this.maxReconnectAttempts) {
                    console.log('⚠️ Max reconnection attempts reached. Using browser print fallback.')
                }
            }
        } catch (error) {
            console.error('Connection error:', error)
        }
    }

    private waitForConnection(timeout: number = 3000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                resolve()
                return
            }

            let attempts = 0
            const maxAttempts = Math.floor(timeout / 300)

            const checkConnection = () => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    resolve()
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Printer service not available'))
                } else {
                    attempts++
                    setTimeout(checkConnection, 300)
                }
            }

            checkConnection()
        })
    }

    // ===================================
    // MAIN PRINT METHOD - FAST FALLBACK
    // ===================================
    async print(receipt: ReceiptData): Promise<PrintResponse> {
        console.log('🖨️ Print job started:', receipt.orderNumber)

        // Quick check - if not connected, fallback immediately
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('⚡ Service offline - Using browser print immediately')
            return await this.printViaBrowser(receipt)
        }

        // Try WebSocket with short timeout (3s)
        try {
            const result = await Promise.race([
                this.printViaWebSocket(receipt),
                new Promise<PrintResponse>((_, reject) =>
                    setTimeout(() => reject(new Error('Print timeout')), 3000)
                )
            ])

            if (result.success) {
                return result
            } else {
                throw new Error(result.error || 'Print failed')
            }
        } catch (error: any) {
            console.warn('⚠️ WebSocket print failed:', error.message)
            console.log('🌐 Falling back to browser print')

            // Automatic fallback to browser print
            return await this.printViaBrowser(receipt)
        }
    }

    // ===================================
    // WEBSOCKET PRINT
    // ===================================
    private async printViaWebSocket(receipt: ReceiptData): Promise<PrintResponse> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.messageHandlers.delete('PRINT_SUCCESS')
                this.messageHandlers.delete('PRINT_ERROR')
                console.log('⏱️ Print timeout')
                resolve({
                    success: false,
                    error: 'Print timeout',
                    orderNumber: receipt.orderNumber
                })
            }, 10000)

            // Success handler
            this.messageHandlers.set('PRINT_SUCCESS', (data) => {
                clearTimeout(timeout)
                this.messageHandlers.delete('PRINT_SUCCESS')
                this.messageHandlers.delete('PRINT_ERROR')
                console.log('✅ Print successful:', data.message)
                resolve({
                    success: true,
                    message: data.message || 'Print completed',
                    orderNumber: receipt.orderNumber
                })
            })

            // Error handler
            this.messageHandlers.set('PRINT_ERROR', (data) => {
                clearTimeout(timeout)
                this.messageHandlers.delete('PRINT_SUCCESS')
                this.messageHandlers.delete('PRINT_ERROR')
                console.error('❌ Print error:', data.error)
                resolve({
                    success: false,
                    error: data.error || 'Print failed',
                    orderNumber: receipt.orderNumber
                })
            })

            // Send print command
            try {
                this.ws!.send(JSON.stringify({
                    type: 'PRINT_RECEIPT',
                    payload: { receiptData: receipt }
                }))
                console.log('📤 Print command sent to raw printer service')
            } catch (error: any) {
                clearTimeout(timeout)
                this.messageHandlers.delete('PRINT_SUCCESS')
                this.messageHandlers.delete('PRINT_ERROR')
                resolve({
                    success: false,
                    error: error.message,
                    orderNumber: receipt.orderNumber
                })
            }
        })
    }

    // ===================================
    // BROWSER PRINT FALLBACK
    // ===================================
    private async printViaBrowser(receipt: ReceiptData): Promise<PrintResponse> {
        try {
            console.log('🌐 Using browser print dialog')
            const success = await BrowserPrint.print(receipt)
            return {
                success,
                message: success ? 'Printed via browser' : 'Browser print cancelled',
                orderNumber: receipt.orderNumber
            }
        } catch (error: any) {
            console.error('Browser print error:', error)
            return {
                success: false,
                error: error.message,
                orderNumber: receipt.orderNumber
            }
        }
    }

    // ===================================
    // TEST PRINT
    // ===================================
    async testPrint(printerName: string): Promise<PrintResponse> {
        console.log('🧪 Test print requested for:', printerName)

        try {
            await this.waitForConnection(2000) // 2s timeout

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return {
                    success: false,
                    error: 'Printer service not connected'
                }
            }

            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.messageHandlers.delete('PRINT_SUCCESS')
                    this.messageHandlers.delete('PRINT_ERROR')
                    resolve({
                        success: false,
                        error: 'Test print timeout'
                    })
                }, 10000)

                this.messageHandlers.set('PRINT_SUCCESS', (data) => {
                    clearTimeout(timeout)
                    this.messageHandlers.delete('PRINT_SUCCESS')
                    this.messageHandlers.delete('PRINT_ERROR')
                    resolve({
                        success: true,
                        message: data.message || 'Test print completed'
                    })
                })

                this.messageHandlers.set('PRINT_ERROR', (data) => {
                    clearTimeout(timeout)
                    this.messageHandlers.delete('PRINT_SUCCESS')
                    this.messageHandlers.delete('PRINT_ERROR')
                    resolve({
                        success: false,
                        error: data.error || 'Test print failed'
                    })
                })

                this.ws!.send(JSON.stringify({
                    type: 'TEST_PRINT',
                    payload: { printerName }
                }))
            })
        } catch (error: any) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    // ===================================
    // GET PRINTERS
    // ===================================
    async getPrinters(): Promise<any[]> {
        try {
            await this.waitForConnection(2000) // 2s timeout

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.log('⚠️ Printer service not connected')
                return []
            }

            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    this.messageHandlers.delete('PRINTER_LIST')
                    resolve([])
                }, 5000)

                this.messageHandlers.set('PRINTER_LIST', (data) => {
                    clearTimeout(timeout)
                    this.messageHandlers.delete('PRINTER_LIST')
                    console.log('📋 Printers received:', data.printers?.length || 0)
                    resolve(data.printers || [])
                })

                this.ws!.send(JSON.stringify({
                    type: 'GET_PRINTERS'
                }))
            })
        } catch (error) {
            console.error('Failed to get printers:', error)
            return []
        }
    }

    // ===================================
    // UTILITY METHODS
    // ===================================
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN
    }

    reconnect(): void {
        console.log('🔄 Manual reconnect triggered')
        this.connectionAttempts = 0
        this.isManualDisconnect = false

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        if (this.ws) {
            this.ws.close()
        }

        this.connect()
    }

    disconnect(): void {
        console.log('🔌 Manual disconnect')
        this.isManualDisconnect = true

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout)
            this.reconnectTimeout = null
        }

        if (this.ws) {
            this.ws.close()
            this.ws = null
        }

        this.messageHandlers.clear()
    }

    getStatus(): {
        connected: boolean
        attempts: number
        maxAttempts: number
        willRetry: boolean
    } {
        return {
            connected: this.isConnected(),
            attempts: this.connectionAttempts,
            maxAttempts: this.maxReconnectAttempts,
            willRetry: this.connectionAttempts < this.maxReconnectAttempts && !this.isManualDisconnect
        }
    }

    // ===================================
    // PING/PONG HEALTH CHECK
    // ===================================
    async ping(): Promise<boolean> {
        if (!this.isConnected()) {
            return false
        }

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.messageHandlers.delete('PONG')
                resolve(false)
            }, 3000)

            this.messageHandlers.set('PONG', () => {
                clearTimeout(timeout)
                this.messageHandlers.delete('PONG')
                resolve(true)
            })

            try {
                this.ws!.send(JSON.stringify({ type: 'PING' }))
            } catch {
                clearTimeout(timeout)
                this.messageHandlers.delete('PONG')
                resolve(false)
            }
        })
    }
}

// ===================================
// SINGLETON EXPORT
// ===================================
export const thermalPrinter = new ThermalPrinter()
export default ThermalPrinter
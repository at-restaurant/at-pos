// printer-service/server.js - FINAL PRODUCTION VERSION
// Supports: Windows 32-bit & 64-bit | Auto-reconnect | Safe error handling
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');

// ===================================
// SAFE PRINTER MODULE LOADING
// ===================================
let printer;
try {
    printer = require('printer');
    console.log('✅ Printer module loaded successfully');
} catch (error) {
    console.log('⚠️  Printer module not available');
    console.log('   Install with: npm install printer --build-from-source');
    console.log('   For 32-bit: npm install printer --build-from-source --target_arch=ia32');
    console.log('   For 64-bit: npm install printer --build-from-source --target_arch=x64');
    printer = null;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3002;
const clients = new Set();

console.log('='.repeat(70));
console.log('🖨️  AT RESTAURANT - PRODUCTION PRINTER SERVICE');
console.log('='.repeat(70));

// ===================================
// WEBSOCKET CONNECTION HANDLER
// ===================================
wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`✅ Client connected: ${clientIp} (Total: ${clients.size + 1})`);
    clients.add(ws);

    // Send connection success with printer list
    const printers = detectWindowsPrinters();
    ws.send(JSON.stringify({
        type: 'CONNECTION_SUCCESS',
        printers,
        platform: os.platform(),
        arch: os.arch(),
        timestamp: new Date().toISOString()
    }));

    // Handle incoming messages
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`📨 Command received: ${data.type}`);

            switch(data.type) {
                case 'PRINT_RECEIPT':
                    await handlePrintReceipt(ws, data.payload);
                    break;

                case 'TEST_PRINT':
                    await handleTestPrint(ws, data.payload);
                    break;

                case 'GET_PRINTERS':
                    const currentPrinters = detectWindowsPrinters();
                    ws.send(JSON.stringify({
                        type: 'PRINTER_LIST',
                        printers: currentPrinters,
                        timestamp: new Date().toISOString()
                    }));
                    break;

                case 'PING':
                    ws.send(JSON.stringify({
                        type: 'PONG',
                        timestamp: new Date().toISOString()
                    }));
                    break;

                default:
                    ws.send(JSON.stringify({
                        type: 'ERROR',
                        error: `Unknown command: ${data.type}`
                    }));
            }
        } catch (error) {
            console.error('❌ Message handling error:', error);
            ws.send(JSON.stringify({
                type: 'ERROR',
                error: error.message
            }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`👋 Client disconnected (Remaining: ${clients.size})`);
    });

    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        clients.delete(ws);
    });
});

// ===================================
// PRINTER DETECTION
// ===================================
function detectWindowsPrinters() {
    if (!printer) {
        console.log('⚠️  Printer module not loaded - returning empty list');
        return [];
    }

    try {
        const printers = printer.getPrinters();

        if (printers.length === 0) {
            console.log('⚠️  No printers detected in Windows');
            return [];
        }

        const formattedPrinters = printers.map((p, index) => ({
            id: `printer_${index}`,
            name: p.name,
            driver: p.driverName || 'Unknown',
            status: p.status || 'Ready',
            connected: p.status !== 'Offline',
            isDefault: p.isDefault || false,
            type: (p.portName || '').toUpperCase().includes('USB') ? 'usb' : 'system',
            portName: p.portName || 'Unknown'
        })).sort((a, b) => {
            // Priority: USB > Default > Others
            if (a.type === 'usb' && b.type !== 'usb') return -1;
            if (a.type !== 'usb' && b.type === 'usb') return 1;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return 0;
        });

        console.log(`📊 Found ${formattedPrinters.length} printer(s)`);
        return formattedPrinters;
    } catch (error) {
        console.error('❌ Printer detection error:', error);
        return [];
    }
}

// ===================================
// PRINT HANDLERS
// ===================================
async function handlePrintReceipt(ws, data) {
    const { receiptData } = data;

    // Validate receipt data
    if (!receiptData || !receiptData.items || !Array.isArray(receiptData.items)) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'Invalid receipt data: missing items array'
        }));
        return;
    }

    if (!printer) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'Printer module not available. Please install: npm install printer --build-from-source'
        }));
        return;
    }

    const printers = detectWindowsPrinters();

    if (printers.length === 0) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'No printers available. Please connect a printer and restart service.'
        }));
        return;
    }

    // Smart printer selection
    const targetPrinter =
        printers.find(p => p.type === 'usb' && p.connected) ||
        printers.find(p => p.isDefault && p.connected) ||
        printers.find(p => p.connected) ||
        printers[0];

    console.log(`🎯 Selected printer: ${targetPrinter.name} (${targetPrinter.type})`);

    try {
        const receiptText = formatReceipt(receiptData);
        await printToWindowsPrinter(targetPrinter.name, receiptText);

        ws.send(JSON.stringify({
            type: 'PRINT_SUCCESS',
            message: 'Receipt printed successfully',
            printer: targetPrinter.name,
            orderNumber: receiptData.orderNumber,
            timestamp: new Date().toISOString()
        }));

        console.log(`✅ Print completed: Order ${receiptData.orderNumber}`);
    } catch (error) {
        console.error('❌ Print failed:', error);
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: `Print failed: ${error.message}`,
            timestamp: new Date().toISOString()
        }));
    }
}

async function handleTestPrint(ws, data) {
    const { printerName } = data;

    if (!printerName) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'Printer name is required for test print'
        }));
        return;
    }

    if (!printer) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'Printer module not available'
        }));
        return;
    }

    const testReceipt = formatReceipt({
        restaurantName: 'AT RESTAURANT',
        tagline: '✅ Test Print Successful',
        address: 'Sooter Mills Rd, Lahore',
        orderNumber: 'TEST-' + Date.now(),
        date: new Date().toLocaleString('en-PK'),
        orderType: 'dine-in',
        items: [
            { name: 'Test Item 1', quantity: 1, price: 100, total: 100, category: '🧪 Test Category' },
            { name: 'Test Item 2', quantity: 2, price: 50, total: 100, category: '🧪 Test Category' }
        ],
        subtotal: 200,
        tax: 0,
        total: 200
    });

    try {
        await printToWindowsPrinter(printerName, testReceipt);
        ws.send(JSON.stringify({
            type: 'PRINT_SUCCESS',
            message: `Test print sent to ${printerName}`
        }));
        console.log(`✅ Test print completed on ${printerName}`);
    } catch (error) {
        console.error('❌ Test print failed:', error);
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: error.message
        }));
    }
}

function printToWindowsPrinter(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        if (!printer) {
            reject(new Error('Printer module not loaded'));
            return;
        }

        try {
            printer.printDirect({
                data: receiptText,
                printer: printerName,
                type: 'RAW',
                success: (jobId) => {
                    console.log(`✅ Print job ${jobId} sent to ${printerName}`);
                    resolve({ success: true, jobId });
                },
                error: (err) => {
                    console.error('❌ Print error:', err);
                    reject(new Error(`Print failed: ${err}`));
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

// ===================================
// RECEIPT FORMATTING (ESC/POS)
// ===================================
function formatReceipt(data) {
    const W = 42; // Width for 80mm thermal paper
    const line = '─'.repeat(W);
    const doubleLine = '═'.repeat(W);

    let receipt = '\n';

    // Header
    receipt += center(data.restaurantName || 'AT RESTAURANT', W) + '\n';
    receipt += center(data.tagline || 'Delicious Food, Memorable Moments', W) + '\n';
    receipt += line + '\n';
    receipt += center(data.address || 'Sooter Mills Rd, Lahore', W) + '\n';
    if (data.phone) receipt += center(data.phone, W) + '\n';
    receipt += doubleLine + '\n\n';

    // Order Info
    receipt += `Order #: ${data.orderNumber}\n`;
    receipt += `Date: ${data.date}\n`;
    receipt += `Type: ${data.orderType === 'delivery' ? '🚚 DELIVERY' : '🍽️ DINE-IN'}\n`;
    if (data.tableNumber) receipt += `Table: #${data.tableNumber}\n`;
    if (data.waiter) receipt += `Waiter: ${data.waiter}\n`;
    receipt += line + '\n\n';

    // Delivery Details
    if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
        receipt += '📦 DELIVERY DETAILS\n' + line + '\n';
        if (data.customerName) receipt += `Name: ${data.customerName}\n`;
        if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`;
        if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`;
        receipt += line + '\n\n';
    }

    // Items (Grouped by Category)
    receipt += '📋 ORDER ITEMS\n' + line + '\n';
    const grouped = {};
    (data.items || []).forEach(item => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    Object.entries(grouped).forEach(([category, items]) => {
        receipt += `\n${category}\n`;
        items.forEach(item => {
            const itemLine = `${item.quantity}x ${item.name}`;
            const price = `PKR ${(item.total || 0).toFixed(2)}`;
            receipt += leftRight(itemLine, price, W) + '\n';
            receipt += `   @ PKR ${(item.price || 0).toFixed(2)} each\n`;
        });
    });

    // Totals
    receipt += '\n' + doubleLine + '\n';
    receipt += leftRight('Subtotal:', `PKR ${(data.subtotal || 0).toFixed(2)}`, W) + '\n';
    receipt += leftRight('Tax:', `PKR ${(data.tax || 0).toFixed(2)}`, W) + '\n';
    if (data.deliveryCharges && data.deliveryCharges > 0) {
        receipt += leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`, W) + '\n';
    }
    receipt += line + '\n';
    receipt += leftRight('TOTAL:', `PKR ${(data.total || 0).toFixed(2)}`, W) + '\n';

    // Payment Method
    if (data.paymentMethod) {
        receipt += '\n' + center(`💳 Payment: ${data.paymentMethod.toUpperCase()}`, W) + '\n';
    }

    // Special Notes
    if (data.notes) {
        receipt += '\n' + line + '\n';
        receipt += '📝 Special Instructions:\n';
        receipt += wrapText(data.notes, W) + '\n';
    }

    // Footer
    receipt += '\n' + doubleLine + '\n';
    receipt += center('🙏 Thank you for dining with us!', W) + '\n';
    receipt += center('Please visit again', W) + '\n\n';
    receipt += center('Powered by AT Restaurant POS', W) + '\n';
    receipt += center(new Date().toLocaleDateString('en-PK'), W) + '\n\n\n';

    // ESC/POS Cut Command
    receipt += '\x1B\x69'; // Cut paper

    return receipt;
}

function center(text, width = 42) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
}

function leftRight(left, right, width = 42) {
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
}

function wrapText(text, width = 42) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + word).length <= width) {
            currentLine += (currentLine ? ' ' : '') + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });
    if (currentLine) lines.push(currentLine);

    return lines.join('\n');
}

// ===================================
// HTTP ENDPOINTS
// ===================================
app.get('/health', (req, res) => {
    const printers = detectWindowsPrinters();
    res.json({
        status: 'online',
        service: 'AT Restaurant Printer Service',
        version: '3.0.0-production',
        platform: `${os.platform()} ${os.arch()}`,
        nodeVersion: process.version,
        clients: clients.size,
        printers: printers.length,
        printersList: printers,
        printerModuleLoaded: printer !== null,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    const printers = detectWindowsPrinters();
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AT Restaurant Printer Service</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        .status {
            padding: 30px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        .status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .stat-box {
            background: white;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .stat-label { font-size: 12px; color: #6c757d; text-transform: uppercase; }
        .stat-value { font-size: 24px; font-weight: bold; color: #212529; margin-top: 5px; }
        .online { color: #28a745; }
        .offline { color: #dc3545; }
        .section {
            padding: 30px;
        }
        .section h2 {
            font-size: 20px;
            margin-bottom: 20px;
            color: #212529;
        }
        .printer {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 15px;
            border-left: 4px solid #28a745;
        }
        .printer.offline { border-left-color: #dc3545; }
        .printer-name {
            font-size: 18px;
            font-weight: bold;
            color: #212529;
            margin-bottom: 10px;
        }
        .printer-details {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
            font-size: 14px;
            color: #6c757d;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-usb { background: #e3f2fd; color: #1976d2; }
        .badge-default { background: #fff3cd; color: #856404; }
        .badge-online { background: #d4edda; color: #155724; }
        .badge-offline { background: #f8d7da; color: #721c24; }
        .empty {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
        .empty-icon { font-size: 64px; margin-bottom: 20px; }
        code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
        }
        .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #6c757d;
            font-size: 14px;
            border-top: 1px solid #e9ecef;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🖨️ AT Restaurant Printer Service</h1>
            <p>Production WebSocket Printer Server</p>
        </div>

        <div class="status">
            <h2 class="online">✅ Service Online</h2>
            <div class="status-grid">
                <div class="stat-box">
                    <div class="stat-label">Platform</div>
                    <div class="stat-value">${os.platform()} ${os.arch()}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Node Version</div>
                    <div class="stat-value">${process.version}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Active Clients</div>
                    <div class="stat-value">${clients.size}</div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Uptime</div>
                    <div class="stat-value">${Math.floor(process.uptime())}s</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>🖨️ Detected Printers (${printers.length})</h2>
            ${printers.length === 0 ? `
                <div class="empty">
                    <div class="empty-icon">🔍</div>
                    <p><strong>No printers detected</strong></p>
                    <p>Please connect a printer and restart the service</p>
                </div>
            ` : printers.map(p => `
                <div class="printer ${p.connected ? '' : 'offline'}">
                    <div class="printer-name">
                        ${p.name}
                        ${p.isDefault ? '<span class="badge badge-default">DEFAULT</span>' : ''}
                        ${p.type === 'usb' ? '<span class="badge badge-usb">USB</span>' : ''}
                        <span class="badge ${p.connected ? 'badge-online' : 'badge-offline'}">
                            ${p.connected ? 'ONLINE' : 'OFFLINE'}
                        </span>
                    </div>
                    <div class="printer-details">
                        <span>Driver: <strong>${p.driver}</strong></span>
                        <span>Port: <strong>${p.portName}</strong></span>
                        <span>Status: <strong>${p.status}</strong></span>
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>🧪 Quick Test</h2>
            <p>Test WebSocket connection from browser console:</p>
            <pre style="background: #f8f9fa; padding: 15px; border-radius: 8px; overflow-x: auto; margin-top: 10px;"><code>const ws = new WebSocket('ws://localhost:3002');
ws.onopen = () => ws.send(JSON.stringify({type: 'GET_PRINTERS'}));
ws.onmessage = (e) => console.log(JSON.parse(e.data));</code></pre>
        </div>

        <div class="footer">
            <p><strong>AT Restaurant POS</strong> • Version 3.0.0 Production</p>
            <p>Health Check: <code>http://localhost:3002/health</code></p>
        </div>
    </div>
</body>
</html>
    `);
});

// ===================================
// START SERVER
// ===================================
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ WebSocket Server: ws://localhost:${PORT}`);
    console.log(`✅ HTTP Interface: http://localhost:${PORT}`);
    console.log(`✅ Health Check: http://localhost:${PORT}/health`);
    console.log(`✅ Platform: ${os.platform()} ${os.arch()}`);
    console.log(`✅ Node: ${process.version}`);
    console.log(`✅ Printer Module: ${printer ? '✅ Loaded' : '❌ Not Available'}`);
    console.log('='.repeat(70));

    const printers = detectWindowsPrinters();
    if (printers.length === 0) {
        console.log('⚠️  WARNING: No printers detected!');
        console.log('');
        console.log('   Troubleshooting:');
        console.log('   1. Check: Control Panel → Devices and Printers');
        console.log('   2. Connect printer via USB');
        console.log('   3. Install printer driver');
        console.log('   4. Restart this service');
        if (!printer) {
            console.log('');
            console.log('   Also install printer module:');
            console.log('   - For 32-bit: npm install printer --build-from-source --target_arch=ia32');
            console.log('   - For 64-bit: npm install printer --build-from-source --target_arch=x64');
        }
    } else {
        console.log(`✅ Detected ${printers.length} printer(s):`);
        printers.forEach(p => {
            const tags = [];
            if (p.type === 'usb') tags.push('USB');
            if (p.isDefault) tags.push('DEFAULT');
            if (!p.connected) tags.push('OFFLINE');
            console.log(`   📍 ${p.name} ${tags.length ? `(${tags.join(', ')})` : ''}`);
        });
    }
    console.log('='.repeat(70));
    console.log('🎯 Service ready for connections!');
    console.log('');
    console.log('📱 Open http://localhost:3002 for status page');
    console.log('');
});

// ===================================
// GRACEFUL SHUTDOWN
// ===================================
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function shutdown() {
    console.log('\n👋 Shutting down gracefully...');

    // Notify all connected clients
    clients.forEach(ws => {
        try {
            ws.send(JSON.stringify({
                type: 'SERVER_SHUTDOWN',
                message: 'Server is shutting down'
            }));
            ws.close();
        } catch (err) {
            // Ignore errors during shutdown
        }
    });

    server.close(() => {
        console.log('✅ Server closed successfully');
        process.exit(0);
    });

    // Force exit after 5 seconds
    setTimeout(() => {
        console.log('⚠️  Forced shutdown');
        process.exit(1);
    }, 5000);
}

// ===================================
// ERROR HANDLING
// ===================================
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Don't exit - keep service running
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit - keep service running
});
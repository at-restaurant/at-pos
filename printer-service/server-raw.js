// printer-service/server-raw.js - NO DRIVER NEEDED
// Works with Generic/Text Only printer
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3002;
const clients = new Set();

console.log('='.repeat(70));
console.log('🖨️  AT RESTAURANT - RAW PRINTER SERVICE (No Driver Needed)');
console.log('='.repeat(70));

// ===================================
// RAW PRINTING FUNCTION
// ===================================
function printRaw(printerName, text) {
    return new Promise((resolve, reject) => {
        // Create temp file
        const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.txt`);

        try {
            // Write receipt text to file
            fs.writeFileSync(tempFile, text, 'utf8');

            // Print using Windows copy command (works with Generic printer)
            const command = `copy "${tempFile}" "${printerName}"`;

            exec(command, (error, stdout, stderr) => {
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {}

                if (error) {
                    console.error('❌ Print error:', error);
                    reject(error);
                } else {
                    console.log('✅ Print successful');
                    resolve({ success: true });
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// ===================================
// GET WINDOWS PRINTERS
// ===================================
function getWindowsPrinters() {
    return new Promise((resolve) => {
        const command = 'wmic printer get name,default';

        exec(command, (error, stdout) => {
            if (error) {
                console.error('Failed to get printers:', error);
                resolve([]);
                return;
            }

            const lines = stdout.split('\n')
                .map(line => line.trim())
                .filter(line => line && !line.startsWith('Default') && !line.startsWith('Name'));

            const printers = lines.map((line, index) => {
                const parts = line.split(/\s+/);
                const isDefault = parts[0] === 'TRUE';
                const name = parts.slice(isDefault ? 1 : 0).join(' ').trim();

                if (!name) return null;

                return {
                    id: `printer_${index}`,
                    name: name,
                    isDefault: isDefault,
                    type: 'raw',
                    connected: true,
                    status: 'Ready'
                };
            }).filter(Boolean);

            console.log(`📊 Found ${printers.length} printer(s)`);
            resolve(printers);
        });
    });
}

// ===================================
// WEBSOCKET CONNECTION
// ===================================
wss.on('connection', async (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`✅ Client connected: ${clientIp}`);
    clients.add(ws);

    const printers = await getWindowsPrinters();
    ws.send(JSON.stringify({
        type: 'CONNECTION_SUCCESS',
        printers,
        platform: os.platform(),
        arch: os.arch(),
        timestamp: new Date().toISOString()
    }));

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log(`📨 Command: ${data.type}`);

            switch(data.type) {
                case 'PRINT_RECEIPT':
                    await handlePrintReceipt(ws, data.payload);
                    break;

                case 'TEST_PRINT':
                    await handleTestPrint(ws, data.payload);
                    break;

                case 'GET_PRINTERS':
                    const currentPrinters = await getWindowsPrinters();
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
            console.error('❌ Error:', error);
            ws.send(JSON.stringify({
                type: 'ERROR',
                error: error.message
            }));
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`👋 Client disconnected`);
    });
});

// ===================================
// PRINT HANDLERS
// ===================================
async function handlePrintReceipt(ws, data) {
    const { receiptData } = data;

    if (!receiptData || !receiptData.items) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'Invalid receipt data'
        }));
        return;
    }

    const printers = await getWindowsPrinters();

    if (printers.length === 0) {
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: 'No printers found. Please add a printer in Windows.'
        }));
        return;
    }

    // Use default printer or first available
    const targetPrinter = printers.find(p => p.isDefault) || printers[0];
    console.log(`🎯 Selected: ${targetPrinter.name}`);

    try {
        const receiptText = formatReceipt(receiptData);
        await printRaw(targetPrinter.name, receiptText);

        ws.send(JSON.stringify({
            type: 'PRINT_SUCCESS',
            message: 'Receipt printed successfully',
            printer: targetPrinter.name,
            orderNumber: receiptData.orderNumber,
            timestamp: new Date().toISOString()
        }));

        console.log(`✅ Printed: Order ${receiptData.orderNumber}`);
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
            error: 'Printer name required'
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
            { name: 'Test Item 1', quantity: 1, price: 100, total: 100, category: '🧪 Test' },
            { name: 'Test Item 2', quantity: 2, price: 50, total: 100, category: '🧪 Test' }
        ],
        subtotal: 200,
        tax: 0,
        total: 200
    });

    try {
        await printRaw(printerName, testReceipt);
        ws.send(JSON.stringify({
            type: 'PRINT_SUCCESS',
            message: `Test print sent to ${printerName}`
        }));
        console.log(`✅ Test print completed`);
    } catch (error) {
        console.error('❌ Test print failed:', error);
        ws.send(JSON.stringify({
            type: 'PRINT_ERROR',
            error: error.message
        }));
    }
}

// ===================================
// RECEIPT FORMATTING
// ===================================
function formatReceipt(data) {
    const W = 42;
    const line = '-'.repeat(W);
    const doubleLine = '='.repeat(W);

    let receipt = '\n';

    // Header
    receipt += center(data.restaurantName || 'AT RESTAURANT', W) + '\n';
    receipt += center(data.tagline || 'Delicious Food, Memorable Moments', W) + '\n';
    receipt += line + '\n';
    receipt += center(data.address || 'Sooter Mills Rd, Lahore', W) + '\n';
    receipt += doubleLine + '\n\n';

    // Order Info
    receipt += `Order #: ${data.orderNumber}\n`;
    receipt += `Date: ${data.date}\n`;
    receipt += `Type: ${data.orderType === 'delivery' ? 'DELIVERY' : 'DINE-IN'}\n`;
    if (data.tableNumber) receipt += `Table: #${data.tableNumber}\n`;
    if (data.waiter) receipt += `Waiter: ${data.waiter}\n`;
    receipt += line + '\n\n';

    // Delivery Details
    if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
        receipt += 'DELIVERY DETAILS\n' + line + '\n';
        if (data.customerName) receipt += `Name: ${data.customerName}\n`;
        if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`;
        if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`;
        receipt += line + '\n\n';
    }

    // Items (Grouped)
    receipt += 'ORDER ITEMS\n' + line + '\n';
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

    // Payment
    if (data.paymentMethod) {
        receipt += '\n' + center(`Payment: ${data.paymentMethod.toUpperCase()}`, W) + '\n';
    }

    // Footer
    receipt += '\n' + doubleLine + '\n';
    receipt += center('Thank you for dining with us!', W) + '\n';
    receipt += center('Please visit again', W) + '\n\n';
    receipt += center('Powered by AT Restaurant POS', W) + '\n';
    receipt += center(new Date().toLocaleDateString('en-PK'), W) + '\n\n\n';

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

// ===================================
// HTTP ENDPOINTS
// ===================================
app.get('/health', async (req, res) => {
    const printers = await getWindowsPrinters();
    res.json({
        status: 'online',
        service: 'AT Restaurant Raw Printer Service',
        version: '3.0.0-raw',
        platform: `${os.platform()} ${os.arch()}`,
        nodeVersion: process.version,
        clients: clients.size,
        printers: printers.length,
        printersList: printers,
        printerModuleLoaded: true,
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get('/', async (req, res) => {
    const printers = await getWindowsPrinters();
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>AT Restaurant Raw Printer Service</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
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
        .status {
            padding: 30px;
            background: #f8f9fa;
        }
        .printer {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
            border-left: 4px solid #28a745;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-default { background: #fff3cd; color: #856404; }
        .badge-online { background: #d4edda; color: #155724; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🖨️ AT Restaurant Raw Printer Service</h1>
            <p>No Driver Needed - Works with Generic Printers</p>
        </div>
        <div class="status">
            <h2 style="color: #28a745;">✅ Service Online</h2>
            <p><strong>Platform:</strong> ${os.platform()} ${os.arch()}</p>
            <p><strong>Printers Found:</strong> ${printers.length}</p>
            <hr style="margin: 20px 0;">
            <h3>📍 Detected Printers</h3>
            ${printers.map(p => `
                <div class="printer">
                    <strong>${p.name}</strong>
                    ${p.isDefault ? '<span class="badge badge-default">DEFAULT</span>' : ''}
                    <span class="badge badge-online">ONLINE</span>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>
    `);
});

// ===================================
// START SERVER
// ===================================
server.listen(PORT, '0.0.0.0', async () => {
    console.log(`✅ WebSocket Server: ws://localhost:${PORT}`);
    console.log(`✅ HTTP Interface: http://localhost:${PORT}`);
    console.log(`✅ Platform: ${os.platform()} ${os.arch()}`);
    console.log('='.repeat(70));

    const printers = await getWindowsPrinters();
    if (printers.length === 0) {
        console.log('⚠️  WARNING: No printers detected!');
        console.log('   Add printer in: Control Panel → Devices and Printers');
    } else {
        console.log(`✅ Detected ${printers.length} printer(s):`);
        printers.forEach(p => {
            console.log(`   📍 ${p.name} ${p.isDefault ? '(DEFAULT)' : ''}`);
        });
    }
    console.log('='.repeat(70));
    console.log('🎯 Service ready! Open http://localhost:3002');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
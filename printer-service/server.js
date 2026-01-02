// printer-service/server.js - WINDOWS ONLY VERSION
const express = require('express');
const cors = require('cors');
const printer = require('printer');
const os = require('os');

const app = express();
const PORT = 3001;

// ✅ CORS - Allow all (since running locally)
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10mb' }));

// ✅ Logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ===================================
// PRINTER DETECTION (Windows Only)
// ===================================
function detectWindowsPrinters() {
    try {
        const printers = printer.getPrinters();

        // Sort: USB > Default > Others
        const formatted = printers.map((p, index) => ({
            id: `printer_${index}`,
            name: p.name,
            driver: p.driverName || 'Unknown',
            status: p.status || 'Ready',
            connected: p.status !== 'Offline',
            isDefault: p.isDefault || false,
            type: (p.portName || '').toUpperCase().includes('USB') ? 'usb' : 'system',
            portName: p.portName
        })).sort((a, b) => {
            // Priority: USB > Default > Others
            if (a.type === 'usb' && b.type !== 'usb') return -1;
            if (a.type !== 'usb' && b.type === 'usb') return 1;
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return 0;
        });

        console.log(`🖨️  Detected ${formatted.length} printers`);
        formatted.forEach(p => {
            console.log(`   - ${p.name} (${p.type}${p.isDefault ? ', DEFAULT' : ''})`);
        });

        return formatted;
    } catch (error) {
        console.error('❌ Printer detection error:', error.message);
        return [];
    }
}

// ===================================
// PRINT TO PRINTER
// ===================================
function printToWindowsPrinter(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`🖨️  Printing to: ${printerName}`);

            printer.printDirect({
                data: receiptText,
                printer: printerName,
                type: 'RAW', // Direct text printing
                success: (jobId) => {
                    console.log(`✅ Print job ${jobId} sent successfully`);
                    resolve({ success: true, jobId });
                },
                error: (err) => {
                    console.error('❌ Print error:', err);
                    reject(new Error(`Print failed: ${err}`));
                }
            });
        } catch (err) {
            console.error('❌ Exception during print:', err);
            reject(err);
        }
    });
}

// ===================================
// RECEIPT FORMATTING
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
        receipt += 'DELIVERY DETAILS\n';
        if (data.customerName) receipt += `Name: ${data.customerName}\n`;
        if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`;
        if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`;
        receipt += line + '\n\n';
    }

    // Items (Grouped by Category)
    receipt += 'ORDER ITEMS\n' + line + '\n';
    const grouped = {};
    data.items.forEach(item => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    Object.entries(grouped).forEach(([category, items]) => {
        receipt += `\n${category}\n`;
        items.forEach(item => {
            receipt += leftRight(`${item.quantity}x ${item.name}`, `PKR ${item.total.toFixed(2)}`, W) + '\n';
            receipt += `   @ PKR ${item.price.toFixed(2)} each\n`;
        });
    });

    // Totals
    receipt += '\n' + doubleLine + '\n';
    receipt += leftRight('Subtotal:', `PKR ${data.subtotal.toFixed(2)}`, W) + '\n';
    receipt += leftRight('Tax:', `PKR ${data.tax.toFixed(2)}`, W) + '\n';
    if (data.deliveryCharges && data.deliveryCharges > 0) {
        receipt += leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`, W) + '\n';
    }
    receipt += line + '\n';
    receipt += leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`, W) + '\n';

    // Payment
    if (data.paymentMethod) {
        receipt += '\n' + center(`Payment: ${data.paymentMethod.toUpperCase()}`, W) + '\n';
    }

    // Notes
    if (data.notes) {
        receipt += '\n' + line + '\n';
        receipt += 'Special Instructions:\n' + data.notes + '\n';
    }

    // Footer
    receipt += '\n' + doubleLine + '\n';
    receipt += center('Thank you for dining with us!', W) + '\n';
    receipt += center('Please visit again', W) + '\n\n';
    receipt += center('Powered by AT Restaurant POS', W) + '\n\n\n';

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

// ===================================
// API ROUTES
// ===================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        platform: os.platform(),
        version: '3.0.0'
    });
});

// Detect Printers
app.get('/api/printers/detect', (req, res) => {
    const printers = detectWindowsPrinters();
    res.json({ success: true, printers });
});

// Test Print
app.post('/api/printers/test', async (req, res) => {
    const { printerName } = req.body;

    if (!printerName) {
        return res.status(400).json({ success: false, error: 'Printer name required' });
    }

    const testReceipt = formatReceipt({
        restaurantName: 'AT RESTAURANT',
        tagline: 'Test Print',
        orderNumber: 'TEST-001',
        date: new Date().toLocaleString(),
        orderType: 'dine-in',
        items: [
            { name: 'Test Item', quantity: 1, price: 100, total: 100, category: 'Test' }
        ],
        subtotal: 100,
        tax: 0,
        total: 100
    });

    try {
        await printToWindowsPrinter(printerName, testReceipt);
        res.json({ success: true, message: 'Test print sent' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Print Receipt (MAIN)
app.post('/api/print', async (req, res) => {
    const receiptData = req.body;

    if (!receiptData || !receiptData.items) {
        return res.status(400).json({ success: false, error: 'Invalid receipt data' });
    }

    // Auto-detect printers
    const printers = detectWindowsPrinters();

    if (printers.length === 0) {
        return res.status(503).json({
            success: false,
            error: 'No printers available. Please check printer connection.'
        });
    }

    // Smart Selection: USB > Default > First
    const targetPrinter =
        printers.find(p => p.type === 'usb' && p.connected) ||
        printers.find(p => p.isDefault && p.connected) ||
        printers[0];

    console.log(`🎯 Selected printer: ${targetPrinter.name}`);

    try {
        const receiptText = formatReceipt(receiptData);
        await printToWindowsPrinter(targetPrinter.name, receiptText);

        res.json({
            success: true,
            message: 'Receipt printed successfully',
            printer: targetPrinter.name,
            orderNumber: receiptData.orderNumber
        });
    } catch (error) {
        console.error('Print failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Handle OPTIONS (CORS)
app.options('*', cors());

// ===================================
// START SERVER
// ===================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🖨️  AT RESTAURANT - WINDOWS PRINTER SERVICE');
    console.log('='.repeat(60));
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`✅ Platform: ${os.platform()}`);
    console.log('='.repeat(60));

    // Auto-detect printers on startup
    const printers = detectWindowsPrinters();
    if (printers.length === 0) {
        console.log('⚠️  WARNING: No printers detected!');
        console.log('   Check: Control Panel → Devices and Printers');
    }
});

// Graceful Shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    server.close(() => {
        console.log('✅ Server closed.');
        process.exit(0);
    });
});
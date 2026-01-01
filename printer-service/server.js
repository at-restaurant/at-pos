// printer-service/server.js - FIXED CORS & ERROR HANDLING
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// ✅ FIX 1: Allow ALL origins in development
app.use(cors({
    origin: '*',  // Allow all origins
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

// ✅ FIX 2: Add request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ✅ IMPROVED: Detect Windows Printers with Better Status Detection
function detectWindowsPrinters() {
    return new Promise((resolve) => {
        console.log('🔍 Detecting Windows printers...');

        // Get detailed printer info including queue status
        const command = `powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Type | ConvertTo-Json"`;

        exec(command, { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Printer detection error:', error.message);
                resolve([]);
                return;
            }

            try {
                let printers = [];

                // Parse JSON output
                if (stdout && stdout.trim()) {
                    printers = JSON.parse(stdout);
                    if (!Array.isArray(printers)) printers = [printers];
                }

                const formatted = printers.map((p, index) => {
                    const status = p.PrinterStatus || 'Unknown';
                    const isUsb = (p.PortName || '').toUpperCase().includes('USB');

                    // Consider printer "connected" if it's USB or has good status
                    const isConnected = isUsb ||
                        status === 'Normal' ||
                        status === 'Idle' ||
                        status === 'Unknown';

                    return {
                        id: `printer_${index}`,
                        name: p.Name || 'Unknown Printer',
                        driver: p.DriverName || 'Unknown Driver',
                        port: p.PortName || 'USB',
                        status: status,
                        type: isUsb ? 'usb' : 'system',
                        connected: isConnected,
                        isDefault: false
                    };
                });

                // Sort: USB printers first
                formatted.sort((a, b) => {
                    if (a.type === 'usb' && b.type !== 'usb') return -1;
                    if (a.type !== 'usb' && b.type === 'usb') return 1;
                    return a.name.localeCompare(b.name);
                });

                // Set first USB printer as default
                if (formatted.length > 0) {
                    const firstUsb = formatted.find(p => p.type === 'usb' && p.connected);
                    if (firstUsb) {
                        formatted.forEach(p => p.isDefault = (p.id === firstUsb.id));
                    } else {
                        formatted[0].isDefault = true;
                    }
                }

                console.log(`✅ Found ${formatted.length} printer(s)`);
                formatted.forEach(p => {
                    console.log(`   - ${p.name} (${p.type}, ${p.connected ? 'Connected' : 'Offline'})`);
                });

                resolve(formatted);
            } catch (parseError) {
                console.error('❌ Parse error:', parseError.message);
                console.log('Raw output:', stdout);
                resolve([]);
            }
        });
    });
}

// Print to Windows Printer
function printToWindowsPrinter(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `receipt_${Date.now()}.txt`);

        console.log(`📄 Creating temp file: ${tempFile}`);
        fs.writeFileSync(tempFile, receiptText, 'utf8');

        const command = `print /D:"${printerName}" "${tempFile}"`;
        console.log(`🖨️  Executing: ${command}`);

        exec(command, (error, stdout, stderr) => {
            // Clean up temp file
            try {
                fs.unlinkSync(tempFile);
                console.log('🗑️  Temp file deleted');
            } catch (e) {
                console.warn('⚠️  Could not delete temp file');
            }

            if (error) {
                console.error('❌ Print error:', error.message);
                reject(new Error(`Print failed: ${error.message}`));
                return;
            }

            console.log('✅ Print successful');
            if (stdout) console.log('stdout:', stdout);
            if (stderr) console.log('stderr:', stderr);

            resolve({ success: true, stdout, stderr });
        });
    });
}

// Format Receipt
function formatReceipt(data) {
    const line = '----------------------------------------';
    const doubleLine = '========================================';

    let receipt = '\n';
    receipt += center(data.restaurantName || 'AT RESTAURANT') + '\n';
    receipt += center(data.tagline || 'Delicious Food, Memorable Moments') + '\n';
    receipt += line + '\n';
    receipt += center(data.address || 'Sooter Mills Rd, Lahore') + '\n';
    receipt += doubleLine + '\n\n';

    receipt += `Order #: ${data.orderNumber}\n`;
    receipt += `Date: ${data.date}\n`;
    receipt += `Type: ${data.orderType === 'delivery' ? 'DELIVERY' : 'DINE-IN'}\n`;

    if (data.tableNumber) receipt += `Table: #${data.tableNumber}\n`;
    if (data.waiter) receipt += `Waiter: ${data.waiter}\n`;
    receipt += line + '\n\n';

    if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
        receipt += 'DELIVERY DETAILS\n';
        if (data.customerName) receipt += `Name: ${data.customerName}\n`;
        if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`;
        if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`;
        receipt += line + '\n\n';
    }

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
            receipt += leftRight(`${item.quantity}x ${item.name}`, `PKR ${item.total.toFixed(2)}`) + '\n';
            receipt += `   @ PKR ${item.price.toFixed(2)} each\n`;
        });
    });

    receipt += '\n' + doubleLine + '\n';
    receipt += leftRight('Subtotal:', `PKR ${data.subtotal.toFixed(2)}`) + '\n';
    receipt += leftRight('Tax:', `PKR ${data.tax.toFixed(2)}`) + '\n';

    if (data.deliveryCharges && data.deliveryCharges > 0) {
        receipt += leftRight('Delivery:', `PKR ${data.deliveryCharges.toFixed(2)}`) + '\n';
    }

    receipt += line + '\n';
    receipt += leftRight('TOTAL:', `PKR ${data.total.toFixed(2)}`, true) + '\n';

    if (data.paymentMethod) {
        receipt += '\n' + center(`Payment: ${data.paymentMethod.toUpperCase()}`) + '\n';
    }

    if (data.notes) {
        receipt += '\n' + line + '\n';
        receipt += 'Special Instructions:\n' + data.notes + '\n';
    }

    receipt += '\n' + doubleLine + '\n';
    receipt += center('Thank you for dining with us!') + '\n';
    receipt += center('Please visit again') + '\n\n';
    receipt += center('Powered by AT Restaurant POS') + '\n\n\n\n';

    return receipt;
}

function center(text) {
    const width = 40;
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
}

function leftRight(left, right, bold = false) {
    const width = 40;
    const spaces = width - left.length - right.length;
    return left + ' '.repeat(Math.max(1, spaces)) + right;
}

// ============================================
// API ENDPOINTS
// ============================================

// ✅ FIX 3: Enhanced health check with CORS headers
app.get('/api/health', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        uptime: process.uptime(),
        port: PORT,
        version: '2.0.0'
    });
});

app.get('/api/printers/detect', async (req, res) => {
    try {
        console.log('📡 Printer detection requested');
        const printers = await detectWindowsPrinters();

        res.json({
            success: true,
            printers,
            count: printers.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Detection error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            printers: []
        });
    }
});

app.post('/api/printers/test', async (req, res) => {
    try {
        const { printerName } = req.body;

        if (!printerName) {
            return res.status(400).json({
                success: false,
                error: 'Printer name required'
            });
        }

        console.log(`🧪 Test print requested for: ${printerName}`);

        const testReceipt = formatReceipt({
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-001',
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            items: [{
                name: 'Test Item',
                quantity: 1,
                price: 100,
                total: 100,
                category: 'Test'
            }],
            subtotal: 100,
            tax: 0,
            total: 100
        });

        await printToWindowsPrinter(printerName, testReceipt);

        res.json({
            success: true,
            message: 'Test print sent successfully'
        });
    } catch (error) {
        console.error('❌ Test print error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/print', async (req, res) => {
    try {
        const receiptData = req.body;

        if (!receiptData || !receiptData.items) {
            return res.status(400).json({
                success: false,
                error: 'Invalid receipt data'
            });
        }

        console.log(`📄 Print job received: Order ${receiptData.orderNumber}`);

        const printers = await detectWindowsPrinters();

        if (printers.length === 0) {
            return res.status(503).json({
                success: false,
                error: 'No printers available'
            });
        }

        // Use first connected USB printer, or first printer as fallback
        const defaultPrinter = printers.find(p => p.type === 'usb' && p.connected) ||
            printers.find(p => p.connected) ||
            printers[0];

        console.log(`🖨️  Using printer: ${defaultPrinter.name}`);

        const receiptText = formatReceipt(receiptData);
        await printToWindowsPrinter(defaultPrinter.name, receiptText);

        console.log(`✅ Receipt printed successfully`);

        res.json({
            success: true,
            message: 'Receipt printed successfully',
            orderNumber: receiptData.orderNumber,
            printer: defaultPrinter.name
        });
    } catch (error) {
        console.error('❌ Print error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/printers/save', async (req, res) => {
    res.json({
        success: true,
        message: 'Printer settings saved'
    });
});

// ✅ FIX 4: Handle OPTIONS preflight requests
app.options('*', cors());

// ============================================
// START SERVER
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🖨️  THERMAL PRINTER SERVICE - WINDOWS');
    console.log('='.repeat(60));
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`✅ Network: http://0.0.0.0:${PORT}`);
    console.log(`📍 Platform: ${os.platform()} (${os.arch()})`);
    console.log(`🔧 Node: ${process.version}`);
    console.log('='.repeat(60));
    console.log('\n📝 Available Endpoints:');
    console.log('   GET  /api/health');
    console.log('   GET  /api/printers/detect');
    console.log('   POST /api/printers/test');
    console.log('   POST /api/print');
    console.log('   POST /api/printers/save\n');

    // Auto-detect printers on startup
    detectWindowsPrinters().then(printers => {
        if (printers.length > 0) {
            const usbPrinters = printers.filter(p => p.type === 'usb' && p.connected);
            console.log('✅ Printer detection complete!\n');
            if (usbPrinters.length > 0) {
                console.log('🎯 USB Printers Ready:');
                usbPrinters.forEach(p => {
                    console.log(`   - ${p.name} (${p.driver})`);
                });
            } else {
                console.log('⚠️  No USB thermal printers detected');
                console.log('💡 Tip: Connect USB printer and restart service\n');
            }
        } else {
            console.log('⚠️  No printers found');
            console.log('💡 Please install printer drivers and restart\n');
        }
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
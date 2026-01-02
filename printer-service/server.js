// printer-service/server.js - ADDED HTTPS & IMPROVED PRINTER LOGIC
const express = require('express');
const cors = require('cors');
const https = require('https'); // Use https
const os = require('os');
const path = require('path');
const fs = require('fs');
const printer = require('printer');

const app = express();
const PORT = 3001;

// ✅ CORS: Allow all origins (permissive mode for development)
app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    // Log incoming requests
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Detect Windows Printers
function detectWindowsPrinters() {
    return new Promise((resolve) => {
        try {
            console.log('🔍 Starting printer detection...');
            
            // Use callback-based API (correct for printer v0.4.0)
            const availablePrinters = printer.getPrinters();
            
            if (!availablePrinters) {
                console.warn('⚠️  getPrinters returned null/undefined');
                return resolve([]);
            }
            
            if (!Array.isArray(availablePrinters)) {
                console.error('❌ getPrinters returned non-array:', typeof availablePrinters);
                return resolve([]);
            }

            if (availablePrinters.length === 0) {
                console.warn('⚠️  No printers found on system');
                return resolve([]);
            }

            const formatted = availablePrinters.map((p, index) => {
                console.log(`  📄 Printer ${index + 1}: ${p.name} (Status: ${p.status})`);
                return {
                    id: `printer_${index}`,
                    name: p.name || `Printer_${index}`,
                    driver: p.driverName || 'Unknown',
                    status: p.status || 'Unknown',
                    connected: (p.status || '').toLowerCase() !== 'offline',
                    isDefault: p.isDefault === true,
                    type: (p.portName || '').toUpperCase().includes('USB') ? 'usb' : 'system',
                };
            });

            // Prioritize: Default printer first, then USB, then others
            formatted.sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                if (a.type === 'usb' && b.type !== 'usb') return -1;
                if (a.type !== 'usb' && b.type === 'usb') return 1;
                return a.name.localeCompare(b.name);
            });

            console.log(`✅ Found ${formatted.length} printer(s).`);
            formatted.forEach((p, i) => {
                console.log(`   ${i + 1}. ${p.name} - ${p.type} - ${p.status} ${p.isDefault ? '(DEFAULT)' : ''}`);
            });
            
            resolve(formatted);
        } catch (error) {
            console.error('❌ Printer detection error:', error.message);
            console.error('   Stack:', error.stack);
            resolve([]);
        }
    });
}

// Print to Windows Printer
function printToWindowsPrinter(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        try {
            if (!printerName || typeof printerName !== 'string') {
                return reject(new Error('Invalid printer name provided'));
            }

            if (!receiptText || typeof receiptText !== 'string') {
                return reject(new Error('Invalid receipt data'));
            }

            console.log(`📤 Sending print job to: ${printerName}`);
            console.log(`   Data size: ${receiptText.length} bytes`);

            const printConfig = {
                data: receiptText,
                printer: printerName,
                type: 'RAW',
                success: (jobId) => {
                    console.log(`✅ Print job sent successfully!`);
                    console.log(`   Job ID: ${jobId}`);
                    resolve({ success: true, jobId, printer: printerName });
                },
                error: (err) => {
                    const errorMsg = err?.message || err?.toString?.() || String(err);
                    console.error('❌ Print job failed:', errorMsg);
                    reject(new Error(`Print failed: ${errorMsg}`));
                },
            };

            console.log('   Executing printer.printDirect()...');
            printer.printDirect(printConfig);
        } catch (err) {
            const errorMsg = err?.message || err?.toString?.() || String(err);
            console.error('❌ Synchronous print error:', errorMsg);
            reject(new Error(`Print failed: ${errorMsg}`));
        }
    });
}

// Format Receipt (remains the same)
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

// API Endpoints
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online', 
        platform: os.platform(), 
        version: '3.0.0-https',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/printers/detect', async (req, res) => {
    try {
        console.log('\n🔎 PRINTER DETECTION REQUEST RECEIVED');
        const printers = await detectWindowsPrinters();
        
        if (printers.length === 0) {
            console.warn('⚠️  Response: No printers detected');
            return res.status(200).json({ 
                success: true, 
                printers: [],
                message: 'No printers found. Please check your printer installation and ensure it is set up in Windows.'
            });
        }
        
        res.json({ 
            success: true, 
            printers,
            default: printers.find(p => p.isDefault),
            message: `Found ${printers.length} printer(s)`
        });
    } catch (error) {
        console.error('❌ Printer detection endpoint error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to detect printers',
            message: error.message
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

        console.log(`\n🧪 TEST PRINT REQUEST for: ${printerName}`);
        
        const testReceipt = formatReceipt({
            restaurantName: 'AT RESTAURANT',
            tagline: 'TEST PRINT',
            orderNumber: 'TEST-' + Date.now(),
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            items: [
                { name: 'Test Item 1', quantity: 1, price: 500, total: 500, category: 'Test' },
                { name: 'Test Item 2', quantity: 2, price: 250, total: 500, category: 'Test' }
            ],
            subtotal: 1000,
            tax: 0,
            total: 1000,
            paymentMethod: 'CASH'
        });

        await printToWindowsPrinter(printerName, testReceipt);
        
        res.json({ 
            success: true, 
            message: 'Test print sent successfully',
            printer: printerName
        });
    } catch (error) {
        console.error('❌ Test print error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Test print failed',
            message: error.message 
        });
    }
});

app.post('/api/print', async (req, res) => {
    try {
        const receiptData = req.body;
        
        console.log(`\n🖨️  PRINT REQUEST RECEIVED - Order #${receiptData?.orderNumber}`);
        
        if (!receiptData || !receiptData.items) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid receipt data - missing items' 
            });
        }

        if (!Array.isArray(receiptData.items) || receiptData.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No items in receipt' 
            });
        }

        const printers = await detectWindowsPrinters();
        
        if (printers.length === 0) {
            console.error('❌ No printers available for printing');
            return res.status(503).json({ 
                success: false, 
                error: 'No printers available',
                message: 'Please install and configure a printer on this system'
            });
        }

        // ✅ IMPROVED LOGIC: Use default, then first connected USB, then first printer
        const selectedPrinter =
            printers.find(p => p.isDefault) ||
            printers.find(p => p.type === 'usb' && p.connected) ||
            printers[0];

        console.log(`📍 Printer selected: ${selectedPrinter.name} (${selectedPrinter.type})`);

        const receiptText = formatReceipt(receiptData);
        await printToWindowsPrinter(selectedPrinter.name, receiptText);
        
        res.json({ 
            success: true, 
            message: 'Receipt printed successfully',
            printer: selectedPrinter.name,
            orderNumber: receiptData.orderNumber
        });
    } catch (error) {
        console.error('❌ Print endpoint error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Print failed',
            message: error.message 
        });
    }
});

// Handle OPTIONS requests for CORS preflight
app.options('*', cors());

// --- HTTPS Server Setup ---
try {
    const options = {
        key: fs.readFileSync(path.join(__dirname, 'key.pem')),
        cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
    };

    const server = https.createServer(options, app);

    server.listen(PORT, '0.0.0.0', async () => {
        console.log('\n' + '='.repeat(70));
        console.log('🖨️  SECURE PRINTER SERVICE (HTTPS) - v3.0.0');
        console.log('='.repeat(70));
        console.log(`✅ Server running at: https://localhost:${PORT}`);
        console.log(`✅ CORS enabled for: http://localhost:3000`);
        console.log(`✅ Timestamp: ${new Date().toISOString()}`);
        console.log('='.repeat(70));
        
        // Run initial printer detection on startup
        console.log('\n🔄 Performing initial printer detection...');
        const initialPrinters = await detectWindowsPrinters();
        
        if (initialPrinters.length === 0) {
            console.warn('\n⚠️  WARNING: No printers detected at startup!');
            console.warn('   Make sure:');
            console.warn('   1. Running as Administrator');
            console.warn('   2. Printer is installed in Windows');
            console.warn('   3. Printer is powered on and connected');
        } else {
            console.log(`\n✅ Initial detection successful - ${initialPrinters.length} printer(s) available\n`);
        }
        
        console.log('='.repeat(70));
        console.log('🔒 ENDPOINTS AVAILABLE:');
        console.log('  GET  /api/health                 - Check server status');
        console.log('  GET  /api/printers/detect        - Get list of available printers');
        console.log('  POST /api/printers/test          - Test print to specific printer');
        console.log('  POST /api/print                  - Print receipt');
        console.log('='.repeat(70) + '\n');
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n👋 Shutting down printer service...');
        server.close(() => {
            console.log('✅ Server closed gracefully.');
            process.exit(0);
        });
        
        // Force exit after 5 seconds
        setTimeout(() => {
            console.error('❌ Forced shutdown after timeout');
            process.exit(1);
        }, 5000);
    });

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error('\n❌ FATAL ERROR: SSL certificate not found.');
        console.error('Missing files:');
        console.error('  - key.pem');
        console.error('  - cert.pem');
        console.error('\nPlease run the certificate generation script:');
        console.error('  npm run generate-certs  (or similar)');
    } else {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error(error.stack);
    }
    process.exit(1);
}

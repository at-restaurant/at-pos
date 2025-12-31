// ============================================
// FILE: printer-service/server.js
// OS-BASED PRINTER SOLUTION (Windows/Linux/Mac)
// Uses system installed printers
// ============================================

const express = require('express');
const printer = require('@thiagoelg/node-printer');
const PDFDocument = require('pdfkit');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({ origin: '*', credentials: true }));
app.use(bodyParser.json({ limit: '1mb' }));

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 50,
    message: { success: false, error: 'Too many requests' }
});
app.use('/api/print', limiter);

// ============================================
// PRINTER CONFIGURATION
// ============================================
let savedPrinterConfig = null;
const configPath = path.join(__dirname, 'printer-config.json');

function loadPrinterConfig() {
    try {
        if (fs.existsSync(configPath)) {
            savedPrinterConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log('✅ Loaded printer:', savedPrinterConfig.printerName);
        }
    } catch (error) {
        console.log('ℹ️  No saved printer config');
    }
}

loadPrinterConfig();

// ============================================
// DETECT OS PRINTERS
// ============================================
app.get('/api/printers/detect', async (req, res) => {
    try {
        // Get all printers from OS
        const printers = printer.getPrinters();

        const devices = printers.map((p, index) => ({
            id: `printer_${index}`,
            name: p.name,
            type: p.isDefault ? 'default' : 'installed',
            driver: p.driverName || 'Unknown',
            status: p.status || 'idle',
            isDefault: p.isDefault || false,
            attributes: p.attributes || {},
            connected: true
        }));

        // Get default printer
        const defaultPrinterName = printer.getDefaultPrinterName();

        console.log(`✅ Detected ${devices.length} printer(s)`);
        console.log(`🖨️  Default: ${defaultPrinterName || 'None'}`);

        res.json({
            success: true,
            printers: devices,
            defaultPrinter: defaultPrinterName,
            platform: os.platform(),
            count: devices.length
        });

    } catch (error) {
        console.error('Detection error:', error);
        res.json({
            success: false,
            printers: [],
            error: error.message
        });
    }
});

// ============================================
// GENERATE THERMAL RECEIPT (ESC/POS Commands)
// ============================================
function generateThermalReceipt(receipt) {
    const ESC = '\x1B';
    const GS = '\x1D';

    let output = '';

    // Initialize
    output += ESC + '@';

    // Header - Center aligned, bold, double size
    output += ESC + 'a' + '\x01'; // Center
    output += ESC + 'E' + '\x01'; // Bold on
    output += GS + '!' + '\x11';  // Double height & width
    output += (receipt.restaurantName || 'AT RESTAURANT') + '\n';
    output += GS + '!' + '\x00';  // Normal size
    output += ESC + 'E' + '\x00'; // Bold off
    output += (receipt.tagline || 'Delicious Food') + '\n';
    output += (receipt.address || 'Lahore') + '\n';
    output += '================================\n';

    // Order Info - Left aligned
    output += ESC + 'a' + '\x00'; // Left align
    output += `Order: ${receipt.orderNumber}\n`;
    output += `Date: ${receipt.date}\n`;
    output += `Type: ${receipt.orderType?.toUpperCase() || 'DINE-IN'}\n`;

    if (receipt.tableNumber) {
        output += `Table: ${receipt.tableNumber}\n`;
    }
    if (receipt.waiter) {
        output += `Waiter: ${receipt.waiter}\n`;
    }

    // Delivery info
    if (receipt.orderType === 'delivery') {
        output += '================================\n';
        output += ESC + 'E' + '\x01'; // Bold
        output += 'DELIVERY INFO\n';
        output += ESC + 'E' + '\x00'; // Bold off
        if (receipt.customerName) output += `Name: ${receipt.customerName}\n`;
        if (receipt.customerPhone) output += `Phone: ${receipt.customerPhone}\n`;
        if (receipt.deliveryAddress) output += `Address: ${receipt.deliveryAddress}\n`;
    }

    output += '================================\n';

    // Items
    output += ESC + 'E' + '\x01'; // Bold
    output += 'ORDER ITEMS\n';
    output += ESC + 'E' + '\x00'; // Bold off
    output += '\n';

    // Group by category
    const grouped = {};
    (receipt.items || []).forEach(item => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    Object.entries(grouped).forEach(([category, items]) => {
        output += ESC + 'E' + '\x01'; // Bold
        output += `  ${category}\n`;
        output += ESC + 'E' + '\x00'; // Bold off

        items.forEach(item => {
            output += `  ${item.quantity}x ${item.name}\n`;
            output += `     PKR ${item.total.toFixed(2)}\n`;
        });

        output += '\n';
    });

    output += '================================\n';

    // Totals
    output += `Subtotal: PKR ${receipt.subtotal?.toFixed(2) || 0}\n`;
    output += `Tax: PKR ${receipt.tax?.toFixed(2) || 0}\n`;

    if (receipt.deliveryCharges && receipt.deliveryCharges > 0) {
        output += `Delivery: PKR ${receipt.deliveryCharges.toFixed(2)}\n`;
    }

    output += '\n';
    output += ESC + 'E' + '\x01'; // Bold
    output += GS + '!' + '\x11';  // Double size
    output += `TOTAL: PKR ${receipt.total?.toFixed(2) || 0}\n`;
    output += GS + '!' + '\x00';  // Normal
    output += ESC + 'E' + '\x00'; // Bold off

    if (receipt.paymentMethod) {
        output += '\n';
        output += `Payment: ${receipt.paymentMethod.toUpperCase()}\n`;
    }

    output += '================================\n';

    // Footer - Center aligned
    output += ESC + 'a' + '\x01'; // Center
    output += 'Thank you!\n';
    output += 'Please visit again\n';
    output += '\n';

    // Cut paper
    output += GS + 'V' + '\x00';

    return Buffer.from(output, 'binary');
}

// ============================================
// TEST PRINTER
// ============================================
app.post('/api/printers/test', async (req, res) => {
    try {
        const { printerName } = req.body;

        if (!printerName) {
            return res.json({
                success: false,
                error: 'No printer selected'
            });
        }

        // Check if printer exists
        const printers = printer.getPrinters();
        const exists = printers.some(p => p.name === printerName);

        if (!exists) {
            return res.json({
                success: false,
                error: `Printer "${printerName}" not found`
            });
        }

        // Generate test receipt
        const ESC = '\x1B';
        const GS = '\x1D';

        let testPrint = ESC + '@'; // Initialize
        testPrint += ESC + 'a' + '\x01'; // Center
        testPrint += ESC + 'E' + '\x01'; // Bold
        testPrint += GS + '!' + '\x11';  // Double size
        testPrint += 'TEST PRINT\n';
        testPrint += GS + '!' + '\x00';  // Normal
        testPrint += ESC + 'E' + '\x00'; // Bold off
        testPrint += '================================\n';
        testPrint += 'Printer Working!\n';
        testPrint += new Date().toLocaleString() + '\n';
        testPrint += `Platform: ${os.platform()}\n`;
        testPrint += '================================\n';
        testPrint += '\n\n';
        testPrint += GS + 'V' + '\x00'; // Cut

        const buffer = Buffer.from(testPrint, 'binary');

        // Print using OS printer
        printer.printDirect({
            data: buffer,
            printer: printerName,
            type: 'RAW',
            success: () => {
                console.log('✅ Test print sent');
                res.json({
                    success: true,
                    message: 'Test print sent to printer'
                });
            },
            error: (err) => {
                console.error('Print error:', err);
                res.json({
                    success: false,
                    error: err.message || 'Print failed'
                });
            }
        });

    } catch (error) {
        console.error('Test error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// SAVE PRINTER
// ============================================
app.post('/api/printers/save', async (req, res) => {
    try {
        const { printerId, printerName, isDefault } = req.body;

        const config = {
            printerId,
            printerName,
            isDefault,
            platform: os.platform(),
            savedAt: new Date().toISOString()
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        savedPrinterConfig = config;

        console.log('✅ Saved:', printerName);

        res.json({
            success: true,
            message: 'Settings saved'
        });

    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    try {
        const printers = printer.getPrinters();
        const defaultPrinter = printer.getDefaultPrinterName();

        res.json({
            status: 'online',
            printer: savedPrinterConfig ? 'configured' : 'not configured',
            savedPrinter: savedPrinterConfig?.printerName || 'None',
            defaultPrinter: defaultPrinter || 'None',
            printersAvailable: printers.length,
            platform: os.platform(),
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.json({
            status: 'online',
            printer: 'error',
            error: error.message
        });
    }
});

// ============================================
// PRINT RECEIPT
// ============================================
app.post('/api/print', async (req, res) => {
    if (!req.body || !req.body.orderNumber) {
        return res.status(400).json({
            success: false,
            error: 'Invalid receipt data'
        });
    }

    const receipt = req.body;

    try {
        // Use saved printer or default
        let printerName = savedPrinterConfig?.printerName;

        if (!printerName) {
            printerName = printer.getDefaultPrinterName();

            if (!printerName) {
                return res.status(503).json({
                    success: false,
                    error: 'No printer configured. Please configure in settings.'
                });
            }
        }

        // Generate receipt
        const buffer = generateThermalReceipt(receipt);

        // Print
        printer.printDirect({
            data: buffer,
            printer: printerName,
            type: 'RAW',
            success: () => {
                console.log(`✅ Printed: ${receipt.orderNumber}`);
                res.json({
                    success: true,
                    message: 'Receipt printed',
                    orderNumber: receipt.orderNumber,
                    printer: printerName
                });
            },
            error: (err) => {
                console.error('Print error:', err);
                res.status(500).json({
                    success: false,
                    error: err.message || 'Print failed'
                });
            }
        });

    } catch (error) {
        console.error('Print error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal error'
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    try {
        const printers = printer.getPrinters();
        const defaultPrinter = printer.getDefaultPrinterName();

        console.log('');
        console.log('🖨️  ========================================');
        console.log('🖨️   THERMAL PRINTER SERVICE');
        console.log('🖨️  ========================================');
        console.log(`🖨️   Platform: ${os.platform()}`);
        console.log(`🖨️   Port: ${PORT}`);
        console.log(`🖨️   Printers: ${printers.length} available`);
        console.log(`🖨️   Default: ${defaultPrinter || 'None'}`);
        console.log(`🖨️   Saved: ${savedPrinterConfig?.printerName || 'None'}`);
        console.log('🖨️  ========================================');
        console.log('');

        if (printers.length > 0) {
            console.log('📋 Available printers:');
            printers.forEach(p => {
                console.log(`   - ${p.name}${p.isDefault ? ' (default)' : ''}`);
            });
            console.log('');
        }
    } catch (error) {
        console.log('');
        console.log('🖨️  Service running on port', PORT);
        console.log('');
    }
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
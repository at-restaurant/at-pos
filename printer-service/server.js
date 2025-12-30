// ============================================
// FILE: printer-service/server.js
// WORKING SOLUTION: node-thermal-printer
// No native dependencies - Pure JavaScript
// ============================================

const express = require('express');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();

// ============================================
// SECURITY & MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
app.use(bodyParser.json({ limit: '1mb' }));

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
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
            console.log('✅ Loaded printer config:', savedPrinterConfig.printerId);
        }
    } catch (error) {
        console.log('ℹ️  No saved printer config');
    }
}

loadPrinterConfig();

// ============================================
// DETECT AVAILABLE PRINTERS (Linux lpstat)
// ============================================
function getSystemPrinters() {
    return new Promise((resolve, reject) => {
        exec('lpstat -p -d', (error, stdout, stderr) => {
            if (error) {
                // If lpstat fails, return default
                resolve([{
                    id: 'default',
                    name: 'USB Printer (Auto-detect)',
                    type: 'usb',
                    path: '/dev/usb/lp0',
                    connected: true
                }]);
                return;
            }

            const lines = stdout.split('\n');
            const printers = [];

            lines.forEach(line => {
                if (line.startsWith('printer')) {
                    const match = line.match(/printer\s+(\S+)/);
                    if (match) {
                        printers.push({
                            id: `printer_${printers.length}`,
                            name: match[1],
                            type: 'system',
                            connected: true
                        });
                    }
                }
            });

            // Add USB direct access option
            printers.push({
                id: 'usb_direct',
                name: 'USB Direct (/dev/usb/lp0)',
                type: 'usb',
                path: '/dev/usb/lp0',
                connected: fs.existsSync('/dev/usb/lp0')
            });

            resolve(printers.length > 0 ? printers : [{
                id: 'default',
                name: 'No printers found',
                type: 'system',
                connected: false
            }]);
        });
    });
}

app.get('/api/printers/detect', async (req, res) => {
    try {
        const printers = await getSystemPrinters();
        console.log(`✅ Detected ${printers.length} printer(s)`);

        res.json({
            success: true,
            printers
        });

    } catch (error) {
        console.error('Detection error:', error);
        res.json({
            success: true,
            printers: [{
                id: 'default',
                name: 'Error detecting printers',
                type: 'system',
                connected: false,
                error: error.message
            }]
        });
    }
});

// ============================================
// TEST PRINTER
// ============================================
app.post('/api/printers/test', async (req, res) => {
    try {
        const { printerName, printerPath } = req.body;

        // Use USB path if provided, otherwise use printer name
        const printerInterface = printerPath || `/dev/usb/lp0`;

        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: printerInterface,
            characterSet: 'PC437_USA',
            removeSpecialCharacters: false,
            lineCharacter: "=",
            options: {
                timeout: 5000
            }
        });

        const isConnected = await printer.isPrinterConnected();

        if (!isConnected) {
            return res.json({
                success: false,
                error: `Cannot connect to printer at ${printerInterface}`
            });
        }

        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
        printer.bold(true);
        printer.println("TEST PRINT");
        printer.bold(false);
        printer.setTextNormal();
        printer.drawLine();
        printer.println("Printer Connected!");
        printer.println(new Date().toLocaleString());
        printer.drawLine();
        printer.newLine();
        printer.cut();

        await printer.execute();

        console.log('✅ Test print successful');
        res.json({
            success: true,
            message: 'Test print successful'
        });

    } catch (error) {
        console.error('Test print error:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// SAVE PRINTER SETTINGS
// ============================================
app.post('/api/printers/save', async (req, res) => {
    try {
        const { printerId, printerName, printerPath } = req.body;

        const config = {
            printerId,
            printerName,
            printerPath,
            savedAt: new Date().toISOString()
        };

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        savedPrinterConfig = config;

        console.log('✅ Printer settings saved');

        res.json({
            success: true,
            message: 'Printer settings saved'
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
    res.json({
        status: 'online',
        printer: savedPrinterConfig ? 'configured' : 'not configured',
        savedPrinter: savedPrinterConfig?.printerName || 'None',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
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
        // Use saved printer or default USB path
        const printerInterface = savedPrinterConfig?.printerPath || '/dev/usb/lp0';

        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,
            interface: printerInterface,
            characterSet: 'PC437_USA',
            removeSpecialCharacters: false,
            lineCharacter: "=",
            options: {
                timeout: 5000
            }
        });

        const isConnected = await printer.isPrinterConnected();

        if (!isConnected) {
            return res.status(503).json({
                success: false,
                error: 'Printer not connected'
            });
        }

        // HEADER
        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
        printer.bold(true);
        printer.println(receipt.restaurantName || 'AT RESTAURANT');
        printer.bold(false);
        printer.setTextNormal();
        printer.println(receipt.tagline || 'Delicious Food');
        printer.println(receipt.address || 'Lahore');
        printer.drawLine();

        // ORDER INFO
        printer.alignLeft();
        printer.println(`Order: ${receipt.orderNumber}`);
        printer.println(`Date: ${receipt.date}`);
        printer.println(`Type: ${receipt.orderType?.toUpperCase() || 'DINE-IN'}`);

        if (receipt.tableNumber) {
            printer.println(`Table: ${receipt.tableNumber}`);
        }

        if (receipt.waiter) {
            printer.println(`Waiter: ${receipt.waiter}`);
        }

        // DELIVERY DETAILS
        if (receipt.orderType === 'delivery') {
            printer.drawLine();
            printer.bold(true);
            printer.println('DELIVERY INFO');
            printer.bold(false);

            if (receipt.customerName) printer.println(`Name: ${receipt.customerName}`);
            if (receipt.customerPhone) printer.println(`Phone: ${receipt.customerPhone}`);
            if (receipt.deliveryAddress) printer.println(`Address: ${receipt.deliveryAddress}`);
        }

        printer.drawLine();

        // ITEMS
        printer.bold(true);
        printer.println('ORDER ITEMS');
        printer.bold(false);
        printer.newLine();

        const grouped = {};
        (receipt.items || []).forEach(item => {
            const cat = item.category || 'Other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(item);
        });

        Object.entries(grouped).forEach(([category, items]) => {
            printer.bold(true);
            printer.println(`  ${category}`);
            printer.bold(false);

            items.forEach(item => {
                printer.println(`  ${item.quantity}x ${item.name}`);
                printer.println(`     PKR ${item.total.toFixed(2)}`);
            });

            printer.newLine();
        });

        printer.drawLine();

        // TOTALS
        printer.println(`Subtotal: PKR ${receipt.subtotal?.toFixed(2) || 0}`);
        printer.println(`Tax: PKR ${receipt.tax?.toFixed(2) || 0}`);

        if (receipt.deliveryCharges && receipt.deliveryCharges > 0) {
            printer.println(`Delivery: PKR ${receipt.deliveryCharges.toFixed(2)}`);
        }

        printer.newLine();
        printer.bold(true);
        printer.setTextDoubleWidth();
        printer.println(`TOTAL: PKR ${receipt.total?.toFixed(2) || 0}`);
        printer.setTextNormal();
        printer.bold(false);

        if (receipt.paymentMethod) {
            printer.newLine();
            printer.println(`Payment: ${receipt.paymentMethod.toUpperCase()}`);
        }

        printer.drawLine();

        // FOOTER
        printer.alignCenter();
        printer.println('Thank you!');
        printer.println('Please visit again');
        printer.newLine();
        printer.newLine();
        printer.cut();

        await printer.execute();

        console.log(`✅ Printed: ${receipt.orderNumber}`);
        res.json({
            success: true,
            message: 'Receipt printed',
            orderNumber: receipt.orderNumber
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
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('');
    console.log('🖨️  ========================================');
    console.log('🖨️   THERMAL PRINTER SERVICE');
    console.log('🖨️  ========================================');
    console.log(`🖨️   Status: Running on port ${PORT}`);
    console.log(`🖨️   Printer: ${savedPrinterConfig?.printerName || 'Not configured'}`);
    console.log(`🖨️   Path: ${savedPrinterConfig?.printerPath || '/dev/usb/lp0'}`);
    console.log('🖨️  ========================================');
    console.log('');
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
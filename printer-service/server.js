// ============================================
// FILE: printer-service/server.js
// UNIVERSAL PRINTER DETECTION
// Windows, Linux, Android compatible
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
const os = require('os');

const app = express();

// ============================================
// DETECT OPERATING SYSTEM
// ============================================
const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isAndroid = fs.existsSync('/system/build.prop');

console.log(`🖥️  Platform: ${os.platform()} (${isWindows ? 'Windows' : isLinux ? 'Linux' : 'Other'})`);
if (isAndroid) console.log('📱 Android detected');

// ============================================
// SECURITY & MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
    origin: '*', // Allow all for local network
    credentials: true
}));
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
            console.log('✅ Loaded printer config:', savedPrinterConfig.printerName);
        }
    } catch (error) {
        console.log('ℹ️  No saved printer config');
    }
}

loadPrinterConfig();

// ============================================
// UNIVERSAL PRINTER DETECTION
// ============================================
async function detectPrinters() {
    const printers = [];

    try {
        // WINDOWS: Use WMI or reg query
        if (isWindows) {
            return new Promise((resolve) => {
                exec('wmic printer get name,portname', (error, stdout) => {
                    if (error) {
                        // Fallback: Check common printer ports
                        printers.push({
                            id: 'usb_windows',
                            name: 'USB Printer (Windows)',
                            type: 'usb',
                            path: 'USB001',
                            connected: true
                        });
                        resolve(printers);
                        return;
                    }

                    const lines = stdout.split('\n').slice(1);
                    lines.forEach((line, index) => {
                        const parts = line.trim().split(/\s{2,}/);
                        if (parts[0] && parts[0] !== 'Name') {
                            printers.push({
                                id: `printer_${index}`,
                                name: parts[0],
                                type: parts[1]?.includes('USB') ? 'usb' : 'network',
                                path: parts[1] || 'Unknown',
                                connected: true
                            });
                        }
                    });

                    resolve(printers.length > 0 ? printers : [{
                        id: 'default',
                        name: 'No printers detected',
                        type: 'system',
                        connected: false
                    }]);
                });
            });
        }

        // LINUX: Use lpstat
        if (isLinux && !isAndroid) {
            return new Promise((resolve) => {
                exec('lpstat -p -d', (error, stdout) => {
                    if (error) {
                        // Check USB devices directly
                        if (fs.existsSync('/dev/usb/lp0')) {
                            printers.push({
                                id: 'usb_linux',
                                name: 'USB Thermal Printer',
                                type: 'usb',
                                path: '/dev/usb/lp0',
                                connected: true
                            });
                        }
                        resolve(printers);
                        return;
                    }

                    const lines = stdout.split('\n');
                    lines.forEach((line, index) => {
                        if (line.startsWith('printer')) {
                            const match = line.match(/printer\s+(\S+)/);
                            if (match) {
                                printers.push({
                                    id: `printer_${index}`,
                                    name: match[1],
                                    type: 'system',
                                    connected: true
                                });
                            }
                        }
                    });

                    // Always add USB direct option
                    if (fs.existsSync('/dev/usb/lp0')) {
                        printers.push({
                            id: 'usb_direct',
                            name: 'USB Direct (/dev/usb/lp0)',
                            type: 'usb',
                            path: '/dev/usb/lp0',
                            connected: true
                        });
                    }

                    resolve(printers);
                });
            });
        }

        // ANDROID: Check USB OTG
        if (isAndroid) {
            // Android USB OTG printers
            if (fs.existsSync('/dev/bus/usb')) {
                printers.push({
                    id: 'usb_android',
                    name: 'USB OTG Printer',
                    type: 'usb',
                    path: '/dev/bus/usb',
                    connected: true
                });
            }

            // Bluetooth printers (if available)
            printers.push({
                id: 'bluetooth',
                name: 'Bluetooth Printer',
                type: 'bluetooth',
                connected: false,
                note: 'Pair via Android settings first'
            });

            return printers;
        }

        // Fallback
        return [{
            id: 'default',
            name: 'Manual Configuration Required',
            type: 'manual',
            connected: false
        }];

    } catch (error) {
        console.error('Detection error:', error);
        return [{
            id: 'error',
            name: 'Error detecting printers',
            type: 'error',
            connected: false,
            error: error.message
        }];
    }
}

app.get('/api/printers/detect', async (req, res) => {
    try {
        const printers = await detectPrinters();
        console.log(`✅ Detected ${printers.length} printer(s)`);

        res.json({
            success: true,
            printers,
            platform: os.platform(),
            isAndroid
        });

    } catch (error) {
        console.error('Detection error:', error);
        res.json({
            success: true,
            printers: [],
            error: error.message
        });
    }
});

// ============================================
// TEST PRINTER
// ============================================
app.post('/api/printers/test', async (req, res) => {
    try {
        const { printerPath, printerType } = req.body;

        if (!printerPath) {
            return res.json({
                success: false,
                error: 'No printer path provided'
            });
        }

        // For Windows, use printer name directly
        const printerInterface = isWindows ? printerPath : (printerPath || '/dev/usb/lp0');

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

        let isConnected = false;
        try {
            isConnected = await printer.isPrinterConnected();
        } catch (err) {
            // On Windows, connection check might fail but printing works
            if (isWindows) {
                isConnected = true;
            } else {
                throw err;
            }
        }

        if (!isConnected) {
            return res.json({
                success: false,
                error: `Cannot connect to printer at ${printerInterface}`
            });
        }

        printer.alignCenter();
        printer.setTextDoubleHeight();
        printer.bold(true);
        printer.println("TEST PRINT");
        printer.bold(false);
        printer.setTextNormal();
        printer.drawLine();
        printer.println("Printer Working!");
        printer.println(new Date().toLocaleString());
        printer.println(`Platform: ${os.platform()}`);
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
        const { printerId, printerName, printerPath, printerType } = req.body;

        const config = {
            printerId,
            printerName,
            printerPath,
            printerType,
            platform: os.platform(),
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
        platform: os.platform(),
        isWindows,
        isLinux,
        isAndroid,
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
        if (!savedPrinterConfig?.printerPath) {
            return res.status(503).json({
                success: false,
                error: 'No printer configured. Please configure printer in settings.'
            });
        }

        const printerInterface = savedPrinterConfig.printerPath;

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

        let isConnected = false;
        try {
            isConnected = await printer.isPrinterConnected();
        } catch (err) {
            if (isWindows) {
                isConnected = true;
            } else {
                throw err;
            }
        }

        if (!isConnected) {
            return res.status(503).json({
                success: false,
                error: 'Printer not connected'
            });
        }

        // HEADER
        printer.alignCenter();
        printer.setTextDoubleHeight();
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
    console.log(`🖨️   Platform: ${os.platform()}`);
    console.log(`🖨️   Status: Running on port ${PORT}`);
    console.log(`🖨️   Printer: ${savedPrinterConfig?.printerName || 'Not configured'}`);
    if (isWindows) console.log('🖨️   Mode: Windows');
    if (isLinux) console.log('🖨️   Mode: Linux');
    if (isAndroid) console.log('🖨️   Mode: Android (OTG)');
    console.log('🖨️  ========================================');
    console.log('');
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
// ============================================
// FILE: printer-service/server.js
// PRODUCTION SOLUTION - Pure JS, No Native Dependencies
// Works on Windows, Linux, Android
// ============================================

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const os = require('os');

const app = express();

// ============================================
// DETECT PLATFORM
// ============================================
const isWindows = os.platform() === 'win32';
const isLinux = os.platform() === 'linux';
const isMac = os.platform() === 'darwin';

console.log(`🖥️  Platform: ${os.platform()}`);

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '1mb' }));

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 50
});
app.use('/api/print', limiter);

// ============================================
// CONFIG
// ============================================
let savedPrinterConfig = null;
const configPath = path.join(__dirname, 'printer-config.json');

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            savedPrinterConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log('✅ Config loaded:', savedPrinterConfig.printerName);
        }
    } catch (error) {
        console.log('ℹ️  No saved config');
    }
}

loadConfig();

// ============================================
// WINDOWS: Detect Printers
// ============================================
function getWindowsPrinters() {
    return new Promise((resolve) => {
        exec('wmic printer get name,portname,driverName /format:list', (error, stdout) => {
            if (error) {
                console.error('Windows detection failed:', error.message);
                resolve([]);
                return;
            }

            const printers = [];
            const blocks = stdout.split('\n\n').filter(b => b.trim());

            blocks.forEach((block, idx) => {
                const lines = block.split('\n');
                const printer = {};

                lines.forEach(line => {
                    const [key, value] = line.split('=').map(s => s.trim());
                    if (key && value) printer[key.toLowerCase()] = value;
                });

                if (printer.name) {
                    printers.push({
                        id: `win_${idx}`,
                        name: printer.name,
                        type: 'windows',
                        port: printer.portname || 'Unknown',
                        driver: printer.drivername || 'Unknown',
                        connected: true,
                        isDefault: false
                    });
                }
            });

            // Get default printer
            exec('wmic printer where default=true get name /format:list', (err, out) => {
                if (!err && out) {
                    const match = out.match(/Name=(.+)/);
                    if (match) {
                        const defaultName = match[1].trim();
                        printers.forEach(p => {
                            if (p.name === defaultName) p.isDefault = true;
                        });
                    }
                }

                console.log(`✅ Windows: ${printers.length} printers`);
                resolve(printers);
            });
        });
    });
}

// ============================================
// LINUX: Detect Printers
// ============================================
function getLinuxPrinters() {
    return new Promise((resolve) => {
        const printers = [];

        // CUPS printers
        exec('lpstat -p -d 2>/dev/null', (error, stdout) => {
            if (!error && stdout) {
                const lines = stdout.split('\n');
                let defaultPrinter = null;

                lines.forEach((line, idx) => {
                    // Get default
                    if (line.includes('system default destination:')) {
                        defaultPrinter = line.split(':')[1]?.trim();
                    }

                    // Get printers
                    if (line.startsWith('printer')) {
                        const match = line.match(/printer\s+(\S+)/);
                        if (match) {
                            const name = match[1];
                            printers.push({
                                id: `cups_${idx}`,
                                name: name,
                                type: 'cups',
                                port: 'CUPS',
                                driver: 'System Driver',
                                connected: true,
                                isDefault: name === defaultPrinter
                            });
                        }
                    }
                });
            }

            // USB devices
            const usbPaths = ['/dev/usb/lp0', '/dev/usb/lp1', '/dev/lp0', '/dev/lp1'];
            usbPaths.forEach((usbPath, idx) => {
                if (fs.existsSync(usbPath)) {
                    const stats = fs.statSync(usbPath);
                    const isWritable = (stats.mode & 0o200) !== 0;

                    printers.push({
                        id: `usb_${idx}`,
                        name: `USB Printer (${path.basename(usbPath)})`,
                        type: 'usb',
                        port: usbPath,
                        driver: 'Direct USB',
                        connected: isWritable,
                        isDefault: false,
                        needsPermission: !isWritable
                    });
                }
            });

            console.log(`✅ Linux: ${printers.length} printers`);
            resolve(printers);
        });
    });
}

// ============================================
// MAC: Detect Printers
// ============================================
function getMacPrinters() {
    return new Promise((resolve) => {
        exec('lpstat -p -d', (error, stdout) => {
            if (error) {
                resolve([]);
                return;
            }

            const printers = [];
            const lines = stdout.split('\n');
            let defaultPrinter = null;

            lines.forEach((line, idx) => {
                if (line.includes('system default destination:')) {
                    defaultPrinter = line.split(':')[1]?.trim();
                }

                if (line.startsWith('printer')) {
                    const match = line.match(/printer\s+(\S+)/);
                    if (match) {
                        const name = match[1];
                        printers.push({
                            id: `mac_${idx}`,
                            name: name,
                            type: 'cups',
                            port: 'System',
                            driver: 'Mac Driver',
                            connected: true,
                            isDefault: name === defaultPrinter
                        });
                    }
                }
            });

            console.log(`✅ Mac: ${printers.length} printers`);
            resolve(printers);
        });
    });
}

// ============================================
// UNIVERSAL DETECT
// ============================================
app.get('/api/printers/detect', async (req, res) => {
    try {
        let printers = [];

        if (isWindows) {
            printers = await getWindowsPrinters();
        } else if (isLinux) {
            printers = await getLinuxPrinters();
        } else if (isMac) {
            printers = await getMacPrinters();
        }

        if (printers.length === 0) {
            printers.push({
                id: 'none',
                name: 'No printers detected',
                type: 'none',
                port: 'N/A',
                driver: 'N/A',
                connected: false,
                isDefault: false,
                note: isLinux
                    ? 'Install CUPS or connect USB printer'
                    : 'Install printer drivers'
            });
        }

        res.json({
            success: true,
            printers,
            platform: os.platform(),
            count: printers.length
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
// GENERATE ESC/POS RECEIPT
// ============================================
function generateReceipt(receipt) {
    const ESC = '\x1B';
    const GS = '\x1D';
    let out = '';

    // Initialize
    out += ESC + '@';

    // Header
    out += ESC + 'a' + '\x01'; // Center
    out += ESC + 'E' + '\x01'; // Bold
    out += GS + '!' + '\x11';  // Double
    out += (receipt.restaurantName || 'AT RESTAURANT') + '\n';
    out += GS + '!' + '\x00';
    out += ESC + 'E' + '\x00';
    out += (receipt.tagline || 'Delicious Food') + '\n';
    out += (receipt.address || 'Lahore') + '\n';
    out += '================================\n';

    // Order info
    out += ESC + 'a' + '\x00'; // Left
    out += `Order: ${receipt.orderNumber}\n`;
    out += `Date: ${receipt.date}\n`;
    out += `Type: ${receipt.orderType?.toUpperCase() || 'DINE-IN'}\n`;

    if (receipt.tableNumber) out += `Table: ${receipt.tableNumber}\n`;
    if (receipt.waiter) out += `Waiter: ${receipt.waiter}\n`;

    // Delivery
    if (receipt.orderType === 'delivery') {
        out += '================================\n';
        out += ESC + 'E' + '\x01';
        out += 'DELIVERY INFO\n';
        out += ESC + 'E' + '\x00';
        if (receipt.customerName) out += `Name: ${receipt.customerName}\n`;
        if (receipt.customerPhone) out += `Phone: ${receipt.customerPhone}\n`;
        if (receipt.deliveryAddress) out += `Address: ${receipt.deliveryAddress}\n`;
    }

    out += '================================\n';

    // Items
    out += ESC + 'E' + '\x01';
    out += 'ORDER ITEMS\n';
    out += ESC + 'E' + '\x00';
    out += '\n';

    const grouped = {};
    (receipt.items || []).forEach(item => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    Object.entries(grouped).forEach(([category, items]) => {
        out += ESC + 'E' + '\x01';
        out += `  ${category}\n`;
        out += ESC + 'E' + '\x00';

        items.forEach(item => {
            out += `  ${item.quantity}x ${item.name}\n`;
            out += `     PKR ${item.total.toFixed(2)}\n`;
        });

        out += '\n';
    });

    out += '================================\n';

    // Totals
    out += `Subtotal: PKR ${receipt.subtotal?.toFixed(2) || 0}\n`;
    out += `Tax: PKR ${receipt.tax?.toFixed(2) || 0}\n`;

    if (receipt.deliveryCharges) {
        out += `Delivery: PKR ${receipt.deliveryCharges.toFixed(2)}\n`;
    }

    out += '\n';
    out += ESC + 'E' + '\x01';
    out += GS + '!' + '\x11';
    out += `TOTAL: PKR ${receipt.total?.toFixed(2) || 0}\n`;
    out += GS + '!' + '\x00';
    out += ESC + 'E' + '\x00';

    if (receipt.paymentMethod) {
        out += '\n';
        out += `Payment: ${receipt.paymentMethod.toUpperCase()}\n`;
    }

    out += '================================\n';

    // Footer
    out += ESC + 'a' + '\x01';
    out += 'Thank you!\n';
    out += 'Please visit again\n';
    out += '\n\n';

    // Cut
    out += GS + 'V' + '\x00';

    return out;
}

// ============================================
// PRINT FUNCTION
// ============================================
function printToPrinter(printerName, data, callback) {
    if (isWindows) {
        // Windows: Use PowerShell
        const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.txt`);
        fs.writeFileSync(tempFile, data, 'binary');

        const psCmd = `Get-Content -Path "${tempFile}" -Encoding Byte -ReadCount 0 | Out-Printer -Name "${printerName}"`;
        exec(`powershell -Command "${psCmd}"`, (error) => {
            fs.unlinkSync(tempFile);
            callback(error);
        });

    } else if (isLinux || isMac) {
        // Linux/Mac: Use lp command or direct write
        if (printerName.startsWith('/dev/')) {
            // Direct USB
            fs.writeFile(printerName, data, 'binary', callback);
        } else {
            // CUPS
            const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}.txt`);
            fs.writeFileSync(tempFile, data, 'binary');
            exec(`lp -d "${printerName}" "${tempFile}"`, (error) => {
                fs.unlinkSync(tempFile);
                callback(error);
            });
        }
    } else {
        callback(new Error('Unsupported platform'));
    }
}

// ============================================
// TEST PRINT
// ============================================
app.post('/api/printers/test', async (req, res) => {
    try {
        const { printerName } = req.body;

        if (!printerName) {
            return res.json({ success: false, error: 'No printer selected' });
        }

        const testData = generateReceipt({
            restaurantName: 'TEST PRINT',
            tagline: 'Printer Working!',
            address: new Date().toLocaleString(),
            orderNumber: 'TEST',
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            items: [
                { name: 'Test Item', quantity: 1, total: 100, category: 'Test' }
            ],
            subtotal: 100,
            tax: 0,
            total: 100
        });

        printToPrinter(printerName, testData, (error) => {
            if (error) {
                console.error('Print error:', error);
                res.json({ success: false, error: error.message });
            } else {
                console.log('✅ Test print sent');
                res.json({ success: true, message: 'Test print sent' });
            }
        });

    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ============================================
// SAVE CONFIG
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
        res.json({ success: true, message: 'Settings saved' });

    } catch (error) {
        res.json({ success: false, error: error.message });
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
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ============================================
// PRINT RECEIPT
// ============================================
app.post('/api/print', async (req, res) => {
    if (!req.body || !req.body.orderNumber) {
        return res.status(400).json({ success: false, error: 'Invalid data' });
    }

    const receipt = req.body;

    try {
        if (!savedPrinterConfig?.printerName) {
            return res.status(503).json({
                success: false,
                error: 'No printer configured'
            });
        }

        const data = generateReceipt(receipt);

        printToPrinter(savedPrinterConfig.printerName, data, (error) => {
            if (error) {
                console.error('Print error:', error);
                res.status(500).json({ success: false, error: error.message });
            } else {
                console.log(`✅ Printed: ${receipt.orderNumber}`);
                res.json({
                    success: true,
                    message: 'Receipt printed',
                    orderNumber: receipt.orderNumber
                });
            }
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
});

// ============================================
// START
// ============================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log('');
    console.log('🖨️  ========================================');
    console.log('🖨️   THERMAL PRINTER SERVICE');
    console.log('🖨️  ========================================');
    console.log(`🖨️   Platform: ${os.platform()}`);
    console.log(`🖨️   Port: ${PORT}`);
    console.log(`🖨️   Saved: ${savedPrinterConfig?.printerName || 'None'}`);
    console.log('🖨️  ========================================');
    console.log('');

    // Auto-detect printers on startup
    try {
        let printers = [];
        if (isWindows) printers = await getWindowsPrinters();
        else if (isLinux) printers = await getLinuxPrinters();
        else if (isMac) printers = await getMacPrinters();

        if (printers.length > 0) {
            console.log('📋 Available printers:');
            printers.forEach(p => {
                console.log(`   ${p.isDefault ? '⭐' : ' '} ${p.name} (${p.type})`);
            });
            console.log('');
        }
    } catch (err) {
        console.log('⚠️  Could not list printers');
    }
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
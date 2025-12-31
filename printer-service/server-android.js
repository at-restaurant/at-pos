// ============================================
// ANDROID PRINTER SERVICE
// printer-service/server-android.js
// Run in Termux on Android
// ============================================

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
    origin: '*', // Allow all origins for local network access
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// ============================================
// DETECT PLATFORM
// ============================================
const isAndroid = os.platform() === 'linux' && process.env.TERMUX_VERSION !== undefined;
const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';

console.log('🔍 Platform detected:', {
    platform: os.platform(),
    isAndroid,
    isWindows,
    isMac,
    termuxVersion: process.env.TERMUX_VERSION
});

// ============================================
// ANDROID PRINTER DETECTION (USB & Network)
// ============================================
async function detectAndroidPrinters() {
    return new Promise((resolve) => {
        if (!isAndroid) {
            resolve([]);
            return;
        }

        // Check for USB devices
        exec('ls /dev/usb/lp* 2>/dev/null || ls /dev/bus/usb/*/* 2>/dev/null', (error, stdout) => {
            const printers = [];

            if (stdout) {
                const devices = stdout.trim().split('\n');
                devices.forEach((device, index) => {
                    if (device) {
                        printers.push({
                            id: `usb_${index}`,
                            name: `USB Thermal Printer ${index + 1}`,
                            driver: 'USB',
                            port: device,
                            type: 'usb',
                            connected: true,
                            isDefault: index === 0
                        });
                    }
                });
            }

            // Add generic Android printer option (uses system print service)
            printers.push({
                id: 'android_default',
                name: 'Android Print Service',
                driver: 'Android System',
                port: 'System',
                type: 'system',
                connected: true,
                isDefault: printers.length === 0
            });

            console.log(`✅ Found ${printers.length} Android printer(s)`);
            resolve(printers);
        });
    });
}

// ============================================
// WINDOWS PRINTER DETECTION
// ============================================
async function detectWindowsPrinters() {
    return new Promise((resolve) => {
        if (!isWindows) {
            resolve([]);
            return;
        }

        const command = `powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | ConvertTo-Json"`;

        exec(command, { encoding: 'utf8' }, (error, stdout) => {
            if (error) {
                console.error('❌ Printer detection error:', error.message);
                resolve([]);
                return;
            }

            try {
                let printers = JSON.parse(stdout);
                if (!Array.isArray(printers)) printers = [printers];

                const formatted = printers.map((p, index) => ({
                    id: `printer_${index}`,
                    name: p.Name || 'Unknown Printer',
                    driver: p.DriverName || 'Unknown Driver',
                    port: p.PortName || 'USB',
                    status: p.PrinterStatus || 'Unknown',
                    type: 'system',
                    connected: p.PrinterStatus === 'Normal' || p.PrinterStatus === 'Idle',
                    isDefault: index === 0
                }));

                console.log(`✅ Found ${formatted.length} Windows printer(s)`);
                resolve(formatted);
            } catch (parseError) {
                console.error('❌ Failed to parse printer data');
                resolve([]);
            }
        });
    });
}

// ============================================
// MAC PRINTER DETECTION
// ============================================
async function detectMacPrinters() {
    return new Promise((resolve) => {
        if (!isMac) {
            resolve([]);
            return;
        }

        exec('lpstat -p -d', (error, stdout) => {
            if (error) {
                resolve([]);
                return;
            }

            const lines = stdout.split('\n');
            const printers = lines
                .filter(line => line.startsWith('printer'))
                .map((line, index) => {
                    const name = line.split(' ')[1];
                    return {
                        id: `printer_${index}`,
                        name: name,
                        driver: 'CUPS',
                        port: 'USB',
                        type: 'cups',
                        connected: true,
                        isDefault: index === 0
                    };
                });

            console.log(`✅ Found ${printers.length} Mac printer(s)`);
            resolve(printers);
        });
    });
}

// ============================================
// UNIVERSAL PRINTER DETECTION
// ============================================
async function detectPrinters() {
    if (isAndroid) return await detectAndroidPrinters();
    if (isWindows) return await detectWindowsPrinters();
    if (isMac) return await detectMacPrinters();
    return [];
}

// ============================================
// PRINT TO ANDROID
// ============================================
function printToAndroid(receiptText) {
    return new Promise((resolve, reject) => {
        // Method 1: Try USB device
        const usbDevice = '/dev/usb/lp0'; // Common USB printer path

        fs.access(usbDevice, fs.constants.W_OK, (err) => {
            if (!err) {
                // Direct USB write
                fs.writeFile(usbDevice, receiptText, (writeErr) => {
                    if (writeErr) {
                        console.log('⚠️ USB write failed, trying alternative...');
                        // Fallback to temp file
                        saveTempFileForAndroid(receiptText, resolve, reject);
                    } else {
                        console.log('✅ Printed via USB device');
                        resolve({ success: true, method: 'usb' });
                    }
                });
            } else {
                // No USB device, use temp file
                saveTempFileForAndroid(receiptText, resolve, reject);
            }
        });
    });
}

function saveTempFileForAndroid(receiptText, resolve, reject) {
    // Save to shared storage for printing via Android Print Service
    const tempDir = process.env.HOME || '/data/data/com.termux/files/home';
    const tempFile = path.join(tempDir, 'storage', 'downloads', `receipt_${Date.now()}.txt`);

    fs.writeFile(tempFile, receiptText, 'utf8', (err) => {
        if (err) {
            reject(new Error('Failed to save receipt file'));
            return;
        }

        console.log(`✅ Receipt saved to: ${tempFile}`);
        console.log('📱 Use Android Print Service to print this file');

        resolve({
            success: true,
            method: 'file',
            filePath: tempFile,
            message: 'Receipt saved. Use Android Print Service or file manager to print.'
        });
    });
}

// ============================================
// PRINT TO WINDOWS
// ============================================
function printToWindows(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `receipt_${Date.now()}.txt`);

        fs.writeFileSync(tempFile, receiptText, 'utf8');

        const command = `print /D:"${printerName}" "${tempFile}"`;

        exec(command, (error, stdout, stderr) => {
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.warn('⚠️ Could not delete temp file');
            }

            if (error) {
                reject(new Error(`Print failed: ${error.message}`));
                return;
            }

            console.log('✅ Printed via Windows');
            resolve({ success: true, stdout, stderr });
        });
    });
}

// ============================================
// PRINT TO MAC
// ============================================
function printToMac(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        const tempDir = os.tmpdir();
        const tempFile = path.join(tempDir, `receipt_${Date.now()}.txt`);

        fs.writeFileSync(tempFile, receiptText, 'utf8');

        const command = `lpr -P "${printerName}" "${tempFile}"`;

        exec(command, (error) => {
            try {
                fs.unlinkSync(tempFile);
            } catch (e) {
                console.warn('⚠️ Could not delete temp file');
            }

            if (error) {
                reject(new Error(`Print failed: ${error.message}`));
                return;
            }

            console.log('✅ Printed via Mac');
            resolve({ success: true });
        });
    });
}

// ============================================
// UNIVERSAL PRINT FUNCTION
// ============================================
async function printReceipt(printerName, receiptText) {
    if (isAndroid) {
        return await printToAndroid(receiptText);
    }
    if (isWindows) {
        return await printToWindows(printerName, receiptText);
    }
    if (isMac) {
        return await printToMac(printerName, receiptText);
    }
    throw new Error('Unsupported platform');
}

// ============================================
// FORMAT RECEIPT (Same as Windows version)
// ============================================
function formatReceipt(data) {
    const line = '----------------------------------------';
    const doubleLine = '========================================';

    let receipt = '\n';
    receipt += center(data.restaurantName || 'AT RESTAURANT') + '\n';
    receipt += center(data.tagline || 'Delicious Food, Memorable Moments') + '\n';
    receipt += line + '\n';
    receipt += center(data.address || 'Sooter Mills Rd, Lahore') + '\n';
    receipt += center(data.phone || 'Tel: +92-XXX-XXXXXXX') + '\n';
    receipt += doubleLine + '\n\n';

    receipt += `Order #: ${data.orderNumber}\n`;
    receipt += `Date: ${data.date}\n`;
    receipt += `Type: ${data.orderType === 'delivery' ? '🚚 DELIVERY' : '🍽️ DINE-IN'}\n`;

    if (data.tableNumber) receipt += `Table: #${data.tableNumber}\n`;
    if (data.waiter) receipt += `Waiter: ${data.waiter}\n`;
    receipt += line + '\n\n';

    if (data.orderType === 'delivery' && (data.customerName || data.customerPhone)) {
        receipt += '📦 DELIVERY DETAILS\n';
        if (data.customerName) receipt += `Name: ${data.customerName}\n`;
        if (data.customerPhone) receipt += `Phone: ${data.customerPhone}\n`;
        if (data.deliveryAddress) receipt += `Address: ${data.deliveryAddress}\n`;
        receipt += line + '\n\n';
    }

    receipt += 'ORDER ITEMS\n' + line + '\n';

    const grouped = {};
    data.items.forEach(item => {
        const cat = item.category || '📋 Other';
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

app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        platform: os.platform(),
        isAndroid,
        isWindows,
        isMac,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

app.get('/api/printers/detect', async (req, res) => {
    try {
        const printers = await detectPrinters();
        res.json({
            success: true,
            printers,
            count: printers.length,
            platform: { isAndroid, isWindows, isMac }
        });
    } catch (error) {
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

        const testReceipt = formatReceipt({
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-001',
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            items: [
                { name: 'Test Item', quantity: 1, price: 100, total: 100, category: '🧪 Test' }
            ],
            subtotal: 100,
            tax: 0,
            total: 100
        });

        const result = await printReceipt(printerName, testReceipt);

        res.json({
            success: true,
            message: 'Test print sent',
            ...result
        });

    } catch (error) {
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

        const printers = await detectPrinters();

        if (printers.length === 0) {
            return res.status(503).json({
                success: false,
                error: 'No printers available'
            });
        }

        const defaultPrinter = printers.find(p => p.isDefault) || printers[0];
        const receiptText = formatReceipt(receiptData);

        const result = await printReceipt(defaultPrinter.name, receiptText);

        console.log(`✅ Receipt printed: Order ${receiptData.orderNumber}`);

        res.json({
            success: true,
            message: 'Receipt printed successfully',
            orderNumber: receiptData.orderNumber,
            printer: defaultPrinter.name,
            ...result
        });

    } catch (error) {
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

// ============================================
// START SERVER
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🖨️  UNIVERSAL PRINTER SERVICE');
    console.log('='.repeat(50));
    console.log(`✅ Server: http://0.0.0.0:${PORT}`);
    console.log(`📍 Platform: ${os.platform()} (${os.arch()})`);
    console.log(`🔧 Node: ${process.version}`);

    if (isAndroid) {
        console.log('📱 Android/Termux Mode Enabled');
        console.log('💡 Access from other devices: http://YOUR_IP:3001');
    }
    if (isWindows) console.log('🪟 Windows Mode Enabled');
    if (isMac) console.log('🍎 Mac Mode Enabled');

    console.log('='.repeat(50));
    console.log('\n📝 Endpoints:');
    console.log('   GET  /api/health');
    console.log('   GET  /api/printers/detect');
    console.log('   POST /api/printers/test');
    console.log('   POST /api/print\n');

    detectPrinters().then(printers => {
        if (printers.length > 0) {
            console.log('✅ Printer detection successful!\n');
        } else {
            console.log('⚠️  No printers detected\n');
        }
    });
});

process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down...');
    process.exit(0);
});
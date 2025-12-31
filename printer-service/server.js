// printer-service/server.js - FIXED WINDOWS DETECTION
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '10mb' }));

// ✅ IMPROVED: Detect Windows Printers with Better Status Detection
function detectWindowsPrinters() {
    return new Promise((resolve) => {
        // Get detailed printer info including queue status
        const command = `powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Type | ConvertTo-Json"`;

        exec(command, { encoding: 'utf8', maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error('❌ Printer detection error:', error.message);
                resolve([]);
                return;
            }

            try {
                let printers = JSON.parse(stdout);
                if (!Array.isArray(printers)) printers = [printers];

                const formatted = printers.map((p, index) => {
                    // ✅ Better status detection
                    const status = p.PrinterStatus;
                    const isUsb = (p.PortName || '').includes('USB');

                    // ✅ Consider printer "connected" if:
                    // 1. It's a USB printer, OR
                    // 2. Status is Normal/Idle/Unknown (Unknown often means ready)
                    const isConnected = isUsb ||
                        status === 'Normal' ||
                        status === 'Idle' ||
                        status === 'Unknown';

                    return {
                        id: `printer_${index}`,
                        name: p.Name || 'Unknown Printer',
                        driver: p.DriverName || 'Unknown Driver',
                        port: p.PortName || 'USB',
                        status: status || 'Ready',
                        type: isUsb ? 'usb' : 'system',
                        connected: isConnected,
                        isDefault: index === 0 // First USB printer as default
                    };
                });

                // ✅ Sort: USB printers first, then by name
                formatted.sort((a, b) => {
                    if (a.type === 'usb' && b.type !== 'usb') return -1;
                    if (a.type !== 'usb' && b.type === 'usb') return 1;
                    return a.name.localeCompare(b.name);
                });

                // ✅ Set first USB printer as default
                if (formatted.length > 0) {
                    const firstUsb = formatted.find(p => p.type === 'usb');
                    if (firstUsb) {
                        formatted.forEach(p => p.isDefault = (p.id === firstUsb.id));
                    } else {
                        formatted[0].isDefault = true;
                    }
                }

                console.log(`✅ Found ${formatted.length} printer(s)`);
                console.log('📋 Printers:', formatted.map(p =>
                    `${p.name} (${p.type}, ${p.connected ? 'Connected' : 'Offline'})`
                ).join(', '));

                resolve(formatted);
            } catch (parseError) {
                console.error('❌ Parse error:', parseError);
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

            console.log('✅ Print successful');
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

// API Endpoints
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        uptime: process.uptime()
    });
});

app.get('/api/printers/detect', async (req, res) => {
    try {
        const printers = await detectWindowsPrinters();
        res.json({ success: true, printers, count: printers.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message, printers: [] });
    }
});

app.post('/api/printers/test', async (req, res) => {
    try {
        const { printerName } = req.body;

        if (!printerName) {
            return res.status(400).json({ success: false, error: 'Printer name required' });
        }

        const testReceipt = formatReceipt({
            restaurantName: 'AT RESTAURANT',
            tagline: 'Test Print',
            address: 'Sooter Mills Rd, Lahore',
            orderNumber: 'TEST-001',
            date: new Date().toLocaleString(),
            orderType: 'dine-in',
            items: [{ name: 'Test Item', quantity: 1, price: 100, total: 100, category: 'Test' }],
            subtotal: 100,
            tax: 0,
            total: 100
        });

        await printToWindowsPrinter(printerName, testReceipt);
        res.json({ success: true, message: 'Test print sent successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/print', async (req, res) => {
    try {
        const receiptData = req.body;

        if (!receiptData || !receiptData.items) {
            return res.status(400).json({ success: false, error: 'Invalid receipt data' });
        }

        const printers = await detectWindowsPrinters();

        if (printers.length === 0) {
            return res.status(503).json({ success: false, error: 'No printers available' });
        }

        // ✅ Use first connected USB printer, or first printer as fallback
        const defaultPrinter = printers.find(p => p.type === 'usb' && p.connected) ||
            printers.find(p => p.connected) ||
            printers[0];

        const receiptText = formatReceipt(receiptData);

        await printToWindowsPrinter(defaultPrinter.name, receiptText);

        console.log(`✅ Receipt printed: Order ${receiptData.orderNumber} on ${defaultPrinter.name}`);

        res.json({
            success: true,
            message: 'Receipt printed successfully',
            orderNumber: receiptData.orderNumber,
            printer: defaultPrinter.name
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/printers/save', async (req, res) => {
    res.json({ success: true, message: 'Printer settings saved' });
});

// Start Server
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(50));
    console.log('🖨️  THERMAL PRINTER SERVICE - WINDOWS');
    console.log('='.repeat(50));
    console.log(`✅ Server: http://localhost:${PORT}`);
    console.log(`📍 Platform: ${os.platform()}`);
    console.log('='.repeat(50) + '\n');

    detectWindowsPrinters().then(printers => {
        if (printers.length > 0) {
            const usbPrinters = printers.filter(p => p.type === 'usb' && p.connected);
            console.log('✅ Printers detected!\n');
            if (usbPrinters.length > 0) {
                console.log('🎯 USB Printers Ready:');
                usbPrinters.forEach(p => console.log(`   - ${p.name} (${p.driver})`));
            }
        } else {
            console.log('⚠️  No printers found\n');
        }
    });
});

process.on('SIGINT', () => {
    console.log('\n👋 Shutting down...');
    process.exit(0);
});
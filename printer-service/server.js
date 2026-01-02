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

// ✅ FIX: Allow production origins
const allowedOrigins = [
    'http://localhost:3000', // Local dev
    // Add your production URL here
    // e.g., 'https://your-app.vercel.app'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
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
            const availablePrinters = printer.getPrinters();
            const formatted = availablePrinters.map((p, index) => ({
                id: `printer_${index}`,
                name: p.name,
                driver: p.driverName,
                status: p.status,
                connected: p.status !== 'Offline',
                isDefault: p.isDefault || false,
                type: (p.portName || '').toUpperCase().includes('USB') ? 'usb' : 'system',
            }));

            // Prioritize: Default printer first, then USB
            formatted.sort((a, b) => {
                if (a.isDefault && !b.isDefault) return -1;
                if (!a.isDefault && b.isDefault) return 1;
                if (a.type === 'usb' && b.type !== 'usb') return -1;
                if (a.type !== 'usb' && b.type === 'usb') return 1;
                return a.name.localeCompare(b.name);
            });

            console.log(`🔍 Found ${formatted.length} printers.`);
            resolve(formatted);
        } catch (error) {
            console.error('❌ Printer detection error:', error.message);
            resolve([]);
        }
    });
}

// Print to Windows Printer
function printToWindowsPrinter(printerName, receiptText) {
    return new Promise((resolve, reject) => {
        try {
            printer.printDirect({
                data: receiptText,
                printer: printerName,
                type: 'RAW',
                success: (jobId) => {
                    console.log(`✅ Print job sent. ID: ${jobId}`);
                    resolve({ success: true, jobId });
                },
                error: (err) => {
                    console.error('❌ Print error:', err);
                    reject(new Error(`Print failed: ${err.message || err}`));
                },
            });
        } catch (err) {
            console.error('❌ Synchronous print error:', err);
            reject(new Error(`Print failed: ${err.message || err}`));
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
    res.json({ status: 'online', platform: os.platform(), version: '3.0.0-https' });
});

app.get('/api/printers/detect', async (req, res) => {
    const printers = await detectWindowsPrinters();
    res.json({ success: true, printers });
});

app.post('/api/printers/test', async (req, res) => {
    const { printerName } = req.body;
    if (!printerName) {
        return res.status(400).json({ success: false, error: 'Printer name required' });
    }
    const testReceipt = formatReceipt({
        restaurantName: 'AT RESTAURANT', tagline: 'Test Print',
        orderNumber: 'TEST-001', date: new Date().toLocaleString(),
        items: [{ name: 'Test Item', quantity: 1, price: 100, total: 100, category: 'Test' }],
        subtotal: 100, tax: 0, total: 100
    });
    try {
        await printToWindowsPrinter(printerName, testReceipt);
        res.json({ success: true, message: 'Test print sent' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/print', async (req, res) => {
    const receiptData = req.body;
    if (!receiptData || !receiptData.items) {
        return res.status(400).json({ success: false, error: 'Invalid receipt data' });
    }

    const printers = await detectWindowsPrinters();
    if (printers.length === 0) {
        return res.status(503).json({ success: false, error: 'No printers available' });
    }

    // ✅ IMPROVED LOGIC: Use default, then first connected USB, then first printer
    const defaultPrinter =
        printers.find(p => p.isDefault) ||
        printers.find(p => p.type === 'usb' && p.connected) ||
        printers[0];

    console.log(`🖨️  Using printer: ${defaultPrinter.name}`);

    try {
        const receiptText = formatReceipt(receiptData);
        await printToWindowsPrinter(defaultPrinter.name, receiptText);
        res.json({ success: true, message: 'Receipt printed', printer: defaultPrinter.name });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
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

    server.listen(PORT, '0.0.0.0', () => {
        console.log('='.repeat(60));
        console.log('🖨️  SECURE PRINTER SERVICE (HTTPS)');
        console.log('='.repeat(60));
        console.log(`✅ Server running at: https://localhost:${PORT}`);
        console.log(`✅ Network access: https://<YOUR_IP>:${PORT}`);
        console.log('='.repeat(60));
        console.log('🔒 IMPORTANT: You must trust the self-signed certificate in your browser!');
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n👋 Shutting down...');
        server.close(() => {
            console.log('✅ Server closed.');
            process.exit(0);
        });
    });

} catch (error) {
    if (error.code === 'ENOENT') {
        console.error('❌ FATAL ERROR: SSL certificate not found.');
        console.error('Please run the certificate generation script first.');
    } else {
        console.error('❌ FATAL ERROR:', error);
    }
    process.exit(1);
}

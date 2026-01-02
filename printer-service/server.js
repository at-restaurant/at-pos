const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const app = express();
const PORT = 3001;

//CORS: Allow all origins for testtt
app.use(cors({
    origin: '*',
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Detect Windows Printers using WMI (no native module needed)
async function detectWindowsPrinters() {
    try {
        console.log('🔍 Starting printer detection via WMI...');
        
        // Use PowerShell to query Windows printers
        const command = `powershell -Command "Get-Printer | ConvertTo-Json"`;
        const { stdout } = await execAsync(command, { 
            shell: 'powershell.exe',
            timeout: 5000 
        });
        
        const printers = JSON.parse(stdout);
        const formatted = [];
        
        if (Array.isArray(printers)) {
            printers.forEach((p, index) => {
                if (p.Name) {
                    formatted.push({
                        id: `printer_${index}`,
                        name: p.Name,
                        driver: p.DriverName || 'Unknown',
                        status: p.PrinterStatus || 'Unknown',
                        connected: (p.PrinterStatus || 0) !== 3,
                        isDefault: p.Default === true,
                        type: p.PortName?.includes('USB') ? 'usb' : 'system',
                    });
                }
            });
        } else if (printers.Name) {
            // Single printer
            formatted.push({
                id: 'printer_0',
                name: printers.Name,
                driver: printers.DriverName || 'Unknown',
                status: printers.PrinterStatus || 'Unknown',
                connected: (printers.PrinterStatus || 0) !== 3,
                isDefault: printers.Default === true,
                type: printers.PortName?.includes('USB') ? 'usb' : 'system',
            });
        }

        console.log(`Found ${formatted.length} printer(s).`);
        formatted.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.name} - ${p.type} - ${p.status} ${p.isDefault ? '(DEFAULT)' : ''}`);
        });
        
        return formatted;
    } catch (error) {
        console.error('⚠️  WMI detection failed, trying fallback method...');
        return await detectPrintersViaRegistry();
    }
}

// Fallback: Detect printers from Windows Registry
async function detectPrintersViaRegistry() {
    try {
        const command = `powershell -Command "Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Devices' | Select-Object PSObject.Properties | ConvertTo-Json"`;
        const { stdout } = await execAsync(command, { 
            shell: 'powershell.exe',
            timeout: 5000 
        });
        
        const registryData = JSON.parse(stdout);
        const printers = [];
        
        if (Array.isArray(registryData)) {
            registryData.forEach((item, index) => {
                if (item.Name && !item.Name.startsWith('PS_') && !item.Name.startsWith('CLSID')) {
                    printers.push({
                        id: `printer_${index}`,
                        name: item.Name,
                        driver: 'Unknown',
                        status: 'Unknown',
                        connected: true,
                        isDefault: index === 0,
                        type: 'system',
                    });
                }
            });
        }
        
        console.log(` Found ${printers.length} printer(s) via registry.`);
        return printers;
    } catch (error) {
        console.error('❌ All detection methods failed:', error.message);
        return [];
    }
}

// Print using Windows Print API
async function printToWindowsPrinter(printerName, receiptText) {
    try {
        if (!printerName || typeof printerName !== 'string') {
            throw new Error('Invalid printer name provided');
        }

        if (!receiptText || typeof receiptText !== 'string') {
            throw new Error('Invalid receipt data');
        }

        console.log(`📤 Sending print job to: ${printerName}`);
        console.log(`   Data size: ${receiptText.length} bytes`);

        // Create temporary file with receipt text
        const tempDir = path.join(os.tmpdir(), 'at-pos-print');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `receipt_${Date.now()}.txt`);
        fs.writeFileSync(tempFile, receiptText, 'utf8');

        console.log(`   Temp file created: ${tempFile}`);

        // Method 1: Use Windows 'print' command (most reliable)
        try {
            console.log('   Method 1: Using Windows print command...');
            const printCommand = `print /d:"${printerName}" "${tempFile}"`;
            await execAsync(printCommand, { 
                shell: 'cmd.exe',
                timeout: 10000 
            });
            
            console.log(` Print job sent successfully via Windows print command!`);
            
            // Clean up temp file
            setTimeout(() => {
                try {
                    fs.unlinkSync(tempFile);
                } catch (e) {
                    console.warn('Could not delete temp file:', tempFile);
                }
            }, 2000);
            
            return { success: true, printer: printerName, method: 'windows-print' };
        } catch (err1) {
            console.log(`   ⚠️  Method 1 failed: ${err1.message}`);
            
            // Method 2: Use Notepad with /p flag
            try {
                console.log('   Method 2: Using Notepad /p...');
                const notepadCommand = `notepad /pt "${tempFile}" "${printerName}" "" ""`;
                await execAsync(notepadCommand, { 
                    shell: 'cmd.exe',
                    timeout: 10000 
                });
                
                console.log(` Print job sent successfully via Notepad!`);
                
                setTimeout(() => {
                    try {
                        fs.unlinkSync(tempFile);
                    } catch (e) {}
                }, 2000);
                
                return { success: true, printer: printerName, method: 'notepad' };
            } catch (err2) {
                console.log(`   ⚠️  Method 2 failed: ${err2.message}`);
                
                // Method 3: Use PowerShell with proper syntax
                try {
                    console.log('   Method 3: Using PowerShell (Add-Printer)...');
                    const psCommand = `powershell -Command "& { [System.Reflection.Assembly]::LoadWithPartialName('System.Printing') | Out-Null; $printServer = New-Object System.Printing.LocalPrintServer; $queue = $printServer.GetPrintQueue('${printerName}'); $job = $queue.AddPrintJob('AT-POS Receipt'); $stream = $job.JobStream; [byte[]]$bytes = [System.IO.File]::ReadAllBytes('${tempFile}'); $stream.Write($bytes, 0, $bytes.Length); $stream.Close(); $job.Publish(); }"`;
                    await execAsync(psCommand, { 
                        shell: 'powershell.exe',
                        timeout: 10000 
                    });
                    
                    console.log(` Print job sent successfully via PowerShell printing API!`);
                    
                    setTimeout(() => {
                        try {
                            fs.unlinkSync(tempFile);
                        } catch (e) {}
                    }, 2000);
                    
                    return { success: true, printer: printerName, method: 'powershell-api' };
                } catch (err3) {
                    console.log(`   ⚠️  Method 3 failed: ${err3.message}`);
                    throw new Error(`All print methods failed. Last error: ${err3.message}`);
                }
            }
        }
    } catch (error) {
        const errorMsg = error?.message || String(error);
        console.error('❌ Print job failed:', errorMsg);
        throw new Error(`Print failed: ${errorMsg}`);
    }
}

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
        mode: 'PowerShell/WMI',
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

        //  IMPROVED LOGIC: Use default, then first connected USB, then first printer
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

// Handle CORS preflight for all routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    res.status(500).json({ 
        success: false, 
        error: err.message 
    });
});

// --- Server Setup ---
// Try HTTPS first, fallback to HTTP if certificates don't exist
try {
    const certPath = path.join(__dirname, 'cert.pem');
    const keyPath = path.join(__dirname, 'key.pem');
    
    let server;
    let protocol = 'HTTP';
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        // Use HTTPS if certificates exist
        console.log(' SSL certificates found, using HTTPS...');
        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath),
        };
        server = https.createServer(options, app);
        protocol = 'HTTPS';
    } else {
        // Fallback to HTTP
        console.log('SSL certificates not found, using HTTP instead...');
        server = http.createServer(app);
        protocol = 'HTTP';
    }

    server.listen(PORT, '0.0.0.0', async () => {
        console.log('\n' + '='.repeat(70));
        console.log(`PRINTER SERVICE (${protocol}) - v3.0.0`);
        console.log('='.repeat(70));
        console.log(` Server running at: ${protocol.toLowerCase()}://localhost:${PORT}`);
        console.log(` Timestamp: ${new Date().toISOString()}`);
        console.log('='.repeat(70));
        
        // Run initial printer detection on startup
        console.log('\n🔄 Performing initial printer detection...');
        const initialPrinters = await detectWindowsPrinters();
        
        if (initialPrinters.length === 0) {
            console.warn('\n⚠️  WARNING: No printers detected at startup!');
            console.warn('   Make sure:');
            console.warn('   1. You are running on Windows 10/11');
            console.warn('   2. Printer is installed in Windows');
            console.warn('   3. Printer is powered on and connected');
        } else {
            console.log(`\nsuccessful - ${initialPrinters.length} printer(s) available\n`);
        }
        
        console.log('='.repeat(70));
        console.log(' ENDPOINTS AVAILABLE:');
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
            console.log(' Server closed gracefully.');
            process.exit(0);
        });
        
        // Force exit after 5 seconds
        setTimeout(() => {
            console.error('❌ Forced shutdown after timeout');
            process.exit(1);
        }, 5000);
    });

} catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
}

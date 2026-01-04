// build/afterPack.js - Handle native modules after packaging
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    console.log('🔧 Running afterPack script...');

    const { appOutDir, electronPlatformName } = context;

    if (electronPlatformName !== 'win32') {
        console.log('⚠️ Skipping: Not Windows platform');
        return;
    }

    try {
        // Path to the packaged app's node_modules
        const appNodeModules = path.join(appOutDir, 'resources', 'app', 'node_modules');
        const printerModulePath = path.join(appNodeModules, 'printer');

        if (fs.existsSync(printerModulePath)) {
            console.log('✅ Printer module found:', printerModulePath);

            // Check for .node files
            const nodeFiles = fs.readdirSync(printerModulePath, { recursive: true })
                .filter(f => f.endsWith('.node'));

            if (nodeFiles.length > 0) {
                console.log('✅ Found .node files:', nodeFiles);
            } else {
                console.warn('⚠️ No .node files found in printer module');
            }
        } else {
            console.warn('⚠️ Printer module not found at:', printerModulePath);
        }

        // Copy printer-service with dependencies
        const printerServiceSrc = path.join(context.appDir, 'printer-service');
        const printerServiceDest = path.join(appOutDir, 'resources', 'printer-service');

        if (fs.existsSync(printerServiceSrc)) {
            console.log('📦 Copying printer-service...');
            copyRecursiveSync(printerServiceSrc, printerServiceDest);
            console.log('✅ Printer service copied');
        }

        console.log('✅ afterPack completed successfully');
    } catch (error) {
        console.error('❌ afterPack error:', error);
    }
};

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(childItemName => {
            if (childItemName !== 'node_modules') { // Skip node_modules
                copyRecursiveSync(
                    path.join(src, childItemName),
                    path.join(dest, childItemName)
                );
            }
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}
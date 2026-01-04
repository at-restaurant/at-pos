// build/afterPack.js
const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
    const { appOutDir, packager, electronPlatformName } = context;

    console.log('🔧 Running afterPack script...');
    console.log(`   Platform: ${electronPlatformName}`);
    console.log(`   Output: ${appOutDir}`);

    // Windows-specific fixes
    if (electronPlatformName === 'win32') {
        const resourcesPath = path.join(appOutDir, 'resources');

        // Ensure printer-service exists
        const printerServiceSrc = path.join(packager.projectDir, 'printer-service');
        const printerServiceDest = path.join(resourcesPath, 'printer-service');

        if (fs.existsSync(printerServiceSrc) && !fs.existsSync(printerServiceDest)) {
            console.log('   ✅ Copying printer-service to resources...');
            fs.cpSync(printerServiceSrc, printerServiceDest, { recursive: true });
        }

        // Copy node_modules/printer to resources
        const printerModuleSrc = path.join(packager.projectDir, 'node_modules', 'printer');
        const printerModuleDest = path.join(resourcesPath, 'app', 'node_modules', 'printer');

        if (fs.existsSync(printerModuleSrc)) {
            console.log('   ✅ Copying printer module...');
            fs.mkdirSync(path.dirname(printerModuleDest), { recursive: true });
            fs.cpSync(printerModuleSrc, printerModuleDest, { recursive: true });
        }
    }

    console.log('✅ afterPack completed successfully');
};
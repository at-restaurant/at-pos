// electron/main.js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')

const isDev = !app.isPackaged
let mainWindow = null
let printerService = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 768,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: false
        },
        backgroundColor: '#0a0a0a',
        icon: path.join(__dirname, '../public/icons/icon-512.png'),
        autoHideMenuBar: true,
        title: 'AT Restaurant POS'
    })

    // ✅ FIX: Handle promise properly
    const loadPromise = isDev
        ? mainWindow.loadURL('http://localhost:3000')
        : mainWindow.loadFile(path.join(__dirname, '../out/index.html'))

    loadPromise.catch(err => {
        console.error('Failed to load window:', err)
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

function startPrinterService() {
    const servicePath = isDev
        ? path.join(__dirname, '../printer-service/server.js')
        : path.join(process.resourcesPath, 'printer-service/server.js')

    if (require('fs').existsSync(servicePath)) {
        printerService = spawn('node', [servicePath], {
            detached: false,
            stdio: 'inherit'
        })
        console.log('✅ Printer service started on localhost:3001')
    } else {
        console.warn('⚠️ Printer service not found at:', servicePath)
    }
}

app.whenReady().then(() => {
    startPrinterService()
    createWindow()
})

app.on('window-all-closed', () => {
    if (printerService) {
        printerService.kill()
    }
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.on('before-quit', () => {
    if (printerService) {
        printerService.kill()
    }
})
// electron/main.js - PRODUCTION READY
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

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

    const loadPromise = isDev
        ? mainWindow.loadURL('http://localhost:3000')
        : mainWindow.loadFile(path.join(__dirname, '../out/index.html'))

    loadPromise.catch(err => {
        console.error('❌ Failed to load window:', err)
    })

    mainWindow.on('closed', () => {
        mainWindow = null
    })

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools()
    }
}

function startPrinterService() {
    try {
        // Determine service path based on environment
        let servicePath
        let nodeModulesPath

        if (isDev) {
            // Development: Use local files
            servicePath = path.join(__dirname, '../printer-service/server.js')
            nodeModulesPath = path.join(__dirname, '../node_modules')
        } else {
            // Production: Use packaged resources
            servicePath = path.join(process.resourcesPath, 'printer-service/server.js')
            nodeModulesPath = path.join(process.resourcesPath, 'app/node_modules')
        }

        console.log('🔍 Checking printer service path:', servicePath)

        if (!fs.existsSync(servicePath)) {
            console.warn('⚠️ Printer service not found at:', servicePath)
            return
        }

        console.log('🚀 Starting printer service...')

        // Set NODE_PATH to include node_modules
        const env = {
            ...process.env,
            NODE_PATH: nodeModulesPath
        }

        printerService = spawn('node', [servicePath], {
            detached: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env
        })

        printerService.stdout.on('data', (data) => {
            console.log(`[Printer Service] ${data.toString().trim()}`)
        })

        printerService.stderr.on('data', (data) => {
            console.error(`[Printer Service Error] ${data.toString().trim()}`)
        })

        printerService.on('error', (error) => {
            console.error('❌ Failed to start printer service:', error)
        })

        printerService.on('exit', (code, signal) => {
            console.log(`⚠️ Printer service exited with code ${code}, signal ${signal}`)
            printerService = null
        })

        console.log('✅ Printer service started (PID:', printerService.pid, ')')
    } catch (error) {
        console.error('❌ Error starting printer service:', error)
    }
}

function stopPrinterService() {
    if (printerService) {
        try {
            console.log('🛑 Stopping printer service...')
            printerService.kill('SIGTERM')

            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (printerService && !printerService.killed) {
                    console.warn('⚠️ Force killing printer service')
                    printerService.kill('SIGKILL')
                }
            }, 5000)
        } catch (error) {
            console.error('❌ Error stopping printer service:', error)
        }
    }
}

// App lifecycle
app.whenReady().then(() => {
    startPrinterService()
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    stopPrinterService()
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('before-quit', () => {
    stopPrinterService()
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
})
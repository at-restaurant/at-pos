# 🚀 Windows Production Setup Guide

**AT Restaurant POS - Printer Service**  
**Final Production-Ready Version**

---

## 📋 Quick Overview

This guide will help you setup the printer service on Windows PC for production use. The web app is hosted on Vercel, printer service runs locally on your PC.

**Architecture:**
```
Vercel (Cloud) → Web App
    ↓
Windows PC (Local) → Printer Service → USB Printer
```

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Prerequisites

Download and install these (in order):

1. **Node.js** (Choose based on your Windows version):
    - 32-bit: https://nodejs.org/dist/v18.20.5/node-v18.20.5-x86.msi
    - 64-bit: https://nodejs.org/dist/v18.20.5/node-v18.20.5-x64.msi

2. **Visual Studio Build Tools**:
    - Download: https://aka.ms/vs/17/release/vs_BuildTools.exe
    - Select: "Desktop development with C++"
    - **Restart PC after installation**

3. **Python**:
    - Download: https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe
    - ✅ Check "Add Python to PATH"

---

### Step 2: Download Project

**Option A: Git Clone**
```cmd
cd C:\
git clone YOUR_GITHUB_REPO_URL
cd at-restaurant-pos
```

**Option B: Manual Download**
1. Download ZIP from GitHub
2. Extract to `C:\at-restaurant-pos`

---

### Step 3: Install Dependencies

Open **Command Prompt as Administrator** and run:

```cmd
cd C:\at-restaurant-pos\printer-service

:: Install dependencies
npm install

:: For 32-bit Windows
npm install printer --build-from-source --target_arch=ia32

:: For 64-bit Windows
npm install printer --build-from-source --target_arch=x64
```

**Wait 2-3 minutes for compilation.**

---

### Step 4: Connect Printer

1. Connect USB printer to PC
2. Install printer driver (if needed)
3. Verify in: `Control Panel → Devices and Printers`
4. Right-click printer → "Set as default printer"
5. Test: Right-click → "Printer properties" → "Print Test Page"

---

### Step 5: Start Service

```cmd
cd C:\at-restaurant-pos\printer-service
node server.js
```

**You should see:**
```
============================================================
🖨️  AT RESTAURANT - PRODUCTION PRINTER SERVICE
============================================================
✅ WebSocket Server: ws://localhost:3002
✅ Detected 1 printer(s):
   📍 XPrinter XP-80C (USB, DEFAULT)
============================================================
🎯 Service ready for connections!
```

**✅ Service is ready!** Keep this window open.

---

## 🔥 Production Setup (Auto-Start on Boot)

### Method 1: Startup Folder (Recommended - Simple)

**Step 1: Create Startup Script**

Create file: `C:\at-restaurant-pos\printer-service\start-service.bat`

```batch
@echo off
title AT Restaurant Printer Service
cd /d C:\at-restaurant-pos\printer-service
node server.js
pause
```

**Step 2: Add to Startup**

1. Press `Win + R`
2. Type: `shell:startup`
3. Press Enter
4. Right-click → New → Shortcut
5. Browse to `start-service.bat`
6. Name: "AT Printer Service"
7. Click Finish

**Step 3: Test**

1. Restart PC
2. Service should auto-start
3. Verify: Open browser → `http://localhost:3002`

---

### Method 2: Hidden Background Service

For completely hidden background execution:

**Step 1: Create VBS Script**

Create file: `C:\at-restaurant-pos\printer-service\start-hidden.vbs`

```vbscript
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d C:\at-restaurant-pos\printer-service && node server.js", 0, False
```

**Step 2: Add to Startup**

1. Press `Win + R`
2. Type: `shell:startup`
3. Press Enter
4. Copy `start-hidden.vbs` here

**Step 3: Test**

Restart PC - service will run completely hidden in background.

---

## 🧪 Testing

### Test 1: Service Status

Open browser: `http://localhost:3002`

You should see beautiful status page with:
- ✅ Service Online
- Platform info
- Connected printers list
- Current active clients

---

### Test 2: Health Check

Open browser: `http://localhost:3002/health`

You should see JSON response:
```json
{
  "status": "online",
  "printers": 1,
  "printerModuleLoaded": true
}
```

---

### Test 3: WebSocket Connection

Open browser console (F12) and paste:

```javascript
const ws = new WebSocket('ws://localhost:3002');
ws.onopen = () => {
    console.log('✅ Connected!');
    ws.send(JSON.stringify({type: 'GET_PRINTERS'}));
};
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

Should show printer list in console.

---

### Test 4: Print from Web App

1. Open your Vercel app: `https://your-app.vercel.app`
2. Make sure printer service is running
3. Create an order
4. Click "Print & Complete"
5. Receipt should print! ✅

---

## 🔧 Troubleshooting

### Issue 1: "Printer module not available"

**Fix:**
```cmd
cd C:\at-restaurant-pos\printer-service

:: For 32-bit
npm install printer --build-from-source --target_arch=ia32

:: For 64-bit
npm install printer --build-from-source --target_arch=x64
```

---

### Issue 2: "Could not find Visual Studio"

**Fix:**
1. Install Visual Studio Build Tools
2. Select "Desktop development with C++"
3. **Restart PC**
4. Try installation again

---

### Issue 3: "No printers detected"

**Fix:**
1. Check: `Control Panel → Devices and Printers`
2. Printer should show "Ready"
3. Set as default printer
4. Restart printer service
5. Check logs

---

### Issue 4: Port 3002 in use

**Fix:**
```cmd
:: Find process using port
netstat -ano | findstr :3002

:: Kill process (replace 1234 with actual PID)
taskkill /PID 1234 /F

:: Or change port in server.js
```

---

### Issue 5: Service doesn't auto-start

**Fix:**
1. Check startup folder: `shell:startup`
2. Make sure script is there
3. Right-click script → Properties → Unblock
4. Test manually first
5. Restart PC

---

## 📊 Monitoring

### Check if Service Running

**Method 1: Process**
```cmd
tasklist | findstr node
```

**Method 2: Port**
```cmd
netstat -ano | findstr :3002
```

**Method 3: Browser**
```
http://localhost:3002/health
```

---

### View Logs

**If running in terminal:**
Logs appear in console

**Save to file:**
```cmd
cd C:\at-restaurant-pos\printer-service
node server.js > logs.txt 2>&1
```

Then check `logs.txt`

---

## 🎯 Daily Operations

### Starting Service Manually

```cmd
cd C:\at-restaurant-pos\printer-service
node server.js
```

### Stopping Service

Press `Ctrl + C` in service window

### Restarting Service

```cmd
taskkill /IM node.exe /F
cd C:\at-restaurant-pos\printer-service
node server.js
```

---

## 🔄 Updating from GitHub

When you push new code to GitHub:

```cmd
:: Stop service first (Ctrl + C)

:: Pull latest code
cd C:\at-restaurant-pos
git pull origin main

:: Reinstall if needed (usually not required)
cd printer-service
npm install

:: Start service
node server.js
```

---

## ✅ Production Checklist

Daily:
- [ ] Printer powered on
- [ ] USB cable connected
- [ ] Service running (`localhost:3002/health`)
- [ ] Paper loaded
- [ ] Test print once

Weekly:
- [ ] Check for errors in logs
- [ ] Clean printer head
- [ ] Verify Windows printer status
- [ ] Pull latest code from GitHub

Monthly:
- [ ] Check for Node.js updates
- [ ] Update printer drivers
- [ ] Backup configuration
- [ ] Test restore procedure

---

## 🚨 Emergency Procedures

### If Printer Stops Working

1. **Check printer power** - Turn off/on
2. **Check USB cable** - Reconnect
3. **Check Windows** - Printer shows "Ready"?
4. **Restart service** - `Ctrl+C` then `node server.js`
5. **Restart PC** - Last resort

### If Service Crashes

Service has auto-recovery, but if needed:

```cmd
taskkill /IM node.exe /F
cd C:\at-restaurant-pos\printer-service
node server.js
```

### If Web App Can't Connect

1. Check service running: `http://localhost:3002`
2. Check firewall: Allow port 3002
3. Restart browser
4. Clear browser cache
5. **Fallback works automatically** - Browser print will be used

---

## 📱 Multiple PCs Setup

If you have multiple cashier PCs:

**PC 1:**
- Install printer service
- Connect USB printer
- Service URL: `localhost:3002`

**PC 2:**
- Install printer service
- Connect USB printer
- Service URL: `localhost:3002`

**PC 3:**
- Install printer service
- Connect USB printer
- Service URL: `localhost:3002`

Each PC is independent! Web app URL is same for all: `https://your-app.vercel.app`

---

## 🎓 Understanding the System

```
┌──────────────────────────────────────┐
│  VERCEL (Internet - Anywhere)        │
│  https://your-app.vercel.app         │
│  - Next.js Web Application           │
│  - Supabase Database                 │
│  - Order Management                  │
└────────────┬─────────────────────────┘
             │
             │ HTTPS (Internet)
             │
             ↓
┌──────────────────────────────────────┐
│  YOUR WINDOWS PC (Local Only)        │
│                                      │
│  1. Browser                          │
│     Opens: your-app.vercel.app       │
│     Connects to: localhost:3002      │
│                                      │
│  2. Printer Service (This code)      │
│     WebSocket: localhost:3002        │
│     Status: http://localhost:3002    │
│     Always running                   │
│                                      │
│  3. USB Thermal Printer              │
│     Connected directly               │
│     Managed by Windows               │
│                                      │
└──────────────────────────────────────┘
```

**Key Points:**
- Web app = Vercel (online, anywhere)
- Printer service = Your PC (local, private)
- Connection = Browser connects to both
- Fallback = If service down, browser print works

---

## 💡 Pro Tips

1. **Keep service running 24/7** using startup method
2. **Check logs daily** for any errors
3. **Test print every morning** to verify everything works
4. **Keep printer paper stocked** - obvious but important
5. **Clean printer head weekly** - better print quality
6. **Backup your setup** - document any changes
7. **Update regularly** - Pull from GitHub weekly

---

## 📞 Quick Commands Reference

```cmd
:: Start service
cd C:\at-restaurant-pos\printer-service
node server.js

:: Check if running
tasklist | findstr node

:: Check port
netstat -ano | findstr :3002

:: Test printers
node -e "const p = require('printer'); console.log(p.getPrinters());"

:: Kill service
taskkill /IM node.exe /F

:: View health
start http://localhost:3002/health

:: View status page
start http://localhost:3002
```

---

## ✅ Success Criteria

You're ready for production when:

- [x] Node.js installed
- [x] Visual Studio Build Tools installed
- [x] Python installed
- [x] Project downloaded
- [x] Printer module compiled
- [x] USB printer connected
- [x] Printer detected in Windows
- [x] Service starts without errors
- [x] Status page accessible
- [x] Test print successful
- [x] Auto-start configured
- [x] Vercel app can print

---

## 🎉 You're Done!

Your printer service is now production-ready!

**Next Steps:**
1. Deploy web app to Vercel (if not already done)
2. Open web app from any device
3. Create orders
4. Print receipts! ✅

**Remember:**
- Printer service runs on PC with printer
- Web app runs on Vercel (online)
- Both work together perfectly
- Browser print fallback always available

---

**Built with ❤️ for AT Restaurant POS**  
**Version 3.0.0 - Production Ready**

For issues, check troubleshooting section or GitHub issues.

---
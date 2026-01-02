# 🚀 Windows Production Setup Guide

## ✅ Step 1: First Time Setup (ONE TIME ONLY)

```bash
# 1. Install dependencies
pnpm install

# 2. Install PM2 globally (ONCE)
npm install -g pm2 pm2-windows-startup

# 3. Setup auto-start (ONCE)
pm2-startup install

# 4. Start printer service
pm2 start printer-service/server.js --name printer

# 5. Save configuration (IMPORTANT!)
pm2 save

# ✅ DONE! Ab Windows restart pe bhi auto-start hoga
```

---

## 🖨️ Alpha Printer - Auto Detection

### Kaise Kaam Karega:

1. **Windows boot hoga** → PM2 automatically printer service start karega
2. **Service API call karega** → PowerShell se "Alpha" driver detect hoga
3. **First printer as default** → "Alpha" automatically default ban jayega
4. **App se print command** → Seedha "Alpha" pe print hoga

### Manual Test (Optional):

```bash
# Check if Alpha detected
curl http://localhost:3001/api/printers/detect

# Response:
{
  "success": true,
  "printers": [
    {
      "id": "printer_0",
      "name": "Alpha",         ← Your printer
      "driver": "...",
      "connected": true,
      "isDefault": true        ← Auto default
    }
  ]
}
```

---

## 📴 Offline Mode - Automatic!

### Already Built-in:

Your app **automatically handles offline**:

1. **No internet** → Orders save to IndexedDB
2. **No printer service** → Orders save but don't print
3. **Internet back** → Auto-sync to Supabase
4. **Printer service back** → Next orders print normally

**Kuch karna nahi padega - automatic hai!**

---

## 🎯 Production Workflow

### Daily Operations:

```
1. Windows ON → PM2 starts printer service automatically
2. Open browser → https://your-app.vercel.app
3. Place orders → Auto-print to Alpha printer
4. Windows OFF → PM2 stops gracefully
```

**Koi manual command nahi!**

---

## 🔧 Management Commands (Agar Zaroorat Ho)

```bash
# Check status
pm2 status

# View logs
pm2 logs printer

# Restart service
pm2 restart printer

# Stop service
pm2 stop printer

# Start again
pm2 start printer

# Remove from startup (agar band karna ho)
pm2 delete printer
pm2 save
```

---

## ⚠️ Troubleshooting

### Problem: "Alpha printer not detected"

```bash
# Check in Windows
powershell -Command "Get-Printer"

# Should show "Alpha" in list
# If not, reinstall Alpha driver
```

### Problem: "PM2 service not starting"

```bash
# Re-run startup setup
pm2-startup install
pm2 resurrect
```

### Problem: "Port 3001 in use"

```bash
# Find and kill
netstat -ano | findstr :3001
taskkill /F /PID <PID>

# Restart service
pm2 restart printer
```

---

## 📊 Production Checklist

Before going live:

- [ ] Alpha printer installed in Windows
- [ ] `pnpm install` completed
- [ ] PM2 installed globally
- [ ] `pm2-startup install` executed
- [ ] Printer service started with PM2
- [ ] `pm2 save` executed
- [ ] Test print successful
- [ ] Windows reboot tested (service auto-starts)
- [ ] Vercel app deployed
- [ ] Environment variables added in Vercel
- [ ] Offline mode tested
- [ ] **HTTPS certificate trusted in browser**

---

## 🔐 NEW: How to Trust the HTTPS Certificate (One Time)

To allow your Vercel app (`https://...`) to talk to your local printer service (`https://localhost:3001`), you must tell your browser to trust the new, self-signed SSL certificate.

1.  **Start the Printer Service:**
    ```bash
    # Run this in your project folder
    pnpm printer
    ```

2.  **Open Your Browser:**
    - Open Chrome or Firefox.

3.  **Visit the Service URL:**
    - Go to this exact address: `https://localhost:3001/api/health`

4.  **Bypass the Warning:**
    - You will see a security warning like "Your connection is not private." This is expected.
    - Click **"Advanced"**.
    - Click **"Proceed to localhost (unsafe)"**.

5.  **Check for Success:**
    - The page should now show a JSON message like: `{"status":"online",...}`.
    - By doing this, you have permanently trusted the certificate for this browser.

**✅ That's it!** Your Vercel app can now securely connect to the printer service.

---

## 🎉 Final Result

**After setup:**

1. ✅ Windows boot hone pe printer service automatic start
2. ✅ Alpha printer automatic default ban jata
3. ✅ Orders print hote rehte without manual commands
4. ✅ Offline orders save hote rehte
5. ✅ Internet aane pe auto-sync

**Bas ek baar setup karo - phir kuch nahi karna!** 🚀
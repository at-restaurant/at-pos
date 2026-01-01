# 🚀 AT Restaurant POS - Complete Setup Guide

## 📋 Prerequisites

1. **Node.js 18+** - https://nodejs.org
2. **ngrok** - https://ngrok.com/download (FREE, no account)
3. **USB Thermal Printer** (for Windows only)
4. **Vercel Account** (FREE)
5. **Supabase Account** (FREE)

---

## 🎯 Quick Setup (15 Minutes)

### Step 1: Download & Install Tools

**A. Node.js**
```
Download: https://nodejs.org
Install: node-v18.x.x-x64.msi
```

**B. ngrok (100% FREE)**
```
1. Download: https://ngrok.com/download
2. Extract: ngrok.exe
3. Move to: C:\Windows\System32\
```

Verify:
```bash
node --version
ngrok version
```

---

### Step 2: Project Setup

**A. Clone/Download Project**
```bash
cd at-restaurant-pos
```

**B. Install Dependencies**
```bash
npm install
```

**C. Create `.env.local`**
```env
NEXT_PUBLIC_PRINTER_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

### Step 3: Start Printer Service

**Windows (USB Printer):**
```bash
# Double-click:
start-printer.bat

# You'll see:
# ✅ Printer service online
# 🌐 ngrok tunnel starting...
# 
# Forwarding: https://xxxx-xx-xx.ngrok-free.app -> http://localhost:3001
```

**Copy the HTTPS URL!**

---

### Step 4: Deploy to Vercel

**A. Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/at-restaurant-pos.git
git push -u origin main
```

**B. Deploy on Vercel**
1. Go to: https://vercel.com
2. Click: **New Project**
3. Import your GitHub repo
4. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_anon_key
   NEXT_PUBLIC_PRINTER_SERVICE_URL = https://xxxx.ngrok-free.app
   ```
5. Click **Deploy**

---

### Step 5: Test Printing

1. Open your Vercel app: `https://your-app.vercel.app`
2. Login to admin
3. Go to: **Orders** page
4. Create a test order
5. Click **Print** button
6. Receipt should print! ✅

---

## 🖨️ Platform-Specific Setup

### Windows (USB Thermal Printer)

**Setup:**
1. Connect printer via USB
2. Install printer drivers
3. Run: `start-printer.bat`
4. Copy ngrok URL to Vercel

**Daily Use:**
- Double-click `start-printer.bat` when starting work
- Keep window open while printing
- Copy new URL if ngrok restarts

---

### Mac/Linux (Browser Print)

**No setup needed!**
- Printing uses system dialog (⌘+P / Ctrl+P)
- Connect printer via USB or WiFi
- Add printer in System Settings

---

### Android (Mobile)

**No setup needed!**
- Open app in Chrome/Firefox
- Print button opens native dialog
- Select Bluetooth/WiFi printer

---

### iOS (iPhone/iPad)

**No setup needed!**
- Open app in Safari
- Print button opens iOS dialog
- Select AirPrint printer

---

## 🔧 Troubleshooting

### ngrok URL Changes
**Issue:** URL changes on restart  
**Solution:** Update Vercel env variable with new URL

**Steps:**
1. Restart `start-printer.bat`
2. Copy new ngrok URL
3. Vercel → Settings → Environment Variables
4. Update `NEXT_PUBLIC_PRINTER_SERVICE_URL`
5. Redeploy

---

### Printer Not Detected
```bash
# Check printers (PowerShell):
Get-Printer

# Test service:
curl http://localhost:3001/api/health
```

---

### ngrok Not Working
```bash
# Reinstall:
1. Download fresh ngrok.exe
2. Place in C:\Windows\System32\
3. Open new terminal
4. Test: ngrok version
```

---

### Browser Print Not Working
- Enable popups for your domain
- Check printer connection
- Try different browser

---

## 📁 Project Structure

```
at-restaurant-pos/
├── printer-service/
│   └── server.js              # Printer service (Windows)
├── src/
│   ├── lib/
│   │   └── print/
│   │       ├── thermalPrinter.ts      # Main printer class
│   │       ├── browserPrint.ts        # Browser printing
│   │       └── deviceDetection.ts     # Device detection
│   └── app/
│       ├── (public)/          # Menu, Orders
│       └── (admin)/           # Dashboard
├── start-printer.bat          # Windows startup
├── package.json
└── .env.local
```

---

## 🎯 Daily Workflow

### Morning Setup:
```
1. Start PC
2. Double-click: start-printer.bat
3. Check if URL changed (rare)
4. If changed: Update Vercel env
5. Start taking orders!
```

### During Day:
```
- Keep start-printer.bat window open
- If closed by accident, restart it
- Print works instantly
```

### Closing:
```
- Close start-printer.bat window
- Or just leave it running
```

---

## 💡 Tips & Best Practices

### ngrok URL Management
- URL changes only on restart
- Keep window open = URL stays same
- Restart needed only if:
    - PC restarts
    - Window closed by mistake
    - Network changes

### Faster Printing
- Use USB printer on Windows (fastest)
- Other devices use browser print (still fast)

### Offline Support
- Orders saved locally
- Auto-sync when online
- Works without internet (except printing from Vercel)

---

## 🆓 Cost Breakdown

| Service | Cost | Notes |
|---------|------|-------|
| Node.js | FREE | Open source |
| ngrok | FREE | No account needed |
| Vercel | FREE | Hobby plan |
| Supabase | FREE | 500MB database |
| **TOTAL** | **FREE** | No hidden costs! |

---

## 🚀 Advanced: Permanent ngrok URL (Optional)

**Free ngrok account = Static domain**

1. Create account: https://ngrok.com/signup
2. Get auth token
3. Run: `ngrok config add-authtoken YOUR_TOKEN`
4. Get static domain: `your-app.ngrok-free.app`
5. Never update Vercel again!

---

## 📞 Support

**Issues?**
- GitHub: Create issue
- Email: support@yourapp.com

**Common Questions:**
- ngrok safe? ✅ Yes, used by millions
- Free forever? ✅ Yes, completely free
- Works offline? ✅ Partially (orders yes, printing needs online)

---

## 🎉 You're Done!

Your restaurant POS is now:
- ✅ Deployed on Vercel
- ✅ Printing from Windows USB
- ✅ Working on all devices
- ✅ 100% FREE

**Start taking orders!** 🍽️
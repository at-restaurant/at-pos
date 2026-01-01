# 🍽️ AT Restaurant POS - Universal Printing System

Complete Restaurant POS with **multi-platform printing** support for Windows, Mac, Android, iOS, and Linux.

---

## 🎯 Features

✅ **Universal Printing** - Works on ALL devices  
✅ **Windows USB Printing** - Direct thermal printer support  
✅ **Mac/Linux Browser Print** - System print dialog  
✅ **Android/iOS Mobile Print** - Bluetooth & WiFi printers  
✅ **Offline Support** - IndexedDB with auto-sync  
✅ **Multi-Table Management** - Dine-in & Delivery  
✅ **Real-time Updates** - Supabase powered  
✅ **PWA Ready** - Install as app

---

## 📱 Supported Platforms

| Platform | Print Method | Setup Required |
|----------|-------------|----------------|
| **Windows** | USB Thermal Printer | ✅ Cloudflare Tunnel |
| **Mac** | Browser Print / USB | ⚠️ Optional service |
| **Android** | Browser / Bluetooth | ❌ None |
| **iOS** | AirPrint | ❌ None |
| **Linux** | Browser / CUPS | ❌ None |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Supabase account
- Thermal printer (optional)

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/at-restaurant-pos.git
cd at-restaurant-pos
npm install
```

### 2. Environment Setup
```bash
# Create .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# For Windows USB printing only:
NEXT_PUBLIC_PRINTER_SERVICE_URL=https://your-tunnel.trycloudflare.com
```

### 3. Run Development
```bash
npm run dev
# or with printer service:
npm run dev:all
```

---

## 🖨️ Printing Setup by Platform

### Windows (USB Thermal Printer)

**Step 1:** Install Cloudflare Tunnel
```bash
# Download from:
https://github.com/cloudflare/cloudflared/releases/latest

# Add to PATH or move to C:\Windows\System32\
```

**Step 2:** Start Printer Service
```bash
# Double-click:
start-windows.bat

# Or manually:
node printer-service/server.js
cloudflared tunnel --url http://localhost:3001
```

**Step 3:** Update Vercel
```bash
# Copy HTTPS URL from terminal
https://abc-xyz-123.trycloudflare.com

# Add to Vercel → Settings → Environment Variables:
NEXT_PUBLIC_PRINTER_SERVICE_URL=https://abc-xyz-123.trycloudflare.com

# Redeploy
```

---

### Mac (Browser Print)

**No setup required!**

- Printing uses macOS print dialog (⌘+P)
- Connect printer via USB or WiFi
- Add printer in System Settings
- Print directly from POS app

**Optional:** For USB thermal printer service (like Windows):
```bash
brew install cloudflare/cloudflare/cloudflared
node printer-service/server.js
cloudflared tunnel --url http://localhost:3001
```

---

### Android (Mobile Print)

**No setup required!**

**Option 1: Browser Print**
- Open POS in Chrome/Firefox
- Print button opens native dialog
- Select WiFi or Bluetooth printer

**Option 2: Bluetooth Thermal Printer**
1. Pair printer in Android Settings
2. Install printer manufacturer's app (if needed)
3. Print from browser dialog

**Option 3: WiFi Network Printer**
- Connect printer to same WiFi
- Printer auto-detected in print dialog

---

### iOS (AirPrint)

**No setup required!**

- Open POS in Safari
- Print button opens iOS print dialog
- Select AirPrint-compatible printer
- Works with most WiFi printers

---

### Linux (CUPS / Browser)

**No setup required!**

- Uses system print dialog
- Connect printer via USB or network
- Manage printers via CUPS: `http://localhost:631`

---

## 📂 Project Structure

```
at-restaurant-pos/
├── printer-service/
│   ├── server.js              # Windows USB printer service
│   └── README.md              # Printer setup guide
│
├── src/
│   ├── app/
│   │   ├── api/print/         # Print API proxy
│   │   ├── (public)/          # Public routes (menu, orders)
│   │   └── (admin)/           # Admin dashboard
│   │
│   ├── lib/
│   │   ├── print/
│   │   │   ├── thermalPrinter.ts      # Main printer class
│   │   │   ├── browserPrint.ts        # Browser print
│   │   │   ├── deviceDetection.ts     # Device detection
│   │   │   └── escposPrint.ts         # ESC/POS (future)
│   │   │
│   │   ├── db/                # IndexedDB for offline
│   │   └── hooks/             # React hooks
│   │
│   └── types/                 # TypeScript types
│
├── public/                    # Static assets
├── start-windows.bat          # Windows startup
├── start-mac.sh               # Mac guide
├── start-android.sh           # Android guide
└── package.json
```

---

## 🔧 Development

```bash
# Run locally
npm run dev

# Run with printer service (Windows)
npm run dev:all

# Build for production
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

---

## 🚢 Deployment

### Deploy to Vercel

1. **Push to GitHub**
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Deploy on Vercel**
- Import GitHub repository
- Add environment variables:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `NEXT_PUBLIC_PRINTER_SERVICE_URL` (Windows only)

3. **For Windows USB Printing**
- Keep `start-windows.bat` running on PC
- Update `NEXT_PUBLIC_PRINTER_SERVICE_URL` with new tunnel URL
- Redeploy if URL changes

---

## 🎨 Key Features

### Multi-Platform Printing
- Automatically detects device type
- Uses best print method for each platform
- Fallback to browser print if service unavailable

### Offline Support
- Orders saved locally (IndexedDB)
- Auto-sync when back online
- Works without internet

### Real-time Updates
- Supabase real-time subscriptions
- Live order updates
- Multi-user support

### PWA (Progressive Web App)
- Install on any device
- Works offline
- Native app experience

---

## 🐛 Troubleshooting

### Windows Printer Not Working
```bash
# Check if service is running:
curl http://localhost:3001/api/health

# Check printer connection:
Get-Printer  # PowerShell

# Restart service:
# Close start-windows.bat and reopen
```

### Cloudflare Tunnel URL Changes
- URL changes on every restart
- Update Vercel environment variable
- Or upgrade to Cloudflare Zero Trust (free, permanent URL)

### Browser Print Not Working
- Enable popups for your site
- Check printer is connected
- Try different browser (Chrome/Firefox/Safari)

### Mobile Print Issues
- Ensure printer on same WiFi
- Check Bluetooth pairing (Android)
- Use printer manufacturer's app

---

## 📊 Database Schema

Tables in Supabase:
- `admins` - Admin users
- `waiters` - Staff management
- `restaurant_tables` - Table management
- `menu_categories` - Menu categories
- `menu_items` - Menu items
- `orders` - Orders
- `order_items` - Order items
- `inventory_categories` - Inventory categories
- `inventory_items` - Inventory items

---

## 🔐 Security

- Row Level Security (RLS) enabled
- Admin authentication required
- API routes protected
- Environment variables secured

---

## 📝 License

MIT License - feel free to use for commercial projects!

---

## 🤝 Contributing

Pull requests welcome! For major changes, please open an issue first.

---

## 💬 Support

Issues? Questions?
- GitHub Issues: [Create Issue](https://github.com/yourusername/at-restaurant-pos/issues)
- Email: your-email@example.com

---

## 🎉 Credits

Built with:
- Next.js 16
- React 19
- Supabase
- Tailwind CSS
- TypeScript

---

**Made with ❤️ for restaurants worldwide**
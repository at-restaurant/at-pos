# AT Restaurant POS - Production Setup

## Windows (Priority 1)

### Quick Start
```bash
# 1. Install dependencies
pnpm install

# 2. Start both services
start-windows.bat

# 3. Test printer
# Go to: http://localhost:3000/admin/settings/printer
# Click "Detect Printers" → "Test Print"
```

### Production Setup (Auto-start on boot)
```bash
npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start printer-service/server.js --name printer
pm2 save
```

---

## Android (Priority 2)

### No Setup Required!
- Open app in Chrome/Firefox
- App automatically uses browser print
- Select printer from Android print dialog

---

## Mac (Priority 3)

### Browser Print
- Same as Android - automatic browser print
- Works with any CUPS printer

---

## Vercel Deployment

```bash
# Push to GitHub
git push origin main

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard:
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY
# - NEXT_PUBLIC_PRINTER_SERVICE_URL
```

---

## Testing

### Windows
```bash
# Check printer service
curl http://localhost:3001/api/health

# Expected: {"status":"online","platform":"win32"}
```

### Android/Mac
- Place order → Click print → Browser dialog opens

---

## Troubleshooting

### Windows: No printers detected
```bash
powershell -Command "Get-Printer"
net stop spooler && net start spooler
```

### Port 3001 in use
```bash
netstat -ano | findstr :3001
taskkill /F /PID <PID>
```

---

## Commands

```bash
pnpm printer:dev     # Start printer service
pnpm dev             # Start Next.js
pnpm dev:all         # Start both
pm2 status           # Check PM2 status
pm2 logs printer     # View logs
```
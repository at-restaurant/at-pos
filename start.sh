echo "========================================"
echo "  AT RESTAURANT POS - STARTUP"
echo "========================================"
echo ""

echo "[1/2] Starting Printer Service..."
pnpm printer:dev &
sleep 3

echo "[2/2] Starting Next.js App..."
pnpm dev &
sleep 5

echo ""
echo "========================================"
echo "  ✅ ALL SERVICES STARTED"
echo "========================================"
echo ""
echo "🖨️  Printer Service: http://localhost:3001"
echo "🌐 Next.js App: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

wait
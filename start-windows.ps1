Write-Host "========================================" -ForegroundColor Green
Write-Host "  AT RESTAURANT POS - STARTUP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "[1/3] Starting Printer Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm printer:dev"
Start-Sleep -Seconds 3

Write-Host "[2/3] Starting Next.js App..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; pnpm dev"
Start-Sleep -Seconds 5

Write-Host "[3/3] Opening Browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ ALL SERVICES STARTED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🖨️  Printer Service: http://localhost:3001" -ForegroundColor Cyan
Write-Host "🌐 Next.js App: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Keep all windows open!" -ForegroundColor Red
Write-Host ""
Read-Host "Press Enter to exit this window"


# ---------------------------------------------
# stop-all.bat (Stop Services)
# ---------------------------------------------
# Save this as: stop-all.bat

@echo off
title Stopping Services
color 0C

echo Stopping all services...
echo.

taskkill /FI "WINDOWTITLE eq Printer Service*" /F 2>nul
taskkill /FI "WINDOWTITLE eq Next.js App*" /F 2>nul

echo.
echo ✅ All services stopped
echo.
pause
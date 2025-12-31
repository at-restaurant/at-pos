@echo off
title AT Restaurant POS - Windows Startup
color 0A

echo ========================================
echo   AT RESTAURANT POS
echo ========================================
echo.

echo Starting Printer Service...
start "Printer Service" cmd /k "cd /d %~dp0 && pnpm printer:dev"
timeout /t 3 /nobreak >nul

echo Starting Next.js App...
start "Next.js App" cmd /k "cd /d %~dp0 && pnpm dev"
timeout /t 5 /nobreak >nul

echo Opening Browser...
timeout /t 3 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================
echo   ALL SERVICES STARTED
echo ========================================
echo.
echo Printer: http://localhost:3001
echo App: http://localhost:3000
echo.
pause
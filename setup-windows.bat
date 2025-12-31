@echo off
title AT Restaurant POS - Auto Setup
color 0B

echo ========================================
echo   AT RESTAURANT POS - AUTO SETUP
echo ========================================
echo.

:: Check if Node.js installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Please install Node.js first:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [1/6] Node.js found:
node --version
echo.

:: Install pnpm
echo [2/6] Installing pnpm...
call npm install -g pnpm
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install pnpm
    pause
    exit /b 1
)
echo.

:: Install dependencies
echo [3/6] Installing project dependencies...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo.

:: Install PM2
echo [4/6] Installing PM2...
call npm install -g pm2 pm2-windows-startup
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install PM2
    pause
    exit /b 1
)
echo.

:: Setup PM2 auto-start
echo [5/6] Setting up auto-start...
call pm2-startup install
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Auto-start setup may need admin rights
    echo Right-click this file and select "Run as administrator"
)
echo.

:: Start printer service
echo [6/6] Starting printer service...
call pm2 start printer-service/server.js --name printer
call pm2 save
echo.

:: Verify
echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo Checking printer service status...
timeout /t 2 /nobreak >nul
call pm2 status
echo.

echo ========================================
echo   NEXT STEPS:
echo ========================================
echo.
echo 1. Connect your Alpha printer via USB
echo 2. Open browser: http://localhost:3001/api/health
echo    (Should show: "status":"online")
echo.
echo 3. Open app: https://your-app.vercel.app
echo 4. Go to Admin - Settings - Printer
echo 5. Click "Detect Printers" (Alpha should appear)
echo 6. Click "Test Print"
echo.
echo ========================================
echo   PRINTER SERVICE IS NOW RUNNING!
echo ========================================
echo.
echo This will auto-start when Windows boots.
echo.
pause
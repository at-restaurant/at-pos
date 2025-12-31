@echo off
title AT Restaurant POS - Auto Setup
color 0B

echo ========================================
echo   AT RESTAURANT POS - AUTO SETUP
echo ========================================
echo.

:: Get current directory
set "CURRENT_DIR=%CD%"
echo Current folder: %CURRENT_DIR%
echo.

:: Check if package.json exists
if not exist "package.json" (
    echo [ERROR] package.json not found!
    echo.
    echo You are in wrong folder!
    echo Current: %CURRENT_DIR%
    echo.
    echo Please:
    echo 1. Extract at-pos-main.zip
    echo 2. Open folder: at-pos-main
    echo 3. Right-click setup-windows.bat
    echo 4. Run as administrator
    echo.
    pause
    exit /b 1
)

echo [CHECK] package.json found - Correct folder!
echo.

:: Check if Node.js installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Download and install Node.js:
    echo https://nodejs.org
    echo.
    echo After install, run this script again.
    echo.
    pause
    exit /b 1
)

echo [1/6] Node.js installed:
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
echo [OK] pnpm installed
echo.

:: Install dependencies
echo [3/6] Installing dependencies (may take 2-3 minutes)...
call pnpm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

:: Check if printer-service exists
if not exist "printer-service\server.js" (
    echo [ERROR] printer-service\server.js not found!
    echo Please check if all files extracted correctly.
    pause
    exit /b 1
)

:: Install PM2
echo [4/6] Installing PM2...
call npm install -g pm2 pm2-windows-startup
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install PM2
    pause
    exit /b 1
)
echo [OK] PM2 installed
echo.

:: Setup PM2 auto-start (needs admin)
echo [5/6] Setting up auto-start...
call pm2-startup install
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Auto-start needs admin rights
    echo Close this window and:
    echo Right-click setup-windows.bat -^> Run as administrator
    echo.
    pause
    exit /b 1
)
echo [OK] Auto-start configured
echo.

:: Start printer service
echo [6/6] Starting printer service...
call pm2 delete printer 2>nul
call pm2 start printer-service\server.js --name printer
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start printer service
    pause
    exit /b 1
)
call pm2 save
echo [OK] Printer service started
echo.

timeout /t 3 /nobreak >nul

:: Verify service
echo ========================================
echo   CHECKING STATUS...
echo ========================================
echo.
call pm2 status
echo.

:: Test health endpoint
echo Testing printer service...
timeout /t 2 /nobreak >nul
curl http://localhost:3001/api/health 2>nul
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Printer service is online!
) else (
    echo.
    echo [INFO] Health check command not available
    echo Open browser: http://localhost:3001/api/health
)
echo.

echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo.
echo 1. Connect Alpha printer via USB
echo 2. Open browser: http://localhost:3001/api/health
echo    Should show: {"status":"online"}
echo.
echo 3. Open your app: https://your-app.vercel.app
echo 4. Go to: Admin -^> Settings -^> Printer
echo 5. Click "Detect Printers"
echo 6. Alpha should appear - Click "Test Print"
echo.
echo ========================================
echo   AUTO-START ENABLED
echo ========================================
echo.
echo Printer service will start automatically
echo when Windows boots.
echo.
echo Management commands:
echo   pm2 status          - Check service
echo   pm2 logs printer    - View logs
echo   pm2 restart printer - Restart service
echo   pm2 stop printer    - Stop service
echo.
pause
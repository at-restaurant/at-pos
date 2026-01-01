@echo off
title AT Restaurant POS - Windows Printer Service
color 0A

echo ========================================
echo   AT RESTAURANT - WINDOWS PRINTER
echo ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo Download: https://nodejs.org
    pause
    exit /b 1
)

:: Check Cloudflared
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [WARNING] Cloudflare Tunnel not found!
    echo.
    echo For production, install Cloudflare Tunnel:
    echo https://github.com/cloudflare/cloudflared/releases/latest
    echo.
    echo Running without tunnel (local only)...
    echo.
    timeout /t 3 /nobreak >nul

    :: Start without tunnel
    node printer-service/server.js
    pause
    exit /b 0
)

echo [OK] Prerequisites found
echo.

:: Start printer service
echo [1/2] Starting Printer Service...
start /MIN "Printer Service" cmd /c "node printer-service/server.js"
timeout /t 3 /nobreak >nul

:: Verify service
curl http://localhost:3001/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Printer service online at http://localhost:3001
) else (
    echo [ERROR] Printer service failed
    pause
    exit /b 1
)
echo.

:: Start Cloudflare Tunnel
echo [2/2] Starting Cloudflare Tunnel...
echo.
echo ========================================
echo   COPY THIS URL TO VERCEL
echo ========================================
echo.
echo Variable: NEXT_PUBLIC_PRINTER_SERVICE_URL
echo Value: [Copy the https:// URL below]
echo.
echo Vercel Dashboard:
echo Settings -^> Environment Variables -^> Edit
echo.
echo ========================================
echo.

cloudflared tunnel --url http://localhost:3001

echo.
echo [INFO] Tunnel closed. Restart to get new URL.
pause
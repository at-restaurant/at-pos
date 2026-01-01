@echo off
title AT Restaurant Printer
color 0A

echo ========================================
echo   AT RESTAURANT - PRINTER SERVICE
echo ========================================
echo.

:: Check cloudflared
where cloudflared >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cloudflare not found!
    echo.
    echo Download 32-bit:
    echo https://github.com/cloudflare/cloudflared/releases/download/2024.12.2/cloudflared-windows-386.exe
    echo.
    echo Rename to: cloudflared.exe
    echo Copy to: C:\Windows\System32\
    echo.
    pause
    exit
)

:: Start printer service
echo [1/2] Starting Printer...
start /MIN cmd /c "node printer-service\server.js"
timeout /t 3 >nul
echo OK - Printer Online
echo.

:: Start tunnel
echo [2/2] Starting Tunnel...
echo.
echo ========================================
echo   COPY THIS URL TO VERCEL
echo ========================================
echo.

cloudflared tunnel --url http://localhost:3001

echo.
pause
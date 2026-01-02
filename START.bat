@echo off
title Cloudflare Tunnel - Printer Service
color 0A

echo ========================================
echo   STARTING PRINTER SERVICE + TUNNEL
echo ========================================
echo.

REM Start printer service in background
echo [1/2] Starting printer service...
cd /d "%~dp0printer-service"
start "Printer Service" /MIN node server.js
timeout /t 3 /nobreak >nul
echo Done!
echo.

REM Start cloudflare tunnel
echo [2/2] Starting Cloudflare tunnel...
cd %USERPROFILE%\Downloads

if exist "cloudflared-windows-386.exe" (
    echo Found cloudflared!
    echo.
    echo ========================================
    echo  TUNNEL URL (copy this):
    echo ========================================
    cloudflared-windows-386.exe tunnel --url http://localhost:3001
) else if exist "cloudflared.exe" (
    cloudflared.exe tunnel --url http://localhost:3001
) else (
    echo ERROR: cloudflared not found!
    pause
    exit
)

pause
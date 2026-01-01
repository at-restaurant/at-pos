@echo off
title AT Restaurant - Printer Service
color 0A

echo ========================================
echo   AT RESTAURANT - PRINTER SERVICE
echo ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Download and install Node.js:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js installed:
node --version
echo.

:: Check ngrok
where ngrok >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ngrok not found!
    echo.
    echo Download ngrok (100%% FREE):
    echo.
    echo Step 1: Visit https://ngrok.com/download
    echo Step 2: Download Windows 64-bit ZIP
    echo Step 3: Extract ngrok.exe
    echo Step 4: Move ngrok.exe to C:\Windows\System32\
    echo.
    echo After installation, run this script again.
    echo.
    pause
    exit /b 1
)
echo [OK] ngrok installed:
ngrok version
echo.

:: Check if in correct directory
if not exist "printer-service\server.js" (
    echo [ERROR] printer-service\server.js not found!
    echo.
    echo Make sure you are in the project root folder!
    echo Current folder: %CD%
    echo.
    pause
    exit /b 1
)
echo [OK] Project files found
echo.

:: Start printer service in background
echo [1/2] Starting Printer Service...
start /MIN "Printer Service" cmd /c "node printer-service\server.js"
timeout /t 3 /nobreak >nul

:: Verify service is running
curl http://localhost:3001/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Printer service is ONLINE
    echo      Local: http://localhost:3001
) else (
    echo [ERROR] Printer service FAILED to start
    echo.
    echo Possible issues:
    echo - Port 3001 already in use
    echo - Node.js not working
    echo - Wrong directory
    echo.
    pause
    exit /b 1
)
echo.

:: Start ngrok tunnel
echo [2/2] Starting ngrok tunnel...
echo.
echo ========================================
echo   COPY THIS URL TO VERCEL
echo ========================================
echo.
echo After ngrok starts, you will see:
echo.
echo   Forwarding: https://xxxx-xx-xx.ngrok-free.app -^> http://localhost:3001
echo                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
echo                COPY THIS HTTPS URL
echo.
echo Steps to add URL to Vercel:
echo.
echo 1. Go to: https://vercel.com/dashboard
echo 2. Select your project
echo 3. Settings -^> Environment Variables
echo 4. Find: NEXT_PUBLIC_PRINTER_SERVICE_URL
echo 5. Edit and paste the HTTPS URL
echo 6. Save and Redeploy
echo.
echo ========================================
echo   STARTING NGROK...
echo ========================================
echo.

ngrok http 3001

echo.
echo ========================================
echo   TUNNEL CLOSED
echo ========================================
echo.
echo Tunnel has been closed.
echo Restart this script to get a new URL.
echo.
pause
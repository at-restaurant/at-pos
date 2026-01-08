@echo off
title AT Restaurant - Printer Service
color 0A

echo ========================================
echo   AT RESTAURANT - PRINTER SERVICE
echo ========================================
echo.

:: Check if Node.js installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not installed!
    echo.
    echo Please install Node.js from:
    echo https://nodejs.org/en/download/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

:: Check if in correct directory
if not exist "printer-service\server-raw.js" (
    echo [ERROR] Cannot find printer-service\server-raw.js
    echo.
    echo Make sure you're in the project root folder!
    echo Current: %CD%
    echo.
    pause
    exit /b 1
)

echo [OK] Project files found
echo.

:: Check if dependencies installed
if not exist "node_modules" (
    echo [WARN] Dependencies not installed!
    echo.
    echo Installing now...
    call npm install
    echo.
)

:: Start the service
echo ========================================
echo   STARTING PRINTER SERVICE
echo ========================================
echo.
echo Local URL: http://localhost:3001
echo.
echo Keep this window OPEN while using POS!
echo.
echo ========================================
echo.

node printer-service\server-raw.js

:: If service crashes
echo.
echo ========================================
echo   SERVICE STOPPED
echo ========================================
echo.
pause
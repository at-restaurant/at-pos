@echo off
title Printer Service Diagnostics
color 0E

echo ========================================
echo   PRINTER SERVICE DIAGNOSTICS
echo ========================================
echo.

:: Check if printer service is running
echo [1/5] Checking printer service...
curl -s http://localhost:3001/api/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Printer service is ONLINE
    curl -s http://localhost:3001/api/health
) else (
    echo [ERROR] Printer service is OFFLINE
    echo.
    echo Troubleshooting steps:
    echo 1. Run: pnpm printer:dev
    echo 2. Check port 3001 is not in use
    echo 3. Check Windows Firewall settings
    goto :error
)
echo.

:: Check Node.js
echo [2/5] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js installed
    node --version
) else (
    echo [ERROR] Node.js not found
    goto :error
)
echo.

:: Check npm/pnpm
echo [3/5] Checking package manager...
where pnpm >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] pnpm installed
    pnpm --version
) else (
    echo [WARNING] pnpm not found, checking npm...
    where npm >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] npm installed
        npm --version
    ) else (
        echo [ERROR] No package manager found
        goto :error
    )
)
echo.

:: Detect printers
echo [4/5] Detecting Windows printers...
powershell -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus | Format-Table"
echo.

:: Check port 3001
echo [5/5] Checking port 3001...
netstat -ano | findstr :3001
if %ERRORLEVEL% EQU 0 (
    echo [OK] Port 3001 is in use (service is running)
) else (
    echo [WARNING] Port 3001 is not in use
    echo Run: pnpm printer:dev
)
echo.

echo ========================================
echo   DIAGNOSTICS COMPLETE
echo ========================================
echo.
echo Next steps:
echo 1. If service offline: pnpm printer:dev
echo 2. If printers not detected: Install drivers
echo 3. If port in use by another app: Change port
echo.
pause
exit /b 0

:error
echo.
echo ========================================
echo   DIAGNOSTICS FAILED
echo ========================================
echo.
echo Please fix the errors above and try again.
echo.
pause
exit /b 1
@echo off
title Cloudflare Tunnel
color 0A

echo ========================================
echo   CLOUDFLARE TUNNEL STARTING...
echo ========================================
echo.

cd %USERPROFILE%\Downloads

echo Searching for cloudflared...
echo.

if exist "cloudflared-windows-386.exe" (
    echo Found: cloudflared-windows-386.exe
    cloudflared-windows-386.exe tunnel --url http://localhost:3001
) else if exist "cloudflared.exe" (
    echo Found: cloudflared.exe
    cloudflared.exe tunnel --url http://localhost:3001
) else if exist "cloudflared-windows-386\cloudflared.exe" (
    echo Found in folder
    cd cloudflared-windows-386
    cloudflared.exe tunnel --url http://localhost:3001
) else (
    echo ERROR: cloudflared not found!
    echo.
    echo Please extract cloudflared-windows-386.exe first
    pause
    exit
)

pause
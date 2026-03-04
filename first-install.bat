@echo off
setlocal
cd /d "%~dp0"

echo ================================
echo CTF Pilot Installer
echo ================================

where node >nul 2>nul
if errorlevel 1 (
    echo error no Node.js 20+，please install it first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo error no npm，please ensure Node.js is fully installed.
    pause
    exit /b 1
)

if exist "node_modules" (
    echo.
    echo [1/2] Detected node_modules, skipping dependency installation.
) else (
    echo.
    echo [1/2] node_modules not detected, installing dependencies (npm install)...
    call npm install
    if errorlevel 1 (
        echo.
        echo [error] Dependency installation failed, please check your network or npm source and try again.
        pause
        exit /b 1
    )
)

echo.
echo [2/2] Starting development server...
call start-server.bat

endlocal

@echo off
setlocal
cd /d "%~dp0"

echo ======================================
echo CTF Pilot One-Click Pack Script
echo ======================================
echo Project: %~dp0

echo.
echo [0/4] Checking runtime tools...
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js 20+ first.
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found. Please repair Node.js installation.
    pause
    exit /b 1
)

echo [OK] Node/npm detected.

if exist "node_modules" (
    echo.
    echo [1/4] node_modules found, skip dependency install.
) else (
    echo.
    echo [1/4] node_modules not found, running npm install...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed.
)

echo.
echo [2/4] Running pack pipeline: npm run pack:exe
call npm run pack:exe
if errorlevel 1 (
    echo.
    echo [ERROR] Packaging failed. Please check logs above.
    pause
    exit /b 1
)

echo.
echo [3/4] Verifying release artifacts...
if not exist "release\CTF Pilot.exe" (
    echo [ERROR] Missing artifact: release\CTF Pilot.exe
    pause
    exit /b 1
)

if not exist "release\dist" (
    echo [ERROR] Missing artifact directory: release\dist
    pause
    exit /b 1
)

echo [OK] Artifacts are ready.

echo.
echo [4/4] Done.
echo Output:
echo   - release\CTF Pilot.exe
echo   - release\dist\
echo.
echo You can now run: release\CTF Pilot.exe
pause

endlocal

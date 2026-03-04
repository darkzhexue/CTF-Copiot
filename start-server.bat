@echo off
setlocal
cd /d "%~dp0"

echo starting CTF Pilot development server...
start "CTF Pilot Dev" powershell -NoLogo -NoExit -Command "Set-Location '%~dp0'; npm run dev"

timeout /t 2 >nul
start "" "http://localhost:3000"

echo Server started, browser opened at http://localhost:3000
echo To stop the server, double-click stop-server.bat
endlocal

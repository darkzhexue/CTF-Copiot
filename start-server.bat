@echo off
setlocal
cd /d "%~dp0"

echo 启动开发服务...
start "CTF Pilot Dev" powershell -NoLogo -NoExit -Command "Set-Location '%~dp0'; npm run dev"

timeout /t 2 >nul
start "" "http://localhost:3000"

echo 已启动，浏览器已打开 http://localhost:3000
echo 如需停止服务，请双击 stop-server.bat
endlocal

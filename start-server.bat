@echo off
setlocal
cd /d "%~dp0"

echo =====================================
echo         CTF Assistant Launcher
echo =====================================
echo.

where wt >nul 2>nul
if %errorlevel%==0 (
	echo 使用 Windows Terminal 启动开发服务...
	start "" wt -w 0 new-tab --title "CTF Assistant Dev" powershell -NoLogo -NoExit -Command "Set-Location '%~dp0'; npm run dev"
) else (
	echo 未检测到 Windows Terminal，使用 PowerShell 启动...
	start "CTF Assistant Dev" powershell -NoLogo -NoExit -Command "Set-Location '%~dp0'; npm run dev"
)

timeout /t 2 >nul
start "" "http://localhost:3000"

echo 已启动。浏览器将打开 http://localhost:3000
echo 如需停止服务，请双击 stop-server.bat
endlocal

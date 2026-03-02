@echo off
cd /d %~dp0
echo 启动 server.ts，打开新窗口运行...
start "CTFServer" cmd /k "npx tsx server.ts"
echo Done.

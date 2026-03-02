@echo off
cd /d %~dp0
echo stopping CTFServer...
:: 尝试通过窗口标题关闭
taskkill /FI "WindowTitle eq CTFServer" /T /F 2>nul
:: 也可以根据可执行文件结束
taskkill /IM tsx.exe /T /F 2>nul
taskkill /IM node.exe /T /F 2>nul
echo 完成。

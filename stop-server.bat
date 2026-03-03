@echo off
setlocal
cd /d "%~dp0"

echo 正在停止 CTF Assistant（端口 3000）...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
	"$pids = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique;" ^
	"if (-not $pids) { Write-Host '未发现运行中的服务。'; exit 0 };" ^
	"foreach ($pid in $pids) { try { Stop-Process -Id $pid -Force -ErrorAction Stop; Write-Host ('已停止 PID ' + $pid) } catch { Write-Host ('停止失败 PID ' + $pid + ': ' + $_.Exception.Message) } }"

echo 完成。
endlocal

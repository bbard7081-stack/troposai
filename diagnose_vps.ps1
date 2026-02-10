$ErrorActionPreference = "Stop"

Write-Host "VPS Diagnostic Script" -ForegroundColor Cyan
Write-Host "====================="

$ServerIP = Read-Host "Enter your VPS IP Address (default: 74.208.170.62)"
if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $ServerIP = "74.208.170.62"
}

Write-Host "`nChecking VPS status..." -ForegroundColor Yellow

try {
    Write-Host "`n--- Docker Container Status ---" -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker ps -a"
    
    Write-Host "`n--- Recent Container Logs (Production) ---" -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker logs --tail 50 tropos_crm 2>&1 || echo 'Container not found'"
    
    Write-Host "`n--- Nginx Status ---" -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "systemctl status nginx --no-pager | head -20"
    
    Write-Host "`n--- Port 3000 Check ---" -ForegroundColor Cyan
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "netstat -tlnp | grep 3000 || echo 'Port 3000 not listening'"
}
catch {
    Write-Error "Failed to run diagnostics: $_"
}

Read-Host "`nPress Enter to exit"

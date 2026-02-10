$ErrorActionPreference = "Stop"

Write-Host "Staging Container Diagnostics" -ForegroundColor Cyan
Write-Host "=============================="

$ServerIP = "74.208.170.62"

try {
    Write-Host "`n[Checking Staging Container Status]" -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker ps -a | grep staging"
    
    Write-Host "`n[Staging Container Logs - Last 100 lines]" -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker logs --tail 100 tropos_staging 2>&1"
    
    Write-Host "`n[Checking if Port 3001 is listening]" -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "ss -tlnp | grep 3001 || echo 'Port 3001 not listening'"
}
catch {
    Write-Error "Diagnostics failed: $_"
}

Read-Host "`nPress Enter to exit"

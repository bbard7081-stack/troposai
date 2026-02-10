$ErrorActionPreference = "Stop"

Write-Host "Tropos Container Diagnostics" -ForegroundColor Cyan
Write-Host "============================="

$ServerIP = "74.208.170.62"

try {
    Write-Host "`n[1] Checking all containers..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker ps -a"
    
    Write-Host "`n[2] Tropos Production Container Logs..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker logs --tail 200 tropos_crm 2>&1 || echo 'Container not found'"
    
    Write-Host "`n[3] Tropos Staging Container Logs..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker logs --tail 200 tropos_staging 2>&1 || echo 'Container not found'"
    
    Write-Host "`n[4] Checking Docker Compose file..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "cd /root/tropos && cat docker-compose.yml 2>&1 || echo 'File not found'"
    
    Write-Host "`n[5] Checking if old careq directory exists..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "ls -la /root/ | grep -E 'careq|tropos'"
}
catch {
    Write-Error "Diagnostics failed: $_"
}

Read-Host "`nPress Enter to exit"

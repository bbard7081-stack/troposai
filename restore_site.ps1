$ErrorActionPreference = "Stop"

Write-Host "Site Recovery - Restart Old Container" -ForegroundColor Cyan
Write-Host "======================================"

$ServerIP = "74.208.170.62"

Write-Host "`nRestarting the old careq_crm container..." -ForegroundColor Yellow

try {
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker start careq_crm && docker ps | grep careq"
    
    Write-Host "`n✅ Site should be back online!" -ForegroundColor Green
    Write-Host "Check: https://troposai.com" -ForegroundColor Cyan
    Write-Host "`nNext step: Run ./deploy_v2.ps1 to deploy the new Tropos version" -ForegroundColor Gray
}
catch {
    Write-Error "Failed: $_"
}

Read-Host "`nPress Enter to exit"

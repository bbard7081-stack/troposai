$ErrorActionPreference = "Stop"

Write-Host "Emergency VPS Recovery Script" -ForegroundColor Cyan
Write-Host "=============================="

$ServerIP = "74.208.170.62"

Write-Host "`nThis will restart the old careq_crm container to get your site back online." -ForegroundColor Yellow
Write-Host "Then you can deploy the new Tropos version properly." -ForegroundColor Gray

try {
    Write-Host "`n[Step 1] Starting old container..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker start careq_crm"
    
    Start-Sleep -Seconds 3
    
    Write-Host "`n[Step 2] Checking if it's running..." -ForegroundColor Yellow
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "docker ps | grep careq"
    
    Write-Host "`n✅ Container restarted!" -ForegroundColor Green
    Write-Host "Check your site: https://troposai.com" -ForegroundColor Cyan
    Write-Host "`nOnce confirmed working, you can deploy the new version with ./deploy_v2.ps1" -ForegroundColor Gray
}
catch {
    Write-Error "Recovery failed: $_"
}

Read-Host "`nPress Enter to exit"

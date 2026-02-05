$ErrorActionPreference = "Stop"

Write-Host "Quick VPS Restart Script" -ForegroundColor Cyan
Write-Host "========================="

$ServerIP = Read-Host "Enter your VPS IP Address (default: 74.208.170.62)"
if ([string]::IsNullOrWhiteSpace($ServerIP)) {
    $ServerIP = "74.208.170.62"
}

Write-Host "`nAttempting to restart containers on $ServerIP..." -ForegroundColor Yellow
Write-Host "(You will be prompted for password: Uim72aNn)" -ForegroundColor Gray

try {
    # Simple restart command
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "cd /root/tropos && docker-compose restart"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Containers restarted successfully!" -ForegroundColor Green
        Write-Host "Check your site at: https://troposai.com" -ForegroundColor Cyan
    }
    else {
        Write-Host "`n⚠️ Restart command completed with warnings" -ForegroundColor Yellow
    }
}
catch {
    Write-Error "Failed to connect or restart: $_"
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Verify you can ping $ServerIP" -ForegroundColor Gray
    Write-Host "2. Check if password 'Uim72aNn' is still correct" -ForegroundColor Gray
    Write-Host "3. Try manual SSH: ssh root@$ServerIP" -ForegroundColor Gray
}

Read-Host "`nPress Enter to exit"

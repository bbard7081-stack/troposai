# careQ CRM - Manual Deployment Steps
# Use this if the automated script fails

Write-Host "careQ CRM - Manual Deployment Guide" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

$ServerIP = "74.208.170.62"
$Package = "careq_deploy.tar.gz"

Write-Host "STEP 1: Upload files to server" -ForegroundColor Yellow
Write-Host "Run this command and enter your password when prompted:" -ForegroundColor White
Write-Host ""
Write-Host "scp $Package remote_setup.sh root@${ServerIP}:~/" -ForegroundColor Green
Write-Host ""
Write-Host "Press Enter after you've successfully uploaded the files..."
Read-Host

Write-Host ""
Write-Host "STEP 2: Connect to server and run setup" -ForegroundColor Yellow
Write-Host "Run this command and enter your password when prompted:" -ForegroundColor White
Write-Host ""
Write-Host "ssh root@${ServerIP}" -ForegroundColor Green
Write-Host ""
Write-Host "Once connected, run:" -ForegroundColor White
Write-Host "bash ~/remote_setup.sh" -ForegroundColor Green
Write-Host ""
Write-Host "STEP 3: After setup completes, type 'exit' to disconnect" -ForegroundColor Yellow
Write-Host ""
Write-Host "Your CRM will be live at: http://${ServerIP}:3000" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close this guide..."

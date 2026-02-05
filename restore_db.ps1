$ErrorActionPreference = "Stop"

Write-Host "Tropos CRM - Database Restore Tool" -ForegroundColor Cyan
Write-Host "===================================="

# 1. Get Server Details
$ServerIP = Read-Host "Enter your VPS IP Address (e.g., 74.208.170.62)"

# 2. Check for local DB
if (-not (Test-Path "crm_data.db")) {
    Write-Error "Local crm_data.db not found. Please place your real database file in this folder."
    exit
}

Write-Host "[Restoring] Sending your real database to the cloud..." -ForegroundColor Yellow

# 3. Upload and Swap
try {
    # Stop the container first so we can swap files safely
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "cd ~/careq && docker-compose down"
    
    # Upload the file directly to the persistent volume path
    scp -o StrictHostKeyChecking=no crm_data.db "root@${ServerIP}:~/careq/data/crm_data.db"
    
    # Start container back up
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "cd ~/careq && docker-compose up -d"
    
    Write-Host "SUCCESS! Your real database has been restored." -ForegroundColor Green
    Write-Host "Refresh troposai.com to see your Grid data." -ForegroundColor Green
}
catch {
    Write-Error "Restore failed. Check your IP/Password."
}

Read-Host "Press Enter to exit..."

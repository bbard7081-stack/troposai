$ErrorActionPreference = "Stop"

Write-Host "Tropos CRM - Automated Cloud Deployer" -ForegroundColor Cyan
Write-Host "===================================="

# 0. Run Automated Tests
Write-Host "[Testing] Running pre-deployment suite..." -ForegroundColor Yellow
node test_deployment.cjs
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Tests failed. Deployment aborted to prevent pushing bugs."
    exit 
}
Write-Host "✅ Tests Passed. Proceeding to Packaging." -ForegroundColor Green

# 1. Create Deployment Package
Write-Host "[Building] frontend assets..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed. Deployment aborted."; exit }

Write-Host "[Packaging] project files..." -ForegroundColor Yellow
tar -czf careq_deploy.tar.gz dist App.tsx server.js database.js package.json package-lock.json components public services types.ts constants.ts Dockerfile docker-compose.yml index.html index.tsx index.css vite.config.ts tsconfig.json .env.local crm_data.db remote_setup.sh sync_users.js restore_db.ps1
if ($LASTEXITCODE -ne 0) { Write-Error "Packaging failed."; exit }

# 2. Get Server Details
$ServerIP = Read-Host "Enter your VPS IP Address (e.g., 74.208.170.62)"

# 3. Upload Project and Helper Script
Write-Host "`n[Uploading] project files to $ServerIP... (You may be asked for your password)" -ForegroundColor Yellow
try {
    # Use -o StrictHostKeyChecking=no to avoid the 'yes/no' prompt
    scp -o StrictHostKeyChecking=no careq_deploy.tar.gz remote_setup.sh "root@${ServerIP}:~/"
    if ($LASTEXITCODE -ne 0) { throw "Upload failed." }
}
catch {
    Write-Error "Setup failed during upload. Check your IP/Password."
}

# 4. Execute Staging Deployment (Automatic)
Write-Host "`n[Deploying] to STAGING (troposai.com/testing)..." -ForegroundColor Yellow
try {
    # Update only the staging container
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "bash ~/remote_setup.sh --staging-only"
    Write-Host "✅ STAGING UPDATE COMPLETE." -ForegroundColor Green
    Write-Host "Please visit: http://${ServerIP}:3000/testing" -ForegroundColor Cyan
    Write-Host "Verify everything is working correctly before proceeding." -ForegroundColor Cyan
}
catch {
    Write-Error "Staging deployment failed: $_"
    exit
}

# 5. Manual Approval Gate
Write-Host "`n------------------------------------------------"
Write-Host "✅ STAGING DEPLOYED!" -ForegroundColor Green
Write-Host "View staging at: https://troposai.com/testing" -ForegroundColor Cyan
Write-Host "------------------------------------------------"
$ConfirmProduction = Read-Host "Are you satisfied with the build? Push to PRODUCTION now? (y/n)"
Write-Host "------------------------------------------------"

if ($ConfirmProduction -eq "y") {
    Write-Host "[Deploying] to PRODUCTION (troposai.com)..." -ForegroundColor Yellow
    try {
        ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "bash ~/remote_setup.sh --production-only"
        Write-Host "SUCCESS! Your CRM is live at: http://${ServerIP}:3000" -ForegroundColor Green
    }
    catch {
        Write-Error "Production deployment failed: $_"
    }
}
else {
    Write-Host "Deployment aborted. Production remains on the previous version." -ForegroundColor Yellow
}

Write-Host "`n[Health Check] Verifying deployment..." -ForegroundColor Yellow
$MaxRetries = 10
$RetryCount = 0
$HealthSuccess = $false

do {
    Start-Sleep -Seconds 5
    $RetryCount++
    try {
        $Response = Invoke-WebRequest -Uri "http://${ServerIP}:3000" -Method Head -TimeoutSec 5 -ErrorAction Stop
        if ($Response.StatusCode -eq 200) {
            $HealthSuccess = $true
            Write-Host "✅ Site is reachable! (Attempt $RetryCount/$MaxRetries)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "⏳ Waiting for site to come online... (Attempt $RetryCount/$MaxRetries)" -ForegroundColor Gray
    }
} while (-not $HealthSuccess -and $RetryCount -lt $MaxRetries)

if (-not $HealthSuccess) {
    Write-Error "❌ Deployment verification failed. Site is not responding."
}
else {
    Write-Host "🎉 DEPLOYMENT SUCCESSFUL & VERIFIED!" -ForegroundColor Green
}

Read-Host "`nPress Enter to exit..."

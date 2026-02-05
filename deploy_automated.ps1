$ErrorActionPreference = "Stop"

Write-Host "Tropos CRM - Automated Cloud Deployer (NON-INTERACTIVE)" -ForegroundColor Cyan
Write-Host "===================================="

# 0. Run Automated Tests
Write-Host "[Testing] Running pre-deployment suite..." -ForegroundColor Yellow
node test_deployment.cjs
if ($LASTEXITCODE -ne 0) { 
    Write-Error "Tests failed. Deployment aborted."
    exit 
}
Write-Host "✅ Tests Passed." -ForegroundColor Green

# 1. Create Deployment Package
Write-Host "[Building] frontend assets..." -ForegroundColor Yellow
cmd /c "npm run build"
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed."; exit }

Write-Host "[Packaging] project files..." -ForegroundColor Yellow
tar -czf careq_deploy.tar.gz dist App.tsx server.js database.js package.json package-lock.json components public services types.ts constants.ts Dockerfile docker-compose.yml index.html index.tsx index.css vite.config.ts tsconfig.json .env .env.local crm_data.db remote_setup.sh sync_users.js restore_db.ps1 migrate_tenants.js migrate_interaction_cols.js
if ($LASTEXITCODE -ne 0) { Write-Error "Packaging failed."; exit }

# 2. Server Details
$ServerIP = "74.208.170.62"
Write-Host "Target Server: $ServerIP" -ForegroundColor Cyan

# 3. Upload
Write-Host "`n[Uploading] files..." -ForegroundColor Yellow
try {
    scp -o StrictHostKeyChecking=no careq_deploy.tar.gz remote_setup.sh "root@${ServerIP}:~/"
    if ($LASTEXITCODE -ne 0) { throw "Upload failed." }
}
catch {
    Write-Error "Upload failed. Check SSH keys/password."
    exit
}

# 4. Deploy
Write-Host "`n[Deploying] to PRODUCTION..." -ForegroundColor Yellow
try {
    ssh -o StrictHostKeyChecking=no "root@${ServerIP}" "bash ~/remote_setup.sh --production-only"
    Write-Host "✅ PRODUCTION UPDATE COMPLETE." -ForegroundColor Green
}
catch {
    Write-Error "Production deployment failed: $_"
    exit
}

# 5. Verify
Write-Host "`n[Health Check] Verifying..." -ForegroundColor Yellow
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
            Write-Host "✅ Site is reachable! (Attempt $RetryCount)" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "⏳ Waiting... (Attempt $RetryCount)" -ForegroundColor Gray
    }
} while (-not $HealthSuccess -and $RetryCount -lt $MaxRetries)

if (-not $HealthSuccess) {
    Write-Error "❌ Deployment verification failed."
}
else {
    Write-Host "🎉 DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
}

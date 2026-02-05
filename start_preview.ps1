$ErrorActionPreference = "Stop"

Write-Host "🎥 Starting Tropos Production Preview..." -ForegroundColor Cyan
Write-Host "======================================"

# 1. Kill any existing processes
Write-Host "`n[1] Cleaning up ports..." -ForegroundColor Yellow
./force_kill.ps1

# 2. Build Frontend
Write-Host "`n[2] Building Frontend (Vite)..." -ForegroundColor Yellow
npm run build

# 3. Start Server (serving build)
Write-Host "`n[3] Starting Production Server..." -ForegroundColor Yellow
Write-Host "Server will start on http://localhost:3000" -ForegroundColor Cyan
Write-Host "(Please wait for 'Server listening' message)" -ForegroundColor Gray

$env:PORT = "3000"
$env:NODE_ENV = "production"

node server.js

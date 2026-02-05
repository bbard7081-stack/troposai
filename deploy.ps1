$ErrorActionPreference = "Stop"

Write-Host "careQ CRM - Automated Cloud Deployer" -ForegroundColor Cyan
Write-Host "===================================="

# Check if Python is installed
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Error "Python is required but not found. Please install Python."
}

Write-Host "Target IP: 74.208.170.62" -ForegroundColor Gray
# Run the simplified Python deployment script
python deploy.py

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed."
}
else {
    Read-Host "Press Enter to exit..."
}

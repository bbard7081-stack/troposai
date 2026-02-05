$ErrorActionPreference = "Stop"

Write-Host "🚀 Tropos CRM - Local Development Server" -ForegroundColor Cyan
Write-Host "========================================="

Write-Host "`n[Step 1] Installing dependencies..." -ForegroundColor Yellow
npm install

Write-Host "`n[Step 2] Starting development server..." -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:3000/api" -ForegroundColor Cyan
Write-Host "`nPress Ctrl+C to stop the server`n" -ForegroundColor Gray

# Run both frontend and backend concurrently
# Frontend runs on 3000 (default)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; npm run dev"
Start-Sleep -Seconds 2
# Backend runs on 3001 to avoid conflict (Vite proxies to it)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:PORT=3001; npm run server"

Write-Host "`n✅ Servers started in separate windows!" -ForegroundColor Green
Write-Host "Landing Page: http://localhost:3000" -ForegroundColor Cyan
# Start Chrome
Start-Process "chrome.exe" "http://localhost:5173/simchatalent"
Write-Host "CRM App:      http://localhost:3000/shimchatalent" -ForegroundColor Cyan

Read-Host "`nPress Enter to exit this window (servers will keep running)"

# Local Testing Guide for Tropos CRM

## Quick Start

Run the local development server:
```powershell
./start_local.ps1
```

This will:
1. Install any missing dependencies
2. Start the Vite dev server (frontend) on port 3000
3. Start the Node.js backend server
4. Open two PowerShell windows (one for each server)

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **Database**: Local `crm_data.db` file

## What to Test

### ✅ Rebranding Verification
- [ ] Check page title shows "Tropos" (not "CareQ")
- [ ] Check sidebar logo says "Tropos"
- [ ] Check Admin Panel branding
- [ ] Check RingCentral module footer (should say "TROPOS-CRM-882")

### ✅ Core Functionality
- [ ] Grid loads with data
- [ ] Can add/edit rows
- [ ] Can filter and sort
- [ ] Admin Panel charts display correctly
- [ ] RingCentral module opens

### ✅ New Features
- [ ] Admin charts use new sleek design (gradients, animations)
- [ ] All UI elements render properly

## Stopping the Servers

Close the two PowerShell windows that opened, or press `Ctrl+C` in each.

## Deploy to Production

Once everything looks good locally:
```powershell
./deploy_v2.ps1
```

This will deploy to your VPS with the staging → production workflow.

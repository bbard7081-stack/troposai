# Tropos CRM - VPS Deployment Guide

## Current Status
✅ **Local Testing**: Complete - All branding verified  
⚠️ **VPS Deployment**: Pending - SSH connection issues encountered

## Quick Deployment

### Option 1: Automated Deployment (Recommended)
```powershell
./deploy_v2.ps1
```

**What it does:**
1. Runs automated tests (TypeScript + Build)
2. Packages files into `careq_deploy.tar.gz`
3. Uploads to VPS via SSH
4. Deploys to staging first
5. Asks for approval before production

**If SSH fails:**
- Verify VPS IP: `74.208.170.62`
- Verify password: `Uim72aNn`
- Test connection: `ssh root@74.208.170.62`

### Option 2: Manual VPS Recovery (If containers are down)

First, restart the old container to get your site back online:
```powershell
./restore_site.ps1
```

Then proceed with full deployment once site is stable.

## Troubleshooting

### SSH Connection Fails
1. **Test basic connectivity:**
   ```powershell
   ping 74.208.170.62
   ```

2. **Test SSH manually:**
   ```powershell
   ssh root@74.208.170.62
   ```
   - If it asks for password, enter: `Uim72aNn`
   - If connection refused: VPS firewall or service issue
   - If timeout: Network/routing issue

3. **Check VPS status:**
   - Visit https://troposai.com in browser
   - If 502 error: Docker containers are down
   - If timeout: VPS is offline

### 502 Bad Gateway
Run diagnostics:
```powershell
./diagnose_vps.ps1
```

This shows:
- Container status
- Container logs
- Nginx status
- Port availability

## Post-Deployment Verification

Once deployed, verify:
- [ ] https://troposai.com loads
- [ ] Page title shows "Tropos"
- [ ] Sidebar logo says "Tropos"
- [ ] User email shows `@troposai.com`
- [ ] Admin charts display correctly
- [ ] RingCentral module works

## Rollback Plan

If deployment fails:
```powershell
./restore_site.ps1
```

This restarts the old `careq_crm` container to restore service.

$ErrorActionPreference = 'SilentlyContinue'
Stop-Process -Name node -Force
Stop-Process -Name npm -Force
Exit 0

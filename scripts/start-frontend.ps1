if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "React frontend is already running on port 5173." -ForegroundColor Green
    exit 0
}

$root = Split-Path -Parent $PSScriptRoot
$host.UI.RawUI.WindowTitle = "HOME HEALTHCARE 3 - React frontend (5173)"
Set-Location (Join-Path $root "frontend-react")
npm run dev

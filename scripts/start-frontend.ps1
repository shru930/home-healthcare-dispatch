$root = Split-Path -Parent $PSScriptRoot
$host.UI.RawUI.WindowTitle = "HOME HEALTHCARE 3 - React frontend (5173)"
Set-Location (Join-Path $root "frontend-react")
npm run dev

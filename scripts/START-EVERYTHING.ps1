# One click: starts Camunda 8 Run, the Spring Boot backend and the React frontend, waits until each is ready,
# then opens the portal and Operate in the browser.  Right-click -> "Run with PowerShell".
$ErrorActionPreference = 'SilentlyContinue'
$scripts = $PSScriptRoot
$c8run = "C:\Users\punee\Cambunda\c8run-8.8.32"

function Wait-Url($url, $name, $seconds) {
    Write-Host "Waiting for $name ..." -NoNewline
    for ($i = 0; $i -lt $seconds; $i += 5) {
        try { if ((Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200) { Write-Host " ready" -ForegroundColor Green; return $true } } catch {}
        Start-Sleep 5; Write-Host "." -NoNewline
    }
    Write-Host " NOT READY" -ForegroundColor Red; return $false
}

# 1. Camunda (skip if already running)
$up = $false
try { $up = (Invoke-WebRequest "http://localhost:8080/v2/topology" -UseBasicParsing -TimeoutSec 4).Content -match '"health":"healthy"' } catch {}
if (-not $up) {
    Remove-Item "$c8run\*.lock" -Force
    Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$scripts\start-camunda.ps1`""
    Wait-Url "http://localhost:8080/v2/topology" "Camunda" 300 | Out-Null
    Start-Sleep 20   # connectors runtime
}

# 2. Backend
$up = $false
try { $up = (Invoke-WebRequest "http://localhost:8090/actuator/health" -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200 } catch {}
if (-not $up) {
    Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$scripts\start-backend.ps1`""
    Wait-Url "http://localhost:8090/actuator/health" "backend" 300 | Out-Null
}

# 3. Frontend
$up = $false
try { $up = (Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -TimeoutSec 4).StatusCode -eq 200 } catch {}
if (-not $up) {
    Start-Process powershell -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$scripts\start-frontend.ps1`""
    Wait-Url "http://localhost:5173" "frontend" 120 | Out-Null
}

Start-Process "http://localhost:5173"
Start-Process "http://localhost:8080/operate"
Write-Host "`nEverything is up. Portal: http://localhost:5173   Operate: http://localhost:8080/operate (demo / demo)" -ForegroundColor Green
Read-Host "Press Enter to close this window"

# Starts the Spring Boot backend (REST API + Zeebe job workers) on port 8090 with settings from ../.env
if (Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host "Spring Boot backend is already running on port 8090." -ForegroundColor Green
    exit 0
}

$root = Split-Path -Parent $PSScriptRoot
Get-Content (Join-Path $root ".env") | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($k, $v, "Process")
}
$host.UI.RawUI.WindowTitle = "HOME HEALTHCARE 2 - Spring Boot backend (8090)"
Set-Location (Join-Path $root "backend-springboot")
.\mvnw.cmd spring-boot:run

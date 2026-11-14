# Starts the Spring Boot backend (REST API + Zeebe job workers) on port 8090 with settings from ../.env
$root = Split-Path -Parent $PSScriptRoot
Get-Content (Join-Path $root ".env") | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($k, $v, "Process")
}
$host.UI.RawUI.WindowTitle = "HOME HEALTHCARE 2 - Spring Boot backend (8090)"
Set-Location (Join-Path $root "backend-springboot")
.\mvnw.cmd spring-boot:run

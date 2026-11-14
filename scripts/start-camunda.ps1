# Starts Camunda 8 Run with the connector secrets from ../.env exported as environment variables.
# The connector runtime resolves {{secrets.NAME}} placeholders from its environment.
param([string]$C8Run = "C:\Users\punee\Cambunda\c8run-8.8.32")
$root = Split-Path -Parent $PSScriptRoot
Get-Content (Join-Path $root ".env") | Where-Object { $_ -match '^[A-Z_]+=' } | ForEach-Object {
    $k, $v = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($k, $v, "Process")
}
$host.UI.RawUI.WindowTitle = "HOME HEALTHCARE 1 - Camunda 8 Run (8080 / 26500 / 8086)"
Set-Location $C8Run
.\c8run.exe start

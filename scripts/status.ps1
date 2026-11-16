# Health check of the whole CareFlow stack (used by the VS Code task "Check CareFlow status").
$ErrorActionPreference = 'SilentlyContinue'
function Line($name, $ok, $detail) {
    $mark = if ($ok) { '[ OK ]' } else { '[FAIL]' }
    $color = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("{0} {1,-28} {2}" -f $mark, $name, $detail) -ForegroundColor $color
}
Write-Host "`nCareFlow status  $(Get-Date -Format 'dd MMM yyyy HH:mm:ss')`n" -ForegroundColor Cyan

$topo = try { Invoke-RestMethod http://localhost:8080/v2/topology -TimeoutSec 5 } catch { $null }
$health = if ($topo) { $topo.brokers[0].partitions[0].health } else { 'unreachable' }
Line 'Camunda 8.8 engine (Zeebe)' ($health -eq 'healthy') "partition $health   http://localhost:8080"
Line 'Connector runtime' ([bool](Get-NetTCPConnection -LocalPort 8086 -State Listen)) 'REST + Email connectors on port 8086'
$op = try { (Invoke-WebRequest http://localhost:8080/operate -UseBasicParsing -TimeoutSec 5).StatusCode } catch { 0 }
Line 'Camunda Operate' ($op -eq 200) 'http://localhost:8080/operate   (demo / demo)'

$be = try { Invoke-RestMethod http://localhost:8090/actuator/health -TimeoutSec 5 } catch { $null }
Line 'Spring Boot backend' ($be.status -eq 'UP') "status $($be.status)   http://localhost:8090"
Line '  PostgreSQL database' ($be.components.db.status -eq 'UP') "$($be.components.db.details.database) $($be.components.db.status)"
Line '  Camunda client (workers)' ($be.components.camundaClient.status -eq 'UP') "$($be.components.camundaClient.status)"

$fe = try { (Invoke-WebRequest http://localhost:5173 -UseBasicParsing -TimeoutSec 5).StatusCode } catch { 0 }
Line 'React portal' ($fe -eq 200) 'http://localhost:5173   (admin / admin@123, user / user@123)'

$login = try { Invoke-RestMethod http://localhost:8090/api/auth/login -Method Post -ContentType 'application/json' -Body '{"username":"admin","password":"admin@123"}' -TimeoutSec 5 } catch { $null }
Line 'Login (admin)' ([bool]$login.token) "role $($login.role)"
if ($login.token) {
    $h = @{ Authorization = "Bearer $($login.token)" }
    $wf = Invoke-RestMethod http://localhost:8090/api/workflows -Headers $h
    $active = @($wf | Where-Object { $_.status -eq 'ACTIVE' })
    Write-Host "`nActive cases ($($active.Count)):" -ForegroundColor Cyan
    $active | ForEach-Object { Write-Host ("   {0,-22} {1}   {2}" -f $_.patientName, $_.processInstanceKey, $_.currentStage) }
    $inc = (Invoke-RestMethod http://localhost:8080/v2/incidents/search -Method Post -ContentType 'application/json' -Body '{"filter":{"state":"ACTIVE"}}').items
    Write-Host "`nOpen incidents in Operate: $(@($inc).Count)" -ForegroundColor Cyan
}
Write-Host ''

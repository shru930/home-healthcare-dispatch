#!/usr/bin/env bash
# Stops the backend on port 8090 (if running) and starts it again in its own PowerShell window.
PID=$(netstat -ano | grep ":8090 .*LISTEN" | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID $PID //F >/dev/null 2>&1 && sleep 2
powershell -Command "Start-Process powershell -ArgumentList '-NoExit','-ExecutionPolicy','Bypass','-File','\"C:\Users\punee\workflo automation\home-healthcare-dispatch\scripts\start-backend.ps1\"'"
for i in $(seq 1 75); do c=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8090/actuator/health); [ "$c" = 200 ] && break; sleep 4; done
echo "backend $c"

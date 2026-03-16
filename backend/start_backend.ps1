Set-Location "f:/Users/Administrator/WorkBuddy/20260314153116/backend"
Start-Process -FilePath "cmd" -ArgumentList "/c npx tsx src/index.ts > backend_run.log 2>&1" -WindowStyle Hidden
Start-Sleep -Seconds 6
Get-Content "backend_run.log"

param(
  [string]$ApiUrl = "http://localhost:4000/api",
  [string]$DatabaseUrl = "postgresql://postgres:postgres@localhost:55432/esn_forecast?schema=public",
  [int]$ApiPort = 4000,
  [int]$WebPort = 5173
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Starting ESN Forecast" -ForegroundColor Cyan
Write-Host "API:   http://localhost:$ApiPort/api/health"
Write-Host "Web:   http://localhost:$WebPort"
Write-Host "VITE_API_URL=$ApiUrl"
Write-Host ""

$env:DATABASE_URL = $DatabaseUrl
$env:PORT = "$ApiPort"
$env:VITE_API_URL = $ApiUrl

function Stop-DevProcesses {
  Write-Host ""
  Write-Host "Stopping ESN Forecast processes..." -ForegroundColor Yellow
  foreach ($process in $script:children) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

$script:children = @()
try {
  $api = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev:api" -WorkingDirectory $root -NoNewWindow -PassThru
  $script:children += $api

  Start-Sleep -Seconds 2

  $webCommand = "npm run dev:web -- --port $WebPort"
  $web = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $webCommand -WorkingDirectory $root -NoNewWindow -PassThru
  $script:children += $web

  Write-Host "Both processes are starting. Press Ctrl+C to stop." -ForegroundColor Green
  while ($true) {
    Start-Sleep -Seconds 2
    foreach ($process in $script:children) {
      if ($process.HasExited) {
        throw "A dev process exited unexpectedly with code $($process.ExitCode)."
      }
    }
  }
} finally {
  Stop-DevProcesses
}

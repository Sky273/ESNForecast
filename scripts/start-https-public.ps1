param(
  [string]$Domain = "esnforecast.net",
  [string]$TunnelName = "esn-forecast",
  [string]$DatabaseUrl = "postgresql://postgres:postgres@localhost:55432/esn_forecast?schema=public",
  [int]$ApiPort = 4000,
  [int]$WebPort = 5173,
  [string]$CloudflaredConfigPath = "$env:USERPROFILE\.cloudflared\config.yml"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".tmp"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared is not installed or not available in PATH."
}

if (-not (Test-Path $CloudflaredConfigPath)) {
  throw "Cloudflare config not found: $CloudflaredConfigPath. Create it with scripts/write-cloudflare-config.ps1 after creating the named tunnel."
}

$script:children = @()

function Start-LoggedProcess {
  param(
    [string]$Name,
    [string]$Command,
    [string[]]$Arguments,
    [string]$WorkingDirectory = $root
  )

  $stdout = Join-Path $logDir "$Name.out.log"
  $stderr = Join-Path $logDir "$Name.err.log"
  Remove-Item -Force -ErrorAction SilentlyContinue $stdout, $stderr
  $process = Start-Process -FilePath $Command -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -NoNewWindow -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $script:children += $process
  return @{ Process = $process; Stdout = $stdout; Stderr = $stderr }
}

function Wait-HttpOk {
  param([string]$Url, [int]$TimeoutSeconds = 30)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  } while ((Get-Date) -lt $deadline)
  throw "Timeout waiting for $Url"
}

function Assert-PortAvailable {
  param([int]$Port, [string]$Name)
  $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($listeners) {
    $processIds = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
    throw "$Name port $Port is already in use by process id(s): $processIds. Stop the existing process or change the port before starting the public tunnel."
  }
}

function Stop-Processes {
  Write-Host ""
  Write-Host "Stopping ESN Forecast public HTTPS processes..." -ForegroundColor Yellow
  foreach ($process in $script:children) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

try {
  $publicWebBaseUrl = "https://$Domain"
  $publicApiBaseUrl = "$publicWebBaseUrl/api"

  Write-Host "Starting ESN Forecast on $publicWebBaseUrl" -ForegroundColor Cyan

  Assert-PortAvailable -Port $ApiPort -Name "API"
  Assert-PortAvailable -Port $WebPort -Name "Web"

  $env:DATABASE_URL = $DatabaseUrl
  $env:PORT = "$ApiPort"
  $env:PUBLIC_WEB_BASE_URL = $publicWebBaseUrl
  $env:PUBLIC_API_BASE_URL = $publicApiBaseUrl
  $env:BRIDGE_REDIRECT_URI = "$publicApiBaseUrl/connectors/bridge/oauth/callback"
  $env:VITE_API_URL = $publicApiBaseUrl

  $api = Start-LoggedProcess -Name "api-public" -Command "cmd.exe" -Arguments @("/c", "npm run dev:api")
  Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/api/health" -TimeoutSeconds 30
  Write-Host "API local ready: http://127.0.0.1:$ApiPort/api/health" -ForegroundColor Green

  Write-Host "Building web frontend for $publicWebBaseUrl..." -ForegroundColor Cyan
  Push-Location (Join-Path $root "packages\shared")
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Shared package build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  Push-Location (Join-Path $root "apps\web")
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Web build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  $web = Start-LoggedProcess -Name "web-public" -Command "node" -Arguments @("scripts/serve-static.mjs", "--root", "apps/web/dist", "--port", "$WebPort")
  Wait-HttpOk -Url "http://127.0.0.1:$WebPort" -TimeoutSeconds 30
  Write-Host "Web local ready: http://127.0.0.1:$WebPort" -ForegroundColor Green

  $tunnel = Start-LoggedProcess -Name "cloudflared-public" -Command "cloudflared" -Arguments @("tunnel", "--config", $CloudflaredConfigPath, "run", $TunnelName)

  Write-Host ""
  Write-Host "ESN Forecast public HTTPS is starting:" -ForegroundColor Cyan
  Write-Host "Application: $publicWebBaseUrl" -ForegroundColor Green
  Write-Host "API:         $publicApiBaseUrl" -ForegroundColor Green
  Write-Host "Bridge callback: $publicApiBaseUrl/connectors/bridge/oauth/callback" -ForegroundColor Green
  Write-Host "Bridge webhook:  $publicApiBaseUrl/webhooks/bridge" -ForegroundColor Green
  Write-Host ""
  Write-Host "Keep this terminal open. Press Ctrl+C to stop." -ForegroundColor Yellow

  while ($true) {
    Start-Sleep -Seconds 2
    foreach ($process in $script:children) {
      if ($process.HasExited) {
        throw "Process $($process.Id) exited unexpectedly with code $($process.ExitCode). Logs are in $logDir."
      }
    }
  }
} finally {
  Stop-Processes
}

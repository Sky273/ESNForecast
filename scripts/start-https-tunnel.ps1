param(
  [string]$DatabaseUrl = "postgresql://postgres:postgres@localhost:55432/esn_forecast?schema=public",
  [int]$ApiPort = 4000,
  [int]$WebPort = 5173,
  [int]$TunnelTimeoutSeconds = 45
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root ".tmp"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  throw "cloudflared is not installed or not available in PATH. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
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

function Wait-TunnelUrl {
  param([string[]]$LogFiles, [int]$TimeoutSeconds)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    foreach ($file in $LogFiles) {
      if (Test-Path $file) {
        $content = Get-Content -Raw -ErrorAction SilentlyContinue $file
        if ([string]::IsNullOrWhiteSpace($content)) {
          continue
        }
        $match = [regex]::Match($content, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        if ($match.Success) {
          return $match.Value
        }
      }
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "Unable to find the Cloudflare Tunnel URL in logs: $($LogFiles -join ', ')"
}

function Stop-DevProcesses {
  Write-Host ""
  Write-Host "Stopping HTTPS tunnel processes..." -ForegroundColor Yellow
  foreach ($process in $script:children) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

try {
  Write-Host "Starting ESN Forecast with HTTPS tunnels" -ForegroundColor Cyan

  $env:DATABASE_URL = $DatabaseUrl
  $env:PORT = "$ApiPort"
  $api = Start-LoggedProcess -Name "api" -Command "cmd.exe" -Arguments @("/c", "npm run dev:api")
  Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/api/health" -TimeoutSeconds 30
  Write-Host "API local ready: http://127.0.0.1:$ApiPort/api/health" -ForegroundColor Green

  $apiTunnel = Start-LoggedProcess -Name "api-tunnel" -Command "cloudflared" -Arguments @("tunnel", "--url", "http://127.0.0.1:$ApiPort")
  $apiHttpsUrl = Wait-TunnelUrl -LogFiles @($apiTunnel.Stdout, $apiTunnel.Stderr) -TimeoutSeconds $TunnelTimeoutSeconds
  Write-Host "API HTTPS: $apiHttpsUrl/api" -ForegroundColor Green

  $env:VITE_API_URL = "$apiHttpsUrl/api"
  $web = Start-LoggedProcess -Name "web" -Command "cmd.exe" -Arguments @("/c", "npm run dev:web -- --port $WebPort")
  Wait-HttpOk -Url "http://127.0.0.1:$WebPort" -TimeoutSeconds 30
  Write-Host "Web local ready: http://127.0.0.1:$WebPort" -ForegroundColor Green

  $webTunnel = Start-LoggedProcess -Name "web-tunnel" -Command "cloudflared" -Arguments @("tunnel", "--url", "http://127.0.0.1:$WebPort")
  $webHttpsUrl = Wait-TunnelUrl -LogFiles @($webTunnel.Stdout, $webTunnel.Stderr) -TimeoutSeconds $TunnelTimeoutSeconds

  Write-Host ""
  Write-Host "ESN Forecast is available over HTTPS:" -ForegroundColor Cyan
  Write-Host "Application: $webHttpsUrl" -ForegroundColor Green
  Write-Host "API:         $apiHttpsUrl/api" -ForegroundColor Green
  Write-Host ""
  Write-Host "Webhook base URL:" -ForegroundColor Cyan
  Write-Host "$apiHttpsUrl/api/webhooks/<provider>" -ForegroundColor Green
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
  Stop-DevProcesses
}

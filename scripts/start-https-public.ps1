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

if (-not (Test-Path $CloudflaredConfigPath)) {
  throw "Cloudflare config not found: $CloudflaredConfigPath. Create it with scripts/write-cloudflare-config.ps1 after creating the named tunnel."
}

$script:children = @()

function Resolve-CloudflaredPath {
  $command = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    "C:\Program Files\cloudflared\cloudflared.exe",
    "C:\Program Files (x86)\cloudflared\cloudflared.exe",
    "C:\ProgramData\chocolatey\bin\cloudflared.exe",
    "C:\ProgramData\chocolatey\lib\cloudflared\tools\cloudflared.exe",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe",
    "$env:USERPROFILE\.cloudflared\cloudflared.exe",
    "$env:USERPROFILE\cloudflared.exe"
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "cloudflared is not installed or not available in PATH. Install it with winget install Cloudflare.cloudflared or add it to PATH."
}

$cloudflaredCommand = Resolve-CloudflaredPath

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
  $entry = @{ Name = $Name; Process = $process; Stdout = $stdout; Stderr = $stderr }
  $script:children += $entry
  return $entry
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
  foreach ($child in $script:children) {
    $process = $child.Process
    if ($process) {
      $process.Refresh()
    }
    if ($process -and -not $process.HasExited) {
      Stop-ProcessTree -ProcessId $process.Id
    }
  }
  Start-Sleep -Milliseconds 250
  Stop-PortListeners -Port $ApiPort -Name "API"
  Stop-PortListeners -Port $WebPort -Name "Web"
}

function Stop-ProcessTree {
  param([int]$ProcessId)
  if (-not (Test-ProcessAlive -ProcessId $ProcessId)) {
    return
  }

  $children = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object { $_.ParentProcessId -eq $ProcessId }
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  Wait-ProcessExit -ProcessId $ProcessId -TimeoutMilliseconds 3000 | Out-Null
}

function Test-ProcessAlive {
  param([int]$ProcessId)
  return [bool](Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Wait-ProcessExit {
  param([int]$ProcessId, [int]$TimeoutMilliseconds = 3000)
  $deadline = (Get-Date).AddMilliseconds($TimeoutMilliseconds)
  while ((Get-Date) -lt $deadline) {
    if (-not (Test-ProcessAlive -ProcessId $ProcessId)) {
      return $true
    }
    Start-Sleep -Milliseconds 100
  }
  return -not (Test-ProcessAlive -ProcessId $ProcessId)
}

function Stop-PortListeners {
  param([int]$Port, [string]$Name, [switch]$ThrowOnFailure)
  for ($attempt = 1; $attempt -le 8; $attempt++) {
    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
      return
    }
    $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if (-not $process) {
        continue
      }
      if ($attempt -eq 1) {
        Write-Host "Stopping $Name port $Port listener: PID $processId ($($process.ProcessName))" -ForegroundColor Yellow
      }
      Stop-ProcessTree -ProcessId $processId
    }
    Start-Sleep -Milliseconds 250
  }
  $remaining = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  if ($remaining) {
    $remainingProcessIds = ($remaining | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
    $message = "$Name port $Port is still in use by process id(s): $remainingProcessIds. Close the owning terminal or run this script from an elevated PowerShell session."
    if ($ThrowOnFailure) {
      throw $message
    }
    Write-Warning $message
  }
}

function Clear-StartupPorts {
  Write-Host "Cleaning stale local listeners if needed..." -ForegroundColor Yellow
  Stop-PortListeners -Port $ApiPort -Name "API"
  Stop-PortListeners -Port $WebPort -Name "Web"
}

function Test-PortAvailable {
  param([int]$Port)
  return -not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Find-AvailablePort {
  param([int]$PreferredPort)
  if (Test-PortAvailable -Port $PreferredPort) {
    return $PreferredPort
  }
  for ($port = $PreferredPort + 1; $port -le ($PreferredPort + 50); $port++) {
    if (Test-PortAvailable -Port $port) {
      return $port
    }
  }
  throw "No available local port found near $PreferredPort."
}

function Resolve-RuntimePorts {
  $resolvedApiPort = Find-AvailablePort -PreferredPort $ApiPort
  $resolvedWebPort = Find-AvailablePort -PreferredPort $WebPort
  if ($resolvedApiPort -ne $ApiPort) {
    Write-Warning "API port $ApiPort could not be released. Using local API port $resolvedApiPort for this run."
  }
  if ($resolvedWebPort -ne $WebPort) {
    Write-Warning "Web port $WebPort could not be released. Using local web port $resolvedWebPort for this run."
  }
  return @{ ApiPort = $resolvedApiPort; WebPort = $resolvedWebPort }
}

function New-CloudflaredRuntimeConfig {
  param([int]$ResolvedApiPort, [int]$ResolvedWebPort)
  $source = Get-Content -Path $CloudflaredConfigPath
  $header = @()
  foreach ($line in $source) {
    if ($line -match "^\s*ingress\s*:") {
      break
    }
    $header += $line
  }
  if (-not ($header | Where-Object { $_ -match "^\s*tunnel\s*:" })) {
    throw "Cloudflare config must contain a tunnel id: $CloudflaredConfigPath"
  }
  $runtimeConfigPath = Join-Path $logDir "cloudflared-public-runtime.yml"
  $runtimeConfig = @()
  $runtimeConfig += $header
  $runtimeConfig += ""
  $runtimeConfig += "ingress:"
  $runtimeConfig += "  - hostname: $Domain"
  $runtimeConfig += "    path: /api/*"
  $runtimeConfig += "    service: http://127.0.0.1:$ResolvedApiPort"
  $runtimeConfig += ""
  $runtimeConfig += "  - hostname: $Domain"
  $runtimeConfig += "    service: http://127.0.0.1:$ResolvedWebPort"
  $runtimeConfig += ""
  $runtimeConfig += "  - service: http_status:404"
  Set-Content -Path $runtimeConfigPath -Value $runtimeConfig -Encoding utf8
  return $runtimeConfigPath
}

function Update-TrackedProcessFromPort {
  param([hashtable]$Entry, [int]$Port)
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $listener) {
    return
  }
  $listenerProcess = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  if ($listenerProcess -and $Entry.Process.Id -ne $listenerProcess.Id) {
    Write-Host "Tracking $($Entry.Name) listener PID $($listenerProcess.Id) instead of launcher PID $($Entry.Process.Id)." -ForegroundColor DarkGray
    $Entry.Process = $listenerProcess
  }
}

try {
  $publicWebBaseUrl = "https://$Domain"
  $publicApiBaseUrl = "$publicWebBaseUrl/api"

  Write-Host "Starting ESN Forecast on $publicWebBaseUrl" -ForegroundColor Cyan

  Clear-StartupPorts
  $runtimePorts = Resolve-RuntimePorts
  $ApiPort = $runtimePorts.ApiPort
  $WebPort = $runtimePorts.WebPort
  $runtimeCloudflaredConfigPath = New-CloudflaredRuntimeConfig -ResolvedApiPort $ApiPort -ResolvedWebPort $WebPort

  $env:DATABASE_URL = $DatabaseUrl
  $env:PORT = "$ApiPort"
  $env:PUBLIC_WEB_BASE_URL = $publicWebBaseUrl
  $env:PUBLIC_API_BASE_URL = $publicApiBaseUrl
  $env:BRIDGE_REDIRECT_URI = "$publicApiBaseUrl/connectors/bridge/oauth/callback"
  $env:VITE_API_URL = $publicApiBaseUrl
  $env:NODE_ENV = "production"

  Write-Host "Building backend and web frontend for $publicWebBaseUrl..." -ForegroundColor Cyan
  Push-Location (Join-Path $root "packages\shared")
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Shared package build failed with exit code $LASTEXITCODE."
    }
  } finally {
    Pop-Location
  }

  Push-Location (Join-Path $root "apps\api")
  try {
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "API build failed with exit code $LASTEXITCODE."
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

  $api = Start-LoggedProcess -Name "api-public" -Command "node" -Arguments @("--import", "tsx", "src/server.ts") -WorkingDirectory (Join-Path $root "apps\api")
  Wait-HttpOk -Url "http://127.0.0.1:$ApiPort/api/health" -TimeoutSeconds 30
  Update-TrackedProcessFromPort -Entry $api -Port $ApiPort
  Write-Host "API local ready: http://127.0.0.1:$ApiPort/api/health" -ForegroundColor Green

  $web = Start-LoggedProcess -Name "web-public" -Command "node" -Arguments @("scripts/serve-static.mjs", "--root", "apps/web/dist", "--port", "$WebPort")
  Wait-HttpOk -Url "http://127.0.0.1:$WebPort" -TimeoutSeconds 30
  Update-TrackedProcessFromPort -Entry $web -Port $WebPort
  Write-Host "Web local ready: http://127.0.0.1:$WebPort" -ForegroundColor Green

  $quotedCloudflaredConfigPath = "`"$runtimeCloudflaredConfigPath`""
  $tunnel = Start-LoggedProcess -Name "cloudflared-public" -Command $cloudflaredCommand -Arguments @("tunnel", "--config", $quotedCloudflaredConfigPath, "run", $TunnelName)

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
    foreach ($child in $script:children) {
      $process = $child.Process
      $process.Refresh()
      if ($process.HasExited) {
        throw "Process $($child.Name) (PID $($process.Id)) exited unexpectedly with code $($process.ExitCode). Logs: $($child.Stdout), $($child.Stderr)."
      }
    }
  }
} finally {
  Stop-Processes
}

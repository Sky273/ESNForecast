param(
  [Parameter(Mandatory = $true)]
  [string]$TunnelId,
  [string]$Domain = "esnforecast.net",
  [int]$ApiPort = 4000,
  [int]$WebPort = 5173,
  [string]$ConfigPath = "$env:USERPROFILE\.cloudflared\config.yml",
  [string]$CredentialsFile = "$env:USERPROFILE\.cloudflared\$TunnelId.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $CredentialsFile)) {
  throw "Cloudflare tunnel credentials file not found: $CredentialsFile. Run: cloudflared tunnel create esn-forecast"
}

$configDir = Split-Path -Parent $ConfigPath
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$credentialsPathForYaml = $CredentialsFile.Replace("\", "/")
$content = @"
tunnel: $TunnelId
credentials-file: $credentialsPathForYaml

ingress:
  - hostname: $Domain
    path: /api/*
    service: http://127.0.0.1:$ApiPort

  - hostname: $Domain
    service: http://127.0.0.1:$WebPort

  - service: http_status:404
"@

Set-Content -Path $ConfigPath -Value $content -Encoding utf8

Write-Host "Cloudflare tunnel config written:" -ForegroundColor Green
Write-Host $ConfigPath -ForegroundColor Green
Write-Host ""
Write-Host "Validate it with:" -ForegroundColor Cyan
Write-Host "cloudflared tunnel ingress validate --config `"$ConfigPath`""

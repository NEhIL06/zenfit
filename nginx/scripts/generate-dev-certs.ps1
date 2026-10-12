$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sslDir = Join-Path (Split-Path -Parent $scriptDir) "ssl"

if (-not (Test-Path $sslDir)) {
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
}

$certFile = Join-Path $sslDir "fullchain.pem"
$keyFile = Join-Path $sslDir "privkey.pem"

Write-Host "Locating OpenSSL..." -ForegroundColor Cyan

$opensslPath = $null
$candidatePaths = @(
    "openssl",
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files\Git\mingw64\bin\openssl.exe"
)

foreach ($path in $candidatePaths) {
    if (Get-Command $path -ErrorAction SilentlyContinue) {
        $opensslPath = $path
        break
    }
}

if ($opensslPath) {
    Write-Host "Found OpenSSL at: $opensslPath" -ForegroundColor Green
    & $opensslPath req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout $keyFile `
        -out $certFile `
        -subj "/C=US/ST=Dev/L=Local/O=ZenFit/OU=Engineering/CN=localhost" `
        -addext "subjectAltName=DNS:localhost,DNS:zenfit.local,DNS:*.zenfit.local,IP:127.0.0.1"

    Write-Host "Development certificates generated successfully:" -ForegroundColor Green
    Write-Host "  - Certificate: $certFile"
    Write-Host "  - Private Key: $keyFile"
} else {
    Write-Error "Could not find OpenSSL. Please install OpenSSL or Git for Windows."
}

param(
    [Parameter(Mandatory = $true)][string]$Php,
    [Parameter(Mandatory = $true)][string]$Mysql,
    [Parameter(Mandatory = $true)][int]$Port
)
$ErrorActionPreference = 'Stop'
$p2BackendRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (!(Test-Path -LiteralPath (Join-Path $p2BackendRoot 'vendor/autoload.php'))) { throw 'Compose the owner branches and install locked dependencies first.' }
$p2Database = 'p2_test_' + [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$env:APP_ENV = 'testing'
$env:APP_KEY = 'base64:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(('x' * 32)))
$env:DB_CONNECTION = 'mysql'
$env:DB_HOST = '127.0.0.1'
$env:DB_PORT = [string]$Port
$env:DB_DATABASE = $p2Database
$env:DB_TEST_DATABASE = $p2Database
$env:DB_TEST_DISPOSABLE = '1'
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = ''
$env:SMS_ENABLED = 'false'
$env:MAKE_ENABLED = 'false'
$env:P2_MODULES_ENABLED = 'false'
$env:P2_TEST_BINDINGS = 'false'
$env:OUTBOX_DISPATCH_ENABLED = 'false'
$env:IDENTITY_ENABLED = 'true'
& $Mysql --host=127.0.0.1 --port=$Port --user=root --execute="CREATE DATABASE $p2Database CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"
if ($LASTEXITCODE -ne 0) { throw 'Unable to create isolated database.' }
Push-Location $p2BackendRoot
try {
    & $Php artisan migrate --force --no-interaction
    if ($LASTEXITCODE -ne 0) { throw 'Unmodified DBA migrations failed.' }
    & $Php tests/P2/sql.php
    if ($LASTEXITCODE -ne 0) { throw 'P2 SQL cases failed.' }
    Write-Output "Evidence database retained: $p2Database on 127.0.0.1:$Port"
} finally { Pop-Location }

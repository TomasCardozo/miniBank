# Levanta la base de datos, el backend y el frontend de MiniBank (Windows).
#   .\dev.cmd         levanta todo; Ctrl+C detiene backend y frontend (la DB queda corriendo)
#   .\dev.cmd stop    detiene la base de datos
#   .\dev.cmd reset   borra los datos de la DB (vuelve al seed de demo)
param([ValidateSet('', 'stop', 'reset')][string]$Action = '')

$ErrorActionPreference = 'Stop'

$Root = $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'

function Log($msg) { Write-Host "[minibank] $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "[minibank] $msg" -ForegroundColor Red; exit 1 }

function Compose {
    Push-Location $Backend
    try {
        & docker compose @args
        if ($LASTEXITCODE -ne 0) { Fail "docker compose $args fallo." }
    } finally { Pop-Location }
}

if ($Action -eq 'stop') { Log 'Deteniendo la base de datos...'; Compose down; exit 0 }
if ($Action -eq 'reset') { Log 'Borrando la base de datos y sus datos...'; Compose down -v; exit 0 }

foreach ($cmd in 'docker', 'java', 'pnpm') {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Fail "No se encontro '$cmd' en el PATH." }
}
& docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail 'Docker no esta corriendo.' }

foreach ($port in 8080, 5173) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        Fail "El puerto $port ya esta en uso (MiniBank ya esta corriendo?)."
    }
}

foreach ($dir in $Backend, $Frontend) {
    $envFile = Join-Path $dir '.env'
    if (-not (Test-Path $envFile)) {
        Copy-Item (Join-Path $dir '.env.example') $envFile
        Log "Creado $envFile"
    }
}

Log 'Levantando PostgreSQL y esperando a que este listo...'
Compose up -d --wait

if (-not (Test-Path (Join-Path $Frontend 'node_modules'))) {
    Log 'Instalando dependencias del frontend...'
    Push-Location $Frontend
    try { & pnpm install; if ($LASTEXITCODE -ne 0) { Fail 'pnpm install fallo.' } } finally { Pop-Location }
}

Log 'Iniciando backend en http://localhost:8080 ...'
$backendProc = Start-Process -FilePath (Join-Path $Backend 'mvnw.cmd') -ArgumentList 'spring-boot:run' `
    -WorkingDirectory $Backend -NoNewWindow -PassThru

Log 'Iniciando frontend en http://localhost:5173 ...'
Log 'Swagger: http://localhost:8080/swagger-ui/index.html'
Log 'Ctrl+C para detener.'

Push-Location $Frontend
try {
    & pnpm dev
} finally {
    Pop-Location
    Log 'Deteniendo backend y frontend...'
    if ($backendProc -and -not $backendProc.HasExited) {
        & taskkill /PID $backendProc.Id /T /F *> $null
    }
    Log 'Listo. La DB sigue corriendo (.\dev.cmd stop para detenerla).'
}

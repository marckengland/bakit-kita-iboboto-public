# Start local services and the app. Stop services with docker compose down.
$ErrorActionPreference = "Stop"
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
    if (-not (Test-Path ".env")) {
        throw "Copy .env.example to .env and set DATABASE_URL before starting."
    }
    docker compose up -d --wait
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run db:deploy
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run db:generate
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    npm run dev
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

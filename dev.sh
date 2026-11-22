#!/usr/bin/env bash
# Start local services and the app. Stop services with docker compose down.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Copy .env.example to .env and set DATABASE_URL before starting."
  exit 1
fi

docker compose up -d --wait
npm run db:deploy
npm run db:generate
npm run dev

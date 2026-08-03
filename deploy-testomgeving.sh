#!/usr/bin/env bash
# Deploy-draaiboek voor de Reppic-testomgeving (VPS /opt/reppic-test).
# Zet de nieuwe app-code op zijn plek, bouwt opnieuw op en draait de migraties.
# Instellingen (.env), uploads en bouwsel-mappen blijven onaangeroerd.
# Draai dit vanuit de git-kloon: bash ~/reppic-app/deploy-testomgeving.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
TARGET="/opt/reppic-test"

# Docker Compose v2 (docker compose) of v1 (docker-compose) automatisch kiezen.
if docker compose version >/dev/null 2>&1; then DC="docker compose"; else DC="docker-compose"; fi

echo "==> Schijfruimte nu:"; df -h / | tail -1
echo "==> Oude, ongebruikte images opruimen (herstelpunt 'voor-integratie' blijft behouden)..."
docker image prune -f >/dev/null 2>&1 || true

echo "==> 1/4  Nieuwe app-code kopieren (instellingen + uploads blijven staan)..."
rsync -a \
  --exclude '.env' --exclude '.env.*' \
  --exclude 'node_modules' --exclude '.next' --exclude 'uploads' \
  "$SRC/app/" "$TARGET/app/"

cd "$TARGET"

echo "==> 2/4  App opnieuw opbouwen (dit kan een paar minuten duren)..."
$DC build app

echo "==> 3/4  App herstarten met de nieuwe versie..."
$DC up -d app

echo "==> 4/4  Database bijwerken (migraties)..."
sleep 5
$DC exec -T app npx prisma migrate deploy

echo ""
echo "=========================================================="
echo "  KLAAR. De nieuwe versie draait."
echo "  Test nu in de browser:  https://app.testreppic.nl"
echo "  Terugrollen kan met het herstelpunt 'voor-integratie'."
echo "=========================================================="

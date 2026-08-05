#!/usr/bin/env bash
# Deploy-draaiboek voor de Reppic-testomgeving (VPS /opt/reppic-test).
# Zet de nieuwe code (app + dashboard-backend) op zijn plek, valideert de
# compose-config, bouwt opnieuw op en draait de migraties.
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

# ── 1/5  Compose-config valideren VÓÓR we iets aanraken ──────────────────────
# Vangt kapotte YAML/instellingen af vóór de deploy i.p.v. halverwege. De
# server draait een eigen compose in $TARGET; die valideren we.
echo "==> 1/5  Compose-config valideren..."
( cd "$TARGET" && $DC config -q )

# ── 2/5  Nieuwe code kopiëren (app + dashboard-backend) ──────────────────────
# LET OP: dashboard-backend moet mee — daar leven de strategische dashboard-
# analyse en de taalprompts. Alleen app/ deployen = de helft deployen.
echo "==> 2/5  Nieuwe code kopiëren (instellingen + uploads blijven staan)..."
RSYNC_EXCLUDES=(--exclude '.env' --exclude '.env.*'
  --exclude 'node_modules' --exclude '.next' --exclude 'dist' --exclude 'uploads')
rsync -a "${RSYNC_EXCLUDES[@]}" "$SRC/app/" "$TARGET/app/"
if [ -d "$SRC/dashboard-backend" ] && [ -d "$TARGET/dashboard-backend" ]; then
  rsync -a "${RSYNC_EXCLUDES[@]}" "$SRC/dashboard-backend/" "$TARGET/dashboard-backend/"
  DEPLOY_BACKEND=1
else
  echo "    (dashboard-backend niet in bron of doel — overslaan)"
  DEPLOY_BACKEND=0
fi

cd "$TARGET"

# ── 3/5  Opnieuw opbouwen ────────────────────────────────────────────────────
echo "==> 3/5  Opnieuw opbouwen (dit kan een paar minuten duren)..."
if [ "$DEPLOY_BACKEND" = "1" ]; then
  $DC build app dashboard-backend
else
  $DC build app
fi

# ── 4/5  Herstarten met de nieuwe versie ─────────────────────────────────────
echo "==> 4/5  Herstarten met de nieuwe versie..."
if [ "$DEPLOY_BACKEND" = "1" ]; then
  $DC up -d app dashboard-backend
else
  $DC up -d app
fi

# ── 5/5  Database bijwerken ──────────────────────────────────────────────────
echo "==> 5/5  Database bijwerken (migraties)..."
sleep 5
$DC exec -T app npx prisma migrate deploy

echo ""
echo "=========================================================="
echo "  KLAAR. De nieuwe versie draait."
echo "  Test nu in de browser:  https://app.testreppic.nl"
echo "  Terugrollen kan met het herstelpunt 'voor-integratie'."
echo "=========================================================="

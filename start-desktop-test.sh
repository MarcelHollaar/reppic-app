#!/usr/bin/env bash
#
# start-desktop-test.sh — lokale end-to-end test van de Desktop Recording SDK.
#
# Doet alles in één keer:
#   1. start een cloudflare-tunnel naar poort 3200 (nodig zodat Recall.ai en
#      AssemblyAI je lokale app kunnen bereiken met hun webhooks)
#   2. zet die publieke URL als APP_URL in app/.env
#   3. start de app op poort 3200 (migraties draaien automatisch mee)
#   4. start de Electron desktop-shell die de app laadt + de Recall SDK draagt
#
# Stoppen: Ctrl+C — servers/tunnel worden afgesloten en APP_URL wordt
# teruggezet naar http://localhost:3200.
#
# Vooraf (eenmalig):
#   - RECALL_API_KEY invullen in app/.env
#   - webhook-endpoint aanmaken in het Recall-dashboard (zie melding bij start)
#     en de signing-secret (whsec_...) als RECALL_WEBHOOK_SECRET in app/.env
#   - in desktop-shell/: npm install   (eenmalig)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT/app"
SHELL_DIR="$ROOT/desktop-shell"
ENV_FILE="$APP_DIR/.env"
APP_PORT=3200
LOG_DIR="$ROOT/.desktop-test-logs"
mkdir -p "$LOG_DIR"

g() { printf "\033[32m%s\033[0m\n" "$*"; }
y() { printf "\033[33m%s\033[0m\n" "$*"; }
r() { printf "\033[31m%s\033[0m\n" "$*"; }

APP_PID=""; TUNNEL_PID=""; SHELL_PID=""

set_env_var() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

cleanup() {
  echo ""
  y "Afsluiten… shell, app en tunnel stoppen."
  [ -n "$SHELL_PID" ]  && kill "$SHELL_PID"  2>/dev/null || true
  [ -n "$APP_PID" ]    && kill "$APP_PID"    2>/dev/null || true
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null || true
  set_env_var "APP_URL" "http://localhost:${APP_PORT}"
  g "Klaar."
  exit 0
}
trap cleanup INT TERM

# ── 0. checks ────────────────────────────────────────────────────────────────
command -v cloudflared >/dev/null || { r "cloudflared ontbreekt (brew install cloudflared)"; exit 1; }
[ -f "$ENV_FILE" ] || { r "app/.env ontbreekt"; exit 1; }

RECALL_KEY="$(grep '^RECALL_API_KEY=' "$ENV_FILE" | cut -d= -f2- || true)"
if [ -z "$RECALL_KEY" ]; then
  y "⚠ RECALL_API_KEY is leeg in app/.env — meeting-detectie werkt, maar"
  y "  opnemen start niet (upload-token faalt). Vul de key in voor de volle test."
fi

if [ ! -d "$SHELL_DIR/node_modules" ]; then
  y "▸ desktop-shell dependencies installeren (eenmalig)…"
  (cd "$SHELL_DIR" && npm install)
fi

# ── 1. tunnel ────────────────────────────────────────────────────────────────
g "▸ 1/3  Cloudflare-tunnel starten (voor Recall/AssemblyAI-webhooks)…"
TUNNEL_LOG="$LOG_DIR/tunnel.log"
cloudflared tunnel --url "http://localhost:${APP_PORT}" --no-autoupdate > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

PUBLIC_URL=""
for _ in $(seq 1 30); do
  PUBLIC_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1 || true)"
  [ -n "${PUBLIC_URL}" ] && break
  sleep 1
done
[ -n "${PUBLIC_URL}" ] || { r "Tunnel-URL niet gevonden (zie $TUNNEL_LOG)"; cleanup; }

set_env_var "APP_URL" "${PUBLIC_URL}"
g "   Tunnel: ${PUBLIC_URL}  →  localhost:${APP_PORT}"
echo ""
y "   ► Zet in het Recall-dashboard (Webhooks) het endpoint op:"
y "     ${PUBLIC_URL}/api/webhooks/recall-sdk"
y "     (quick-tunnel-URL wisselt per run — pas hem elke testrun aan)"
echo ""

# ── 2. app ───────────────────────────────────────────────────────────────────
g "▸ 2/3  App starten op poort ${APP_PORT}…"
(cd "$APP_DIR" && PORT=${APP_PORT} npm start > "$LOG_DIR/app.log" 2>&1) &
APP_PID=$!

for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://localhost:${APP_PORT}" && break
  sleep 1
done
curl -s -o /dev/null "http://localhost:${APP_PORT}" || { r "App komt niet op (zie $LOG_DIR/app.log)"; cleanup; }
g "   App draait: http://localhost:${APP_PORT}"

# ── 3. desktop-shell ─────────────────────────────────────────────────────────
g "▸ 3/3  Desktop-shell starten…"
(cd "$SHELL_DIR" && REPPIC_URL="http://localhost:${APP_PORT}" npm start > "$LOG_DIR/shell.log" 2>&1) &
SHELL_PID=$!

echo ""
g "Alles draait. Testflow:"
echo "  1. log in de desktop-shell in als verkoper"
echo "  2. start een Zoom/Meet/Teams-call op deze Mac"
echo "  3. de shell detecteert de meeting → bevestig 'Opnemen' (eerste keer)"
echo "  4. beëindig de call → webhook → transcript → analyse → dashboard"
echo ""
echo "Logs: $LOG_DIR/{tunnel,app,shell}.log   ·   Stoppen: Ctrl+C"
wait

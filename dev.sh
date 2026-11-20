#!/usr/bin/env bash
# Levanta la base de datos, el backend y el frontend de MiniBank (Linux/macOS).
#   ./dev.sh        levanta todo; Ctrl+C detiene backend y frontend (la DB queda corriendo)
#   ./dev.sh stop   detiene la base de datos
#   ./dev.sh reset  borra los datos de la DB (vuelve al seed de demo)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

log() { printf '\033[1;36m[minibank]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[minibank]\033[0m %s\n' "$*" >&2; exit 1; }

compose() { (cd "$BACKEND" && docker compose "$@"); }

case "${1:-}" in
  stop)
    log "Deteniendo la base de datos..."
    compose down
    exit 0
    ;;
  reset)
    log "Borrando la base de datos y sus datos..."
    compose down -v
    exit 0
    ;;
  "" ) ;;
  *) fail "Uso: ./dev.sh [stop|reset]" ;;
esac

for cmd in docker java pnpm; do
  command -v "$cmd" >/dev/null 2>&1 || fail "No se encontró '$cmd' en el PATH."
done
docker info >/dev/null 2>&1 || fail "Docker no está corriendo."

for port in 8080 5173; do
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null || (exec 3<>"/dev/tcp/::1/$port") 2>/dev/null; then
    fail "El puerto $port ya está en uso (¿MiniBank ya está corriendo?)."
  fi
done

[[ -f "$BACKEND/.env" ]] || { cp "$BACKEND/.env.example" "$BACKEND/.env"; log "Creado backend/.env"; }
[[ -f "$FRONTEND/.env" ]] || { cp "$FRONTEND/.env.example" "$FRONTEND/.env"; log "Creado frontend/.env"; }

log "Levantando PostgreSQL y esperando a que esté listo..."
compose up -d --wait

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  log "Instalando dependencias del frontend..."
  (cd "$FRONTEND" && pnpm install)
fi

set -m
pids=()

cleanup() {
  trap - INT TERM EXIT
  log "Deteniendo backend y frontend..."
  for pid in "${pids[@]}"; do
    kill -TERM -- "-$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  log "Listo. La DB sigue corriendo (./dev.sh stop para detenerla)."
}
trap cleanup INT TERM EXIT

log "Iniciando backend en http://localhost:8080 ..."
(cd "$BACKEND" && exec ./mvnw spring-boot:run) &
pids+=($!)

log "Iniciando frontend en http://localhost:5173 ..."
(cd "$FRONTEND" && exec pnpm dev) &
pids+=($!)

log "Swagger: http://localhost:8080/swagger-ui/index.html"
log "Ctrl+C para detener."

wait -n "${pids[@]}" || true

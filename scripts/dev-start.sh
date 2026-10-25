#!/usr/bin/env bash
# Start the whole app (PostgreSQL in Docker, API and web on the host) in the background and wait
# until it is healthy. Reuses an instance that is already running. Never installs Node, pnpm or Docker.
# Exit 0 only when http://localhost:5330/api/health answers {"status":"ok"} (web proxy → API → DB).
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

API_PORT=3330
WEB_PORT=5330
HEALTH_URL="http://localhost:${WEB_PORT}/api/health"
STATE_DIR="$repo_root/.dev"
LOG_FILE="$STATE_DIR/dev.log"
PID_FILE="$STATE_DIR/dev.pid"
TIMEOUT_SECONDS="${DEV_START_TIMEOUT:-90}"

with_node() { "$repo_root/scripts/with-node.sh" "$@"; }
healthy() { curl -sf --max-time 2 "$HEALTH_URL" 2>/dev/null | grep -q '"status":"ok"'; }
print_urls() {
  echo "  web:     http://localhost:${WEB_PORT}"
  echo "  api:     http://localhost:${API_PORT}/api"
  echo "  openapi: http://localhost:${API_PORT}/api/docs"
  echo "  logs:    $LOG_FILE"
}

if healthy; then
  echo "already running"
  print_urls
  exit 0
fi

# Prerequisites: report what the human has to do, never fix it here.
if ! with_node node --version >/dev/null; then
  exit 1 # with-node.sh already printed the exact command (nvm install)
fi
if ! with_node pnpm --version >/dev/null 2>&1; then
  echo "pnpm is not available for Node $(tr -d '[:space:]' < .nvmrc). Run: nvm use && corepack enable" >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop (or the Docker daemon) and run this again." >&2
  exit 1
fi

if [ ! -f node_modules/.modules.yaml ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then
  echo "Installing dependencies..."
  with_node pnpm install --frozen-lockfile
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

with_node pnpm db:up
with_node pnpm db:migrate

for port in "$API_PORT" "$WEB_PORT"; do
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [ -n "$pid" ]; then
    echo "port $port is in use by pid $pid: $(ps -o command= -p "$pid" | cut -c1-160)" >&2
    echo "Stop that process (if it is a stale Drum Tutor run: scripts/dev-stop.sh) and run this again." >&2
    exit 1
  fi
done

mkdir -p "$STATE_DIR"
# Own process group (set -m), so dev-stop.sh can stop turbo, tsx and vite together.
set -m
nohup "$repo_root/scripts/with-node.sh" pnpm dev >"$LOG_FILE" 2>&1 &
dev_pid=$!
set +m
echo "$dev_pid" >"$PID_FILE"

echo "Starting (pid $dev_pid), waiting up to ${TIMEOUT_SECONDS}s for $HEALTH_URL ..."
for _ in $(seq 1 "$TIMEOUT_SECONDS"); do
  if healthy; then
    echo "ready"
    print_urls
    exit 0
  fi
  if ! kill -0 "$dev_pid" 2>/dev/null; then
    echo "failed: pnpm dev exited early. Last log lines:" >&2
    tail -n 50 "$LOG_FILE" >&2
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 1
done

echo "failed: not healthy after ${TIMEOUT_SECONDS}s. Last log lines:" >&2
tail -n 50 "$LOG_FILE" >&2
# Do not leave a half-started app holding the ports for the next attempt.
kill -- "-$dev_pid" 2>/dev/null || true
rm -f "$PID_FILE"
exit 1

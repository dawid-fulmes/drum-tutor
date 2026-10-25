#!/usr/bin/env bash
# Stop the API and web dev servers started by dev-start.sh. The database keeps running
# (stop it with `pnpm db:down`). Exit 0 only when ports 3330 and 5330 are free.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$repo_root/.dev/dev.pid"
PORTS=(3330 5330)

if [ -f "$PID_FILE" ]; then
  pgid="$(cat "$PID_FILE")"
  # The pid file may be stale: only stop the group if its leader still runs in this repo.
  if kill -0 -- "-$pgid" 2>/dev/null &&
    lsof -a -p "$pgid" -d cwd -Fn 2>/dev/null | grep -qx "n$repo_root"; then
    kill -- "-$pgid" 2>/dev/null || true
    for _ in $(seq 1 10); do
      kill -0 -- "-$pgid" 2>/dev/null || break
      sleep 1
    done
    kill -9 -- "-$pgid" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

for port in "${PORTS[@]}"; do
  pid="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [ -n "$pid" ]; then
    echo "port $port is still in use by pid $pid: $(ps -o command= -p "$pid" | cut -c1-160)" >&2
    echo "It was not started by scripts/dev-start.sh; stop it manually." >&2
    exit 1
  fi
done

echo "stopped (ports ${PORTS[*]} are free; the database is still running — pnpm db:down stops it)"

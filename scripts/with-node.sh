#!/usr/bin/env bash
# Run a command under the Node version pinned in .nvmrc, from any directory.
# Agents' shells do not keep `nvm use` between commands, so every command goes through this.
# Usage: scripts/with-node.sh <command> [args...]
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node_version="$(tr -d '[:space:]' < "$repo_root/.nvmrc")"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

# nvm's own installer puts nvm.sh in $NVM_DIR; Homebrew keeps it under its prefix.
nvm_script=""
for candidate in "$NVM_DIR/nvm.sh" /opt/homebrew/opt/nvm/nvm.sh /usr/local/opt/nvm/nvm.sh; do
  if [ -s "$candidate" ]; then
    nvm_script="$candidate"
    break
  fi
done
if [ -z "$nvm_script" ]; then
  echo "nvm not found. Install nvm: https://github.com/nvm-sh/nvm" >&2
  exit 1
fi

# shellcheck source=/dev/null
. "$nvm_script" --no-use

if ! nvm ls "$node_version" >/dev/null 2>&1; then
  echo "Node $node_version is not installed. Run: nvm install" >&2
  exit 1
fi

nvm use --silent "$node_version" >/dev/null
exec "$@"

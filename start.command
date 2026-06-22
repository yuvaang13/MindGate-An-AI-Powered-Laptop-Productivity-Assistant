#!/bin/bash
# start.command – Build and launch MindGate (Electron)

set -euo pipefail
IFS=$'\n\t'
unset ELECTRON_RUN_AS_NODE

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
ELECTRON_DIR="${PROJECT_ROOT}/mindgate-electron"

if [[ ! -d "$ELECTRON_DIR" ]]; then
  log "❌  Directory not found: $ELECTRON_DIR"
  exit 1
fi

log "🔧  Changing to Electron project directory..."
cd "$ELECTRON_DIR"

log "📦  Installing npm dependencies..."
npm install --ignore-scripts 2>/dev/null || true

if [[ ! -f "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" && ! -f "node_modules/electron/dist/electron" ]]; then
  log "⬇️  Downloading Electron binary..."
  ELECTRON_VER=$(node -e "console.log(require('./node_modules/electron/package.json').version)")
  ARCH=$(node -e "console.log(process.arch)")
  PLATFORM=$(node -e "console.log(process.platform)")
  if [[ "$PLATFORM" == "darwin" ]]; then
    curl -L -o /tmp/electron-temp.zip "https://github.com/electron/electron/releases/download/v${ELECTRON_VER}/electron-v${ELECTRON_VER}-${PLATFORM}-${ARCH}.zip"
    mkdir -p node_modules/electron/dist
    unzip -oq /tmp/electron-temp.zip -d node_modules/electron/dist/
    printf 'Electron.app/Contents/MacOS/Electron' > node_modules/electron/path.txt
    rm -f /tmp/electron-temp.zip
    log "✅  Electron binary installed"
  fi
fi

log "🏗️  Building the project..."
npm run build

log "🚀  Launching MindGate..."

SHUTDOWN_IN_PROGRESS=0
ELECTRON_PID=""
READY_FILE="/tmp/mindgate-ready"

terminate_pid() {
  local pid="$1"
  local pgid="${2:-}"
  local signal="$3"

  if [[ -n "$pgid" && "$pgid" != "$$" ]]; then
    kill -"$signal" "-$pgid" 2>/dev/null || kill -"$signal" "$pid" 2>/dev/null || true
  else
    kill -"$signal" "$pid" 2>/dev/null || true
  fi
}

cleanup() {
  if [[ "$SHUTDOWN_IN_PROGRESS" -eq 1 ]]; then
    return
  fi
  SHUTDOWN_IN_PROGRESS=1

  if [[ -z "${ELECTRON_PID:-}" ]]; then
    return
  fi

  if ! ps -p "$ELECTRON_PID" >/dev/null 2>&1; then
    return
  fi

  log "🛑  Shutting down MindGate..."

  local pgid
  pgid="$(ps -o pgid= -p "$ELECTRON_PID" 2>/dev/null | tr -d ' ' || true)"

  terminate_pid "$ELECTRON_PID" "$pgid" TERM
  sleep 5

  if ps -p "$ELECTRON_PID" >/dev/null 2>&1; then
    terminate_pid "$ELECTRON_PID" "$pgid" KILL
  fi

  wait "$ELECTRON_PID" 2>/dev/null || true
  ELECTRON_PID=""
}

trap 'cleanup' EXIT HUP INT TERM

node scripts/run-electron.mjs &
ELECTRON_PID=$!
log "📱  MindGate launcher started (PID: $ELECTRON_PID)"

log "⏳  Waiting for MindGate bridge to be ready..."
MAX_WAIT=30
WAITED=0
while [[ ! -f "$READY_FILE" ]]; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    log "⚠️  Bridge did not signal ready within ${MAX_WAIT}s — check mindgate-debug.log in /tmp"
    break
  fi
done

if [[ -f "$READY_FILE" ]]; then
  log "✅  MindGate bridge is ready"
  rm -f "$READY_FILE"
fi

if [[ -n "${ELECTRON_PID:-}" ]]; then
  wait "$ELECTRON_PID"
fi

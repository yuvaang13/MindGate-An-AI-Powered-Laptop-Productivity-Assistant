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

# Track if we're shutting down
SHUTDOWN_IN_PROGRESS=0

# Trap signals to ensure Electron and all child processes terminate when this script exits
cleanup() {
  if [[ "$SHUTDOWN_IN_PROGRESS" -eq 1 ]]; then
    return
  fi
  SHUTDOWN_IN_PROGRESS=1
  log "🛑  Shutting down MindGate..."
  if [[ -n "${ELECTRON_PID:-}" ]]; then
    # Kill entire process group (negative PID) for complete cleanup
    kill -TERM -"$ELECTRON_PID" 2>/dev/null || true
    sleep 1
    # Force kill if still running
    kill -KILL -"$ELECTRON_PID" 2>/dev/null || true
  fi
}

trap 'cleanup' EXIT INT TERM

# Start Electron in background - process group will be killed on exit
npx electron . &
ELECTRON_PID=$!
log "📱  MindGate started (PID: $ELECTRON_PID)"
wait "$ELECTRON_PID"
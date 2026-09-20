#!/usr/bin/env bash
# Build a downloadable Mac zip of dooogs OS for the website.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/desktop"
OUT="$ROOT/public/downloads"
mkdir -p "$OUT"

cd "$DESKTOP"
npm install
npm run build:ui

set +e
npx electron-builder --mac dir -c.mac.identity=null
BUILD_OK=$?
set -e

APP_DIR="$(find "$DESKTOP/release" -maxdepth 4 -type d -name 'dooogs OS.app' 2>/dev/null | head -1 || true)"
if [[ "$BUILD_OK" -eq 0 && -n "${APP_DIR:-}" ]]; then
  rm -f "$OUT/dooogs-os-mac.zip"
  ditto -c -k --sequesterRsrc --keepParent "$APP_DIR" "$OUT/dooogs-os-mac.zip"
  echo "Wrote app bundle $OUT/dooogs-os-mac.zip"
  ls -lh "$OUT/dooogs-os-mac.zip"
  exit 0
fi

# Fallback: zip runnable project (includes deps for start)
TMP="$(mktemp -d)"
mkdir -p "$TMP/dooogs-os"
rsync -a --exclude release --exclude .git "$DESKTOP/" "$TMP/dooogs-os/"
cat > "$TMP/dooogs-os/START.command" <<'CMD'
#!/bin/bash
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
npm install
npm run dev
CMD
chmod +x "$TMP/dooogs-os/START.command"
rm -f "$OUT/dooogs-os-mac.zip"
ditto -c -k --sequesterRsrc --keepParent "$TMP/dooogs-os" "$OUT/dooogs-os-mac.zip"
rm -rf "$TMP"
echo "Wrote developer pack $OUT/dooogs-os-mac.zip"
ls -lh "$OUT/dooogs-os-mac.zip"

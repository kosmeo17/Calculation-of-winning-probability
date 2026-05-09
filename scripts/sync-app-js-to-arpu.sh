#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CANON="$ROOT/app.js"
DEST="$ROOT/../ARPU计算/app.js"

if [[ ! -f "$CANON" ]]; then
  echo "error: missing $CANON" >&2
  exit 1
fi

if [[ -L "$DEST" ]]; then
  echo "OK: $DEST is a symlink (already synced with canonical app.js)."
  exit 0
fi

if [[ -e "$DEST" ]]; then
  cp "$CANON" "$DEST"
  echo "Copied canonical app.js -> $DEST (was a regular file)."
  echo "Tip: replace with symlink for auto-sync: ln -sf ../Calculation-of-winning-probability/app.js \"$DEST\""
else
  mkdir -p "$(dirname "$DEST")"
  ln -sf "../Calculation-of-winning-probability/app.js" "$DEST"
  echo "Created symlink $DEST -> canonical app.js."
fi

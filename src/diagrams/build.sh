#!/usr/bin/env bash
# Build the metamodel diagrams (repo root: specy-PRD-metamodel.svg, specy-SysReq-metamodel.svg).
# Requires python3 + network on first run (fonts and fontTools are fetched into git-ignored caches).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
FONTS="$DIR/.fonts"
VENV="$DIR/.venv"

if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet fonttools brotli
fi

if [ ! -f "$FONTS/EBGaramond-Bold.ttf" ]; then
  mkdir -p "$FONTS"
  css="$(curl -fsSL -A 'Mozilla/5.0 (X11; Linux x86_64)' \
    'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@700&family=IBM+Plex+Sans+Condensed:wght@400;700')"
  urls=($(printf '%s' "$css" | grep -o 'https://[^)]*\.ttf'))
  # css2 lists the families in the order requested: Garamond 700, Plex 400, Plex 700
  curl -fsSL -o "$FONTS/EBGaramond-Bold.ttf" "${urls[0]}"
  curl -fsSL -o "$FONTS/IBMPlexSansCondensed-Regular.ttf" "${urls[1]}"
  curl -fsSL -o "$FONTS/IBMPlexSansCondensed-Bold.ttf" "${urls[2]}"
fi

cd "$DIR"
"$VENV/bin/python" prd_metamodel.py "$ROOT/specy-PRD-metamodel.svg"
"$VENV/bin/python" sysreq_metamodel.py "$ROOT/specy-SysReq-metamodel.svg"
"$VENV/bin/python" arch_metamodel.py "$ROOT/specy-Arch-metamodel.svg"

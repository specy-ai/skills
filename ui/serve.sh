#!/usr/bin/env bash
# Serve the Specy Domain Navigator prototype.
cd "$(dirname "$0")"
PORT="${1:-8347}"
echo "Specy Domain Navigator → http://0.0.0.0:${PORT}"
exec python3 -m http.server --bind 0.0.0.0 "$PORT"

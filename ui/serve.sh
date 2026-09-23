#!/usr/bin/env bash
# Serve the Specy Domain Navigator prototype.
# Every response carries `Cache-Control: no-cache`: the browser revalidates
# each file on every load (a cheap 304 when unchanged), so an edited script,
# model or vendor bundle is never mixed with a stale cached copy.
cd "$(dirname "$0")"
PORT="${1:-8347}"
echo "Specy Domain Navigator → http://0.0.0.0:${PORT}"
exec python3 - "$PORT" <<'PY'
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


http.server.ThreadingHTTPServer(("0.0.0.0", int(sys.argv[1])), NoCacheHandler).serve_forever()
PY

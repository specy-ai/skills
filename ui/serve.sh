#!/usr/bin/env bash
# Serve the Specy Domain Navigator prototype.
# Every response carries `Cache-Control: no-cache`: the browser revalidates
# each file on every load (a cheap 304 when unchanged), so an edited script,
# model or vendor bundle is never mixed with a stale cached copy.
#
# The two small APIs the app boots from (see app.js) are served here too:
#   GET /api/models              → { tenant, files: [{ org, name, kind, size, uploadedAt }] }
#   GET /api/models/local/<name> → the file (text/plain)
#   GET /api/me                  → a local developer, no sign-out
# listing every .domain / .sysreq / .arch of this folder under the one local
# organization "local" — the same contract the hosted Worker (hosting/) serves
# from the files published for a tenant.
cd "$(dirname "$0")"
PORT="${1:-8347}"
echo "Specy Domain Navigator → http://0.0.0.0:${PORT}"
exec python3 - "$PORT" <<'PY'
import datetime
import http.server
import json
import os
import re
import sys
import urllib.parse

ORG = "local"
TENANT = {"id": ORG, "name": "Local files"}
ME = {"user": {"name": "Local developer", "email": "dev@example.com", "role": "admin"}, "tenant": TENANT, "logoutUrl": None}
MODEL_NAME = re.compile(r"^[A-Za-z0-9._-]+\.(domain|arch|sysreq)$")


def is_model(name):
    # Cloud-sync conflict copies (`x_<device>_<date>_Conflict.domain`) are
    # leftovers next to the real file, not a model to load twice.
    return bool(MODEL_NAME.match(name)) and "_Conflict." not in name and os.path.isfile(name)


def list_models():
    files = []
    for name in sorted(os.listdir(".")):
        if not is_model(name):
            continue
        st = os.stat(name)
        files.append({
            "org": ORG,
            "name": name,
            "kind": MODEL_NAME.match(name).group(1),
            "size": st.st_size,
            "uploadedAt": datetime.datetime.fromtimestamp(st.st_mtime, datetime.timezone.utc).isoformat(),
        })
    return files


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def guess_type(self, path):
        if path.endswith((".domain", ".arch", ".sysreq")):
            return "text/plain; charset=utf-8"
        return super().guess_type(path)

    def send_json(self, obj):
        body = json.dumps(obj).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == "/api/models":
            return self.send_json({"tenant": TENANT, "files": list_models()})
        if path == "/api/me":
            return self.send_json(ME)
        m = re.match(r"^/api/models/([^/]+)/([^/]+)$", path)
        if m:
            name = urllib.parse.unquote(m.group(2))
            if m.group(1) != ORG or not is_model(name):
                self.send_error(404)
                return
            self.path = "/" + urllib.parse.quote(name)
        super().do_GET()


http.server.ThreadingHTTPServer(("0.0.0.0", int(sys.argv[1])), Handler).serve_forever()
PY

#!/usr/bin/env bash
# Creates a tenant — a client, the unit of isolation (proposals/navigator-hosting.md §3.11):
#   tenant:<id> → { id, name, createdAt }
#
#   scripts/create-tenant.sh [--remote] <id> "<name>"
#
# Writes the local KV of `wrangler dev` by default; --remote writes the deployed
# namespace. The readers come next: scripts/invite.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
MODE=--local
if [ "${1:-}" = "--remote" ]; then MODE=--remote; shift; fi
[ $# -eq 2 ] || { echo "usage: $0 [--remote] <id> \"<name>\"" >&2; exit 2; }
ID="$1"; NAME="$2"
printf '%s' "$ID" | grep -Eq '^[a-z0-9][a-z0-9-]{0,63}$' || { echo "create-tenant: id must match ^[a-z0-9][a-z0-9-]{0,63}$" >&2; exit 2; }
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
VALUE="$(python3 -c 'import json, sys; print(json.dumps({"id": sys.argv[1], "name": sys.argv[2], "createdAt": sys.argv[3]}))' "$ID" "$NAME" "$NOW")"
"$HERE/node_modules/.bin/wrangler" --cwd "$HERE" kv key put "tenant:$ID" "$VALUE" --binding APP_AUTH "$MODE" >/dev/null
echo "create-tenant: tenant:$ID written ($MODE)"

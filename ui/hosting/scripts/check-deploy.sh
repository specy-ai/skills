#!/usr/bin/env bash
# Refuses to deploy a configuration that must never reach production
# (proposals/navigator-hosting.md, §12.10). Run by `npm run deploy` after build.sh.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CONF="$HERE/wrangler.jsonc"
fail() { echo "check-deploy: $*" >&2; exit 1; }

if grep -q 'DEV_IDENTITY_EMAIL' "$CONF"; then fail "DEV_IDENTITY_EMAIL must only live in .dev.vars"; fi
if grep -q 'REPLACE_WITH_NAMESPACE_ID' "$CONF"; then fail "kv_namespaces: create it once (npx wrangler kv namespace create APP_AUTH) and paste its id in wrangler.jsonc"; fi
grep -Eq '"run_worker_first":[[:space:]]*true' "$CONF" || fail "run_worker_first must be true"
grep -Eq '"workers_dev":[[:space:]]*false' "$CONF" || fail "workers_dev must be false"
grep -Eq '"preview_urls":[[:space:]]*false' "$CONF" || fail "preview_urls must be false"
grep -Eq '"binding":[[:space:]]*"MODELS"' "$CONF" || fail "r2_buckets: the MODELS binding is missing (create the bucket once: npx wrangler r2 bucket create specy-models)"
if grep -Eq '"ACCESS_(TEAM_DOMAIN|AUD)":[[:space:]]*""' "$CONF"; then
  echo "check-deploy: warning: ACCESS_TEAM_DOMAIN / ACCESS_AUD are empty — nobody can sign in until step 2 fills them" >&2
fi
[ -d "$HERE/dist/public" ] || fail "dist/public missing: run build.sh first"
found="$(find "$HERE/dist/public" \( -name '*.arch' -o -name '*.domain' -o -name '*.sysreq' -o -type l \) -print)"
[ -z "$found" ] || fail "model files or symlinks in dist/public: $found"
echo "check-deploy: ok"

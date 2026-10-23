#!/usr/bin/env bash
# Publishes model files for an organization of a tenant (proposals/navigator-hosting.md §3.2, §3.16):
#   bucket specy-models, key tenants/<tenant>/models/<org>/<name>
#
#   scripts/publish-models.sh [--remote] <tenant> <org> <file>...
#   scripts/publish-models.sh [--remote] --delete <tenant> <org> <name>...
#
# <org> is the slug readers are granted with `invite.sh --org`; by convention
# the `organization` name of the file. The mission's git repository stays the
# source of truth and the bucket is its published projection: publish again
# after a change, delete what was renamed or withdrawn. Writes the local R2 of
# `wrangler dev` by default; --remote writes the deployed bucket.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
W="$HERE/node_modules/.bin/wrangler"
usage() { echo "usage: $0 [--remote] [--delete] <tenant> <org> <file|name>..." >&2; exit 2; }
MODE=--local; ACTION=put
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) MODE=--remote; shift ;;
    --delete) ACTION=delete; shift ;;
    --*) usage ;;
    *) break ;;
  esac
done
[ $# -ge 3 ] || usage
TENANT="$1"; ORG="$2"; shift 2
SLUG='^[a-z0-9][a-z0-9-]{0,63}$'                   # src/model-name.js ORG
NAME_RE='^[A-Za-z0-9._-]+\.(domain|arch|sysreq)$'  # src/model-name.js NAME
printf '%s' "$TENANT" | grep -Eq "$SLUG" || { echo "publish-models: tenant must match $SLUG" >&2; exit 2; }
printf '%s' "$ORG" | grep -Eq "$SLUG" || { echo "publish-models: organization must match $SLUG: $ORG" >&2; exit 2; }
BUCKET="$(sed -n 's/.*"bucket_name": *"\([^"]*\)".*/\1/p' "$HERE/wrangler.jsonc" | head -1)"
[ -n "$BUCKET" ] || { echo "publish-models: no r2_buckets.bucket_name in wrangler.jsonc" >&2; exit 1; }

# every argument is checked before the bucket is touched
for f in "$@"; do
  name="$(basename "$f")"
  printf '%s' "$name" | grep -Eq "$NAME_RE" || { echo "publish-models: not a model file name (<name>.domain|.arch|.sysreq): $name" >&2; exit 2; }
  if [ "$ACTION" = put ]; then
    [ -f "$f" ] && [ ! -L "$f" ] || { echo "publish-models: not a regular file: $f" >&2; exit 2; }
    [ -s "$f" ] || { echo "publish-models: empty file: $f" >&2; exit 2; }
  fi
done

for f in "$@"; do
  name="$(basename "$f")"; key="tenants/$TENANT/models/$ORG/$name"
  if [ "$ACTION" = put ]; then
    abs="$(cd "$(dirname "$f")" && pwd)/$name"   # wrangler --cwd would resolve a relative --file elsewhere
    "$W" --cwd "$HERE" r2 object put "$BUCKET/$key" --file "$abs" --content-type "text/plain; charset=utf-8" "$MODE" >/dev/null
    echo "publish-models: put $key from $f ($MODE)"
  else
    "$W" --cwd "$HERE" r2 object delete "$BUCKET/$key" "$MODE" >/dev/null
    echo "publish-models: deleted $key ($MODE)"
  fi
done

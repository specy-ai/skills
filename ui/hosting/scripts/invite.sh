#!/usr/bin/env bash
# Registers a reader of a tenant (proposals/navigator-hosting.md §3.11, §3.16, §12.6):
#   user:<uid>                   → the record (role, organizations, status active)
#   user-by-email:<email>        → <uid>
#   user-by-tenant:<tid>:<uid>   → index for listings
# and, deployed, adds the e-mail to the Zero Trust list the Access policy
# includes (scripts/zero-trust.sh), so the login page lets the person in.
#
#   scripts/invite.sh [--remote] [--kv-only] <tenant> <email> "<name>" [--role admin|member] [--org <org>]...
#
# Without --org the reader sees every organization of the tenant; an admin
# always does. Writes the local KV of `wrangler dev` by default, where there
# is no Access; --remote writes the deployed namespace and the Access list
# (CLOUDFLARE_API_TOKEN), --kv-only leaves the list to be edited by hand.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
W="$HERE/node_modules/.bin/wrangler"
# shellcheck source=zero-trust.sh
. "$HERE/scripts/zero-trust.sh"
usage() { echo "usage: $0 [--remote] [--kv-only] <tenant> <email> \"<name>\" [--role admin|member] [--org <org>]..." >&2; exit 2; }
MODE=--local; ACCESS=yes
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) MODE=--remote; shift ;;
    --kv-only) ACCESS=no; shift ;;
    --*) usage ;;
    *) break ;;
  esac
done
[ $# -ge 3 ] || usage
TENANT="$1"; EMAIL="$(printf '%s' "$2" | tr 'A-Z' 'a-z')"; NAME="$3"; shift 3
ROLE=member; ORGS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --role) ROLE="${2:-}"; shift 2 ;;
    --org) ORGS="$ORGS ${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done
printf '%s' "$TENANT" | grep -Eq '^[a-z0-9][a-z0-9-]{0,63}$' || { echo "invite: tenant must match ^[a-z0-9][a-z0-9-]{0,63}$" >&2; exit 2; }
printf '%s' "$EMAIL" | grep -Eq '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' || { echo "invite: not an e-mail address: $EMAIL" >&2; exit 2; }
[ "$ROLE" = admin ] || [ "$ROLE" = member ] || { echo "invite: role must be admin or member" >&2; exit 2; }
for o in $ORGS; do
  printf '%s' "$o" | grep -Eq '^[a-z0-9][a-z0-9-]{0,63}$' || { echo "invite: organization must match ^[a-z0-9][a-z0-9-]{0,63}$: $o" >&2; exit 2; }
done
[ "$MODE" = --remote ] || ACCESS=no   # wrangler dev has no Access in front of it

kv() { "$W" --cwd "$HERE" kv key "$@" --binding APP_AUTH "$MODE"; }
# whether a key exists — through a listing: `kv key get` prints "Value not found" and exits 0 on a miss
exists() {
  kv list --prefix "$1" 2>/dev/null | python3 -c '
import json, sys
out = sys.stdin.read()
keys = json.loads(out[out.index("["):]) if "[" in out else []
sys.exit(0 if any(k.get("name") == sys.argv[1] for k in keys) else 1)' "$1"
}

# every check before any write: the token and the list, then the record
LIST_ID=""
if [ "$ACCESS" = yes ]; then
  zt_require invite
  LIST_ID="$(zt_list_id)" || exit 1
fi
if exists "user-by-email:$EMAIL"; then
  echo "invite: $EMAIL is already registered" >&2; exit 1
fi

# the Access list first — adding twice is harmless, a record without the list is a reader who cannot log in
if [ "$ACCESS" = yes ]; then
  if zt_list_has "$LIST_ID" "$EMAIL"; then
    echo "invite: $EMAIL already in the Access list $ZT_LIST"
  else
    zt_list_append "$LIST_ID" "$EMAIL" || exit 1
    echo "invite: $EMAIL added to the Access list $ZT_LIST"
  fi
fi

USER_ID="$(uuidgen | tr 'A-Z' 'a-z')"
NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
# shellcheck disable=SC2086
VALUE="$(python3 - "$USER_ID" "$TENANT" "$EMAIL" "$NAME" "$ROLE" "$NOW" $ORGS <<'PY'
import json, sys
uid, tenant, email, name, role, now, *orgs = sys.argv[1:]
print(json.dumps({"id": uid, "tenantId": tenant, "email": email, "name": name, "role": role,
                  "organizations": orgs or ["*"], "status": "active", "createdAt": now, "lastLoginAt": None}))
PY
)"
kv put "user:$USER_ID" "$VALUE" >/dev/null
kv put "user-by-email:$EMAIL" "$USER_ID" >/dev/null
kv put "user-by-tenant:$TENANT:$USER_ID" "1" >/dev/null
echo "invite: $EMAIL registered as $ROLE of $TENANT (organizations: ${ORGS:-*}) — user:$USER_ID ($MODE)"
if [ "$MODE" = --remote ] && [ "$ACCESS" = no ]; then
  echo "invite: add $EMAIL to the Access list $ZT_LIST by hand (--kv-only)" >&2
fi

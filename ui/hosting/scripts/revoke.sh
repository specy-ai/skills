#!/usr/bin/env bash
# Revokes a reader (proposals/navigator-hosting.md §12.6). The record stays,
# with `status: disabled` — the Worker refuses it within KV's 60 s cache, even
# while an Access session is still valid — and, deployed, the e-mail leaves
# the Zero Trust list the Access policy includes and its Access sessions are
# revoked, so the login page refuses it too.
#
#   scripts/revoke.sh [--remote] [--kv-only] <tenant> <email>
#
# <tenant> must be the reader's: a guard against revoking the wrong person.
# The e-mail stays registered (invite.sh refuses it); to reactivate, put the
# record back to `status: active`.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
W="$HERE/node_modules/.bin/wrangler"
# shellcheck source=zero-trust.sh
. "$HERE/scripts/zero-trust.sh"
usage() { echo "usage: $0 [--remote] [--kv-only] <tenant> <email>" >&2; exit 2; }
MODE=--local; ACCESS=yes
while [ $# -gt 0 ]; do
  case "$1" in
    --remote) MODE=--remote; shift ;;
    --kv-only) ACCESS=no; shift ;;
    --*) usage ;;
    *) break ;;
  esac
done
[ $# -eq 2 ] || usage
TENANT="$1"; EMAIL="$(printf '%s' "$2" | tr 'A-Z' 'a-z')"
printf '%s' "$TENANT" | grep -Eq '^[a-z0-9][a-z0-9-]{0,63}$' || { echo "revoke: tenant must match ^[a-z0-9][a-z0-9-]{0,63}$" >&2; exit 2; }
[ "$MODE" = --remote ] || ACCESS=no   # wrangler dev has no Access in front of it

kv() { "$W" --cwd "$HERE" kv key "$@" --binding APP_AUTH "$MODE"; }

LIST_ID=""
if [ "$ACCESS" = yes ]; then
  zt_require revoke
  LIST_ID="$(zt_list_id)" || exit 1
fi

# the record: `kv key get` prints "Value not found" (exit 0) on a miss
USER_ID="$(kv get "user-by-email:$EMAIL" 2>/dev/null || true)"
printf '%s' "$USER_ID" | grep -Eq '^[0-9a-f-]{36}$' || { echo "revoke: $EMAIL is not registered ($MODE)" >&2; exit 1; }
RECORD="$(kv get "user:$USER_ID" 2>/dev/null || true)"
UPDATED="$(python3 - "$RECORD" "$TENANT" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" <<'PY'
import json, sys
raw, tenant, now = sys.argv[1:]
try:
    rec = json.loads(raw)
except ValueError:
    sys.stderr.write("revoke: the user record is missing or not JSON\n"); sys.exit(1)
if rec.get("tenantId") != tenant:
    sys.stderr.write("revoke: %s belongs to tenant %r, not %r\n" % (rec.get("email"), rec.get("tenantId"), tenant)); sys.exit(3)
if rec.get("status") == "disabled":
    sys.stderr.write("revoke: already disabled since %s\n" % rec.get("disabledAt", "?"))
else:
    rec["status"] = "disabled"; rec["disabledAt"] = now
print(json.dumps(rec))
PY
)" || exit $?
kv put "user:$USER_ID" "$UPDATED" >/dev/null
echo "revoke: $EMAIL disabled in $TENANT — user:$USER_ID ($MODE)"

if [ "$ACCESS" = yes ]; then
  if zt_list_has "$LIST_ID" "$EMAIL"; then
    zt_list_remove "$LIST_ID" "$EMAIL" || exit 1
    echo "revoke: $EMAIL removed from the Access list $ZT_LIST"
  else
    echo "revoke: $EMAIL was not in the Access list $ZT_LIST"
  fi
  zt_revoke_user "$EMAIL" || exit 1
  echo "revoke: Access sessions of $EMAIL revoked (effective within a minute)"
elif [ "$MODE" = --remote ]; then
  echo "revoke: remove $EMAIL from the Access list $ZT_LIST and revoke the user in Zero Trust by hand (--kv-only)" >&2
fi

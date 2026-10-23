# Sourced by invite.sh and revoke.sh — the Cloudflare Access half of an
# invitation or a revocation (proposals/navigator-hosting.md §12.4, §12.6):
# the Zero Trust list of e-mails the Access policy includes, and the
# revocation of a reader's Access sessions. Talks to the Cloudflare API with
# CLOUDFLARE_API_TOKEN, an API token kept out of the Worker and of git, with
# two account permissions:
#   Zero Trust: Edit                                              (the list)
#   Access: Organizations, Identity Providers, and Groups: Revoke  (revoke)
# The list is named by APP_ACCESS_LIST (default app-readers); it
# must exist (Zero Trust › My Team › Lists, type Email) and be the Include of
# the Access policy. Expects HERE (the hosting directory) from the caller.
ZT_LIST="${APP_ACCESS_LIST:-app-readers}"
ZT_ACCOUNT=""

# zt_require <script-name>: the token and the account, or exit 1
zt_require() {
  [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "$1: CLOUDFLARE_API_TOKEN is not set (see scripts/zero-trust.sh); --kv-only skips the Access half" >&2; exit 1; }
  ZT_ACCOUNT="$(sed -n 's/.*"account_id": *"\([^"]*\)".*/\1/p' "$HERE/wrangler.jsonc" | head -1)"
  [ -n "$ZT_ACCOUNT" ] || { echo "$1: no account_id in wrangler.jsonc" >&2; exit 1; }
}

# zt_api <method> <path> [json-body] → the API's JSON envelope on stdout when success is true, else exit 1
zt_api() {
  local -a args
  args=(-sS -X "$1" "https://api.cloudflare.com/client/v4/accounts/$ZT_ACCOUNT/$2"
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json")
  [ -z "${3:-}" ] || args+=(--data "$3")
  curl "${args[@]}" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    r = json.loads(raw)
except ValueError:
    sys.stderr.write("cloudflare api: not JSON: " + raw[:200] + "\n"); sys.exit(1)
if not r.get("success"):
    sys.stderr.write("cloudflare api: " + ("; ".join(e.get("message", "") for e in r.get("errors", [])) or "error") + "\n"); sys.exit(1)
sys.stdout.write(raw)'
}

# zt_list_id → the id of the e-mail list, or exit 1
zt_list_id() {
  zt_api GET "gateway/lists" | python3 -c '
import json, sys
name = sys.argv[1]
found = [l for l in (json.load(sys.stdin).get("result") or []) if l.get("name") == name]
if not found:
    sys.stderr.write("zero trust: no list named %r: create it (Zero Trust > My Team > Lists, type Email), include it in the Access policy, or set APP_ACCESS_LIST\n" % name); sys.exit(1)
if (found[0].get("type") or "EMAIL") != "EMAIL":
    sys.stderr.write("zero trust: list %r is of type %s, not EMAIL\n" % (name, found[0].get("type"))); sys.exit(1)
print(found[0]["id"])' "$ZT_LIST"
}

# zt_list_has <list-id> <email> → 0 when the e-mail is in the list, 1 when not, 2 on an API error
zt_list_has() {
  local page=1 verdict
  while :; do
    verdict="$(zt_api GET "gateway/lists/$1/items?page=$page" | python3 -c '
import json, sys
r = json.load(sys.stdin); items = r.get("result") or []; info = r.get("result_info") or {}
if any((i.get("value") or "").strip().lower() == sys.argv[1] for i in items): print("found")
elif items and info.get("total_pages", 1) > info.get("page", 1): print("more")
else: print("absent")' "$2")" || return 2
    case "$verdict" in
      found) return 0 ;;
      more) page=$((page + 1)); [ "$page" -le 200 ] || return 1 ;;
      *) return 1 ;;
    esac
  done
}

zt_list_append() { zt_api PATCH "gateway/lists/$1" "$(python3 -c 'import json, sys; print(json.dumps({"append": [{"value": sys.argv[1]}]}))' "$2")" >/dev/null; }
zt_list_remove() { zt_api PATCH "gateway/lists/$1" "$(python3 -c 'import json, sys; print(json.dumps({"remove": [sys.argv[1]]}))' "$2")" >/dev/null; }
# every Access session of that e-mail, across the applications of the account
zt_revoke_user() { zt_api POST "access/organizations/revoke_user" "$(python3 -c 'import json, sys; print(json.dumps({"email": sys.argv[1]}))' "$1")" >/dev/null; }

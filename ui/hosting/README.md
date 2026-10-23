# Hosted Navigator

The Cloudflare Worker that serves the Navigator (`ui/`) to a client's readers.
Design: `proposals/navigator-hosting.md` (local, git-ignored) — the Access
variant (§12): Cloudflare Access authenticates, the Worker authorizes from its
own user records (KV) and serves the models published for the signed-in tenant
(R2), restricted to the organizations that user may see.

## Status

| Step | What | State |
|---|---|---|
| 1 | Allowlist build of `ui/`, Worker serving the assets behind a gate, model manifest contract, Navigator booting from the manifest | done, deployed |
| 2 | Zero Trust: identity providers, protection of the Worker, policy on a list of e-mails, session (yours, see below) | — |
| 3 | Access JWT validation (`jose`), e-mail → tenant through KV, 403 page, user menu and sign-out, reload on 401 | done; deploy once step 2 and the KV namespace exist |
| 4 | Models in R2 by grant (`publish-models.sh`), the Access list half of `invite.sh`, `revoke.sh` | done; deploy once the bucket exists |
| 5 | CSP, end-to-end tests, checklist | — |
| 6 | First client | — |

## Commands

```bash
npm install
npm run build     # ui/ → dist/public (explicit file list, data.js emptied, .assetsignore)
npm test          # build + vitest (Workers runtime: Access tokens signed by a test key, KV and R2 seeded)
npm run dev       # build + wrangler dev on http://localhost:8787 — needs .dev.vars
npm run deploy    # build + check-deploy.sh + wrangler deploy (custom domain app.specy.ai)
```

`cp .dev.vars.example .dev.vars` once: `wrangler dev` then signs every request
as the development user (tenant `local`, admin, every organization) unless a
user record carries that e-mail. A deployment never carries that variable;
`scripts/check-deploy.sh` refuses it.

Local data lives in `.wrangler/state/`: the scripts below write it when run
without `--remote`, and `wrangler dev` serves it. To see models locally:

```bash
./scripts/create-tenant.sh acme "Acme Mobility"
./scripts/invite.sh acme dev@example.com "Dev Person" --role admin      # the .dev.vars identity
./scripts/publish-models.sh acme retail-media ../../examples/retail-media/*.arch ../../examples/retail-media/*.domain
npm run dev
```

## Scripts

| Script | Does |
|---|---|
| `create-tenant.sh [--remote] <id> "<name>"` | writes `tenant:<id>` |
| `invite.sh [--remote] [--kv-only] <tenant> <email> "<name>" [--role admin\|member] [--org <org>]...` | adds the e-mail to the Access list (remote only), then writes the user record: role, organizations (`*` without `--org`), `status: active` |
| `revoke.sh [--remote] [--kv-only] <tenant> <email>` | `status: disabled` (the Worker refuses within 60 s), then removes the e-mail from the Access list and revokes its Access sessions (remote only) |
| `publish-models.sh [--remote] [--delete] <tenant> <org> <file\|name>...` | puts the files under `tenants/<tenant>/models/<org>/<name>`, or deletes them; refuses a name outside `<name>.domain\|.arch\|.sysreq`, a symlink, an empty file |
| `check-deploy.sh` | refuses a configuration that must not reach production (run by `npm run deploy`) |
| `zero-trust.sh` | sourced by `invite.sh` and `revoke.sh`: the Zero Trust list and the revocation, through the API |

`<org>` is the organization slug (`^[a-z0-9][a-z0-9-]{0,63}$`) readers are
granted with `invite.sh --org`; by convention the `organization` name of the
file. A reader with `--org` sees only those; an admin, or a reader invited
without `--org`, sees every organization of the tenant. Anything else in the
bucket — another key shape, another extension — is never listed nor served.

The Access half needs `CLOUDFLARE_API_TOKEN` in the shell that runs the
script (never in `wrangler.jsonc` or `.dev.vars`): an API token with the two
account permissions **Zero Trust: Edit** (the list) and **Access:
Organizations, Identity Providers, and Groups: Revoke** (revocation). The list
is found by its name, `app-readers` unless `APP_ACCESS_LIST` says
otherwise. Without the token, `--kv-only` writes the record and tells you what
to do in Zero Trust by hand.

## Going live (steps 3 and 4)

1. **The user records.** Once: `npx wrangler kv namespace create APP_AUTH`
   from this directory (so it lands in the Defsquare account of
   `wrangler.jsonc`), paste the id into `kv_namespaces` (the deploy check
   refuses the placeholder).
2. **Cloudflare Access (step 2)**, in Zero Trust:
   - a team domain `<team>.cloudflareaccess.com`, login page named and branded;
   - identity providers: One-time PIN (nothing to configure), Google, Microsoft
     Entra ID (both with the redirect URI `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback`);
   - My Team › Lists: a list **`app-readers`** of type *Email*, empty for now;
   - Workers & Pages › `specy-app` › **Access** › protect this Worker
     (production and previews); session 24 h; a policy *Allow* whose Include is
     that list;
   - from the application's Overview, the **AUD** tag.
3. **Tell the Worker.** In `wrangler.jsonc`: `ACCESS_TEAM_DOMAIN` =
   `https://<team>.cloudflareaccess.com`, `ACCESS_AUD` = the AUD tag.
4. **The bucket.** Once: `npx wrangler r2 bucket create specy-models` (the
   binding in `wrangler.jsonc` names it; a deploy fails while it does not exist).
5. **The API token** for the scripts (My Profile › API Tokens › Create Token,
   custom, the two account permissions above), exported as
   `CLOUDFLARE_API_TOKEN` where you run them.
6. **A tenant and its readers**, remote:
   ```bash
   ./scripts/create-tenant.sh --remote acme "Acme Mobility"
   ./scripts/invite.sh --remote acme ada@acme.example "Ada" --role admin
   ./scripts/invite.sh --remote acme bob@acme.example "Bob" --org acme-mobility   # sees that organization only
   ```
7. **The models**, remote:
   ```bash
   ./scripts/publish-models.sh --remote acme acme-mobility path/to/acme-mobility.domain path/to/acme-landscape.arch
   ```
8. `npm run deploy`, then open `https://app.specy.ai`: the Access login,
   the Navigator with the user menu and the published organizations. An
   address Access lets through that no record names gets the "no access" page.
9. Later: `./scripts/revoke.sh --remote acme bob@acme.example`; publish again
   after a change, `--delete` what was renamed.

## How a request goes

```
Access (login, session, X-Requested-With → 401 for fetches)
  → src/access.js      who? the Access JWT, verified with jose against <team>/cdn-cgi/access/certs
  → src/authorize.js   what? user-by-email → user → tenant in KV; disabled or unknown → 403
  → assets | /api/models (R2 listing by grant, files with ETag and 304) | /api/me (name, tenant, logoutUrl)
```

`ctx.access` is not available to a Worker with static assets, hence the JWT
validation in code; it also keeps the Worker safe if it were ever reachable
without Access.

## Layout

```
build.sh                copies the allowlist of ui/ (+ public-src/) into dist/public; fails on a forbidden file
wrangler.jsonc          assets behind run_worker_first, KV, R2, Access vars, custom domain only
src/index.js            identity → authorization → assets | models | me | 403
src/access.js           the Access JWT (jose), or the development identity
src/authorize.js        e-mail → user → tenant; organizations grant (mayRead)
src/model-name.js       ORG and NAME: the shape of a published key, shared by handler, adapter and publish-models.sh
src/ports.js            UserStore, ModelStore (JSDoc interfaces); src/adapters/{kv,r2}.js implement them; src/context.js assembles
src/handlers/           models.js (manifest + files), me.js, forbidden.js (the 403 page)
src/http.js             responses, headers, navigation detection
public-src/             forbidden.html
scripts/                check-deploy.sh, create-tenant.sh, invite.sh, revoke.sh, publish-models.sh, zero-trust.sh
test/worker.test.js     the Worker in the Workers runtime (29 tests)
```

`dist/`, `node_modules/`, `.wrangler/` and `.dev.vars` are git-ignored.

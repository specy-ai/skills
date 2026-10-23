/* The Worker, called directly with the test environment (@cloudflare/vitest-plugin):
   the gate, Access identities (tokens signed by a test key whose key set the
   tests serve by answering the Worker's outbound fetch — the Worker runs in
   this isolate), the user records in KV, the models in R2 and the grant by
   organization, the manifest contract, the assets. */
import { createExecutionContext, env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../src/index.js";

const TEAM = "https://test.cloudflareaccess.com";   // ACCESS_TEAM_DOMAIN of vitest.config.js
const AUD = "test-aud";                              // ACCESS_AUD
const KID = "test-key";
const NO_DEV = { DEV_IDENTITY_EMAIL: undefined };
const PAGE = { Accept: "text/html,application/xhtml+xml", "Sec-Fetch-Mode": "navigate" };
const XHR = { "X-Requested-With": "XMLHttpRequest" };
let privateKey;

const USERS = [
  { id: "u-ada", tenantId: "acme", email: "ada@acme.example", name: "Ada", role: "admin", organizations: ["*"], status: "active" },
  { id: "u-bob", tenantId: "acme", email: "bob@acme.example", name: "Bob", role: "member", organizations: ["mobility"], status: "active" },
  { id: "u-eve", tenantId: "acme", email: "eve@acme.example", name: "Eve", role: "member", organizations: ["*"], status: "disabled" },
  { id: "u-orphan", tenantId: "nowhere", email: "orphan@acme.example", name: "Orphan", role: "member", status: "active" },
];

/** What publish-models.sh would have put in the bucket, plus keys of other shapes that must stay invisible. */
const MODELS = {
  "tenants/acme/models/mobility/mobility.domain": "organization Mobility { }\n",
  "tenants/acme/models/mobility/mobility-landscape.arch": "organization Mobility { }\n",
  "tenants/acme/models/retail/retail.domain": "organization Retail { }\n",
  "tenants/acme/models/retail/notes.txt": "not a model",            // wrong extension
  "tenants/acme/models/Retail/x.domain": "bad organization slug",
  "tenants/acme/models/loose.domain": "no organization segment",
  "tenants/other/models/mobility/secret.domain": "another tenant's file",
};

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: "RS256", use: "sig" };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url === TEAM + "/cdn-cgi/access/certs") {
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "content-type": "application/json" } });
    }
    return realFetch(input, init);
  };
  await env.APP_AUTH.put("tenant:acme", JSON.stringify({ id: "acme", name: "Acme Mobility" }));
  for (const u of USERS) {
    await env.APP_AUTH.put("user:" + u.id, JSON.stringify(u));
    await env.APP_AUTH.put("user-by-email:" + u.email, u.id);
  }
  for (const [key, text] of Object.entries(MODELS)) {
    await env.MODELS.put(key, text, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
  }
});

/** An Access application token as the team would issue it. */
async function token({ email = "ada@acme.example", aud = AUD, iss = TEAM, expiresIn = 3600, kid = KID } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT(email === null ? { type: "app" } : { email, type: "app" })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(iss).setAudience(aud).setIssuedAt(now).setExpirationTime(now + expiresIn);
  return jwt.sign(privateKey);
}

const call = (path, { env: extraEnv = {}, headers = {}, method = "GET" } = {}) =>
  worker.fetch(new Request("https://app.specy.ai" + path, { method, headers }), { ...env, ...extraEnv }, createExecutionContext());
const asAccess = async (path, opts = {}, tokenOpts = {}) =>
  call(path, { ...opts, env: { ...NO_DEV, ...(opts.env || {}) }, headers: { "Cf-Access-Jwt-Assertion": await token(tokenOpts), ...(opts.headers || {}) } });

describe("without an identity (no Access token, no development identity)", () => {
  for (const path of ["/", "/index.html", "/app.js", "/vendor/specy-diagram-engine.js", "/api/models", "/api/me", "/nothing"]) {
    it(`refuses ${path}`, async () => {
      const res = await call(path, { env: NO_DEV, headers: XHR });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "unauthenticated" });
    });
  }
  it("shows the no-access page to a page load", async () => {
    const res = await call("/", { env: NO_DEV, headers: PAGE });
    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain("No signed-in identity");
    expect(html).not.toContain("{{detail}}");
  });
});

describe("with an Access token", () => {
  it("lets a registered reader in and describes them", async () => {
    const res = await asAccess("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Domain Navigator");
    const me = await (await asAccess("/api/me")).json();
    expect(me).toEqual({
      user: { name: "Ada", email: "ada@acme.example", role: "admin" },
      tenant: { id: "acme", name: "Acme Mobility" },
      logoutUrl: "/cdn-cgi/access/logout",
    });
    const models = await (await asAccess("/api/models")).json();
    expect(models.tenant).toEqual({ id: "acme", name: "Acme Mobility" });
  });

  it("accepts the token from the CF_Authorization cookie too", async () => {
    const res = await call("/api/me", { env: NO_DEV, headers: { Cookie: "other=1; CF_Authorization=" + await token() } });
    expect(res.status).toBe(200);
  });

  it("normalizes the e-mail", async () => {
    const res = await asAccess("/api/me", {}, { email: " Ada@Acme.example " });
    expect((await res.json()).user.email).toBe("ada@acme.example");
  });

  it("rejects a reader nobody invited: JSON for a fetch, the page for a page load", async () => {
    const fetchRes = await asAccess("/api/models", { headers: XHR }, { email: "nobody@acme.example" });
    expect(fetchRes.status).toBe(403);
    expect(await fetchRes.json()).toEqual({ error: "unknown-user" });
    const pageRes = await asAccess("/", { headers: PAGE }, { email: "<nobody>@acme.example" });
    expect(pageRes.status).toBe(403);
    const html = await pageRes.text();
    expect(html).toContain("&lt;nobody&gt;@acme.example");   // escaped
    expect(html).not.toContain("<nobody>");
    expect(html).toContain("/cdn-cgi/access/logout");
  });

  it("rejects a disabled reader and one whose tenant does not exist", async () => {
    expect((await asAccess("/api/me", {}, { email: "eve@acme.example" })).status).toBe(403);
    expect((await asAccess("/api/me", {}, { email: "orphan@acme.example" })).status).toBe(403);
  });

  it("rejects an expired token, a wrong audience, a wrong issuer, an unknown key, a service token, garbage", async () => {
    expect((await asAccess("/api/me", {}, { expiresIn: -60 })).status).toBe(403);
    expect((await asAccess("/api/me", {}, { aud: "another-app" })).status).toBe(403);
    expect((await asAccess("/api/me", {}, { iss: "https://other.cloudflareaccess.com" })).status).toBe(403);
    expect((await asAccess("/api/me", {}, { kid: "unknown-key" })).status).toBe(403);
    expect((await asAccess("/api/me", {}, { email: null })).status).toBe(403);
    expect((await call("/api/me", { env: NO_DEV, headers: { "Cf-Access-Jwt-Assertion": "not.a.token" } })).status).toBe(403);
  });

  it("never falls back to the development identity when a token is present", async () => {
    const res = await call("/api/me", { headers: { "Cf-Access-Jwt-Assertion": "not.a.token" } });   // DEV_IDENTITY_EMAIL still set
    expect(res.status).toBe(403);
  });

  it("refuses every token while Access is not configured", async () => {
    const res = await asAccess("/api/me", { env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } });
    expect(res.status).toBe(403);
  });
});

describe("models in R2, by grant", () => {
  const names = files => files.map(f => f.org + "/" + f.name);

  it("lists the whole tenant to an admin, well-formed keys only, sorted by organization then name", async () => {
    const res = await asAccess("/api/models");
    expect(res.status).toBe(200);
    const { tenant, files } = await res.json();
    expect(tenant).toEqual({ id: "acme", name: "Acme Mobility" });
    expect(names(files)).toEqual(["mobility/mobility-landscape.arch", "mobility/mobility.domain", "retail/retail.domain"]);
    const f = files.find(x => x.name === "retail.domain");
    expect(f.kind).toBe("domain");
    expect(f.size).toBe("organization Retail { }\n".length);
    expect(f.etag).toMatch(/^".+"$/);
    expect(f.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(files.find(x => x.name === "mobility-landscape.arch").kind).toBe("arch");
  });

  it("lists only the granted organizations to a member", async () => {
    const { files } = await (await asAccess("/api/models", {}, { email: "bob@acme.example" })).json();
    expect(names(files)).toEqual(["mobility/mobility-landscape.arch", "mobility/mobility.domain"]);
  });

  it("serves a file as text with its ETag, private and revalidated", async () => {
    const res = await asAccess("/api/models/retail/retail.domain");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("etag")).toMatch(/^".+"$/);
    expect(await res.text()).toBe("organization Retail { }\n");
  });

  it("answers 304 to a matching If-None-Match, 200 to another", async () => {
    const first = await asAccess("/api/models/mobility/mobility.domain");
    const etag = first.headers.get("etag");
    const same = await asAccess("/api/models/mobility/mobility.domain", { headers: { "If-None-Match": etag } });
    expect(same.status).toBe(304);
    expect(same.headers.get("etag")).toBe(etag);
    expect(await same.text()).toBe("");
    const other = await asAccess("/api/models/mobility/mobility.domain", { headers: { "If-None-Match": '"stale"' } });
    expect(other.status).toBe(200);
    expect(await other.text()).toBe("organization Mobility { }\n");
  });

  it("answers HEAD with the headers and no body", async () => {
    const res = await asAccess("/api/models/mobility/mobility.domain", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String("organization Mobility { }\n".length));
    expect(await res.text()).toBe("");
  });

  it("hides a file outside the grant, another tenant's file and a malformed key behind the same 404", async () => {
    const bob = { email: "bob@acme.example" };
    expect((await asAccess("/api/models/retail/retail.domain", {}, bob)).status).toBe(404);
    expect((await asAccess("/api/models/mobility/mobility.domain", {}, bob)).status).toBe(200);
    expect((await asAccess("/api/models/mobility/secret.domain")).status).toBe(404);   // tenant "other"
    expect((await asAccess("/api/models/retail/notes.txt")).status).toBe(404);
    expect((await asAccess("/api/models/Retail/x.domain")).status).toBe(404);
    expect((await asAccess("/api/models/mobility/missing.domain")).status).toBe(404);
  });
});

describe("with the development identity", () => {
  it("serves the application with its headers", async () => {
    const res = await call("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(await res.text()).toContain("Domain Navigator");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
  });

  it("ships no sample organization", async () => {
    const res = await call("/data.js");
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/organizations:\s*\[\]/);
  });

  it("is the built-in developer, with no logout, unless the store knows the e-mail", async () => {
    expect(await (await call("/api/me")).json()).toEqual({
      user: { name: "Developer", email: "dev@example.com", role: "admin" },
      tenant: { id: "local", name: "Local" },
      logoutUrl: null,
    });
    const known = await (await call("/api/me", { env: { DEV_IDENTITY_EMAIL: "bob@acme.example" } })).json();
    expect(known.user).toEqual({ name: "Bob", email: "bob@acme.example", role: "member" });
    expect(known.tenant.id).toBe("acme");
  });

  it("lists an empty tenant until models are published", async () => {
    const res = await call("/api/models");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-cache");
    expect(await res.json()).toEqual({ tenant: { id: "local", name: "Local" }, files: [] });
  });

  it("answers 404 for a missing file, a bad organization, a bad name and an unknown api", async () => {
    expect((await call("/api/models/local/any.domain")).status).toBe(404);
    expect((await call("/api/models/Local/any.domain")).status).toBe(404);
    expect((await call("/api/models/local/..%2Fany.domain")).status).toBe(404);
    expect((await call("/api/models/local/any.txt")).status).toBe(404);
    expect((await call("/api/models/local")).status).toBe(404);
    expect((await call("/api/nothing")).status).toBe(404);
  });

  it("never serves a model file, the 403 page's source aside, as an asset", async () => {
    expect((await call("/any.domain")).status).toBe(404);
    expect((await call("/any.arch")).status).toBe(404);
  });

  it("refuses writes", async () => {
    expect((await call("/api/models", { method: "POST" })).status).toBe(405);
    expect((await call("/", { method: "POST" })).status).toBe(405);
  });
});

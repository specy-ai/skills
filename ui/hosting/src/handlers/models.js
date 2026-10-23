/**
 * GET /api/models              → { tenant, files: [{ org, name, kind, size, etag, uploadedAt }] }
 * GET /api/models/<org>/<name> → the file (text/plain), ETag, 304 on If-None-Match
 *
 * The listing is the manifest the Navigator boots from (ui/app.js). It only
 * ever names what the user may read (§3.16): the whole tenant for `*`, else
 * each granted organization; a file outside the grant is a 404, exactly like
 * a file that does not exist. The files live in R2 behind the ModelStore port
 * (adapters/r2.js); without the binding a tenant is simply empty.
 */
import { mayRead } from "../authorize.js";
import { json, methodNotAllowed, notFound, withHeaders } from "../http.js";
import { NAME, ORG } from "../model-name.js";

export async function handleModels(request, user, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
  const url = new URL(request.url);
  if (url.pathname === "/api/models") {
    return json({ tenant: { id: user.tenantId, name: user.tenantName }, files: await listFiles(user, ctx) });
  }
  const m = url.pathname.match(/^\/api\/models\/([^/]+)\/([^/]+)$/);
  if (!m) return notFound();
  let org, name;
  try { org = decodeURIComponent(m[1]); name = decodeURIComponent(m[2]); } catch (e) { return notFound(); }
  if (!ORG.test(org) || !NAME.test(name) || !mayRead(user, org)) return notFound();
  return serveFile(request, user, org, name, ctx);
}

async function listFiles(user, ctx) {
  if (!ctx.models) return [];
  const orgs = user.organizations.includes("*") ? "*" : user.organizations;
  if (orgs !== "*" && orgs.length === 0) return [];
  return ctx.models.list(user.tenantId, orgs);
}

async function serveFile(request, user, org, name, ctx) {
  if (!ctx.models) return notFound();
  const file = await ctx.models.get(user.tenantId, org, name, { ifNoneMatch: request.headers.get("If-None-Match") });
  if (!file) return notFound();
  // private: the reader's browser keeps the body and revalidates with If-None-Match (the Navigator fetches with cache: "no-cache")
  const headers = { ETag: file.etag, "Cache-Control": "private, no-cache" };
  if (file.unchanged) return withHeaders(new Response(null, { status: 304, headers }));
  headers["Content-Type"] = "text/plain; charset=utf-8";
  if (request.method === "HEAD") {
    await file.body.cancel();
    return withHeaders(new Response(null, { status: 200, headers: { ...headers, "Content-Length": String(file.size) } }));
  }
  return withHeaders(new Response(file.body, { status: 200, headers }));
}

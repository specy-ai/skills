/**
 * Hosted Specy Navigator — the Worker (proposals/navigator-hosting.md, §12).
 *
 * Every request comes here first (`run_worker_first`), and the order never
 * changes: identity (who is this? — Cloudflare Access) → authorization (what
 * may they see? — our user records) → assets | models | me. Nothing is served
 * to an unknown request, the application's own files included.
 */
import { resolveIdentity } from "./access.js";
import { authorize } from "./authorize.js";
import { createContext } from "./context.js";
import { forbidden } from "./handlers/forbidden.js";
import { handleMe } from "./handlers/me.js";
import { handleModels } from "./handlers/models.js";
import { methodNotAllowed, notFound, withHeaders } from "./http.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ctx = createContext(env);

    const identity = await resolveIdentity(request, env);
    if (!identity) return forbidden(request, env, { reason: "unauthenticated" });
    const user = await authorize(identity, env, ctx);
    if (!user) return forbidden(request, env, { reason: "unknown-user", email: identity.email });

    if (url.pathname === "/api/models" || url.pathname.startsWith("/api/models/")) return handleModels(request, user, ctx);
    if (url.pathname === "/api/me") return handleMe(request, user, identity);
    if (url.pathname.startsWith("/api/")) return notFound();
    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
    return withHeaders(await env.ASSETS.fetch(request));
  },
};

/**
 * GET /api/me → what the header shows (§7.3): the user, their tenant, and
 * where "Sign out" goes — Access's logout on this domain, nothing in
 * development.
 */
import { json, methodNotAllowed } from "../http.js";

export const ACCESS_LOGOUT = "/cdn-cgi/access/logout";

export function handleMe(request, user, identity) {
  if (request.method !== "GET") return methodNotAllowed();
  return json({
    user: { name: user.name, email: user.email, role: user.role },
    tenant: { id: user.tenantId, name: user.tenantName },
    logoutUrl: identity.via === "access" ? ACCESS_LOGOUT : null,
  });
}

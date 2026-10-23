/**
 * Authorization: what may this identity see?
 *
 * Maps an e-mail to a user of the product — tenant, role, organizations
 * (proposals/navigator-hosting.md §3.11, §3.16) — through the UserStore port.
 * Access only answered "who"; an e-mail it let through but that no record
 * names, or a disabled one, sees nothing. The development identity falls back
 * to a built-in user of the tenant "local" when the store does not know it.
 *
 * @typedef {{ id: string, email: string, name: string,
 *             tenantId: string, tenantName: string,
 *             role: "admin" | "member", organizations: string[],
 *             status: "active" }} User
 */
import { devEmail } from "./access.js";

/**
 * @param {import("./access.js").Identity} identity
 * @param {Record<string, unknown>} env
 * @param {import("./context.js").Context} ctx
 * @returns {Promise<User | null>}
 */
export async function authorize(identity, env, ctx) {
  if (ctx.users) {
    const record = await ctx.users.getByEmail(identity.email);
    if (record) return await fromRecord(record, ctx);
    if (identity.via !== "dev") return null;
  }
  if (identity.via === "dev" && identity.email === devEmail(env)) {
    return {
      id: "dev", email: identity.email, name: "Developer",
      tenantId: "local", tenantName: "Local",
      role: "admin", organizations: ["*"], status: "active",
    };
  }
  return null;
}

/** @param {import("./ports.js").UserRecord} record */
async function fromRecord(record, ctx) {
  if (record.status !== "active" || !record.tenantId) return null;
  const tenant = await ctx.users.getTenant(record.tenantId);
  if (!tenant) return null;
  const organizations = Array.isArray(record.organizations) ? record.organizations.filter(o => typeof o === "string") : ["*"];
  return {
    id: record.id, email: record.email, name: record.name || record.email,
    tenantId: tenant.id, tenantName: tenant.name || tenant.id,
    role: record.role === "admin" ? "admin" : "member",
    organizations: record.role === "admin" ? ["*"] : organizations,
    status: "active",
  };
}

/** Whether the user may read the organization (`*` = every organization of the tenant). */
export function mayRead(user, org) {
  return user.status === "active" && (user.organizations.includes("*") || user.organizations.includes(org));
}

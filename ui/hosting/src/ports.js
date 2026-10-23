/**
 * Ports: what the handlers need from storage, as interfaces (JSDoc). KV and
 * R2 implement them today (adapters/), D1 tomorrow for the users — a change
 * of adapter, not of handlers (proposals/navigator-hosting.md §3.10).
 *
 * @typedef {{ id: string, name: string, createdAt?: string }} Tenant
 *
 * The stored user record (§3.11). `organizations` is `["*"]` for the whole
 * tenant, else the organizations the reader may see (§3.16).
 * @typedef {{ id: string, tenantId: string, email: string, name?: string,
 *             role?: "admin" | "member", organizations?: string[],
 *             status?: "invited" | "active" | "disabled",
 *             createdAt?: string, lastLoginAt?: string | null }} UserRecord
 *
 * @typedef {{ getByEmail(email: string): Promise<UserRecord | null>,
 *             getTenant(id: string): Promise<Tenant | null> }} UserStore
 *
 * A published model file as the manifest lists it (§3.2).
 * @typedef {{ org: string, name: string, kind: "domain" | "arch" | "sysreq",
 *             size: number, etag: string, uploadedAt: string }} ModelFile
 *
 * One read of a file: `unchanged` (and a null body) when `ifNoneMatch` named
 * its current etag — the 304 case.
 * @typedef {{ etag: string, size: number, body: ReadableStream | null, unchanged: boolean }} ModelRead
 *
 * `orgs` is `"*"` for the whole tenant, else the granted organizations.
 * @typedef {{ list(tenantId: string, orgs: "*" | string[]): Promise<ModelFile[]>,
 *             get(tenantId: string, org: string, name: string,
 *                 opts?: { ifNoneMatch?: string | null }): Promise<ModelRead | null> }} ModelStore
 */
export {};

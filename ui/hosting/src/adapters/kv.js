/**
 * KV adapter of the UserStore port (key schema: proposals/navigator-hosting.md
 * §3.11). Reads are cached at the edge for 60 s, KV's minimum: a revocation
 * (`status: disabled`, or the record removed) shows within that window plus
 * KV's own propagation (§12.6).
 */
const READ = { cacheTtl: 60 };

/** @param {KVNamespace} kv @returns {import("../ports.js").UserStore} */
export function kvUserStore(kv) {
  return {
    async getByEmail(email) {
      const id = await kv.get("user-by-email:" + email, READ);
      if (!id) return null;
      return kv.get("user:" + id, { type: "json", ...READ });
    },
    async getTenant(id) {
      return kv.get("tenant:" + id, { type: "json", ...READ });
    },
  };
}

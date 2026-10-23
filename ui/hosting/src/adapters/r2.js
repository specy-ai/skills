/**
 * R2 adapter of the ModelStore port. Keys are
 * `tenants/<tid>/models/<org>/<name>` (proposals/navigator-hosting.md §3.2):
 * the tenant is the first segment, so a listing by prefix never crosses
 * tenants; the organization is the second, so a grant is a prefix too
 * (§3.16). Keys that do not parse — anything put in the bucket by hand under
 * another shape — are left out of the manifest and never served.
 */
import { NAME, ORG, kindOf } from "../model-name.js";

const PAGE = 1000;   // R2's maximum per list call

const prefix = (tenantId, org) => `tenants/${tenantId}/models/` + (org ? org + "/" : "");
const key = (tenantId, org, name) => prefix(tenantId, org) + name;

/** @param {R2Bucket} bucket @returns {import("../ports.js").ModelStore} */
export function r2ModelStore(bucket) {
  return {
    async list(tenantId, orgs) {
      const prefixes = orgs === "*" ? [prefix(tenantId)] : orgs.map(org => prefix(tenantId, org));
      const pages = await Promise.all(prefixes.map(p => listAll(bucket, p)));
      const files = [];
      for (const objects of pages) {
        for (const o of objects) {
          const named = parse(tenantId, o.key);
          if (named) files.push({ ...named, size: o.size, etag: o.httpEtag, uploadedAt: o.uploaded.toISOString() });
        }
      }
      return files.sort((a, b) => a.org.localeCompare(b.org) || a.name.localeCompare(b.name));
    },

    async get(tenantId, org, name, { ifNoneMatch } = {}) {
      const options = ifNoneMatch ? { onlyIf: new Headers({ "If-None-Match": ifNoneMatch }) } : {};
      const object = await bucket.get(key(tenantId, org, name), options);
      if (!object) return null;
      // a failed precondition yields the metadata without a body (R2Object, not R2ObjectBody)
      const body = "body" in object ? object.body : undefined;
      const unchanged = body === undefined || body === null;
      return { etag: object.httpEtag, size: object.size, body: unchanged ? null : body, unchanged };
    },
  };
}

async function listAll(bucket, p) {
  const out = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: p, cursor, limit: PAGE });
    out.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}

/** `tenants/<tid>/models/<org>/<name>` → { org, name, kind }, or null when the key has another shape. */
function parse(tenantId, k) {
  const parts = k.slice(prefix(tenantId).length).split("/");
  if (parts.length !== 2) return null;
  const [org, name] = parts;
  if (!ORG.test(org) || !NAME.test(name)) return null;
  return { org, name, kind: kindOf(name) };
}

/**
 * Identity: who is this request from?
 *
 * In production the answer comes from Cloudflare Access. Every request that
 * reaches the Worker carries the JWT Access issued for the application
 * (`Cf-Access-Jwt-Assertion`, also the `CF_Authorization` cookie), which we
 * verify ourselves against the team's public keys: a Worker with static
 * assets does not receive `ctx.access` (proposals/navigator-hosting.md §12.3).
 * No JWT, or a bad one, is no identity, and nothing is served.
 *
 * In development (`wrangler dev`, tests) there is no Access: DEV_IDENTITY_EMAIL
 * from .dev.vars stands in when no JWT is present. scripts/check-deploy.sh
 * refuses a deployed configuration that defines it.
 *
 * @typedef {{ email: string, via: "access" | "dev" }} Identity
 */
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS_PATH = "/cdn-cgi/access/certs";
/** one remote key set per team domain, cached across the requests of the isolate */
const keySets = new Map();

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Identity | null>}
 */
export async function resolveIdentity(request, env) {
  const token = accessToken(request);
  if (token) {
    const email = await verifyAccessToken(token, env);
    return email ? { email, via: "access" } : null;
  }
  const dev = devEmail(env);
  return dev ? { email: dev, via: "dev" } : null;
}

/** The Access configuration (step 2), or null while it is not filled in. */
export function accessConfig(env) {
  const domain = typeof env.ACCESS_TEAM_DOMAIN === "string" ? env.ACCESS_TEAM_DOMAIN.trim().replace(/\/+$/, "") : "";
  const aud = typeof env.ACCESS_AUD === "string" ? env.ACCESS_AUD.trim() : "";
  return domain && aud ? { domain, aud } : null;
}

/** The development e-mail, normalized, or null. */
export function devEmail(env) {
  const v = env.DEV_IDENTITY_EMAIL;
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null;
}

function accessToken(request) {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header && header.trim()) return header.trim();
  const m = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1].trim() : null;
}

/** The e-mail of a valid application token, else null. A service token has no e-mail: not a reader. */
async function verifyAccessToken(token, env) {
  const conf = accessConfig(env);
  if (!conf) return null;   // Access not configured yet: nobody gets in
  try {
    let jwks = keySets.get(conf.domain);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(conf.domain + JWKS_PATH));
      keySets.set(conf.domain, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, { issuer: conf.domain, audience: conf.aud, algorithms: ["RS256"] });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    return email || null;
  } catch (e) {
    console.warn("access token rejected: " + (e && e.code ? e.code : "error"));   // no token, no e-mail in the logs
    return null;
  }
}

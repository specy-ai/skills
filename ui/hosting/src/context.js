/** Assembles the adapters the handlers talk to (§3.10): KV for users, R2 for models. */
import { kvUserStore } from "./adapters/kv.js";
import { r2ModelStore } from "./adapters/r2.js";

/** @typedef {{ users: import("./ports.js").UserStore | null, models: import("./ports.js").ModelStore | null }} Context */

/** @param {Record<string, unknown>} env @returns {Context} */
export function createContext(env) {
  return {
    users: env.APP_AUTH ? kvUserStore(/** @type {KVNamespace} */ (env.APP_AUTH)) : null,
    models: env.MODELS ? r2ModelStore(/** @type {R2Bucket} */ (env.MODELS)) : null,
  };
}

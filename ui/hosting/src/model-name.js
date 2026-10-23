/**
 * How a published model file is named (proposals/navigator-hosting.md §3.2,
 * §3.16): an organization slug — the unit readers are granted — and a file
 * name with one of the three model extensions. Shared by the handler, the
 * R2 adapter and (as regexes copied verbatim) scripts/publish-models.sh.
 */
export const ORG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const NAME = /^[A-Za-z0-9._-]+\.(domain|arch|sysreq)$/;

/** @returns {"domain" | "arch" | "sysreq" | null} */
export const kindOf = name => /** @type {any} */ ((name.match(/\.(domain|arch|sysreq)$/) || [])[1] || null);

/** Response helpers, and the headers every response carries. */

/** Adds the headers every response carries (CSP comes with step 5). */
export function withHeaders(res) {
  const out = new Response(res.body, res);
  out.headers.set("X-Content-Type-Options", "nosniff");
  out.headers.set("Referrer-Policy", "same-origin");
  out.headers.set("X-Frame-Options", "DENY");
  return out;
}

export function json(data, init = {}) {
  return withHeaders(new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-cache",
      ...(init.headers || {}),
    },
  }));
}

export const notFound = () => json({ error: "not-found" }, { status: 404 });
export const methodNotAllowed = () => json({ error: "method-not-allowed" }, { status: 405 });

export const escapeHtml = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** A page load, as opposed to one of the Navigator's fetches (X-Requested-With). */
export function isNavigation(request) {
  if (request.method !== "GET") return false;
  if (request.headers.get("X-Requested-With") === "XMLHttpRequest") return false;
  if (request.headers.get("Sec-Fetch-Mode") === "navigate") return true;
  return (request.headers.get("Accept") || "").includes("text/html");
}

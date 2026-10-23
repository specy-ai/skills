/**
 * 403. A page load gets the "no access" page (public-src/forbidden.html,
 * read through the assets binding, the signed-in e-mail filled in) so a
 * reader Access let through but nobody invited understands what to do; a
 * fetch gets JSON. Never any model content.
 */
import { escapeHtml, isNavigation, json, withHeaders } from "../http.js";

const FALLBACK = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Specy Navigator — no access</title><p>{{detail}}</p></html>`;

/**
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @param {{ reason: "unauthenticated" | "unknown-user", email?: string }} why
 */
export async function forbidden(request, env, why) {
  if (!isNavigation(request)) return json({ error: why.reason }, { status: 403 });
  const detail = why.email
    ? `You are signed in as <strong>${escapeHtml(why.email)}</strong>, but this address is not registered as a reader of this space.`
    : `No signed-in identity reached this space.`;
  let html = null;
  try {
    const res = await env.ASSETS.fetch(new Request(new URL("/forbidden.html", request.url), { method: "GET" }));
    if (res.ok) html = await res.text();
  } catch (e) { /* no build around: the fallback below */ }
  const body = (html || FALLBACK).replaceAll("{{detail}}", () => detail);
  return withHeaders(new Response(body, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  }));
}

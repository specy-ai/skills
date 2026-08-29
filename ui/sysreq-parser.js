/* Tolerant reader for Specy .sysreq files (SYSTEM-REQ-METAMODEL.md) → requirement
   sets. Line-oriented: comments stripped, then each `REQ-…` header starts a
   requirement whose following lines carry rationale (`:: "…"`), the EARS
   statement (bare quoted string), priority, source, and relation lists. */

"use strict";

function parseSysreq(text, fileStem) {
  const lines = [];
  for (const raw of text.split("\n")) {
    let out = "", inStr = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '"') inStr = !inStr;
      if (!inStr && c === "/" && raw[i + 1] === "/") break;
      out += c;
    }
    out = out.trim();
    if (out) lines.push(out);
  }

  const sets = [];
  let set = null, req = null;
  let collecting = null;   // { target: "statement" | "rationale", buf: [] }

  const finishCollect = () => {
    if (!collecting || !req) { collecting = null; return; }
    const textJoined = collecting.buf.join(" ").replace(/^"|"$/g, "");
    req[collecting.target] = textJoined;
    collecting = null;
  };

  for (const line of lines) {
    if (collecting) {
      collecting.buf.push(line);
      if (line.endsWith('"')) finishCollect();
      continue;
    }

    let m = line.match(/^requirements\s+"([^"]*)"\s+scoped-to\s+(\S+)\s*{?$/);
    if (m) {
      set = { id: fileStem + (sets.length ? ":" + (sets.length + 1) : ""), name: m[1], scopedTo: m[2], file: fileStem, requirements: [] };
      sets.push(set);
      req = null;
      continue;
    }
    if (!set) continue;

    m = line.match(/^prd-source\s+"([^"]*)"$/);
    if (m) { set.prdSource = m[1]; continue; }

    m = line.match(/^(REQ-[A-Z0-9-]+)\s+"([^"]*)"\s*(?::\s*(\S+))?$/);
    if (m) {
      req = { id: m[1], title: m[2], pattern: m[3] || "ubiquitous" };
      set.requirements.push(req);
      continue;
    }
    if (!req) continue;

    if (line.startsWith('::')) {
      const rest = line.replace(/^::\s*/, "");
      collecting = { target: "rationale", buf: [rest] };
      if (rest.startsWith('"') && rest.length > 1 && rest.endsWith('"')) finishCollect();
      continue;
    }
    if (line.startsWith('"')) {
      collecting = { target: "statement", buf: [line] };
      if (line.length > 1 && line.endsWith('"')) finishCollect();
      continue;
    }
    m = line.match(/^priority\s+(\w+)$/);
    if (m) { req.priority = m[1]; continue; }
    m = line.match(/^source\s+"([^"]*)"$/);
    if (m) { req.source = m[1]; continue; }
    m = line.match(/^(depends-on|conflicts-with|decomposed-into)\s*{?\s*(.*?)\s*}?$/);
    if (m && m[2]) req[m[1].replace(/-(\w)/g, (_, c) => c.toUpperCase())] = m[2].split(/[\s,]+/).filter(x => /^REQ-/.test(x));
  }
  return sets;
}

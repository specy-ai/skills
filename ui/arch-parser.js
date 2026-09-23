/* Tolerant reader for Specy .arch files (src/grammars/architecture.ebnf,
   SOFTWARE-ARCHITECTURE-METAMODEL.md) → the navigator's architecture shape.
   Structural, like domain-parser.js: comments are stripped (outside
   strings), physical lines are joined into logical lines (multi-line headers
   and operations), the text is folded into a brace-scoped block tree with
   quote-aware brace counting, and each header / statement is interpreted by
   its leading keyword. One-line blocks (`enum X { a = 1 }`, `exception X
   { … }`, `meta { … }`) stay statements. Unknown constructs (struct, enum,
   union, exception, typedef, import, operations) are skipped, never fatal.

   parseArch(text, fileStem) →
     { id, name, description, domainSource, requirementsSource,
       persons, externalSystems, systems: [{ …, containers, channels,
       connectors, environments }], system (= systems[0]), counts }
   A file normally has one system in focus; a merged landscape (see
   scripts/merge-arch.mjs) has one `system` block per system. */

"use strict";

function parseArch(text, fileStem) {

  /* ---- small lexical helpers (quote-aware) ---- */
  const STR = /"(?:[^"\\]|\\.)*"/g;
  const unquoted = s => s.replace(STR, '""');
  const parenDepth = s => { const u = unquoted(s); return (u.match(/\(/g) || []).length - (u.match(/\)/g) || []).length; };
  const openMeta = s => /\bmeta\s*\{[^}]*$/.test(unquoted(s));

  /* ---- 1. strip comments (outside strings), drop blanks ---- */
  const lines = [];
  for (const raw of String(text || "").split("\n")) {
    let out = "", inStr = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (inStr && c === "\\") { out += c + (raw[i + 1] || ""); i++; continue; }
      if (c === '"') inStr = !inStr;
      if (!inStr && c === "/" && raw[i + 1] === "/") break;
      out += c;
    }
    out = out.trim();
    if (out) lines.push(out);
  }

  /* ---- 2. logical lines: a header or operation may continue on the next
     physical lines (`:: "…"`, `realizes …`, `satisfies […]`, `technology`,
     `meta {…}`, `returns`, `throws`), or while a `(` / `meta {` is open ---- */
  const CONT = /^(?:::|(?:realizes|satisfies|technology|meta|returns|throws)\b)/;
  const logical = [];
  for (const line of lines) {
    const n = logical.length;
    const prev = n ? logical[n - 1] : null;
    if (prev != null && !prev.startsWith("}") &&
        (openMeta(prev) || parenDepth(prev) > 0 || (!prev.endsWith("{") && CONT.test(line)))) {
      logical[n - 1] = prev + " " + line;
    } else {
      logical.push(line);
    }
  }

  /* ---- 3. fold into a block tree (items keep source order). Only braces
     left unmatched on their own line are structural: a matched pair is a
     one-line block and stays inside its statement. ---- */
  const root = { head: "", items: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  for (const line of logical) {
    const opens = [];                 // positions of unmatched `{`
    const structural = new Map();     // position → "{" | "}"
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr && c === "\\") { i++; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") opens.push(i);
      else if (c === "}") { if (opens.length) opens.pop(); else structural.set(i, "}"); }
    }
    for (const i of opens) structural.set(i, "{");
    let from = 0;
    for (const i of [...structural.keys()].sort((a, b) => a - b)) {
      const seg = line.slice(from, i).trim();
      from = i + 1;
      if (structural.get(i) === "{") {
        const node = { head: seg, items: [] };
        top().items.push({ head: seg, node });
        stack.push(node);
      } else {
        if (seg) top().items.push({ head: seg });
        if (stack.length > 1) stack.pop();
      }
    }
    const rest = line.slice(from).trim();
    if (rest) top().items.push({ head: rest });
  }

  /* ---- 4. head tokenizer + clause extraction ---- */
  const CLOSE = { "[": "]", "{": "}", "(": ")" };
  function matchClose(s, i) {
    const open = s[i], close = CLOSE[open];
    let depth = 0, inStr = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr && c === "\\") { j++; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === open) depth++;
      else if (c === close && --depth === 0) return j;
    }
    return s.length;
  }
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') {
        let j = i + 1, v = "";
        while (j < s.length && s[j] !== '"') {
          if (s[j] === "\\" && j + 1 < s.length) { v += s[j + 1]; j += 2; continue; }
          v += s[j++];
        }
        out.push({ t: "str", v });
        i = j + 1;
        continue;
      }
      if (c === ":" && s[i + 1] === ":") { out.push({ t: "op", v: "::" }); i += 2; continue; }
      if (c === "-" && s[i + 1] === ">") { out.push({ t: "op", v: "->" }); i += 2; continue; }
      if (CLOSE[c]) { const j = matchClose(s, i); out.push({ t: c, v: s.slice(i + 1, j).trim() }); i = j + 1; continue; }
      if (c === ",") { out.push({ t: "," }); i++; continue; }
      let j = i;
      while (j < s.length && !/[\s",[\]{}()]/.test(s[j])
        && !(s[j] === ":" && s[j + 1] === ":") && !(s[j] === "-" && s[j + 1] === ">")) j++;
      if (j === i) { out.push({ t: "op", v: c }); i++; continue; }   // stray `]`, `}`, `)`
      out.push({ t: "w", v: s.slice(i, j) });
      i = j;
    }
    return out;
  }

  /* Pulls `:: "…"`, `technology "…"`, `satisfies [...]`, `meta {…}` and
     `realizes (module "…" | context X | interface X | event X | value type X)`
     from anywhere in the head; `rest` keeps `keyword Name [on Broker] …`.
     A trailing non-meta `{ … }` is a one-line block body (`inline`). */
  function parseHead(head) {
    const tk = tokenize(head);
    const h = { rest: [], desc: "", technology: "", satisfies: [], realizes: [], inline: null };
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i], nx = tk[i + 1];
      if (t.t === "op" && t.v === "::" && nx && nx.t === "str") { h.desc = nx.v; i++; continue; }
      if (t.t === "w" && t.v === "technology" && nx && nx.t === "str") { h.technology = nx.v; i++; continue; }
      if (t.t === "w" && t.v === "satisfies" && nx && nx.t === "[") {
        h.satisfies.push(...nx.v.split(",").map(x => x.trim()).filter(Boolean)); i++; continue;
      }
      if (t.t === "w" && t.v === "meta" && nx && nx.t === "{") { i++; continue; }
      if (t.t === "w" && t.v === "realizes") {
        let j = i + 1;
        for (;;) {
          const a = tk[j], b = tk[j + 1], c = tk[j + 2];
          if (a && a.t === ",") { j++; continue; }
          if (a && a.t === "w" && (a.v === "module" || a.v === "context") && b && (b.t === "str" || b.t === "w")) {
            h.realizes.push({ kind: a.v, name: b.v }); j += 2; continue;
          }
          if (a && a.t === "w" && (a.v === "interface" || a.v === "event") && b && b.t === "w") {
            h.realizes.push({ kind: a.v, name: b.v }); j += 2; continue;
          }
          if (a && a.t === "w" && a.v === "value" && b && b.v === "type" && c && c.t === "w") {
            h.realizes.push({ kind: "value type", name: c.v }); j += 3; continue;
          }
          break;
        }
        i = j - 1;
        continue;
      }
      if (t.t === "{" && h.inline == null) { h.inline = t.v; continue; }
      h.rest.push(t);
    }
    return h;
  }

  const word = (h, i) => { const t = h.rest[i]; return t && (t.t === "w" || t.t === "str") ? t.v : ""; };
  /* comma-separated names after the keyword (`carries A, B`, `deploy A, B replicas 2`) */
  const namesAfter = (h, stop) => {
    const out = [];
    for (let i = 1; i < h.rest.length; i++) {
      const t = h.rest[i];
      if (t.t === "w" && stop && t.v === stop) break;
      if (t.t === "w" || t.t === "str") out.push(t.v);
    }
    return out;
  };
  /* one-line block bodies: `{ provides A requires B }` → clause statements */
  const INLINE_SPLIT = /\s+(?=(?:provides|requires|consumes|publishes|subscribes|carries|deploy|boundedContext)\b)/;
  const inlineItems = body => body.split(INLINE_SPLIT).map(s => s.trim()).filter(Boolean).map(s => ({ head: s }));
  const OPERATION = /^(?:(?:safe|oneway|streaming)\s+)?[A-Za-z_]\w*\s*\(/;

  /* ---- 5. interpret ---- */
  const arch = {
    id: fileStem, name: fileStem, description: "", domainSource: "", requirementsSource: "",
    persons: [], externalSystems: [], systems: [], system: null,
    counts: null,
  };
  const newSystem = (name, h) => {
    const sys = { id: String(name || "").replace(/[^\w.-]+/g, "-"), name: name || "", description: (h && h.desc) || "",
      satisfies: [], realizes: [], boundedContexts: [], interfaces: [], containers: [], channels: [], connectors: [], environments: [] };
    arch.systems.push(sys);
    return sys;
  };
  /* the system a member belongs to; a bare file (members outside any
     `system` block) gets one implicit system */
  let implicit = null;
  const sysOf = scope => scope.sys || implicit || (implicit = newSystem(""));
  let connectorCount = 0;
  const SYSTEM_MEMBERS = new Set(["boundedContext", "interface", "container", "channel", "connect", "environment"]);

  function connector(h) {
    // connect A[.I] -> B[.I] over "protocol" (sync|async|streaming)
    const r = h.rest;
    const arrow = r.findIndex(t => t.t === "op" && t.v === "->");
    if (arrow < 2) return null;
    const endpoint = t => {
      const parts = (t && (t.t === "w" || t.t === "str") ? t.v : "").split(".").filter(Boolean);
      return parts.length ? { name: parts[0], iface: parts.length > 1 ? parts.slice(1).join(".") : null } : null;
    };
    const from = endpoint(r[arrow - 1]), to = endpoint(r[arrow + 1]);
    if (!from || !to) return null;
    let protocol = "", style = "sync";
    for (let i = arrow + 2; i < r.length; i++) {
      const t = r[i];
      if (t.t === "w" && t.v === "over" && r[i + 1] && r[i + 1].t === "str") { protocol = r[i + 1].v; i++; continue; }
      if (t.t === "w" && /^(sync|async|streaming)$/.test(t.v)) style = t.v;
    }
    return { id: "c" + (++connectorCount), from, to, protocol, style, description: h.desc };
  }

  function walk(items, scope) {
    for (const it of items || []) {
      try { interpret(it, scope); } catch (e) { /* tolerant: skip what cannot be read */ }
    }
  }

  function interpret(it, scope) {
    const h = parseHead(it.head);
    const kw = word(h, 0);
    const sub = it.node ? it.node.items : (h.inline != null ? inlineItems(h.inline) : null);
    const name = word(h, 1);
    const owner = scope.component || scope.container || scope.ext;
    const sys = SYSTEM_MEMBERS.has(kw) ? sysOf(scope) : scope.sys || null;

    switch (kw) {
      case "architecture":
        if (name) arch.name = name;
        if (h.desc) arch.description = h.desc;
        walk(sub, scope);
        return;
      case "domain-source":
        arch.domainSource = name;
        return;
      case "requirements-source":
        arch.requirementsSource = name;
        return;
      case "person":
        if (name) arch.persons.push({ id: name, name, description: h.desc });
        return;
      case "externalSystem": {
        if (!name) return;
        const ext = { id: name, name, description: h.desc, realizes: h.realizes, provides: [], consumes: [] };
        arch.externalSystems.push(ext);
        walk(sub, { ext });
        return;
      }
      case "system": {
        // a repeated block of the same system continues it
        const known = arch.systems.find(x => x.name === name && name);
        const target = known || newSystem(name, h);
        if (!target.description && h.desc) target.description = h.desc;
        target.satisfies.push(...h.satisfies);
        target.realizes.push(...h.realizes);
        walk(sub, { sys: target });
        return;
      }
      case "boundedContext":
        if (!name) return;
        if (scope.component) scope.component.boundedContext = name;
        else sys.boundedContexts.push({ id: name, name, description: h.desc });
        return;
      case "interface":
        if (!name) return;
        sys.interfaces.push({ id: name, name, description: h.desc, realizes: h.realizes,
          operations: (sub || []).filter(x => !x.node && OPERATION.test(x.head)).length });
        return;
      case "container": {
        if (!name) return;
        const container = { id: name, name, description: h.desc, technology: h.technology,
          satisfies: h.satisfies, realizes: h.realizes, provides: [], requires: [], components: [] };
        sys.containers.push(container);
        walk(sub, { container, sys });
        return;
      }
      case "component": {
        if (!name || !scope.container) return;   // a component lives in a container
        const component = { id: name, name, description: h.desc, boundedContext: "",
          satisfies: h.satisfies, realizes: h.realizes, provides: [], requires: [], publishes: [], subscribes: [] };
        scope.container.components.push(component);
        walk(sub, { container: scope.container, component, sys });
        return;
      }
      case "provides":
      case "requires":
      case "consumes":
        if (name && owner && Array.isArray(owner[kw])) owner[kw].push(name);
        return;
      case "publishes": {
        // publishes Event to channel
        const to = h.rest.findIndex(t => t.t === "w" && t.v === "to");
        const channel = to > 0 ? word(h, to + 1) : "";
        if (name && scope.component) scope.component.publishes.push({ event: name, channel });
        return;
      }
      case "subscribes":
        if (name && scope.component) scope.component.subscribes.push(name);
        return;
      case "channel": {
        if (!name) return;
        const on = h.rest.findIndex(t => t.t === "w" && t.v === "on");
        const channel = { id: name, name, broker: on > 0 ? word(h, on + 1) : "", description: h.desc, carries: [] };
        sys.channels.push(channel);
        walk(sub, { channel, sys });
        return;
      }
      case "carries":
        if (scope.channel) scope.channel.carries.push(...namesAfter(h));
        return;
      case "connect": {
        const c = connector(h);
        if (c) sys.connectors.push(c);
        return;
      }
      case "environment": {
        if (!name) return;
        const env = { id: name, name, description: h.desc, deploys: [] };
        sys.environments.push(env);
        walk(sub, { env, sys });
        return;
      }
      case "deploy": {
        if (!scope.env) return;
        const rep = h.rest.findIndex(t => t.t === "w" && t.v === "replicas");
        const replicas = rep > 0 && /^\d+$/.test(word(h, rep + 1)) ? Number(word(h, rep + 1)) : null;
        for (const container of namesAfter(h, "replicas")) scope.env.deploys.push({ container, replicas });
        return;
      }
      default:
        // struct / enum / union / exception / typedef / import / operations / unknown
        return;
    }
  }

  /* the file normally holds one `architecture` block; a bare file (members at
     top level) is read the same way */
  walk(root.items, {});
  if (!arch.systems.length) newSystem(arch.name);
  for (const sys of arch.systems) if (!sys.name) { sys.name = arch.name; sys.id = String(arch.name).replace(/[^\w.-]+/g, "-"); }
  arch.system = arch.systems[0];

  const sum = f => arch.systems.reduce((n, s) => n + f(s), 0);
  arch.counts = {
    systems: arch.systems.length,
    persons: arch.persons.length,
    externalSystems: arch.externalSystems.length,
    containers: sum(s => s.containers.length),
    components: sum(s => s.containers.reduce((n, c) => n + c.components.length, 0)),
    interfaces: sum(s => s.interfaces.length),
    channels: sum(s => s.channels.length),
    connectors: sum(s => s.connectors.length),
    environments: sum(s => s.environments.length),
  };
  return arch;
}

/* Node (scripts/check-arch-export.mjs loads this file through vm; the
   browser ignores this block) */
if (typeof module !== "undefined" && module.exports) module.exports = parseArch;

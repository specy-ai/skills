#!/usr/bin/env node
/* Merge several single-system Specy .arch files into one architecture that
   holds every system — a C4 *system landscape* (one `system` block per
   system, SOFTWARE-ARCHITECTURE-METAMODEL.md otherwise models one system per
   file).

     node scripts/merge-arch.mjs -o ffm.arch [--name N] [--description D] a.arch b.arch …

   Each source file describes one system in focus and sees the others as
   `externalSystem`s. The merge keeps every system block verbatim (comments,
   types, interfaces, containers, components, channels, environments) and only
   changes what a single file needs:
     - persons: once each (first description);
     - external systems: those that are one of the merged systems disappear
       (they are systems now); the others are kept once, their provides /
       consumes clauses united;
     - types and interfaces: one declaration per name in the whole file — an
       interface in the system whose container / component `provides` it, a
       type in the first system (argument order) that declares it; a later
       declaration that differs is reported;
     - containers / components declared in several systems are renamed
       `<Name><System>` inside each of them;
     - connectors: a flow described from both sides (same flow id, the
       `"F3 — …"` prefix of its description) becomes one connector with the
       precise end of each side; an end still naming a whole system is
       retargeted to the element of that system that provides (target) or
       requires (source) the interface, when there is exactly one; each
       connector lands in the system of its source (of its target when the
       source is a person or an external system).
   A report goes to stderr. No dependency beyond Node. */

import fs from "node:fs";
import path from "node:path";

/* ---------------------------------------------------------------- CLI */
const argv = process.argv.slice(2);
let out = null, name = null, description = null;
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "-o" || a === "--out") out = argv[++i];
  else if (a === "--name") name = argv[++i];
  else if (a === "--description") description = argv[++i];
  else inputs.push(a);
}
if (!out || inputs.length < 2) {
  console.error("usage: node scripts/merge-arch.mjs -o out.arch [--name N] [--description D] a.arch b.arch …");
  process.exit(2);
}

/* ---------------------------------------------------------------- lexing helpers */
/* code part of a line: `//` comment dropped, strings kept (quote-aware) */
function codeOf(line) {
  let s = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i - 1] !== "\\") s = !s;
    if (!s && c === "/" && line[i + 1] === "/") return line.slice(0, i);
  }
  return line;
}
function braceDelta(line) {
  let d = 0, s = false;
  const code = codeOf(line);
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '"' && code[i - 1] !== "\\") s = !s;
    else if (!s && c === "{") d++;
    else if (!s && c === "}") d--;
  }
  return d;
}
const parenDelta = line => {
  let d = 0, s = false;
  for (const c of codeOf(line)) { if (c === '"') s = !s; else if (!s && c === "(") d++; else if (!s && c === ")") d--; }
  return d;
};
const CONTINUATION = /^\s*(::|realizes\b|satisfies\b|technology\b|meta\b|returns\b|throws\b|\{)/;
const isBlankOrComment = l => /^\s*(\/\/.*)?$/.test(l);

/* Split a block body (array of lines) into items: { lead: [comment/blank
   lines before it], lines: [the statement or block], kw, name }. */
function splitItems(lines) {
  const items = [];
  let lead = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isBlankOrComment(l)) { lead.push(l); continue; }
    const stmt = [l];
    let depth = braceDelta(l), paren = parenDelta(l);
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (depth > 0 || paren > 0 || CONTINUATION.test(next)) {
        i++;
        stmt.push(next);
        depth += braceDelta(next);
        paren += parenDelta(next);
        continue;
      }
      break;
    }
    items.push(Object.assign({ lead, lines: stmt }, classify(stmt)));
    lead = [];
  }
  return { items, trailing: lead };
}
function classify(stmt) {
  const first = codeOf(stmt[0]).trim();
  const kw = (first.match(/^([A-Za-z-]+)/) || [])[1] || "";
  let name = (first.match(/^[A-Za-z-]+\s+([A-Za-z_]\w*)/) || [])[1] || "";
  if (kw === "import") name = (first.match(/(\w+)\s+from\s+domain/) || [])[1] || name;
  return { kw, name };
}
/* The body lines of a block item (between its first `{` line and last `}`) */
function blockBody(lines) {
  let open = -1;
  for (let i = 0; i < lines.length; i++) if (braceDelta(lines[i]) > 0 || /\{\s*$/.test(codeOf(lines[i]))) { open = i; break; }
  if (open < 0) return null;
  return { header: lines.slice(0, open + 1), body: lines.slice(open + 1, -1), footer: lines.slice(-1) };
}
/* Replace identifiers outside strings */
function renameIdents(line, map) {
  if (!map || map.size === 0) return line;
  let out = "", s = false, i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"' && line[i - 1] !== "\\") { s = !s; out += c; i++; continue; }
    if (!s && c === "/" && line[i + 1] === "/") { out += line.slice(i); break; }
    if (!s && /[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < line.length && /\w/.test(line[j])) j++;
      const word = line.slice(i, j);
      out += map.get(word) ?? word;
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
const norm = lines => lines.map(l => codeOf(l).trim()).filter(Boolean).join(" ").replace(/\s+/g, " ");

/* ---------------------------------------------------------------- read sources */
const report = { renamed: [], dupDiffer: [], interfaceOwners: 0, flowsFused: [], retargeted: [], unresolved: [], conflicts: [] };

function readSource(file) {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  // the `architecture … {` block
  const top = splitItems(lines).items.find(it => it.kw === "architecture");
  if (!top) throw new Error(`${file}: no architecture block`);
  const archBlock = blockBody(top.lines);
  const members = splitItems(archBlock.body).items;
  const sysItem = members.find(it => it.kw === "system");
  if (!sysItem) throw new Error(`${file}: no system block`);
  const sysBlock = blockBody(sysItem.lines);
  const domainItem = members.find(it => it.kw === "domain-source");
  const domainSource = domainItem ? (codeOf(domainItem.lines[0]).match(/"([^"]*)"/) || [])[1] : null;
  return {
    file,
    domainFile: domainSource ? path.resolve(path.dirname(file), domainSource) : null,
    persons: members.filter(it => it.kw === "person"),
    externals: members.filter(it => it.kw === "externalSystem"),
    system: {
      name: sysItem.name,
      lead: sysItem.lead,
      header: sysBlock.header,
      footer: sysBlock.footer,
      ...splitItems(sysBlock.body),
    },
  };
}
const sources = inputs.map(readSource);
const systemNames = new Set(sources.map(s => s.system.name));
if (systemNames.size !== sources.length) throw new Error("two sources declare the same system name");

/* ---------------------------------------------------------------- element index */
/* containers / components of a system, with their provides / requires */
function indexElements(sys) {
  const els = [];
  for (const it of sys.items) {
    if (it.kw !== "container") continue;
    const container = { name: it.name, kind: "container", provides: new Set(), requires: new Set() };
    els.push(container);
    const b = blockBody(it.lines);
    if (!b) continue;
    let depth = 0, current = container;
    for (const l of b.body) {
      const code = codeOf(l).trim();
      if (depth === 0) {
        const m = code.match(/^component\s+(\w+)/);
        if (m) { current = { name: m[1], kind: "component", provides: new Set(), requires: new Set() }; els.push(current); }
        else current = container;
        const p = code.match(/^(provides|requires)\s+(\w+)/);
        if (p) container[p[1]].add(p[2]);
      } else if (depth === 1) {
        const p = code.match(/^(provides|requires)\s+(\w+)/);
        if (p) current[p[1]].add(p[2]);
      }
      depth += braceDelta(l);
      if (depth === 0) current = container;
    }
  }
  return els;
}

/* rename element names declared in more than one system */
const declaredIn = new Map();
for (const s of sources) for (const e of indexElements(s.system)) {
  if (!declaredIn.has(e.name)) declaredIn.set(e.name, new Set());
  declaredIn.get(e.name).add(s.system.name);
}
for (const s of sources) {
  const map = new Map();
  for (const [n, syss] of declaredIn) {
    if (syss.size > 1 && syss.has(s.system.name)) map.set(n, n + s.system.name);
  }
  s.renames = map;
  if (map.size) {
    for (const it of s.system.items) it.lines = it.lines.map(l => renameIdents(l, map));
    for (const [a, b] of map) report.renamed.push(`${a} → ${b} (${s.system.name})`);
  }
}
const elements = new Map();   // element name → { sys, kind, provides, requires }
for (const s of sources) for (const e of indexElements(s.system)) elements.set(e.name, Object.assign(e, { sys: s.system.name }));
const personNames = new Set(sources.flatMap(s => s.persons.map(p => p.name)));

/* ---------------------------------------------------------------- types & interfaces */
const DEF_KINDS = new Set(["typedef", "enum", "struct", "exception", "union", "interface"]);
const defs = new Map();   // name → [{ sys, item }]
for (const s of sources) for (const it of s.system.items) {
  if (!DEF_KINDS.has(it.kw) || !it.name) continue;
  if (!defs.has(it.name)) defs.set(it.name, []);
  defs.get(it.name).push({ sys: s.system.name, item: it });
}
const keep = new Set();   // items kept
for (const [n, list] of defs) {
  let owner = list[0];
  if (list[0].item.kw === "interface") {
    const providers = [...elements.values()].filter(e => e.provides.has(n)).map(e => e.sys);
    const own = list.find(d => providers.includes(d.sys));
    if (own) { owner = own; report.interfaceOwners++; }
  }
  keep.add(owner.item);
  const ref = norm(owner.item.lines);
  for (const d of list) if (d !== owner && norm(d.item.lines) !== ref) report.dupDiffer.push(`${n}: ${d.sys} differs from ${owner.sys} (kept ${owner.sys})`);
}

/* ---------------------------------------------------------------- connectors */
const CONNECT = /^\s*connect\s+(\S+)\s*->\s*(\S+)\s+over\s+("(?:[^"\\]|\\.)*")\s+(sync|async|streaming)\b(.*)$/;
const ref = r => { const [head, ...rest] = r.split("."); return { head, iface: rest.length ? rest.join(".") : null }; };
const refText = r => r.iface ? `${r.head}.${r.iface}` : r.head;
const flows = new Map();
let order = 0;
for (const s of sources) for (const it of s.system.items) {
  if (it.kw !== "connect") continue;
  const m = it.lines.map(l => codeOf(l).trim()).join(" ").match(CONNECT);
  if (!m) { report.unresolved.push(`${s.system.name}: unreadable connector ${it.lines[0].trim()}`); continue; }
  const desc = (m[5].match(/::\s*"([^"]*)"/) || [])[1] || "";
  const id = (desc.match(/^([A-Z]+\d+[a-z]?)(?:\s|$)/) || [])[1] || `#${order}`;
  if (!flows.has(id)) flows.set(id, []);
  flows.get(id).push({ id, sys: s.system.name, from: ref(m[1]), to: ref(m[2]), proto: m[3], style: m[4], rest: m[5].trimEnd(), order: order++ });
}
const isSystem = h => systemNames.has(h);
function pickEnd(versions, side) {
  const precise = versions.filter(v => !isSystem(v[side].head));
  const chosen = (precise[0] || versions[0])[side];
  const others = new Set(precise.map(v => v[side].head));
  if (others.size > 1) report.conflicts.push(`${versions[0].id} ${side}: ${[...others].join(" / ")} (kept ${chosen.head})`);
  const iface = chosen.iface || versions.map(v => v[side].iface).find(Boolean) || null;
  return { head: chosen.head, iface: precise.length ? chosen.iface : iface };
}
function retarget(end, sideIface, role, flowId) {
  if (!isSystem(end.head)) return end;
  const iface = end.iface || sideIface;
  if (!iface) { report.unresolved.push(`${flowId}: ${end.head} (no interface to look up)`); return end; }
  const cands = [...elements.values()].filter(e => e.sys === end.head && e[role].has(iface));
  // prefer components over their container when both declare it
  const comps = cands.filter(e => e.kind === "component");
  const pool = comps.length ? comps : cands;
  if (pool.length === 1) {
    report.retargeted.push(`${flowId}: ${refText(end)} → ${pool[0].name}.${iface}`);
    return { head: pool[0].name, iface };
  }
  report.unresolved.push(`${flowId}: ${refText(end)} — ${pool.length ? pool.map(e => e.name).join(", ") : "no element"} ${role === "provides" ? "provides" : "requires"} ${iface}`);
  return end;
}
const merged = [];
for (const [id, versions] of flows) {
  versions.sort((a, b) => a.order - b.order);
  let from = pickEnd(versions, "from");
  let to = pickEnd(versions, "to");
  to = retarget(to, from.iface, "provides", id);
  from = retarget(from, to.iface, "requires", id);
  const rests = [...new Set(versions.map(v => v.rest))];
  const rest = rests.sort((a, b) => b.length - a.length)[0];
  if (versions.length > 1) report.flowsFused.push(`${id}: ${versions.map(v => v.sys).join(" + ")} → ${refText(from)} -> ${refText(to)}`);
  const sysOf = h => elements.get(h)?.sys ?? (isSystem(h) ? h : null);
  const home = (!personNames.has(from.head) && sysOf(from.head)) || sysOf(to.head) || versions[0].sys;
  merged.push({ id, home, order: versions[0].order,
    text: `    connect ${refText(from)} -> ${refText(to)} over ${versions[0].proto} ${versions[0].style}${rest}` });
}

/* ---------------------------------------------------------------- persons & external systems */
const persons = [];
const seenPersons = new Set();
for (const s of sources) for (const p of s.persons) {
  if (seenPersons.has(p.name)) continue;
  seenPersons.add(p.name);
  persons.push(p.lines.join("\n"));
}
const externals = new Map();   // name → { header, body: [] }
for (const s of sources) for (const x of s.externals) {
  if (systemNames.has(x.name)) continue;
  const b = blockBody(x.lines);
  const entry = externals.get(x.name) || { header: b ? b.header : x.lines, body: [] };
  if (b) for (const l of b.body) {
    const code = codeOf(l).trim();
    if (code && !entry.body.some(e => codeOf(e).trim() === code)) entry.body.push(l);
  }
  externals.set(x.name, entry);
}
const externalText = ([, e]) => {
  if (!e.body.length) return e.header.join("\n").replace(/\s*\{\s*$/, "");
  const header = e.header.join("\n");
  return `${/\{\s*$/.test(header) ? header : header + " {"}\n${e.body.join("\n")}\n  }`;
};

/* ---------------------------------------------------------------- emit systems */
const SECTION = /^\s*\/\/\s*-{2,}/;
function emitSystem(s) {
  const sys = s.system;
  const own = merged.filter(c => c.home === sys.name).sort((a, b) => a.order - b.order);
  const out = [];
  let carried = null;        // lead of removed items (section headers)
  let connectorsDone = false;
  const pushLead = lead => {
    if (carried && !lead.some(l => SECTION.test(l))) out.push(...carried);
    carried = null;
    out.push(...lead);
  };
  for (const it of sys.items) {
    if (it.kw === "connect") {
      if (!connectorsDone) {
        pushLead(it.lead);
        for (const c of own) out.push(c.text);
        connectorsDone = true;
      } else if (it.lead.some(l => SECTION.test(l))) carried = it.lead;
      continue;
    }
    const removed = (DEF_KINDS.has(it.kw) && it.name && !keep.has(it)) ||
      (it.kw === "import" && out.some(l => codeOf(l).trim() === codeOf(it.lines[0]).trim()));
    if (removed) {
      if (it.lead.some(l => SECTION.test(l))) carried = it.lead;
      continue;
    }
    if (it.kw === "environment" && !connectorsDone && own.length) {
      out.push("", "    // ---- Connecteurs ----");
      for (const c of own) out.push(c.text);
      connectorsDone = true;
    }
    pushLead(it.lead);
    out.push(...it.lines);
  }
  if (!connectorsDone && own.length) {
    out.push("", "    // ---- Connecteurs ----");
    for (const c of own) out.push(c.text);
  }
  out.push(...sys.trailing);
  // collapse runs of blank lines
  const tidy = out.filter((l, i) => !(i > 0 && l.trim() === "" && out[i - 1].trim() === ""));
  return [
    "",
    `  // ===========================================================================`,
    `  // Système ${sys.name} — source ${path.basename(s.file)}`,
    `  // ===========================================================================`,
    ...sys.header.map(l => renameIdents(l, s.renames)),
    ...tidy,
    ...sys.footer,
  ].join("\n");
}

/* ---------------------------------------------------------------- assemble */
const outDir = path.dirname(path.resolve(out));
// the domain-source as written, else a file of that name next to the output
const domainFiles = [...new Set(sources.map(s => s.domainFile).filter(Boolean).map(f =>
  fs.existsSync(f) || !fs.existsSync(path.join(outDir, path.basename(f))) ? f : path.join(outDir, path.basename(f))))];
if (domainFiles.length > 1) console.error(`warning: several domain-source files, keeping ${domainFiles[0]}`);
const domainSource = domainFiles.length ? path.relative(outDir, domainFiles[0]) : null;
const archName = name || "PaysageApplicatif";
const archDesc = description || `Paysage applicatif : ${sources.length} systèmes`;
const q = s => `"${String(s).replace(/"/g, '\\"')}"`;
const text = [
  "// =============================================================================",
  `// ${archDesc}`,
  "// Specy .arch — paysage applicatif C4 (system landscape) : un bloc `system` par système.",
  `// Fusion de ${sources.length} architectures par ui/scripts/merge-arch.mjs — ne pas éditer à la main :`,
  `//   node scripts/merge-arch.mjs -o ${path.relative(process.cwd(), out)} ${inputs.map(f => path.relative(process.cwd(), f)).join(" ")}`,
  "// Noms uniques dans tout le fichier : chaque type est déclaré une fois (premier système qui le",
  "// déclare), chaque interface dans le système qui la fournit ; un flux décrit des deux côtés",
  "// (même identifiant de flux) est un seul connecteur, rangé dans le système de sa source.",
  "// =============================================================================",
  "",
  `architecture ${archName} :: ${q(archDesc)} {`,
  "",
  ...(domainSource ? [`  domain-source ${q(domainSource)}`, ""] : []),
  "  // ---- Niveau 1 : personnes ----",
  ...persons,
  "",
  "  // ---- Niveau 1 : systèmes externes (hors du paysage modélisé) ----",
  ...[...externals].map(externalText).join("\n\n").split("\n"),
  ...sources.map(emitSystem),
  "}",
  "",
].join("\n");
fs.writeFileSync(out, text);

/* ---------------------------------------------------------------- report */
const e = (...a) => console.error(...a);
e(`wrote ${out}: ${sources.length} systems, ${persons.length} persons, ${externals.size} external systems, ${merged.length} connectors (${[...flows.values()].reduce((n, v) => n + v.length, 0)} in the sources)`);
e(`types/interfaces: ${defs.size} names, ${[...defs.values()].reduce((n, l) => n + l.length - 1, 0)} duplicate declarations dropped, ${report.interfaceOwners} interfaces placed with their provider`);
const section = (title, list) => { if (list.length) { e(`${title} (${list.length}):`); for (const x of list) e("  " + x); } };
section("renamed", report.renamed);
section("differing duplicate declarations", report.dupDiffer);
section("flows fused", report.flowsFused);
section("endpoints retargeted", report.retargeted);
section("endpoints left on a whole system", report.unresolved);
section("conflicting precise endpoints", report.conflicts);

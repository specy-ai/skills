#!/usr/bin/env node
/* Validates a level-0 `.arch` — an `organization` root: systems, dependencies
   and numbered flows of domain concepts (SOFTWARE-ARCHITECTURE-METAMODEL.md,
   "Level 0 — Organization") — as the Navigator reads it:
     1. parses the file with ui/arch-parser.js and its `domain-source`s with
        ui/domain-parser.js (paths relative to the .arch). A declared domain
        source that is missing, unreadable or yields no bounded context is a
        violation: the concept references cannot be checked. `--no-domain`
        checks the structure alone, and says so
     2. reports what the grammar rejects at level 0 (the reader's `issues`:
        a statement not written as its production, a level-0 clause after a
        member of levels 2–3, `handles` on an external system, an empty phase
        block, a phase without mechanism, an unknown pattern…)
     3. checks the rules that need no judgment: flow numbers unique and
        positive; `to` names an end of its dependency; referenced areas,
        phases, persons and systems declared; one dependency per ordered
        pair, none to itself, at least one end inside the organization; one
        pattern per side; `Partnership` on both dependencies of a pair or on
        neither, never with CS / Conformist / ACL / OHS; no pattern between
        two systems realizing the same bounded context; no `as` received by a
        Conformist downstream; a hotspot concerns flows of its own system; a
        phase listed at most once per flow; every system states its purpose
        and is detailed at most once; connector ends resolve; a concept
        mastered by at most one system
     4. resolves every concept reference with ui/arch-concepts.js: each one
        resolves to exactly one domain element or is acknowledged by a
        `// NOTE:` — ambiguous and unacknowledged names are violations — and
        `masters` names an entity or aggregate of a context the system
        realizes, or a read-only entity sourced from it. A name matched only
        after normalisation is a warning
     5. converts the organization into the Navigator's concept landscape —
        the domain concepts by system (ui/arch-to-diagram.js
        `conceptLandscapeDiagram`) — with every toggle combination and
        checks the DiagramFiles against the group contract of
        diagram-engine/docs/DERIVED-DIAGRAMS.md §7: parents before members,
        `er-group` iff members, every modelRef resolving, every system drawn
        once, every resolved `masters` / `handles` reference one card inside
        its system, every dependency between drawn systems one edge between
        the system nodes, flows and the unplaced group only when toggled on
     6. prints counts; exits non-zero on a violation
   For the default example it writes the default conversion to
   ../diagram-engine/examples/diagrams/navigator-concept-landscape.json as an
   engine fixture; a file passed on the command line is checked only.
   Usage: node ui/scripts/check-arch-landscape.mjs [--no-domain] [path/to/file.arch]
          (default: examples/retail-media/retail-media.arch) */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const read = f => fs.readFileSync(f, "utf8");
function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(UI, "..");
const USAGE = "usage: node ui/scripts/check-arch-landscape.mjs [--no-domain] [path/to/file.arch]";
const options = process.argv.slice(2).filter(a => a.startsWith("--"));
const files = process.argv.slice(2).filter(a => !a.startsWith("--"));
for (const o of options) if (o !== "--no-domain") fail(`unknown option ${o} — ${USAGE}`);
if (files.length > 1) fail(`one file at a time — ${USAGE}`);
/* structure alone: the domain sources are not read, the concept references not checked */
const NO_DOMAIN = options.includes("--no-domain");
const ARCH = files[0]
  ? path.resolve(files[0])
  : path.join(SKILL, "examples", "retail-media", "retail-media.arch");

/* ---- load the parsers + the resolver in a bare context (no window/document) ---- */
const ctx = vm.createContext({ console, module: { exports: {} } });
for (const f of ["domain-parser.js", "arch-parser.js", "arch-concepts.js", "arch-to-diagram.js"])
  vm.runInContext(read(path.join(UI, f)), ctx, { filename: f });
/* top-level declarations of a classic script land in the context's global
   lexical scope — read them back through an expression */
const { parseDomain, parseArch, SpecyArchConcepts: C, SpecyArchDiagrams: A } =
  vm.runInContext("({ parseDomain, parseArch, SpecyArchConcepts, SpecyArchDiagrams })", ctx);
const ENGINE_EXAMPLES = path.resolve(SKILL, "..", "diagram-engine", "examples", "diagrams");

/* ---- parse ---- */
if (!fs.existsSync(ARCH)) fail("no such file " + ARCH);
const arch = parseArch(read(ARCH), path.basename(ARCH).replace(/\.arch$/, ""));
if (arch.root !== "organization") {
  console.log(`model     ${arch.name}  (${ARCH})`);
  console.log("not an organization file (root `architecture`): no level 0 to check — see check-arch-export.mjs");
  process.exit(0);
}

const errors = [];
const err = (line, msg) => errors.push({ line: line || 0, msg });
const put = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };

/* ---- domain sources: relative to the .arch, else the same file name next
   to it (the navigator serves every model flat from ui/). One that is
   declared and cannot be resolved against is a violation — an unknown
   concept name must not pass for want of a model to look it up in. ---- */
const sources = C.domainSources(arch);
const domainOrgs = [], notLoaded = [], domainLines = [];
for (const source of NO_DOMAIN ? [] : sources) {
  let file = path.resolve(path.dirname(ARCH), source);
  if (!fs.existsSync(file)) file = path.resolve(path.dirname(ARCH), path.basename(source));
  if (!fs.existsSync(file)) { notLoaded.push(`domain-source "${source}": no such file next to the .arch`); continue; }
  let org;
  try { org = parseDomain(read(file), C.domainStem(file)); }
  catch (e) { notLoaded.push(`domain-source "${source}" cannot be read: ${e.message}`); continue; }
  if (!org || !org.contexts || !org.contexts.length) {
    notLoaded.push(`domain-source "${source}" yields no bounded context: its definitions have nothing to be qualified with`);
    continue;
  }
  domainOrgs.push(org);
  const elements = org.contexts.reduce((n, c) => n + c.modules.reduce((m, mod) => m + mod.elements.length, 0), 0);
  domainLines.push(`${source} (${org.contexts.length} contexts: ${org.contexts.map(c => c.name).join(", ")}; ${elements} elements)`);
}
for (const x of notLoaded) err(0, `${x} — the concept references cannot be checked (--no-domain checks the structure alone)`);
const resolving = !NO_DOMAIN && sources.length > 0 && !notLoaded.length;
const resolver = C.resolver(arch, resolving ? domainOrgs : []);
const summary = resolver.resolveAll();

/* ---- what the grammar rejects at level 0 (recorded by the reader) ---- */
for (const i of arch.issues) err(i.line, i.message);

/* ---- declarations ---- */
const systems = new Map(arch.systems.map(s => [s.name, s]));
const externals = new Map(arch.externalSystems.map(x => [x.name, x]));
const persons = new Set(arch.persons.map(p => p.name));
const areas = new Set(arch.areas.map(a => a.name));
const phases = arch.phases.map(p => p.name);
for (const [kind, items] of [["phase", arch.phases], ["area", arch.areas], ["person", arch.persons], ["external system", arch.externalSystems]]) {
  const seen = new Set();
  for (const x of items) {
    if (seen.has(x.name)) err(x.line, `${kind} ${x.name} is declared more than once`);
    seen.add(x.name);
  }
}
for (const x of arch.externalSystems)
  if (systems.has(x.name)) err(x.line, `${x.name} is both a system and an external system`);
if (!arch.systems.length) err(0, "an organization has at least one system");
/* the bounded contexts a system realizes, comparable across systems: the
   domain's context when it is loaded and knows the name, else the name as written */
const contextKeys = s => [...new Set(((s && s.contexts) || []).flatMap(n => {
  const known = resolving ? resolver.index.contexts.get(C.norm(n)) || [] : [];
  return known.length ? known.map(e => e.ctx.id) : ["name:" + C.norm(n)];
}))].sort();

/* ---- flows by number ---- */
const flowsByNumber = new Map();
for (const f of arch.flows) put(flowsByNumber, f.number, f);
for (const [n, fl] of flowsByNumber) {
  if (fl.length > 1) err(fl[1].line, `flow number ${n} is used ${fl.length} times (lines ${fl.map(f => f.line).join(", ")})`);
  if (!(n >= 1)) err(fl[0].line, `flow ${n}: a flow number is a positive integer`);
}

/* ---- systems ---- */
for (const s of arch.systems) {
  if (!s.description) err(s.line, `system ${s.name} states no purpose (:: "…")`);
  if (s.area && !areas.has(s.area)) err(s.line, `system ${s.name}: area ${s.area} is not declared`);
  for (const p of s.usedBy) if (!persons.has(p)) err(s.line, `system ${s.name}: used-by ${p} is not a declared person`);
  if (s.detailedIn && (s.containers.length || s.interfaces.length || s.channels.length || s.connectors.length || s.environments.length))
    err(s.line, `system ${s.name} is detailed twice: inline and in ${s.detailedIn}`);
  for (const h of s.hotspots) {
    for (const n of h.flows) {
      const fl = flowsByNumber.get(n) || [];
      if (!fl.length) err(h.line, `hotspot ${h.name} of ${s.name} concerns flow ${n}, which does not exist`);
      else if (!fl.some(f => f.sender === s.name || f.receiver === s.name))
        err(h.line, `hotspot ${h.name} of ${s.name} concerns flow ${n}, a flow of ${fl[0].dependency}: ${s.name} is at neither end`);
    }
  }
  for (const c of s.connectors)
    for (const [side, end] of [["from", c.from], ["to", c.to]])
      if (!end.kind) err(c.line, `system ${s.name}: connector ${c.id} ${side} "${end.name}" is neither local to it, a system, a person nor an external system`);
}

/* ---- dependencies + flows (an unknown pattern or criticality is among the reader's issues) ---- */
const DOWNSTREAM = new Set(["CS", "Conformist", "ACL"]);
const UPSTREAM = new Set(["OHS"]);
const SHARED = new Set(["SharedKernel", "PublishedLanguage"]);
const firstOfPair = new Map();
for (const d of arch.dependencies) {
  const pair = `${d.from} -> ${d.to}`;
  const declared = n => systems.has(n) || externals.has(n);
  if (!declared(d.from)) err(d.line, `dependency ${pair}: downstream ${d.from} is neither a system nor an external system`);
  if (!declared(d.to)) err(d.line, `dependency ${pair}: upstream ${d.to} is neither a system nor an external system`);
  if (declared(d.from) && declared(d.to) && !systems.has(d.from) && !systems.has(d.to))
    err(d.line, `dependency ${pair}: at least one end is a system of the organization`);
  if (d.from === d.to) err(d.line, `dependency ${pair}: a system does not depend on itself`);
  if (firstOfPair.has(pair)) err(d.line, `dependency ${pair} is declared twice (first on line ${firstOfPair.get(pair)}): at most one per ordered pair`);
  else firstOfPair.set(pair, d.line);

  for (const [side, set] of [["downstream", DOWNSTREAM], ["upstream", UPSTREAM], ["shared", SHARED], ["partnership", new Set(["Partnership"])]]) {
    const on = d.patterns.filter(p => set.has(p));
    if (on.length > 1) err(d.line, `dependency ${pair}: more than one ${side} pattern (${on.join(", ")})`);
  }
  /* the same bounded context(s) on both sides: no context boundary is crossed, so no pattern */
  const down = contextKeys(systems.get(d.from) || externals.get(d.from)), up = contextKeys(systems.get(d.to) || externals.get(d.to));
  if (d.patterns.length && d.from !== d.to && down.length && down.join("|") === up.join("|")) {
    const same = (systems.get(d.from) || externals.get(d.from)).contexts.join(", ");
    err(d.line, `dependency ${pair}: ${d.from} and ${d.to} realize the same bounded context (${same}) — no boundary is crossed, so no pattern (${d.patterns.join(", ")})`);
  }
  if (d.patterns.includes("Partnership")) {
    const excluded = d.patterns.filter(p => DOWNSTREAM.has(p) || UPSTREAM.has(p));
    if (excluded.length) err(d.line, `dependency ${pair}: Partnership excludes ${excluded.join(", ")}`);
    const back = arch.dependencies.find(x => x.from === d.to && x.to === d.from);
    if (!back) err(d.line, `dependency ${pair}: Partnership on a one-way dependency`);
    else if (!back.patterns.includes("Partnership")) err(d.line, `dependency ${pair} carries Partnership, ${back.from} -> ${back.to} (line ${back.line}) does not`);
  }

  for (const f of d.flows) {
    if (f.to && f.to !== d.from && f.to !== d.to) err(f.line, `flow ${f.number}: to ${f.to} names no end of ${pair}`);
    if (d.patterns.includes("Conformist") && f.receiver === d.from)
      for (const c of f.carries)
        if (c.as) err(f.line, `flow ${f.number}: ${d.from} is Conformist on ${pair}, yet receives ${c.concept.raw} as ${c.as.raw}`);
    const listed = new Set();
    for (const p of f.perPhase) {
      if (!phases.includes(p.phase)) err(p.line, `flow ${f.number}: phase ${p.phase} is not declared`);
      if (listed.has(p.phase)) err(p.line, `flow ${f.number} lists phase ${p.phase} more than once`);
      listed.add(p.phase);
    }
  }
}

/* ---- concept references ---- */
for (const p of summary.problems) err(p.line, p.message);
for (const p of summary.domainProblems) err(0, p.message);
const warnings = summary.inexact.map(i => `line ${i.line}: ${i.message}`);

/* `masters` names an entity or aggregate of a context the system realizes, or
   a read-only entity the domain says is sourced from that system (its name,
   or a context it realizes — compared as names are, after normalisation).
   Only a concept with identity has a system of record. */
for (const r of summary.references) {
  const x = r.resolution;
  if (r.site !== "masters" || x.status !== "resolved") continue;
  const holder = systems.get(r.system) || externals.get(r.system);
  const what = `${r.system} masters ${x.context}.${x.name}, ${/^[aeiou]/.test(x.kindLabel) ? "an" : "a"} ${x.kindLabel}`;
  if (x.kind === "entity" || x.kind === "aggregate") {
    if (!contextKeys(holder).includes(x.contextId))
      err(r.ref.line, `${what} of a context ${r.system} does not realize: a system masters the entities and aggregates of its own contexts`);
  } else if (x.kind === "readonly-entity") {
    const itself = new Set([r.system, ...holder.contexts, ...resolver.ownContexts(r.system).flatMap(c => [c.name, c.shortname])].map(C.norm));
    if (!x.sourcedFrom) err(r.ref.line, `${what} the domain does not say is sourced from ${r.system} (no sourced-from)`);
    else if (!itself.has(C.norm(x.sourcedFrom))) err(r.ref.line, `${what} sourced from ${x.sourcedFrom}, not from ${r.system}`);
  } else {
    err(r.ref.line, `${what}: only an entity or an aggregate has a system of record`);
  }
}

/* a concept is mastered by at most one system (external systems included).
   Resolved references are compared by element, the others by name; when a
   declared domain source is not read, same-name masters may be homonyms
   and are only listed. */
const masters = new Map();
for (const r of summary.references) {
  const x = r.resolution;
  if (r.site !== "masters" || x.status === "ambiguous") continue;   // an ambiguous name is reported as such
  put(masters, x.status === "resolved" ? x.id : "name:" + r.ref.raw, r);
}
for (const rs of masters.values()) {
  const who = [...new Set(rs.map(r => r.system))];
  if (who.length < 2) continue;
  const x = rs[0].resolution;
  const label = x.status === "resolved" ? `${x.context}.${x.name}` : rs[0].ref.raw;
  if (sources.length && !resolving) warnings.push(`${label} is mastered by ${who.join(" and ")} — one concept or homonyms: not decidable without the domain source`);
  else err(rs[1].ref.line, `${label} is mastered by ${who.join(" and ")}: a concept has at most one system of record`);
}

/* ---- the concept landscape: the same organization at concept granularity
   (the Navigator's "domain concepts by system"), converted with every
   toggle combination and checked against the group contract ---- */
const conceptLines = [];
let conceptDefault = null;
if (typeof A.conceptLandscapeDiagram === "function") {
  const SHOW = A.CONCEPT_LANDSCAPE_DEFAULT_SHOW;
  const variants = [["default", {}]];
  for (const k of Object.keys(SHOW)) variants.push([`${k} ${SHOW[k] ? "off" : "on"}`, { [k]: !SHOW[k] }]);
  variants.push(["all on", Object.fromEntries(Object.keys(SHOW).map(k => [k, true]))]);
  variants.push(["all off", Object.fromEntries(Object.keys(SHOW).map(k => [k, false]))]);
  for (const [label, show] of variants) {
    const report = {};
    let F;
    try {
      F = A.conceptLandscapeDiagram(arch, show, { resolution: resolving ? summary : null, domainOrgs: resolving ? domainOrgs : [], report });
    } catch (e) { err(0, `concept landscape [${label}] threw: ${e.message}`); continue; }
    const full = Object.assign({}, SHOW, show);
    checkConceptLandscape(F, label, full, report);
    if (label === "default") conceptDefault = F;
    conceptLines.push(`  [${label.padEnd(19)}] ${String(F.diagram.nodes.length).padStart(3)} nodes (${report.groups} system groups, ${report.cards} cards, ${report.notes} notes${full.unplaced ? `, ${report.unplaced} unplaced` : ""})  ${String(F.diagram.edges.length).padStart(3)} edges${full.flows ? ` (${report.flows} flows, ${report.flowsAtSystem} at a system node)` : ""}${report.dropped.length ? `  dropped ${report.dropped.map(d => d.id).join(", ")}` : ""}`);
  }
} else {
  err(0, "ui/arch-to-diagram.js has no conceptLandscapeDiagram: the concept landscape cannot be checked");
}

function checkConceptLandscape(F, label, show, report) {
  const E = msg => err(0, `concept landscape [${label}]: ${msg}`);
  if (!F || !F.model || !F.diagram) { E("no DiagramFile"); return; }
  if (F.version !== 1) E("version must be 1");
  if (F.model.metamodel !== "software-architecture") E("metamodel " + F.model.metamodel);
  if (F.model.id !== A.conceptLandscapeModelIdOf(arch)) E(`model id ${F.model.id}`);
  if (F.diagram.id !== F.model.id + "#concepts") E(`diagram id ${F.diagram.id}`);
  const L = F.diagram.layout || {};
  if (L.engine !== "dagre" || L.handles !== "auto") E("layout must be dagre with handles auto");

  const elById = new Map(), relById = new Map();
  for (const e of F.model.elements) {
    if (!e.id || !e.type || !e.data) E("element without id/type/data");
    if (elById.has(e.id)) E("duplicate element id " + e.id);
    elById.set(e.id, e);
  }
  for (const r of F.model.relations) {
    if (relById.has(r.id)) E("duplicate relation id " + r.id);
    relById.set(r.id, r);
    for (const side of ["sourceElementId", "targetElementId"]) if (!elById.has(r[side])) E(`relation ${r.id} ${side} unknown`);
    if (!["dependency", "flow"].includes(r.type)) E(`relation ${r.id} type ${r.type}`);
  }

  const nodeById = new Map(), members = new Map(), nodeOfElement = new Map();
  for (const n of F.diagram.nodes) {
    if (!n.id || !n.type || !n.data) { E("node without id/type/data"); continue; }
    if (nodeById.has(n.id)) E("duplicate node id " + n.id);
    if ("position" in n) E(`node ${n.id} carries a position`);
    if (!["er-group", "er-concept"].includes(n.type)) E(`node ${n.id} type ${n.type}`);
    if (n.parentId != null) {
      const p = nodeById.get(n.parentId);
      if (!p) E(`node ${n.id}: parent ${n.parentId} is not an earlier node`);
      else if (p.type !== "er-group") E(`node ${n.id}: parent ${n.parentId} is not an er-group`);
      if (n.extent !== "parent") E(`member ${n.id} without extent "parent"`);
      members.set(n.parentId, (members.get(n.parentId) || 0) + 1);
    }
    nodeById.set(n.id, n);
    const d = n.data;
    if (!d.modelRef || d.modelRef.modelId !== F.model.id || !elById.has(d.modelRef.elementId)) E(`node ${n.id}: modelRef does not resolve`);
    else {
      if (nodeOfElement.has(d.modelRef.elementId)) E(`element ${d.modelRef.elementId} drawn twice`);
      nodeOfElement.set(d.modelRef.elementId, n.id);
    }
    if (!d.name || !d.kind || !d.kindLabel) E(`node ${n.id} lacks name/kind/kindLabel`);
    if (n.type === "er-group" && (d.level == null || !d.foldedWidth)) E(`group ${n.id} without level/foldedWidth`);
    if (d.kind === "concept" || d.kind === "concept-note") {
      if (!n.parentId) E(`concept card ${n.id} outside any group`);
      if (!n.style || n.style.width !== A.CONCEPT_LANDSCAPE_LIMITS.width) E(`concept card ${n.id} width`);
      if (!/concept-card--(masters|handles|unplaced)/.test(n.className || "")) E(`concept card ${n.id} without its site class`);
      if (d.kind === "concept" && !(d.domainRef && d.domainRef.id)) E(`concept card ${n.id} without domainRef`);
      if (d.kind === "concept-note" && d.domainRef) E(`note card ${n.id} carries a domainRef`);
      for (const a of d.actions || []) if (!a.label || !a.href) E(`node ${n.id} malformed action`);
    }
  }
  for (const n of F.diagram.nodes) {
    const isGroup = (members.get(n.id) || 0) > 0;
    if (isGroup !== (n.type === "er-group")) E(`node ${n.id}: er-group iff it has members`);
    if (n.data.kind === "system" && n.parentId && nodeById.get(n.parentId).data.kind !== "area") E(`system ${n.id} nested in a non-area`);
    if (n.data.kind === "externalSystem" && n.parentId) E(`external system ${n.id} is nested`);
  }
  if (!show.externalSystems && F.diagram.nodes.some(n => n.data.kind === "externalSystem")) E("external systems hidden but drawn");
  if (F.diagram.nodes.some(n => n.data.kind === "person")) E("persons drawn");
  if (!show.unplaced && F.diagram.nodes.some(n => n.data.kind === "unplaced")) E("unplaced group drawn while off");

  /* every system drawn once; every (shown) masters / handles reference of a
     system one card inside its node */
  const systemNodes = F.diagram.nodes.filter(n => n.data.kind === "system");
  if (systemNodes.length !== arch.systems.length) E(`${systemNodes.length} system nodes for ${arch.systems.length} systems`);
  const holders = arch.systems.map(s => [s, "system"]).concat(show.externalSystems ? arch.externalSystems.map(x => [x, "externalSystem"]) : []);
  for (const [s, type] of holders) {
    const holderEl = F.model.elements.find(e => e.type === type && e.data.name === s.name);
    if (!holderEl) { E(`${s.name} not in the model`); continue; }
    const cards = F.model.elements.filter(e => e.type === "concept" && e.data.system === s.name);
    const wanted = new Set();
    for (const site of ["masters"].concat(show.handled ? ["handles"] : []))
      for (const ref of s[site] || []) {
        const x = resolving ? summary.of(ref) : null;
        wanted.add(x && x.status === "resolved" ? x.id : "name:" + C.norm(ref.name));
      }
    const drawn = new Set(cards.map(e => e.data.domainId || "name:" + C.norm(e.data.ref)));
    for (const w of wanted) if (!drawn.has(w)) E(`${s.name}: concept ${w} not drawn`);
    if (cards.length !== wanted.size) E(`${s.name}: ${cards.length} cards for ${wanted.size} distinct concepts`);
    if (!show.handled && cards.some(e => e.data.site === "handles")) E(`${s.name}: handled concept drawn while handled is off`);
    const holderNode = nodeOfElement.get(holderEl.id);
    for (const e of cards) {
      const n = nodeById.get(nodeOfElement.get(e.id));
      if (!n || n.parentId !== holderNode) E(`${s.name}: card ${e.id} is not inside its system`);
    }
  }

  /* edges: every relation drawn once, between the nodes of its ends; every
     dependency between two drawn systems present, none to a hidden one */
  const drawnRel = new Set();
  for (const e of F.diagram.edges) {
    if (e.type !== "er-edge" || e.markerEnd !== "er-arrow") E(`edge ${e.id} type / marker`);
    if (e.sourceHandle != null || e.targetHandle != null) E(`edge ${e.id} carries handles`);
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) E(`edge ${e.id} endpoint not a node`);
    const d = e.data || {};
    if (!d.modelRef || !relById.has(d.modelRef.relationId)) { E(`edge ${e.id} modelRef does not resolve`); continue; }
    if (!Array.isArray(d.points) || typeof d.description !== "string") E(`edge ${e.id} without points / description`);
    if (!show.edgeLabels && d.label != null) E(`edge ${e.id} labelled while labels are off`);
    for (const rid of d.relationIds || [d.modelRef.relationId]) {
      const r = relById.get(rid);
      if (!r) { E(`edge ${e.id} relation ${rid} unknown`); continue; }
      if (drawnRel.has(rid)) E(`relation ${rid} drawn twice`);
      drawnRel.add(rid);
      if (nodeOfElement.get(r.sourceElementId) !== e.source || nodeOfElement.get(r.targetElementId) !== e.target) E(`edge ${e.id} endpoints disagree with ${rid}`);
      if (r.type === "flow" && !show.flows) E(`flow ${rid} drawn while flows are off`);
      if (r.type === "flow" && !d.flow) E(`edge ${e.id} of a flow not flagged data.flow`);
    }
  }
  for (const r of F.model.relations) if (!drawnRel.has(r.id)) E(`relation ${r.id} is not drawn`);
  const visible = new Set(F.model.elements.filter(e => e.type === "system" || e.type === "externalSystem").map(e => e.data.name));
  for (const d of arch.dependencies) {
    const expected = visible.has(d.from) && visible.has(d.to) && d.from !== d.to;
    if (expected !== relById.has(d.id)) E(`dependency ${d.id} ${expected ? "missing" : "drawn though an end is hidden"}`);
    if (relById.has(d.id)) {
      const r = relById.get(d.id);
      if (elById.get(r.sourceElementId).data.name !== d.from || elById.get(r.targetElementId).data.name !== d.to) E(`dependency ${d.id} joins the wrong ends`);
    }
  }
  for (const u of report.unresolved || []) E(`unresolved end ${u.side} "${u.name}" of ${u.id}`);
}

/* ---- report ---- */
const tally = (items, key) => {
  const t = new Map();
  for (const x of items) for (const k of [].concat(key(x))) t.set(k, (t.get(k) || 0) + 1);
  return [...t].map(([k, v]) => `${k}=${v}`).join("  ") || "none";
};
const mutual = arch.dependencies.filter(d => d.mutual && d.from < d.to);
const reverseOf = d => arch.dependencies.find(x => x.from === d.to && x.to === d.from);
const isPartnership = d => d.patterns.includes("Partnership") && reverseOf(d) && reverseOf(d).patterns.includes("Partnership");
const numbers = arch.flows.map(f => f.number).filter(n => n != null);
/* the mechanism of a flow in a phase: its own, or the one it lists for that phase; none = open */
const mechanismIn = (f, phase) => (f.perPhase.length ? f.perPhase.find(p => p.phase === phase) || null : f.mechanism);

console.log(`model     ${arch.name}  (${ARCH})`);
console.log(`root      organization${arch.description ? " — " + arch.description : ""}`);
console.log(`domain    ${!sources.length ? "no domain-source: concept references are plain names"
  : NO_DOMAIN ? `not read (--no-domain): ${sources.join(", ")}`
  : domainLines.concat(notLoaded.map(x => "✗ " + x)).join("; ")}`);
console.log(`parsed    ${Object.entries(arch.counts).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`systems   ${arch.systems.length}: ${tally(arch.systems, s => s.detail === "none" ? "black box" : "detailed " + s.detail)}  ·  with technology=${arch.systems.filter(s => s.technology).length}  realizing a context=${arch.systems.filter(s => s.contexts.length).length}  with status=${arch.systems.filter(s => s.status).length}`);
console.log(`areas     ${arch.areas.length}: ${arch.areas.map(a => `${a.name} (${a.systems.length})`).join(", ") || "none"}${arch.systems.some(s => !s.area) ? `  ·  no area: ${arch.systems.filter(s => !s.area).map(s => s.name).join(", ")}` : ""}`);
console.log(`phases    ${arch.phases.length}: ${phases.join(" → ") || "none"}`);
console.log(`dependencies ${arch.dependencies.length}  ·  patterns: ${tally(arch.dependencies, d => d.patterns.length ? d.patterns : "none")}  ·  criticality: ${tally(arch.dependencies, d => d.criticality || "unstated")}`);
console.log(`  mutual pairs ${mutual.length}: ${mutual.map(d => `${d.from} ⇄ ${d.to}${isPartnership(d) ? " (Partnership)" : ""}`).join(", ") || "none"}`);
console.log(`flows     ${arch.flows.length}${numbers.length ? ` (numbers ${Math.min(...numbers)}–${Math.max(...numbers)})` : ""}  ·  mechanism: ${tally(arch.flows, f => f.perPhase.length ? "per phase" : f.mechanism ? "stated once" : "none")}  ·  with an explicit \`to\`: ${arch.flows.filter(f => f.to).map(f => f.number).join(", ") || "none"}  ·  translating (\`as\`): ${arch.flows.filter(f => f.carries.some(c => c.as)).length}`);
for (const phase of phases) {
  const open = arch.flows.filter(f => !mechanismIn(f, phase));
  console.log(`  ${phase}: ${tally(arch.flows.filter(f => mechanismIn(f, phase)), f => mechanismIn(f, phase).mode || "mode unstated")}  open=${open.length}${open.length ? ` (flow ${open.map(f => f.number).join(", ")})` : ""}`);
}
console.log(`hotspots  ${arch.counts.hotspots}: ${arch.systems.flatMap(s => s.hotspots.map(h => `${s.name}.${h.name} [${h.flows.join(", ")}${h.concepts.length ? (h.flows.length ? "; " : "") + h.concepts.map(c => c.raw).join(", ") : ""}]`)).join(", ") || "none"}`);
console.log(`concepts  ${summary.total} references  ·  ${!sources.length ? "plain names (no domain-source)"
  : NO_DOMAIN ? "NOT CHECKED (--no-domain): no reference was resolved against the domain"
  : !resolving ? "NOT CHECKED: a declared domain source could not be resolved against"
  : `resolved=${summary.counts.resolved} (${summary.distinct.resolved} elements)  ambiguous=${summary.counts.ambiguous}  acknowledged=${summary.counts.acknowledged}  unresolved=${summary.counts.unresolved}`}`);
if (resolving) {
  console.log(`  by site: ${tally(summary.references, r => r.site)}  ·  resolved through: ${tally(summary.references.filter(r => r.resolution.status === "resolved"), r => r.resolution.via)}`);
  console.log(`  resolved kinds: ${tally(summary.references.filter(r => r.resolution.status === "resolved"), r => r.resolution.kindLabel)}`);
  console.log(`  acknowledged by a // NOTE: ${summary.acknowledged.map(a => `${a.name} ×${a.uses} (line ${a.line})`).join(", ") || "none"}`);
  /* informational: such a note may be a remark of another kind */
  for (const n of summary.staleNotes) console.log(`  info: line ${n.line} carries a // NOTE: and the names on this line all resolve (${n.names.join(", ")})`);
}
for (const w of warnings) console.log(`  warning: ${w}`);
if (conceptLines.length) {
  console.log(`concept landscape (the domain concepts by system), per toggle combination:`);
  for (const l of conceptLines) console.log(l);
}

if (errors.length) {
  errors.sort((a, b) => a.line - b.line);   // stable: file order, the rules of one line together
  console.error(`\n${errors.length} violation(s):`);
  for (const e of errors.slice(0, 80)) console.error(`  - ${e.line ? `line ${e.line}: ` : ""}${e.msg}`);
  if (errors.length > 80) console.error(`  … and ${errors.length - 80} more`);
  process.exit(1);
}
console.log(`\nOK — the organization satisfies the level-0 structural rules${resolving ? " and every concept reference resolves or is acknowledged"
  : NO_DOMAIN && sources.length ? "; its concept references were NOT checked against the domain (--no-domain)"
  : " (no domain-source: its concept references are plain names)"}`);

/* ---- engine fixture: the default (public) example only — a client model
   passed on the command line is checked but never written into the
   engine's examples ---- */
if (conceptDefault && files[0]) {
  console.log("custom model: concept landscape fixture not written (engine examples stay on retail-media)");
} else if (conceptDefault && fs.existsSync(path.dirname(ENGINE_EXAMPLES))) {
  fs.mkdirSync(ENGINE_EXAMPLES, { recursive: true });
  const out = path.join(ENGINE_EXAMPLES, "navigator-concept-landscape.json");
  fs.writeFileSync(out, JSON.stringify(conceptDefault, null, 2) + "\n");
  console.log(`wrote ${out}  (${conceptDefault.model.id})`);
}

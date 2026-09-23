#!/usr/bin/env node
/* Validates the Navigator → Diagram Engine architecture converter
   (ui/arch-to-diagram.js) against docs/DERIVED-DIAGRAMS.md §7 / §8 using a
   real model:
     1. parses examples/url-shortener/url-shortener.arch with ui/arch-parser.js
        (and its `domain-source` with ui/domain-parser.js, for domainRef links)
     2. converts it with DEFAULT_SHOW, with each toggle off, and all off
     3. checks each DiagramFile: required fields, dagre + handles "auto" layout,
        unique ids, no node position / height, parents before members with
        `extent`, er-group iff it has members, every modelRef resolving, edge
        endpoints among the nodes, dash pattern per relation style, no edge
        into an ancestor, every relation drawn (except the component → own
        container connectors §8 keeps undrawn), no unresolved endpoint
     4. writes the default conversion to
        diagram-engine/examples/diagrams/navigator-architecture.json
   A path on the command line is validated only — never written (client data).
   For a file stem `ffm` the parser counts are asserted.
   Usage: node ui/scripts/check-arch-export.mjs [path/to/file.arch] */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(UI, "..");
const ENGINE_EXAMPLES = path.resolve(SKILL, "..", "diagram-engine", "examples", "diagrams");
const CUSTOM = !!process.argv[2];
const ARCH = CUSTOM
  ? path.resolve(process.argv[2])
  : path.join(SKILL, "examples", "url-shortener", "url-shortener.arch");

const read = f => fs.readFileSync(f, "utf8");
function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }

/* ---- load parsers + converter in a bare context (no window/document) ---- */
const ctx = vm.createContext({ console, module: { exports: {} } });
for (const f of ["domain-parser.js", "arch-parser.js", "arch-to-diagram.js"])
  vm.runInContext(read(path.join(UI, f)), ctx, { filename: f });
/* top-level declarations of a classic script land in the context's global
   lexical scope — read them back through an expression */
const { parseDomain, parseArch, SpecyArchDiagrams: A } = vm.runInContext("({ parseDomain, parseArch, SpecyArchDiagrams })", ctx);

/* ---- parse ---- */
if (!fs.existsSync(ARCH)) fail("no such file " + ARCH);
const stem = path.basename(ARCH).replace(/\.arch$/, "");
const arch = parseArch(read(ARCH), stem);

let domainOrg = null;
if (arch.domainSource) {
  // As the browser does (app.js archDomainStem): the path as written, else
  // the same file name next to the .arch (the navigator serves every model
  // flat from ui/, so `domain-source "../ffm.domain"` means ui/ffm.domain).
  let domainFile = path.resolve(path.dirname(ARCH), arch.domainSource);
  if (!fs.existsSync(domainFile)) domainFile = path.resolve(path.dirname(ARCH), path.basename(arch.domainSource));
  if (fs.existsSync(domainFile)) {
    const dstem = path.basename(domainFile).replace(/\.domain$/, "");
    try { domainOrg = parseDomain(read(domainFile), dstem); }
    catch (e) { console.warn(`domain-source ${arch.domainSource} not parsed: ${e.message}`); }
  } else {
    console.warn(`domain-source ${arch.domainSource} not found next to the .arch — no domainRef links`);
  }
}

const errors = [];
const err = (label, msg) => errors.push(`${label}: ${msg}`);

/* ---- parser counts ---- */
const EXPECTED = {
  // ffm.arch = the FFM landscape merged by scripts/merge-arch.mjs from ffm.arch-sources/*.arch
  ffm: { systems: 11, persons: 19, externalSystems: 9, containers: 42, components: 40, interfaces: 64, channels: 3, connectors: 144, environments: 16 },
};
if (EXPECTED[stem]) {
  for (const [k, v] of Object.entries(EXPECTED[stem]))
    if (arch.counts[k] !== v) err("parser", `${k} = ${arch.counts[k]}, expected ${v}`);
}
for (const k of ["persons", "externalSystems", "containers", "components", "interfaces", "channels", "connectors", "environments"])
  if (typeof arch.counts[k] !== "number") err("parser", `counts.${k} missing`);

/* ---- convert with every toggle combination ---- */
const variants = [["default", A.DEFAULT_SHOW]];
for (const k of Object.keys(A.DEFAULT_SHOW)) variants.push([`${k} off`, Object.assign({}, A.DEFAULT_SHOW, { [k]: false })]);
variants.push(["all off", Object.fromEntries(Object.keys(A.DEFAULT_SHOW).map(k => [k, false]))]);

const results = variants.map(([label, show]) => {
  const report = {};
  const file = A.architectureDiagram(arch, show, { domainOrg, report });
  validate(file, label, show, report);
  return { label, show, file, report };
});

/* ---- contract checks ---- */
function validate(F, label, show, report) {
  const E = msg => err(label, msg);
  if (F.version !== 1) E("version must be 1");
  if (!F.model || !F.diagram) { E("missing model/diagram"); return; }
  for (const k of ["id", "name", "metamodel", "elements", "relations"])
    if (F.model[k] == null) E("model." + k + " missing");
  if (F.model.metamodel !== "software-architecture") E("metamodel " + F.model.metamodel);
  if (F.model.id !== A.modelIdOf(arch)) E("model id " + F.model.id + " ≠ " + A.modelIdOf(arch));
  for (const k of ["id", "name", "nodes", "edges"])
    if (F.diagram[k] == null) E("diagram." + k + " missing");
  if (!String(F.diagram.id).startsWith(F.model.id + "#")) E("diagram.id must be <model id>#…");
  const L = F.diagram.layout || {};
  if (L.engine !== "dagre") E("layout.engine must be dagre");
  if (L.handles !== "auto") E('layout.handles must be "auto"');

  /* elements / relations */
  const elById = new Map(), relById = new Map();
  for (const e of F.model.elements) {
    if (!e.id || !e.type || !e.data) E("element without id/type/data: " + JSON.stringify(e).slice(0, 80));
    if (elById.has(e.id)) E("duplicate element id " + e.id);
    elById.set(e.id, e);
    if (!["person", "externalSystem", "system", "container", "component", "channel"].includes(e.type)) E(`element ${e.id} type ${e.type} is not drawn`);
  }
  for (const r of F.model.relations) {
    if (!r.id || !r.type || !r.sourceElementId || !r.targetElementId) E("relation incomplete: " + JSON.stringify(r));
    if (relById.has(r.id)) E("duplicate relation id " + r.id);
    relById.set(r.id, r);
    for (const side of ["sourceElementId", "targetElementId"])
      if (!elById.has(r[side])) E(`relation ${r.id} ${side} ${r[side]} not an element`);
    if (!["connect", "publishes", "subscribes"].includes(r.type)) E(`relation ${r.id} type ${r.type}`);
    if (r.type === "connect" && !["sync", "async", "streaming"].includes(r.data && r.data.style)) E(`connect ${r.id} without style`);
    if (r.type === "publishes" && !(r.data && Array.isArray(r.data.messages) && r.data.messages.length)) E(`publishes ${r.id} without messages`);
  }

  /* nodes */
  const nodeById = new Map(), nodeOfElement = new Map(), memberCount = new Map();
  for (const n of F.diagram.nodes) {
    if (!n.id || !n.type || !n.data) { E("node without id/type/data: " + JSON.stringify(n).slice(0, 80)); continue; }
    if (nodeById.has(n.id)) E("duplicate node id " + n.id);
    if ("position" in n) E(`node ${n.id} carries a position (the engine lays out)`);
    if (n.height != null || n.width != null || (n.style && n.style.height != null)) E(`node ${n.id} carries a height/width outside style.width`);
    if (!["er-group", "er-concept"].includes(n.type)) E(`node ${n.id} type ${n.type}`);
    if (n.parentId != null) {
      const parent = nodeById.get(n.parentId);
      if (!parent) E(`node ${n.id} parentId ${n.parentId} is not an earlier node`);
      else if (parent.type !== "er-group") E(`node ${n.id} parent ${n.parentId} is not an er-group`);
      if (n.extent !== "parent") E(`member ${n.id} without extent "parent"`);
      memberCount.set(n.parentId, (memberCount.get(n.parentId) || 0) + 1);
    }
    nodeById.set(n.id, n);
    const d = n.data;
    const ref = d.modelRef;
    if (!ref || ref.modelId !== F.model.id || !elById.has(ref.elementId)) E(`node ${n.id} modelRef does not resolve`);
    else {
      if (nodeOfElement.has(ref.elementId)) E(`element ${ref.elementId} drawn twice`);
      nodeOfElement.set(ref.elementId, n.id);
      if (n.id !== "node-" + ref.elementId) E(`node id ${n.id} ≠ node-<element id>`);
    }
    if (!d.name || !d.kind || !d.kindLabel) E(`node ${n.id} lacks name/kind/kindLabel`);
    if (!A.KIND_LEGEND[d.kind]) E(`node ${n.id} kind ${d.kind} not in KIND_LEGEND`);
    if (n.type === "er-group") {
      if (d.level == null || !d.kind) E(`group ${n.id} without data.level / data.kind`);
      if (n.style && n.style.width != null) E(`group ${n.id} carries a width`);
      if (!d.foldedWidth) E(`group ${n.id} without foldedWidth`);
    } else {
      const w = n.style && n.style.width;
      const want = d.kind === "person" ? 190 : 230;
      if (w !== want) E(`node ${n.id} width ${w} ≠ ${want}`);
    }
    for (const a of d.actions || []) if (!a.label || (a.navigate !== true && !a.href)) E(`node ${n.id} malformed action`);
    if (d.domainRef && !/^(mod|ctx):/.test(d.domainRef.id)) E(`node ${n.id} domainRef ${d.domainRef.id}`);
    if (d.actions && !d.domainRef) E(`node ${n.id} has an Open action but no domainRef`);
  }
  for (const n of F.diagram.nodes) {
    const isGroup = memberCount.get(n.id) > 0;
    if (isGroup !== (n.type === "er-group")) E(`node ${n.id}: er-group iff it has members (members ${memberCount.get(n.id) || 0}, type ${n.type})`);
  }
  if (!show.persons && F.diagram.nodes.some(n => n.data.kind === "person")) E("persons hidden but drawn");
  if (!show.externalSystems && F.diagram.nodes.some(n => n.data.kind === "externalSystem")) E("external systems hidden but drawn");
  // one node per system (a landscape has several), every container inside a system
  const nodeOf = new Map(F.diagram.nodes.map(n => [n.id, n]));
  const systemNodes = F.diagram.nodes.filter(n => n.data.kind === "system");
  if (systemNodes.length !== arch.systems.length) E(`${systemNodes.length} system nodes for ${arch.systems.length} systems`);
  for (const n of F.diagram.nodes) {
    if (n.data.kind === "system" && n.parentId) E(`system ${n.id} is nested in ${n.parentId}`);
    if (n.data.kind === "container" && nodeOf.get(n.parentId)?.data.kind !== "system") E(`container ${n.id} is not inside a system`);
  }
  if (!show.channels && F.diagram.nodes.some(n => n.data.kind === "channel")) E("channels hidden but drawn");

  /* edges */
  const ancestors = id => { const out = []; for (let p = nodeById.get(id) && nodeById.get(id).parentId; p; p = nodeById.get(p) && nodeById.get(p).parentId) out.push(p); return out; };
  const DASH = { sync: undefined, async: "6 4", streaming: "2 3" };
  const edgeIds = new Set(), drawn = new Set();
  for (const e of F.diagram.edges) {
    if (edgeIds.has(e.id)) E("duplicate edge id " + e.id);
    edgeIds.add(e.id);
    if (e.type !== "er-edge") E(`edge ${e.id} type ${e.type}`);
    if (e.markerEnd !== "url(#er-arrow)") E(`edge ${e.id} markerEnd`);
    if (e.sourceHandle != null || e.targetHandle != null) E(`edge ${e.id} carries handles (the engine derives them)`);
    if (!nodeById.has(e.source)) E(`edge ${e.id} source ${e.source} not a node`);
    if (!nodeById.has(e.target)) E(`edge ${e.id} target ${e.target} not a node`);
    if (e.source === e.target || ancestors(e.source).includes(e.target) || ancestors(e.target).includes(e.source))
      E(`edge ${e.id} joins a node and its own ancestor`);
    const d = e.data || {};
    if (!Array.isArray(d.points)) E(`edge ${e.id} without data.points`);
    if (typeof d.description !== "string") E(`edge ${e.id} without data.description`);
    if (!show.edgeLabels && d.label != null) E(`edge ${e.id} labelled while edge labels are off`);
    if (show.edgeLabels && !d.label) E(`edge ${e.id} without label`);
    const ref = d.modelRef;
    if (!ref || ref.modelId !== F.model.id || !relById.has(ref.relationId)) { E(`edge ${e.id} modelRef does not resolve`); continue; }
    const rids = d.relationIds || [ref.relationId];
    if (rids[0] !== ref.relationId) E(`edge ${e.id} relationIds[0] ≠ modelRef.relationId`);
    if (e.id !== "edge-" + ref.relationId) E(`edge ${e.id} ≠ edge-<relation id>`);
    for (const rid of rids) {
      const rel = relById.get(rid);
      if (!rel) { E(`edge ${e.id} relation ${rid} unknown`); continue; }
      if (drawn.has(rid)) E(`relation ${rid} drawn twice`);
      drawn.add(rid);
      if (nodeOfElement.get(rel.sourceElementId) !== e.source || nodeOfElement.get(rel.targetElementId) !== e.target)
        E(`edge ${e.id} endpoints disagree with relation ${rid}`);
      const style = rel.type === "connect" ? rel.data.style : "async";
      if ((e.style || {}).strokeDasharray !== DASH[style]) E(`edge ${e.id} dash ${(e.style || {}).strokeDasharray} ≠ ${style}`);
    }
    if (rids.length > 1 && d.label && d.label.split(" / ").length > rids.length) E(`edge ${e.id} has more labels than relations`);
  }
  if (F.diagram.edges.length > F.model.relations.length) E("more edges than relations");
  for (const r of F.model.relations) {
    if (drawn.has(r.id)) continue;
    const s = nodeOfElement.get(r.sourceElementId), t = nodeOfElement.get(r.targetElementId);
    const selfish = s === t || ancestors(s).includes(t) || ancestors(t).includes(s);
    if (!selfish) E(`relation ${r.id} is not drawn`);
  }
  for (const u of report.unresolved || []) E(`unresolved endpoint ${u.side} "${u.name}" of ${u.id}`);
}

/* ---- report ---- */
const def = results[0];
const F = def.file;
const byKind = {};
for (const n of F.diagram.nodes) { const k = `${n.type}/${n.data.kind}`; byKind[k] = (byKind[k] || 0) + 1; }
const relTypes = {};
for (const r of F.model.relations) relTypes[r.type] = (relTypes[r.type] || 0) + 1;

console.log(`model     ${arch.name}  (${ARCH})`);
console.log(`system${arch.systems.length > 1 ? "s  " : "   "} ${arch.systems.map(x => x.name).join(", ")}   domain-source ${arch.domainSource || "—"} ${domainOrg ? "(parsed: " + domainOrg.contexts.length + " contexts)" : "(not loaded)"}`);
console.log(`parsed    ${Object.entries(arch.counts).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`diagram   ${F.model.id}  ${F.diagram.nodes.length} nodes, ${F.diagram.edges.length} edges, ${F.model.relations.length} relations`);
console.log(`  nodes by type/kind: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`  relations by type: ${Object.entries(relTypes).map(([k, v]) => `${k}=${v}`).join("  ")}`);
console.log(`  merged connectors: ${def.report.merged.length ? def.report.merged.map(m => `${m.edgeId} ← ${m.relationIds.join("+")}`).join(", ") : "none"}`);
console.log(`  dropped connectors: ${def.report.dropped.length ? def.report.dropped.map(d => `${d.id} (${d.reason})`).join(", ") : "none"}`);
console.log(`  unresolved endpoints: ${def.report.unresolved.length ? def.report.unresolved.map(u => `${u.id}.${u.side} "${u.name}"`).join(", ") : "none"}`);
console.log(`  domainRefs:`);
for (const r of def.report.domainRefs) console.log(`    ${r.resolved ? "✓" : "✗"} ${r.elementId.padEnd(28)} realizes ${r.ref}${r.resolved ? "  → " + r.resolved : "  (unresolved)"}`);
console.log(`variants:`);
for (const r of results)
  console.log(`  ${r.label.padEnd(20)} ${String(r.file.diagram.nodes.length).padStart(3)} nodes ${String(r.file.diagram.edges.length).padStart(3)} edges ${String(r.file.model.relations.length).padStart(3)} relations  (countVisible ${A.countVisible(arch, r.show)})`);
for (const r of results)
  if (A.countVisible(arch, r.show) !== r.file.diagram.nodes.length) err(r.label, `countVisible ${A.countVisible(arch, r.show)} ≠ ${r.file.diagram.nodes.length} nodes`);

if (errors.length) {
  console.error(`\n${errors.length} contract violation(s):`);
  for (const e of errors.slice(0, 60)) console.error("  - " + e);
  process.exit(1);
}

console.log(`\nOK — all architecture DiagramFiles satisfy DERIVED-DIAGRAMS.md`);

/* ---- fixture: only for the default (public) url-shortener model. A model
   passed on the command line is checked but never written into the engine's
   examples (client data stays out of that repository). ---- */
if (CUSTOM) {
  console.log("custom model: fixture not written (engine examples stay on url-shortener)");
  process.exit(0);
}
fs.mkdirSync(ENGINE_EXAMPLES, { recursive: true });
const out = path.join(ENGINE_EXAMPLES, "navigator-architecture.json");
fs.writeFileSync(out, JSON.stringify(F, null, 2) + "\n");
console.log(`wrote ${out}  (${F.model.id})`);

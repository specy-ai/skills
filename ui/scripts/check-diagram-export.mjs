#!/usr/bin/env node
/* Validates the Navigator → Diagram Engine converters (ui/domain-to-diagram.js)
   against docs/DERIVED-DIAGRAMS.md using a real model:
     1. parses examples/business-loan/business-loan.domain with ui/domain-parser.js
     2. converts every module (class diagram) and every state machine
     3. checks each DiagramFile: required fields, edge endpoints among nodes,
        every modelRef resolving, no node positions, ghosts prefixed "ghost:"
     4. writes the richest module + machine to diagram-engine/examples/diagrams/
   No dependencies; app.js is not loaded (it touches the DOM at load), the
   converter's KINDS_FALLBACK is instead diffed against app.js's KINDS table.
   Usage: node ui/scripts/check-diagram-export.mjs [path/to/file.domain] */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const UI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = path.resolve(UI, "..");
const ENGINE_EXAMPLES = path.resolve(SKILL, "..", "diagram-engine", "examples", "diagrams");
const DOMAIN = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(SKILL, "examples", "business-loan", "business-loan.domain");

const read = f => fs.readFileSync(f, "utf8");

/* ---- load parser + converter in a bare context (no window/document) ---- */
const ctx = vm.createContext({ console, module: { exports: {} } });
vm.runInContext(read(path.join(UI, "domain-parser.js")), ctx, { filename: "domain-parser.js" });
vm.runInContext(read(path.join(UI, "domain-to-diagram.js")), ctx, { filename: "domain-to-diagram.js" });
/* top-level `const` of a classic script lands in the context's global lexical
   scope, not on the context object — read both back through an expression */
const { parseDomain, SpecyDomainDiagrams: D } = vm.runInContext("({ parseDomain, SpecyDomainDiagrams })", ctx);

/* ---- KINDS drift check: the fallback table must equal app.js's KINDS ---- */
const appSrc = read(path.join(UI, "app.js"));
const kindsSrc = appSrc.match(/const KINDS = (\{[\s\S]*?\n\});/);
if (!kindsSrc) fail("could not locate `const KINDS = {…};` in app.js");
const KINDS = vm.runInNewContext("(" + kindsSrc[1] + ")");
const drift = [];
for (const k of new Set([...Object.keys(KINDS), ...Object.keys(D.KINDS_FALLBACK)])) {
  if (JSON.stringify(KINDS[k]) !== JSON.stringify(D.KINDS_FALLBACK[k])) drift.push(k);
}
if (drift.length) fail("KINDS_FALLBACK drifts from app.js KINDS for: " + drift.join(", "));

/* ---- parse + convert ---- */
const stem = path.basename(DOMAIN).replace(/\.domain$/, "");
const org = parseDomain(wrapIfElided(read(DOMAIN), stem), stem);

/* Some examples (business-loan) elide the organization/context containers and
   declare their modules at top level; the parser needs the full nesting, so
   they are wrapped in a synthetic organization + one context named after the
   file (the org name comes from the "// Organization: …" header when present). */
function wrapIfElided(text, fileStem) {
  if (/^\s*organization\s/m.test(text)) return text;
  const orgName = (text.match(/^\/\/\s*Organization:\s*(\w+)/m) || [])[1] || fileStem.replace(/\W+/g, "");
  const short = fileStem.split(/\W+/).map(w => w[0] || "").join("").toUpperCase() || "CTX";
  return `organization ${orgName} {\ncontext ${orgName}Context (${short}) {\n${text}\n}\n}\n`;
}

const errors = [];
const err = (file, msg) => errors.push(`${file.model.id}: ${msg}`);

const classFiles = [], smFiles = [];
const moduleIds = new Set();
for (const c of org.contexts)
  for (const m of c.modules) moduleIds.add(D.moduleModelId(m, c, org.id));

for (const c of org.contexts) {
  for (const m of c.modules) {
    const file = D.moduleClassDiagram(m, c, D.DEFAULT_SHOW, org.id);
    classFiles.push({ file, mod: m, ctx: c });
    validate(file, "domain-class", { moduleIds, contextElementIds: new Set(c.modules.flatMap(x => x.elements.map(e => e.id))) });
    /* every category toggle combination must also produce a consistent file */
    for (const cat of Object.keys(D.DEFAULT_SHOW)) {
      const show = Object.assign({}, D.DEFAULT_SHOW, { [cat]: false });
      validate(D.moduleClassDiagram(m, c, show, org.id), "domain-class", { moduleIds, contextElementIds: new Set(c.modules.flatMap(x => x.elements.map(e => e.id))), silentCounts: true });
    }
    for (const el of m.elements)
      for (const sm of el.stateMachines || []) {
        if (!sm.states.length) continue;
        const file = D.stateMachineDiagram(el, sm, { el, mod: m, ctx: c, org });
        smFiles.push({ file, el, sm });
        validate(file, "state-machine", {});
      }
  }
}

/* ---- contract checks ---- */
function validate(file, metamodel, opts) {
  const F = file;
  if (F.version !== 1) err(F, "version must be 1");
  if (!F.model || !F.diagram) { err(F, "missing model/diagram"); return; }
  for (const k of ["id", "name", "metamodel", "elements", "relations"])
    if (F.model[k] == null) err(F, "model." + k + " missing");
  if (F.model.metamodel !== metamodel) err(F, "metamodel " + F.model.metamodel + " ≠ " + metamodel);
  for (const k of ["id", "name", "nodes", "edges"])
    if (F.diagram[k] == null) err(F, "diagram." + k + " missing");
  if (!F.diagram.layout || F.diagram.layout.engine !== "dagre") err(F, "diagram.layout hint missing");
  if (!F.diagram.id.startsWith(F.model.id + "#")) err(F, "diagram.id must be <model id>#…");

  const elIds = new Set(), relIds = new Set(), nodeIds = new Set();
  for (const e of F.model.elements) {
    if (!e.id || !e.type || !e.data) err(F, "element without id/type/data: " + JSON.stringify(e));
    if (elIds.has(e.id)) err(F, "duplicate element id " + e.id);
    elIds.add(e.id);
  }
  for (const r of F.model.relations) {
    if (!r.id || !r.type || !r.sourceElementId || !r.targetElementId) err(F, "relation incomplete: " + JSON.stringify(r));
    if (relIds.has(r.id)) err(F, "duplicate relation id " + r.id);
    relIds.add(r.id);
    if (metamodel === "domain-class") {
      /* endpoints are either in this model or a cross-module element of the same context */
      for (const side of ["sourceElementId", "targetElementId"])
        if (!elIds.has(r[side]) && !opts.contextElementIds.has(r[side])) err(F, `relation ${r.id} ${side} ${r[side]} unknown`);
    } else {
      for (const side of ["sourceElementId", "targetElementId"])
        if (!elIds.has(r[side])) err(F, `relation ${r.id} ${side} ${r[side]} not an element`);
    }
  }
  for (const n of F.diagram.nodes) {
    if (!n.id || !n.type || !n.data) err(F, "node without id/type/data: " + JSON.stringify(n).slice(0, 80));
    if (nodeIds.has(n.id)) err(F, "duplicate node id " + n.id);
    nodeIds.add(n.id);
    if ("position" in n) err(F, "node " + n.id + " carries a position (must be laid out by the engine)");
    const ref = n.data.modelRef;
    if (!ref || !ref.modelId || !ref.elementId) { err(F, "node " + n.id + " without modelRef"); continue; }
    if (n.type === "ghost-card") {
      if (!n.id.startsWith("ghost:")) err(F, "ghost node id not prefixed ghost: " + n.id);
      if (n.id !== "ghost:" + ref.elementId) err(F, "ghost id/elementId mismatch " + n.id);
      if (ref.modelId === F.model.id) err(F, "ghost " + n.id + " points at its own model");
      if (!opts.moduleIds.has(ref.modelId)) err(F, "ghost " + n.id + " modelRef.modelId " + ref.modelId + " is not a module model id");
      if (!opts.contextElementIds.has(ref.elementId)) err(F, "ghost " + n.id + " elementId unknown in context");
      if (!n.data.module) err(F, "ghost " + n.id + " lacks home module name");
    } else {
      if (n.id.startsWith("ghost:")) err(F, "non-ghost node with ghost: prefix " + n.id);
      if (ref.modelId !== F.model.id) err(F, "node " + n.id + " modelRef.modelId ≠ model id");
      if (!elIds.has(ref.elementId)) err(F, "node " + n.id + " modelRef.elementId unresolved");
      if (n.id !== ref.elementId) err(F, "node id ≠ element id: " + n.id);
    }
    if (metamodel === "domain-class" && n.type === "class-card") {
      for (const k of ["name", "kind", "kindLabel", "kindTitle", "kindShort", "color", "compartments"])
        if (n.data[k] == null) err(F, `node ${n.id} data.${k} missing`);
      for (const sec of n.data.compartments || [])
        for (const row of sec.rows || []) if (row.left == null) err(F, `node ${n.id} compartment row without left`);
    }
    if (metamodel === "state-machine" && n.type === "sm-state")
      for (const k of ["name", "description", "invariants", "initial", "final"])
        if (n.data[k] == null) err(F, `state ${n.id} data.${k} missing`);
  }
  const edgeIds = new Set();
  const expectedEdgeType = metamodel === "domain-class" ? "class-edge" : "sm-transition";
  for (const e of F.diagram.edges) {
    if (edgeIds.has(e.id)) err(F, "duplicate edge id " + e.id);
    edgeIds.add(e.id);
    if (e.type !== expectedEdgeType) err(F, `edge ${e.id} type ${e.type} ≠ ${expectedEdgeType}`);
    if (!nodeIds.has(e.source)) err(F, `edge ${e.id} source ${e.source} not a node`);
    if (!nodeIds.has(e.target)) err(F, `edge ${e.id} target ${e.target} not a node`);
    const ref = e.data && e.data.modelRef;
    if (!ref || ref.modelId !== F.model.id || !relIds.has(ref.relationId)) { err(F, `edge ${e.id} modelRef does not resolve`); continue; }
    const rel = F.model.relations.find(r => r.id === ref.relationId);
    const strip = id => id.replace(/^ghost:/, "");
    if (strip(e.source) !== rel.sourceElementId || strip(e.target) !== rel.targetElementId)
      err(F, `edge ${e.id} endpoints disagree with relation ${rel.id}`);
    if (metamodel === "domain-class" && e.data.label == null) err(F, `edge ${e.id} without label`);
  }
  if (F.model.relations.length !== F.diagram.edges.length) err(F, "one relation per edge expected");
  if (metamodel === "state-machine") {
    const hasInitial = elIds.has("[*]");
    const anyInitial = F.model.elements.some(e => e.type === "state" && e.data.initial);
    if (anyInitial && !hasInitial) err(F, "initial state present but no [*] element");
    if (!nodeIds.has("[*]") === hasInitial) err(F, "[*] element/node mismatch");
  }
}

/* ---- report ---- */
const totalNodes = classFiles.reduce((a, x) => a + x.file.diagram.nodes.length, 0);
const totalGhosts = classFiles.reduce((a, x) => a + x.file.diagram.nodes.filter(n => n.type === "ghost-card").length, 0);
const totalEdges = classFiles.reduce((a, x) => a + x.file.diagram.edges.length, 0);
const relTypes = {};
for (const { file } of classFiles) for (const r of file.model.relations) relTypes[r.type] = (relTypes[r.type] || 0) + 1;

console.log(`model     ${org.name}  (${DOMAIN})`);
console.log(`contexts  ${org.contexts.length}   modules ${classFiles.length}   machines ${smFiles.length}`);
console.log(`class diagrams: ${totalNodes} nodes (${totalGhosts} ghosts), ${totalEdges} edges`);
console.log(`  relations by type: ${Object.entries(relTypes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join("  ")}`);
for (const { file } of classFiles)
  console.log(`  ${file.model.id.padEnd(44)} ${String(file.diagram.nodes.length).padStart(3)} nodes ${String(file.diagram.edges.length).padStart(3)} edges`);
console.log(`statecharts:`);
for (const { file } of smFiles)
  console.log(`  ${file.model.id.padEnd(60)} ${String(file.model.elements.length).padStart(3)} states ${String(file.diagram.edges.length).padStart(3)} transitions`);

if (errors.length) {
  console.error(`\n${errors.length} contract violation(s):`);
  for (const e of errors.slice(0, 40)) console.error("  - " + e);
  process.exit(1);
}

/* ---- samples: richest module + richest machine ---- */
const bestClass = classFiles.slice().sort((a, b) => b.file.diagram.edges.length - a.file.diagram.edges.length)[0];
const bestSm = smFiles.slice().sort((a, b) => b.file.diagram.edges.length - a.file.diagram.edges.length)[0];
fs.mkdirSync(ENGINE_EXAMPLES, { recursive: true });
const outClass = path.join(ENGINE_EXAMPLES, "navigator-domain-class.json");
const outSm = path.join(ENGINE_EXAMPLES, "navigator-statechart.json");
fs.writeFileSync(outClass, JSON.stringify(bestClass.file, null, 2) + "\n");
if (bestSm) fs.writeFileSync(outSm, JSON.stringify(bestSm.file, null, 2) + "\n");
console.log(`\nOK — all DiagramFiles satisfy DERIVED-DIAGRAMS.md`);
console.log(`wrote ${outClass}  (${bestClass.file.model.id})`);
if (bestSm) console.log(`wrote ${outSm}  (${bestSm.file.model.id})`);
else console.log("no state machine found — navigator-statechart.json not written");

function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }

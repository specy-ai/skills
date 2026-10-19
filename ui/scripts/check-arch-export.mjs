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

   A file rooted at `organization` (level 0) goes through the same checks —
   its C4 view: the systems detailed inline opened, the others as black
   boxes — and through those of its landscape (`landscapeDiagram`), converted
   with every toggle combination, with its concepts resolved against its
   `domain-source`s (ui/arch-concepts.js) and once without:
     - contract shape, model id `<stem>-landscape`, diagram id
       `<model id>#landscape`, dagre layout with `handles: "auto"`;
     - unique ids; elements of type area / system / externalSystem / person,
       each carrying the raw facts of the details panel; no node position or
       height; parents before members with `extent: "parent"`; `er-group` iff
       the node has members; every system inside its area, or at top level;
     - one relation and one edge per dependency, downstream → upstream, none
       merged, none with a handle; both edges of every mutual pair, with
       opposite ends; every edge end among the nodes; the label starting with
       the compacted flow numbers, within the cap, absent when edge labels
       are off; `data.description` one line per flow; patterns, criticality,
       mutual, partnership and the stroke they stand for (LANDSCAPE_LEGEND);
     - the card rows (masters first, capped as `+ N more`, gone with
       `concepts` off, `used by` with the persons); every action `href` and
       every `domainRef` naming an element, a module or a context that exists
       in the parsed domain; every resolved concept shown on a card reachable
       through an action; no link at all without a resolution;
     - `landscapeCountVisible` = the number of nodes drawn.
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
for (const f of ["domain-parser.js", "arch-parser.js", "arch-concepts.js", "arch-to-diagram.js"])
  vm.runInContext(read(path.join(UI, f)), ctx, { filename: f });
/* top-level declarations of a classic script land in the context's global
   lexical scope — read them back through an expression */
const { parseDomain, parseArch, SpecyArchConcepts: C, SpecyArchDiagrams: A } =
  vm.runInContext("({ parseDomain, parseArch, SpecyArchConcepts, SpecyArchDiagrams })", ctx);

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
// Pinned counts for tracked examples only; local (git-ignored) client models
// change on their own schedule, so none is pinned here.
const EXPECTED = {};
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
    if (e.markerEnd !== "er-arrow") E(`edge ${e.id} markerEnd (bare marker id expected)`);
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

/* ================= landscape (level 0): organization files only ================= */

const landscapeLines = [];
if (arch.root === "organization") checkLandscape();

function checkLandscape() {
  const L = A.LANDSCAPE_LIMITS || {};
  for (const k of ["landscapeDiagram", "landscapeModelIdOf", "landscapeCountVisible"])
    if (typeof A[k] !== "function") { err("landscape", `SpecyArchDiagrams.${k} is not exported`); return; }
  const DEFAULTS = { externalSystems: true, persons: false, edgeLabels: true, concepts: true };
  if (JSON.stringify(A.LANDSCAPE_DEFAULT_SHOW) !== JSON.stringify(DEFAULTS)) err("landscape", "LANDSCAPE_DEFAULT_SHOW ≠ " + JSON.stringify(DEFAULTS));
  if (!Array.isArray(A.LANDSCAPE_LEGEND) || A.LANDSCAPE_LEGEND.some(x => !x.key || !x.label || !x.style || !x.style.stroke))
    err("landscape", "LANDSCAPE_LEGEND: every entry needs key, label and style.stroke");
  const legend = Object.fromEntries((A.LANDSCAPE_LEGEND || []).map(x => [x.key, x.style]));
  for (const k of ["dependency", "critical", "partnership"]) if (!legend[k]) { err("landscape", `LANDSCAPE_LEGEND has no "${k}" entry`); return; }
  const modelId = A.landscapeModelIdOf(arch);
  if (modelId !== `${arch.id}-landscape`) err("landscape", `landscapeModelIdOf = ${modelId}, expected ${arch.id}-landscape`);

  /* ---- every domain source, as the browser loads them: next to the .arch ---- */
  const orgs = [], missing = [];
  for (const source of C.domainSources(arch)) {
    let file = path.resolve(path.dirname(ARCH), source);
    if (!fs.existsSync(file)) file = path.resolve(path.dirname(ARCH), path.basename(source));
    if (!fs.existsSync(file)) { missing.push(source); continue; }
    try { orgs.push(parseDomain(read(file), C.domainStem(file))); } catch (e) { missing.push(`${source} (${e.message})`); }
  }
  /* what a link may point at: app.js INDEX keys */
  const domainIds = new Set();
  for (const o of orgs) for (const c of o.contexts) {
    domainIds.add("ctx:" + c.id);
    for (const m of c.modules) { domainIds.add("mod:" + m.id); for (const el of m.elements) domainIds.add(el.id); }
  }
  const resolution = orgs.length ? C.resolveAll(arch, orgs) : null;

  /* ---- what the file says ---- */
  const systems = arch.systems, externals = arch.externalSystems;
  const areaOf = new Map(arch.areas.map(a => [a.name, a]));
  const drawnAreas = arch.areas.filter(a => systems.some(s => s.area === a.name));
  const flowNumbers = flows => {          // `1–3, 7, 9, 10`: a run of three or more is a range
    const ns = [...new Set(flows.map(f => f.number).filter(n => typeof n === "number"))].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < ns.length;) {
      let j = i;
      while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
      if (j - i >= 2) out.push(`${ns[i]}–${ns[j]}`); else for (let k = i; k <= j; k++) out.push(String(ns[k]));
      i = j + 1;
    }
    return out.join(", ");
  };

  /* ---- every toggle combination with the concepts resolved, the default one without ---- */
  const keys = Object.keys(DEFAULTS);
  const variants = [];
  for (let bits = 0; bits < 1 << keys.length; bits++) {
    const show = Object.fromEntries(keys.map((k, i) => [k, !(bits & (1 << i))]));
    const off = keys.filter(k => !show[k]);
    variants.push({ label: `landscape [${off.length ? off.join(", ") + " off" : "all on"}]`, show, resolution });
  }
  variants.push({ label: "landscape [default, no resolution]", show: DEFAULTS, resolution: null });

  let first = null;
  for (const v of variants) {
    const report = {};
    let F;
    try { F = A.landscapeDiagram(arch, v.show, { resolution: v.resolution, report }); }
    catch (e) { err(v.label, "landscapeDiagram threw: " + (e && e.stack || e)); continue; }
    validateLandscape(F, v, report);
    v.file = F; v.report = report;
    if (!first) first = v;
  }
  /* an omitted toggle map is the default one */
  if (first && JSON.stringify(A.landscapeDiagram(arch, undefined, { resolution })) !== JSON.stringify(A.landscapeDiagram(arch, DEFAULTS, { resolution })))
    err("landscape", "landscapeDiagram(arch) ≠ landscapeDiagram(arch, LANDSCAPE_DEFAULT_SHOW)");

  function validateLandscape(F, v, report) {
    const E = msg => err(v.label, msg);
    const show = v.show;
    if (F.version !== 1) E("version must be 1");
    if (!F.model || !F.diagram) { E("missing model/diagram"); return; }
    for (const k of ["id", "name", "metamodel", "elements", "relations"]) if (F.model[k] == null) E("model." + k + " missing");
    for (const k of ["id", "name", "nodes", "edges"]) if (F.diagram[k] == null) E("diagram." + k + " missing");
    if (F.model.metamodel !== "software-architecture") E("metamodel " + F.model.metamodel);
    if (F.model.id !== modelId) E(`model id ${F.model.id} ≠ ${modelId}`);
    if (F.diagram.id !== modelId + "#landscape") E(`diagram id ${F.diagram.id} ≠ ${modelId}#landscape`);
    const lay = F.diagram.layout || {};
    if (lay.engine !== "dagre") E("layout.engine must be dagre");
    if (lay.handles !== "auto") E('layout.handles must be "auto"');
    if (!["LR", "TB", "RL", "BT"].includes(lay.rankdir)) E("layout.rankdir " + lay.rankdir);

    /* elements */
    const elById = new Map();
    const elOf = (type, name) => F.model.elements.find(e => e.type === type && e.data.name === name);
    for (const e of F.model.elements) {
      if (!e.id || !e.type || !e.data) { E("element without id/type/data: " + JSON.stringify(e).slice(0, 80)); continue; }
      if (elById.has(e.id)) E("duplicate element id " + e.id);
      elById.set(e.id, e);
      if (!["area", "system", "externalSystem", "person"].includes(e.type)) E(`element ${e.id} type ${e.type}`);
      for (const k of ["name", "description", "technology", "area", "detail", "status"])
        if (typeof e.data[k] !== "string") E(`element ${e.id} lacks data.${k}`);
    }
    for (const a of arch.areas) if (!elOf("area", a.name)) E(`area ${a.name} is not an element`);
    for (const s of systems) {
      const e = elOf("system", s.name);
      if (!e) { E(`system ${s.name} is not an element`); continue; }
      const d = e.data;
      if (d.description !== (s.description || "") || d.technology !== (s.technology || "") || d.area !== (s.area || "")
        || d.detail !== s.detail || d.status !== (s.status || "")) E(`system ${s.name}: element data disagrees with the file`);
      if (JSON.stringify(d.masters) !== JSON.stringify(s.masters.map(r => r.raw)) || JSON.stringify(d.handles) !== JSON.stringify(s.handles.map(r => r.raw)))
        E(`system ${s.name}: element masters / handles disagree with the file`);
      if (JSON.stringify(d.usedBy) !== JSON.stringify(s.usedBy)) E(`system ${s.name}: element usedBy disagrees with the file`);
    }
    for (const x of externals) if (show.externalSystems !== !!elOf("externalSystem", x.name)) E(`external system ${x.name}: ${show.externalSystems ? "missing" : "present while hidden"}`);
    for (const p of arch.persons) if (show.persons !== !!elOf("person", p.name)) E(`person ${p.name}: ${show.persons ? "missing" : "present while hidden"}`);

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
        else if (parent.type !== "er-group" || parent.data.kind !== "area") E(`node ${n.id} parent ${n.parentId} is not an area group`);
        if (n.extent !== "parent") E(`member ${n.id} without extent "parent"`);
        memberCount.set(n.parentId, (memberCount.get(n.parentId) || 0) + 1);
      } else if (n.extent != null) E(`top-level node ${n.id} carries an extent`);
      nodeById.set(n.id, n);
      const d = n.data, ref = d.modelRef;
      if (!ref || ref.modelId !== modelId || !elById.has(ref.elementId)) { E(`node ${n.id} modelRef does not resolve`); continue; }
      if (nodeOfElement.has(ref.elementId)) E(`element ${ref.elementId} drawn twice`);
      nodeOfElement.set(ref.elementId, n.id);
      if (n.id !== "node-" + ref.elementId) E(`node id ${n.id} ≠ node-<element id>`);
      const el = elById.get(ref.elementId);
      if (!d.name || !d.kind || !d.kindLabel) E(`node ${n.id} lacks name/kind/kindLabel`);
      if (d.kind !== el.type) E(`node ${n.id} kind ${d.kind} ≠ element type ${el.type}`);
      if (!A.KIND_LEGEND[d.kind]) E(`node ${n.id} kind ${d.kind} not in KIND_LEGEND`);
      if (n.type === "er-group") {
        if (d.kind !== "area") E(`group ${n.id} is not an area`);
        if (d.level !== 3) E(`area ${n.id} is not open by default (level ${d.level})`);
        if (!d.foldedWidth) E(`group ${n.id} without foldedWidth`);
        if (n.style && n.style.width != null) E(`group ${n.id} carries a width`);
        if (!d.layout || !d.layout.rankdir) E(`area ${n.id} without data.layout.rankdir`);
      } else if (!(n.style && typeof n.style.width === "number")) E(`card ${n.id} without style.width`);
    }
    for (const n of F.diagram.nodes) {
      const isGroup = memberCount.get(n.id) > 0;
      if (isGroup !== (n.type === "er-group")) E(`node ${n.id}: er-group iff it has members`);
    }
    const nodeOf = (type, name) => { const e = elOf(type, name); return e ? nodeById.get(nodeOfElement.get(e.id)) : undefined; };
    for (const a of arch.areas) if (!!nodeOf("area", a.name) !== drawnAreas.includes(a)) E(`area ${a.name}: drawn iff a system sits in it`);
    for (const s of systems) {
      const n = nodeOf("system", s.name);
      if (!n) { E(`system ${s.name} is not drawn`); continue; }
      const area = areaOf.has(s.area) ? nodeOf("area", s.area) : null;
      if ((n.parentId || null) !== (area ? area.id : null)) E(`system ${s.name} is in ${n.parentId || "no area"}, expected ${area ? area.id : "the top level"}`);
      if (n.data.subtitle !== (s.technology || "")) E(`system ${s.name}: the card's subtitle is not its product`);
    }
    for (const x of externals) { const n = nodeOf("externalSystem", x.name); if (n && n.parentId) E(`external system ${x.name} is inside ${n.parentId}`); }
    if (A.landscapeCountVisible(arch, show) !== F.diagram.nodes.length) E(`landscapeCountVisible ${A.landscapeCountVisible(arch, show)} ≠ ${F.diagram.nodes.length} nodes`);

    /* cards: rows and links */
    const capped = refs => (refs.length > L.concepts ? refs.slice(0, L.concepts).map(r => r.raw).concat(`+ ${refs.length - L.concepts} more`) : refs.map(r => r.raw)).join(", ");
    for (const [type, holders] of [["system", systems], ["externalSystem", show.externalSystems ? externals : []]]) {
      for (const h of holders) {
        const n = nodeOf(type, h.name);
        if (!n) continue;
        const rows = (n.data.body && n.data.body.rows) || [];
        if (n.data.body && n.data.body.kind !== "kv") E(`card ${n.id}: body kind ${n.data.body.kind}`);
        const want = [];
        if (show.concepts && h.masters.length) want.push(["masters", capped(h.masters)]);
        if (show.concepts && h.handles.length) want.push(["handles", capped(h.handles)]);
        if (show.persons && (h.usedBy || []).length) want.push(["used by", h.usedBy.join(", ")]);
        if (JSON.stringify(rows.map(r => [r.key, r.value])) !== JSON.stringify(want)) E(`card ${n.id}: rows ${JSON.stringify(rows)} ≠ ${JSON.stringify(want)}`);
        const flagged = /(^| )landscape-card--masters( |$)/.test(n.className || "");
        if (flagged !== (want.length > 0 && want[0][0] === "masters")) E(`card ${n.id}: the masters class says ${flagged}, its first row says otherwise`);
        if (!/(^| )landscape-card( |$)/.test(n.className || "")) E(`card ${n.id} lacks the landscape-card class`);

        const d = n.data, actions = d.actions || [];
        for (const a of actions) if (!a.label || (a.navigate !== true && !a.href)) E(`card ${n.id}: malformed action ${JSON.stringify(a)}`);
        const navigating = actions.filter(a => a.navigate === true);
        if (navigating.length > 1) E(`card ${n.id}: ${navigating.length} navigate actions (the host cannot tell them apart)`);
        if (navigating.length && !d.domainRef) E(`card ${n.id}: a navigate action without domainRef`);
        if (d.domainRef && !domainIds.has(d.domainRef.id)) E(`card ${n.id}: domainRef ${d.domainRef.id} is not in the parsed domain`);
        if (d.domainRef && !/^ctx:/.test(d.domainRef.id)) E(`card ${n.id}: domainRef ${d.domainRef.id} is not a context`);
        const hrefs = new Set();
        for (const a of actions.filter(a => a.href)) {
          if (a.href[0] !== "#") { E(`card ${n.id}: action href ${a.href} leaves the page`); continue; }
          const id = decodeURIComponent(a.href.slice(1));
          if (!domainIds.has(id)) E(`card ${n.id}: action "${a.label}" → ${id} is not in the parsed domain`);
          if (hrefs.has(id)) E(`card ${n.id}: two actions open ${id}`);
          hrefs.add(id);
        }
        if (actions.length > L.actions + 1) E(`card ${n.id}: ${actions.length} actions`);
        if (!v.resolution) { if (d.domainRef || actions.length) E(`card ${n.id}: a domain link without a resolution`); continue; }
        /* every resolved concept the card shows is reachable, masters first */
        const shown = h.masters.slice(0, L.concepts).concat(h.handles.slice(0, L.concepts));
        for (const ref of shown) {
          const x = v.resolution.of(ref);
          if (x && x.status === "resolved" && !hrefs.has(x.id)) E(`card ${n.id}: ${ref.raw} resolves to ${x.id} and no action opens it`);
        }
        const firstMaster = h.masters.map(r => v.resolution.of(r)).find(x => x && x.status === "resolved");
        const firstLink = actions.find(a => a.href);
        if (firstMaster && firstLink && decodeURIComponent(firstLink.href.slice(1)) !== firstMaster.id) E(`card ${n.id}: the first concept action is not its first resolved master`);
      }
    }
    for (const n of F.diagram.nodes) if (n.data.kind === "area" || n.data.kind === "person") if (n.data.domainRef || n.data.actions) E(`node ${n.id}: a ${n.data.kind} carries no domain link`);

    /* relations + edges: one per dependency, downstream → upstream, none merged */
    const relById = new Map(), edgeById = new Map();
    for (const r of F.model.relations) {
      if (!r.id || !r.type || !r.sourceElementId || !r.targetElementId) E("relation incomplete: " + JSON.stringify(r).slice(0, 100));
      if (relById.has(r.id)) E("duplicate relation id " + r.id);
      relById.set(r.id, r);
      if (r.type !== "dependency") E(`relation ${r.id} type ${r.type}`);
      for (const side of ["sourceElementId", "targetElementId"]) if (!elById.has(r[side])) E(`relation ${r.id} ${side} ${r[side]} not an element`);
    }
    const drawnRelations = new Set();
    for (const e of F.diagram.edges) {
      if (edgeById.has(e.id)) E("duplicate edge id " + e.id);
      edgeById.set(e.id, e);
      if (e.type !== "er-edge") E(`edge ${e.id} type ${e.type}`);
      if (!e.markerEnd || typeof e.markerEnd !== "string") E(`edge ${e.id} without an arrowhead`);
      if (e.sourceHandle != null || e.targetHandle != null) E(`edge ${e.id} carries handles (the engine derives them)`);
      if (!nodeById.has(e.source)) E(`edge ${e.id} source ${e.source} not a node`);
      if (!nodeById.has(e.target)) E(`edge ${e.id} target ${e.target} not a node`);
      if (e.source === e.target) E(`edge ${e.id} is a self loop`);
      const d = e.data || {};
      if (!Array.isArray(d.points)) E(`edge ${e.id} without data.points`);
      if (!Array.isArray(d.relationIds) || d.relationIds.length !== 1) E(`edge ${e.id} stands for ${JSON.stringify(d.relationIds)}: one dependency per edge, none merged`);
      const rid = d.modelRef && d.modelRef.modelId === modelId ? d.modelRef.relationId : null;
      if (!rid || !relById.has(rid) || (d.relationIds || [])[0] !== rid) { E(`edge ${e.id} modelRef does not resolve`); continue; }
      if (e.id !== "edge-" + rid) E(`edge ${e.id} ≠ edge-<relation id>`);
      if (drawnRelations.has(rid)) E(`relation ${rid} drawn twice`);
      drawnRelations.add(rid);
    }
    const endKind = name => (systems.some(s => s.name === name) ? "system" : externals.some(x => x.name === name) ? "externalSystem" : null);
    const drawable = d => d.from !== d.to && [d.from, d.to].every(n => endKind(n) === "system" || (endKind(n) === "externalSystem" && show.externalSystems));
    let expected = 0;
    for (const d of arch.dependencies) {
      const rel = relById.get(d.id), edge = edgeById.get("edge-" + d.id);
      if (!drawable(d)) {
        if (rel || edge) E(`dependency ${d.id} has an end that is not drawn, yet it is in the diagram`);
        if (endKind(d.from) && endKind(d.to) && !(report.dropped || []).some(x => x.id === d.id)) E(`dependency ${d.id} is neither drawn nor reported as dropped`);
        continue;
      }
      expected++;
      if (!rel || !edge) { E(`dependency ${d.id}: ${!rel ? "no relation" : "no edge"}`); continue; }
      const down = nodeOf(endKind(d.from), d.from), up = nodeOf(endKind(d.to), d.to);
      if (!down || !up) { E(`dependency ${d.id}: an end is not drawn`); continue; }
      if (edge.source !== down.id || edge.target !== up.id) E(`edge ${edge.id} goes ${edge.source} → ${edge.target}, expected ${down.id} (downstream) → ${up.id} (upstream)`);
      if (nodeOfElement.get(rel.sourceElementId) !== down.id || nodeOfElement.get(rel.targetElementId) !== up.id) E(`relation ${d.id} ends disagree with the dependency`);
      const x = edge.data, partnership = d.patterns.includes("Partnership");
      if (JSON.stringify(x.patterns) !== JSON.stringify(d.patterns)) E(`edge ${edge.id} patterns ${JSON.stringify(x.patterns)}`);
      if ((x.criticality || null) !== (d.criticality || null)) E(`edge ${edge.id} criticality ${x.criticality}`);
      if (x.mutual !== d.mutual) E(`edge ${edge.id} mutual ${x.mutual} ≠ ${d.mutual}`);
      if (x.partnership !== partnership) E(`edge ${edge.id} partnership ${x.partnership} ≠ ${partnership}`);
      for (const k of ["patterns", "criticality", "mutual", "partnership"])
        if (JSON.stringify(rel.data[k]) !== JSON.stringify(x[k])) E(`relation ${d.id} data.${k} disagrees with its edge`);
      /* the stroke: width for `critical`, colour for Partnership, nothing else */
      const st = edge.style || {};
      if (st.stroke !== (partnership ? legend.partnership : legend.dependency).stroke) E(`edge ${edge.id} stroke ${st.stroke}`);
      if (st.strokeWidth !== (d.criticality === "critical" ? legend.critical : legend.dependency).strokeWidth) E(`edge ${edge.id} strokeWidth ${st.strokeWidth}`);
      if (st.strokeDasharray != null) E(`edge ${edge.id} is dashed`);
      /* the full list: one line per flow, `<n>. <label> — <concepts>` */
      if (typeof x.description !== "string") { E(`edge ${edge.id} without data.description`); continue; }
      const lines = x.description ? x.description.split("\n") : [];
      if (lines.length !== d.flows.length) E(`edge ${edge.id}: ${lines.length} description lines for ${d.flows.length} flows`);
      d.flows.forEach((f, i) => {
        const concepts = f.carries.map(c => (c.as ? `${c.concept.raw} as ${c.as.raw}` : c.concept.raw)).join(", ");
        if (lines[i] !== `${f.number}. ${f.label || "(unnamed)"} — ${concepts}`) E(`edge ${edge.id}: description line ${i + 1} is "${lines[i]}"`);
      });
      /* the label: flow numbers first, one line, within the cap */
      if (!show.edgeLabels) { if (x.label != null) E(`edge ${edge.id} labelled while edge labels are off`); continue; }
      if (!d.flows.length) { if (x.label) E(`edge ${edge.id}: a label without flows`); continue; }
      const numbers = flowNumbers(d.flows);
      if (typeof x.label !== "string" || !x.label) { E(`edge ${edge.id} without label`); continue; }
      if (/\n/.test(x.label)) E(`edge ${edge.id}: the label has several lines`);
      if (x.label.length > L.label) E(`edge ${edge.id}: label of ${x.label.length} characters (cap ${L.label})`);
      if (!(x.label === numbers || x.label.startsWith(numbers + " · "))) E(`edge ${edge.id}: label "${x.label}" does not start with the flow numbers "${numbers}"`);
    }
    if (F.diagram.edges.length !== expected) E(`${F.diagram.edges.length} edges for ${expected} dependencies with both ends drawn`);
    if (F.model.relations.length !== expected) E(`${F.model.relations.length} relations for ${expected} dependencies with both ends drawn`);
    if ((report.merged || []).length) E("the report lists merged edges");
    for (const u of report.unresolved || []) E(`unresolved end ${u.side} "${u.name}" of ${u.id}`);
    /* both edges of every mutual pair, with opposite ends */
    for (const d of arch.dependencies) {
      if (!d.mutual || !drawable(d)) continue;
      const back = arch.dependencies.find(o => o.from === d.to && o.to === d.from);
      const e1 = edgeById.get("edge-" + d.id), e2 = back && edgeById.get("edge-" + back.id);
      if (!e1 || !e2 || e1 === e2) { E(`mutual pair ${d.from} ⇄ ${d.to}: both edges must be there`); continue; }
      if (e1.source !== e2.target || e1.target !== e2.source) E(`mutual pair ${d.from} ⇄ ${d.to}: the two edges do not have opposite ends`);
    }
  }

  /* ---- report: the default toggle map ---- */
  first = variants.find(v => v.file && v.resolution === resolution && keys.every(k => v.show[k] === DEFAULTS[k])) || first;
  if (!first || !first.file) return;
  const F = first.file, byKind = {};
  for (const n of F.diagram.nodes) { const k = `${n.type}/${n.data.kind}`; byKind[k] = (byKind[k] || 0) + 1; }
  const cards = F.diagram.nodes.filter(n => n.type === "er-concept");
  const links = cards.reduce((n, c) => n + (c.data.actions || []).filter(a => a.href).length, 0);
  const pairs = arch.dependencies.filter(d => d.mutual && d.from < d.to);
  const labels = F.diagram.edges.map(e => e.data.label || "");
  landscapeLines.push(
    `landscape ${F.model.id}  ${F.diagram.nodes.length} nodes, ${F.diagram.edges.length} edges, ${F.model.relations.length} relations  (layout ${F.diagram.layout.rankdir}, areas ${(F.diagram.nodes.find(n => n.type === "er-group") || { data: { layout: {} } }).data.layout.rankdir || "—"})`,
    `  nodes by type/kind: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join("  ")}`,
    `  dependencies: ${arch.dependencies.length} declared, ${F.diagram.edges.length} drawn, none merged  ·  mutual pairs ${pairs.length}: ${pairs.map(d => `${d.from} ⇄ ${d.to}${d.patterns.includes("Partnership") ? " (Partnership)" : ""}`).join(", ") || "none"}`,
    `  strokes: critical=${F.diagram.edges.filter(e => e.data.criticality === "critical").length}  partnership=${F.diagram.edges.filter(e => e.data.partnership).length}  ·  labels: longest ${Math.max(0, ...labels.map(l => l.length))} of ${L.label} characters, shortened ${labels.filter(l => l.endsWith("…")).length}`,
    `  domain: ${orgs.length ? orgs.map(o => o.id + ".domain").join(", ") : "not loaded"}${missing.length ? "  ✗ " + missing.join(", ") : ""}  ·  cards opening a context ${cards.filter(c => c.data.domainRef).length}  ·  concept actions ${links}  ·  concepts without a domain element ${first.report.concepts.filter(c => !c.resolved).map(c => c.ref).filter((x, i, a) => a.indexOf(x) === i).join(", ") || "none"}`,
    `landscape variants:`,
    ...variants.filter(v => v.file).map(v => `  ${v.label.replace("landscape ", "").padEnd(52)} ${String(v.file.diagram.nodes.length).padStart(3)} nodes ${String(v.file.diagram.edges.length).padStart(3)} edges  (landscapeCountVisible ${A.landscapeCountVisible(arch, v.show)}${v.report.dropped.length ? `, dropped ${v.report.dropped.map(d => d.id).join(", ")}` : ""})`),
  );
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
for (const line of landscapeLines) console.log(line);

if (errors.length) {
  console.error(`\n${errors.length} contract violation(s):`);
  for (const e of errors.slice(0, 60)) console.error("  - " + e);
  process.exit(1);
}

console.log(`\nOK — all architecture DiagramFiles satisfy DERIVED-DIAGRAMS.md${landscapeLines.length ? ", and so does the landscape with every toggle combination" : ""}`);

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

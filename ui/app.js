/* Specy Domain Navigator — vanilla JS, no build step.
   Renders MODEL (data.js): header org picker · tree panel · detail panel. */

"use strict";

/* ---- Kind registry — colors follow CLASS_CARD_STEREOTYPES from the
   design system; kinds the DS doesn't define reuse its palette shades. ---- */
const KINDS = {
  "module":                 { label: "M",  title: "Module",                 color: "#172741" },
  "entity":                 { label: "E",  title: "Entity",                 color: "#F65E5E" },
  "readonly-entity":        { label: "E",  title: "Read-only Entity",       color: "#b7a480" },
  "aggregate":              { label: "A",  title: "Aggregate",              color: "#172741" },
  "value":                  { label: "V",  title: "Value Type",             color: "#8d7e63" },
  "enum":                   { label: "En", title: "Enum (Referential)",     color: "#b7a480" },
  "command":                { label: "C",  title: "Command",                color: "#F65E5E" },
  "query":                  { label: "Q",  title: "Query",                  color: "#1e416e" },
  "event":                  { label: "Ev", title: "Event",                  color: "#8d7e63" },
  "reaction":               { label: "Rx", title: "Reaction",               color: "#bf3d5e" },
  "domain-service":         { label: "S",  title: "Domain Service",         color: "#1e416e" },
  "application-service":    { label: "As", title: "Application Service",    color: "#2a5a98" },
  "infrastructure-service": { label: "Is", title: "Infrastructure Service", color: "#4b5d6c" },
  "repository":             { label: "R",  title: "Repository",             color: "#3573c3" },
  "interface":              { label: "I",  title: "Interface",              color: "#3b5468" },
  "invariant":              { label: "P",  title: "Invariant",              color: "#a13e3e" },
  "agreement":              { label: "Ag", title: "Agreement",              color: "#762d2d" },
  "reconciliation":         { label: "Rc", title: "Reconciliation",         color: "#625845" },
};
const EVENT_TYPE_LABEL = { internal: "Internal Event", external: "External Event", error: "Error Event", temporal: "Temporal Event" };
const EVENT_TYPE_COLOR = { internal: "#8d7e63", external: "#2a5a98", error: "#cb4e4e", temporal: "#625845" };

const GROUPS = [
  ["Aggregates", ["aggregate"]],
  ["Entities", ["entity", "readonly-entity"]],
  ["Values & Enums", ["value", "enum"]],
  ["Commands", ["command"]],
  ["Queries", ["query"]],
  ["Events", ["event"]],
  ["Reactions", ["reaction"]],
  ["Services", ["domain-service", "application-service", "infrastructure-service"]],
  ["Repositories", ["repository"]],
  ["Interfaces", ["interface"]],
  ["Properties", ["invariant", "agreement", "reconciliation"]],
];

/* ---- .domain / .sysreq / .arch files loaded at boot ----
   The server lists them at `api/models` — `{ tenant, files: [{ org, name,
   kind }] }` — and serves each one at `api/models/<org>/<name>`. Locally
   `serve.sh` lists the model files of ui/ under the one organization "local";
   hosted, the Worker (ui/hosting/) lists the files published for the
   signed-in tenant, restricted to the organizations that user may see. Files
   are loaded by kind (.domain, then .sysreq, then .arch) in name order.
   Always revalidated with the server (304 when unchanged): an edited model
   must never be read from a stale HTTP cache next to newer code. The
   X-Requested-With header makes an expired hosted session answer 401 instead
   of redirecting a fetch to a login page. */
const MODELS_API = "api/models";
const NO_CACHE = { cache: "no-cache", headers: { "X-Requested-With": "XMLHttpRequest" } };

const ARCHS = [];            // parsed .arch architectures (arch-parser.js)
const DOMAIN_TEXT = {};      // organization id → .domain source, for the Synthetic data tab (synth-view.js parses it in the page)

const REQSETS = [];          // parsed requirement sets
const REQ_BY_ID = {};        // "REQ-FIPRO-001" → requirement object

/* EARS patterns (SYSTEM-REQ-METAMODEL.md) */
const PATTERN_KINDS = {
  "ubiquitous":   { label: "U", title: "Ubiquitous",            color: "#172741" },
  "state-driven": { label: "S", title: "State-driven (While)",  color: "#1e416e" },
  "event-driven": { label: "E", title: "Event-driven (When)",   color: "#2a5a98" },
  "unwanted":     { label: "!", title: "Unwanted (If-Then)",    color: "#cb4e4e" },
  "optional":     { label: "O", title: "Optional (Where)",      color: "#8d7e63" },
  "complex":      { label: "C", title: "Complex",               color: "#bf3d5e" },
};
const PATTERN_ORDER = ["ubiquitous", "state-driven", "event-driven", "unwanted", "optional", "complex"];
const PRIORITY_CHIP = { must: "req", should: "warn", could: "info", wont: "" };

/* Satisfaction roles are derived from the satisfying element's kind
   (SYSTEM-REQ-METAMODEL.md "Satisfaction roles" — the role is never recorded) */
const ROLE_BY_KIND = {
  "entity": "structured-by", "readonly-entity": "structured-by", "aggregate": "structured-by",
  "value": "structured-by", "enum": "structured-by", "repository": "structured-by",
  "invariant": "enforced-by", "reaction": "enforced-by",
  "command": "implemented-by", "query": "implemented-by", "domain-service": "implemented-by",
  "application-service": "implemented-by", "interface": "implemented-by", "module": "implemented-by",
  "agreement": "reconciled-by", "reconciliation": "reconciled-by",
  "infrastructure-service": "quality-constrained-by",
};
function roleOf(el) {
  if (el.kind === "event") return el.eventType === "error" ? "detected-by" : "implemented-by";
  return ROLE_BY_KIND[el.kind] || "implemented-by";
}

/* Coverage: every domain element (or operation) whose satisfies list carries reqId */
function elementsSatisfying(reqId) {
  const hits = [];
  for (const org of MODEL.organizations)
    for (const c of org.contexts)
      for (const mod of c.modules)
        for (const el of mod.elements) {
          if ((el.satisfies || []).includes(reqId)) hits.push({ el, org, via: null });
          for (const op of el.operations || [])
            if (typeof op === "object" && op && (op.satisfies || []).includes(reqId))
              hits.push({ el, org, via: op.label });
        }
  return hits;
}

/* ---- Index: id → {el, module, context, org} ---- */
const INDEX = {};
function buildIndex() {
  for (const k in INDEX) delete INDEX[k];
  for (const org of MODEL.organizations) {
    for (const ctx of org.contexts) {
      INDEX["ctx:" + ctx.id] = { ctx, org };
      for (const mod of ctx.modules) {
        INDEX["mod:" + mod.id] = { mod, ctx, org };
        /* first wins: a second definition of the same name in a context never shadows the first */
        for (const el of mod.elements) if (!INDEX[el.id]) INDEX[el.id] = { el, mod, ctx, org };
      }
    }
  }
  for (const set of REQSETS) {
    INDEX["reqset:" + set.id] = { set };
    for (const r of set.requirements) {
      INDEX["req:" + r.id] = { req: r, set };
      REQ_BY_ID[r.id] = r;
    }
  }
}
buildIndex();

/* ---- State ---- */
const state = {
  view: "domain",            // "domain" | "diagram" | "arch" | "req" | "synth"
  /* null until boot when data.js ships no sample (the hosted build) */
  orgId: MODEL.organizations[0]?.id ?? null,
  ctxId: MODEL.organizations[0]?.contexts[0]?.id ?? null,
  selected: MODEL.organizations[0] ? "ctx:" + MODEL.organizations[0].contexts[0].id : null,
  reqSetId: null,
  reqSelected: null,
  diagramModId: null,        // module rendered in the diagram view
  diagramShow: { interfaces: true, entities: true, values: true, services: true },
  diagramScope: "module",    // diagram view: "module" (one module) | "context" (every concept of the context) | "org" (the concepts by system)
  conceptShow: null,         // category toggles of the context diagram (seeded from SpecyDomainDiagrams.CONCEPTS_SHOW)
  conceptLandShow: {},       // toggles of the organization diagram the user changed (defaults: CONCEPT_LANDSCAPE_DEFAULT_SHOW)
  archId: null,              // architecture rendered in the arch view
  archShow: { persons: true, externalSystems: true, channels: true, edgeLabels: true },
  archSel: null,             // "kind:name" of the element selected in the arch view (tree or canvas)
  archMode: {},              // organization files only: arch id → "landscape" (default) | "c4"
  archUnfold: null,          // "system:name" to open on its containers at the next C4 render ("Open C4 view")
  landShow: {},              // landscape toggles the user changed (defaults: LANDSCAPE_DEFAULT_SHOW)
  returnTo: null,            // { hash, label } of the architecture place a domain link was followed from
  expanded: new Set(),
  filter: "",
};

const curSet = () => REQSETS.find(s => s.id === state.reqSetId) || REQSETS[0];
const curArch = () => ARCHS.find(a => a.id === state.archId) || ARCHS[0];

const org = () => MODEL.organizations.find(o => o.id === state.orgId);
const ctx = () => org().contexts.find(c => c.id === state.ctxId) || org().contexts[0];
/* Enters an organization: its first context selected, nothing unfolded. */
function enterOrg(o) {
  state.orgId = o.id;
  state.ctxId = o.contexts[0].id;
  state.selected = "ctx:" + state.ctxId;
  state.diagramModId = null;
  state.expanded.clear();
}

function kindOf(el) {
  if (el.kind === "event" && el.eventType) {
    return { label: KINDS.event.label, title: EVENT_TYPE_LABEL[el.eventType], color: EVENT_TYPE_COLOR[el.eventType] };
  }
  return KINDS[el.kind] || KINDS.entity;
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function badge(k, lg) {
  return `<span class="badge${lg ? " lg" : ""}" style="background:${k.color}" title="${esc(k.title)}">${esc(k.label)}</span>`;
}

/* A clickable reference to another element (or context/module). */
function refLink(id) {
  const hit = INDEX[id];
  if (!hit) return `<code class="inline">${esc(id)}</code>`;
  if (hit.el) {
    const k = kindOf(hit.el);
    return `<a class="ref" href="#${esc(id)}" data-goto="${esc(id)}">${badge(k)}${esc(hit.el.name)}</a>`;
  }
  if (hit.mod && !hit.el) return `<a class="ref" href="#${esc(id)}" data-goto="${esc(id)}">${badge(KINDS.module)}${esc(hit.mod.name)}</a>`;
  return `<a class="ref" href="#${esc(id)}" data-goto="${esc(id)}">${esc(hit.ctx.name)}</a>`;
}
const refList = arr => (arr || []).map(r => refLink(r.ref)).join(", ");

/* A `satisfies` chip — a link into the requirements navigator when the id is known */
function reqChip(reqId) {
  if (REQ_BY_ID[reqId])
    return `<a class="chip req" href="#req:${esc(reqId)}" data-goto="req:${esc(reqId)}">satisfies ${esc(reqId)}</a>`;
  return `<span class="chip req">satisfies ${esc(reqId)}</span>`;
}
/* An inline requirement id link (used in requirement detail relation lists) */
function reqLink(reqId) {
  const r = REQ_BY_ID[reqId];
  if (!r) return `<code class="inline">${esc(reqId)}</code>`;
  const k = PATTERN_KINDS[r.pattern] || PATTERN_KINDS.ubiquitous;
  return `<a class="ref" href="#req:${esc(reqId)}" data-goto="req:${esc(reqId)}">${badge(k)}${esc(reqId)}</a>`;
}

/* ================= Tree ================= */

function elementMatches(el, f) {
  return !f || el.name.toLowerCase().includes(f) || el.kind.includes(f);
}

function treeRow({ id, name, k, depth, hasChildren, expanded, count }) {
  const sel = state.selected === id ? " selected" : "";
  const caret = hasChildren
    ? `<span class="caret${expanded ? " open" : ""}">▶</span>`
    : `<span class="caret leaf">▶</span>`;
  return `<button class="tree-row${sel}" data-select="${esc(id)}" ${hasChildren ? `data-toggle="${esc(id)}"` : ""} style="--indent:${depth * 16}px">
    ${caret}${k ? badge(k) : ""}<span class="row-name">${esc(name)}</span>${count != null ? `<span class="row-count">${count}</span>` : ""}
  </button>`;
}

function renderReqTree() {
  const set = curSet();
  if (!set) { document.getElementById("tree").innerHTML = `<div class="tree-empty">No .sysreq file loaded.</div>`; return; }
  const f = state.filter.trim().toLowerCase();
  const matches = r => !f || r.id.toLowerCase().includes(f) || r.title.toLowerCase().includes(f)
    || r.pattern.includes(f) || (r.statement || "").toLowerCase().includes(f);
  let html = `<ul><li>${treeRowSel({ id: "reqset:" + set.id, name: set.name + " — coverage", depth: 0 })}</li>`;
  let any = false;
  for (const pattern of PATTERN_ORDER) {
    const reqs = set.requirements.filter(r => r.pattern === pattern && matches(r));
    if (!reqs.length) continue;
    any = true;
    const k = PATTERN_KINDS[pattern];
    html += `<li><div class="tree-group-label" style="--indent:0px">${esc(k.title)}</div></li>`;
    for (const r of reqs) html += `<li>${treeRowSel({ id: "req:" + r.id, name: r.id.replace(/^REQ-/, ""), k, depth: 1, hint: r.title })}</li>`;
  }
  html += "</ul>";
  if (!any && f) html = `<div class="tree-empty">No requirement matches “${esc(state.filter)}”.</div>`;
  document.getElementById("tree").innerHTML = html;
}

/* tree row for the requirements view (selection tracked in reqSelected) */
function treeRowSel({ id, name, k, depth, hint }) {
  const sel = state.reqSelected === id ? " selected" : "";
  return `<button class="tree-row req-row${sel}" data-select="${esc(id)}" style="--indent:${depth * 16}px" ${hint ? `title="${esc(hint)}"` : ""}>
    <span class="caret leaf">▶</span>${k ? badge(k) : ""}<span class="row-name">${esc(name)}</span>${hint ? `<span class="row-hint">${esc(hint)}</span>` : ""}
  </button>`;
}

/* Diagram view tree: the context's concept diagram — every entity and
   aggregate of the context at once — then one row per module */
const CTX_BADGE = { label: "BC", title: "Bounded context — all its concepts", color: "#172741" };
function renderDiagramTree() {
  const c = ctx();
  if (!c.modules.some(m => m.id === state.diagramModId))
    state.diagramModId = c.modules.length ? c.modules[0].id : null;
  const f = state.filter.trim().toLowerCase();
  const mods = c.modules.filter(m => !f || m.name.toLowerCase().includes(f));
  const D = SpecyDomainDiagrams;
  const concepts = c.modules.reduce((n, m) => n + m.elements.filter(e => D.CATEGORY_OF[e.kind] === "entities").length, 0);
  const ctxSel = state.diagramScope === "context" ? " selected" : "";
  let html = `<ul><li><button class="tree-row scope-row${ctxSel}" data-select="diagctx" style="--indent:0px" title="Every entity and aggregate of the context on one canvas, whatever its module">
      <span class="caret leaf">▶</span>${badge(CTX_BADGE)}<span class="row-name">All concepts of ${esc(c.shortname || c.name)}</span>
      <span class="row-count">${concepts}</span>
    </button></li>`;
  if (!mods.length) {
    document.getElementById("tree").innerHTML = html + `<li><div class="tree-empty">No module matches “${esc(state.filter)}”.</div></li></ul>`;
    return;
  }
  html += `<li><div class="tree-group-label" style="--indent:0px">Modules</div></li>`;
  for (const mod of mods) {
    const mains = mod.elements.filter(e => D.MAIN_KINDS.has(e.kind)).length;
    const sel = state.diagramScope === "module" && state.diagramModId === mod.id ? " selected" : "";
    html += `<li><button class="tree-row${sel}" data-select="diagmod:${esc(mod.id)}" style="--indent:0px" title="${esc(mod.description || mod.name)}">
      <span class="caret leaf">▶</span>${badge(KINDS.module)}<span class="row-name">${esc(mod.name)}</span>
      <span class="row-count">${mains}/${mod.elements.length}</span>
    </button></li>`;
  }
  html += "</ul>";
  document.getElementById("tree").innerHTML = html;
}

/* ---- Architecture view (arch-parser.js + arch-to-diagram.js) ---- */
const ARCH_BADGE = { label: "C4", title: "Software architecture", color: "#172741" };
const ORG_BADGE = { label: "L0", title: "Organization landscape (level 0)", color: "#172741" };
/* An `organization` file (level 0) opens on its landscape — systems by area,
   "depends on" edges, numbered flows — and keeps the C4 diagram of its
   detailed systems one click away; an `architecture` file only has the C4
   view. Without the landscape converter (arch-to-diagram.js), or when it
   fails on a file, an organization file falls back to the C4 view. */
const isOrgArch = a => !!a && a.root === "organization";
const landscapeFailed = new Set();   // arch ids whose landscape conversion threw
const hasLandscape = a => typeof SpecyArchDiagrams.landscapeDiagram === "function" && !landscapeFailed.has(a.id);
const archModeOf = a => (isOrgArch(a) && hasLandscape(a) ? state.archMode[a.id] || "landscape" : "c4");
/* an organization and a landscape (several systems) are named after the
   file's root, a single system in focus after the system */
const archTitle = a => (isOrgArch(a) || (a.systems && a.systems.length > 1) ? a.name : (a.system && a.system.name) || a.name);
const archDomainStem = a => String(a.domainSource || "").split("/").pop().replace(/\.domain$/, "");
/* the loaded organization parsed from the .arch's domain-source (ids = file stems) */
const archDomainOrg = a => (a.domainSource && MODEL.organizations.find(o => o.id === archDomainStem(a))) || null;

/* kinds the converter's KIND_LEGEND may not know */
const ARCH_SWATCH_FALLBACK = { area: { label: "Area", color: "transparent", border: "#9aa5b1", dashed: true } };
function archSwatch(kind) {
  const k = SpecyArchDiagrams.KIND_LEGEND[kind] || ARCH_SWATCH_FALLBACK[kind];
  if (!k) return `<span class="arch-swatch none"></span>`;
  return `<span class="arch-swatch${k.dashed ? " dashed" : ""}" style="background:${esc(k.color)};border-color:${esc(k.border)}" title="${esc(k.label)}"></span>`;
}

/* ---- Level 0: concept references resolved against the loaded domain models
   (arch-concepts.js). One resolution per parsed architecture, recomputed
   when a domain model was loaded since (boot loads the files one by one). ---- */
const archResolutions = new WeakMap();
function archResolution(a) {
  let r = archResolutions.get(a);
  if (r && r.loaded === MODEL.organizations.length) return r;
  r = { loaded: MODEL.organizations.length, sources: [], orgs: [], missing: [], summary: null };
  if (typeof SpecyArchConcepts !== "undefined") {
    try {
      r.sources = SpecyArchConcepts.domainSources(a);
      const found = SpecyArchConcepts.domainOrgsFor(a, MODEL.organizations);
      r.orgs = found.orgs;
      r.missing = found.missing;
      r.summary = SpecyArchConcepts.resolveAll(a, r.orgs);
    } catch (e) {
      console.warn("concept resolution failed for " + a.id + ".arch:", e);
      r.summary = null;
    }
  }
  archResolutions.set(a, r);
  return r;
}
/* how a concept reference resolved: { status: "resolved" | "ambiguous" |
   "acknowledged" | "unresolved" | "plain", … } (see arch-concepts.js) */
function conceptResolution(a, ref) {
  const r = archResolution(a);
  const x = (r.summary && r.summary.of(ref)) || { status: "plain" };
  /* with a domain source missing, "unresolved" proves nothing */
  return x.status === "unresolved" && r.missing.length ? { status: "plain" } : x;
}
const unresolvedReason = (ref, x) => (x.reason === "unknown-context" ? `no bounded context ${ref.context} in the domain model`
  : x.reason === "not-referable" ? `names ${(x.found || []).map(c => `${c.kindLabel} ${c.context}.${c.name}`).join(", ")} — not a kind a concept may name`
  : "no domain element");

/* A concept name of a level-0 clause (`masters`, `handles`, `carries … as …`,
   a hotspot's `concerns`). Resolved, it is a link into the Domain Navigator;
   ambiguous, it offers its candidates; acknowledged or unresolved, it is
   plain text with its reason (the NOTE, "no domain element") — in the
   tooltip, or next to the name with `opts.reason`. `opts.bare` shows the
   name without its context qualifier (the caller prints the context). */
function conceptHtml(a, ref, opts = {}) {
  if (!ref) return "";
  const x = conceptResolution(a, ref);
  const label = esc(opts.bare ? ref.name : ref.raw || ref.name);
  if (x.status === "resolved" && INDEX[x.id]) {
    const tip = `${x.kindLabel} ${x.name} — context ${x.context}${x.sourcedFrom ? `, sourced from ${x.sourcedFrom}` : ""} · open in the Domain Navigator`;
    return `<a class="ref concept" href="#${esc(x.id)}" data-goto="${esc(x.id)}" title="${esc(tip)}">${badge(kindOf(INDEX[x.id].el))}${label}</a>`;
  }
  if (x.status === "ambiguous") {
    const cands = (x.candidates || []).map(c => (INDEX[c.id]
      ? `<a class="ref concept" href="#${esc(c.id)}" data-goto="${esc(c.id)}">${badge(kindOf(INDEX[c.id].el))}${esc(c.context)}.${esc(c.name)}</a>`
      : `<span class="rel-plain">${esc(c.context)}.${esc(c.name)}</span>`)
      + ` <span class="rel-note">${esc(c.kindLabel)}${c.module ? ` · module ${esc(c.module)}` : ""}</span>`);
    return `<details class="concept-amb"><summary title="Ambiguous: ${cands.length} domain elements bear this name — pick one (and qualify the name in the .arch)">${label}<span class="amb-mark">${cands.length}?</span></summary>` +
      `<span class="amb-menu">${cands.map(c => `<span class="amb-item">${c}</span>`).join("")}</span></details>`;
  }
  if (x.status === "acknowledged" || x.status === "unresolved") {
    const why = x.status === "acknowledged" ? x.note || "acknowledged by a // NOTE:" : unresolvedReason(ref, x);
    const tip = x.status === "acknowledged" ? `Not in the domain model — NOTE: ${why}` : `Not linked: ${why}`;
    return `<span class="concept-plain ${x.status}" title="${esc(tip)}">${label}</span>` +
      (opts.reason ? ` <span class="concept-why">${esc(why)}</span>` : "");
  }
  return `<span class="concept-plain">${label}</span>`;
}

/* bounded contexts named by `realizes context X`, looked up (by name or
   shortname) in the domain models the architecture resolves against */
function archContexts(a, names) {
  const orgs = archResolution(a).orgs;
  const norm = typeof SpecyArchConcepts !== "undefined" ? SpecyArchConcepts.norm : s => String(s || "").toLowerCase();
  return (names || []).map(name => {
    let ctx = null;
    for (const o of orgs) for (const c of o.contexts) if (!ctx && (norm(c.name) === norm(name) || norm(c.shortname) === norm(name))) ctx = c;
    return { name, ctx };
  });
}
const contextLink = (name, ctx) => (ctx && INDEX["ctx:" + ctx.id]
  ? `<a class="ref" href="#ctx:${esc(ctx.id)}" data-goto="ctx:${esc(ctx.id)}" title="Bounded context ${esc(ctx.name)} — open its context map in the Domain Navigator">${esc(name)}</a>`
  : `<span class="rel-plain">${esc(name)}</span>`);

/* ---- Level-0 vocabulary shared by the organization tree and the sheets ---- */
const flowMechanism = (f, phase) => (f.perPhase.length ? f.perPhase.find(p => p.phase === phase) || null : f.mechanism);
const dependsOn = d => `${d.from} depends on ${d.to}`;
const reverseDependency = (a, d) => a.dependencies.find(x => x.from === d.to && x.to === d.from) || null;
const isPartnership = (a, d) => {
  const back = reverseDependency(a, d);
  return !!back && d.patterns.includes("Partnership") && back.patterns.includes("Partnership");
};
/* context-map patterns: the side of the dependency each one qualifies */
const PATTERN_INFO = {
  CS:                ["downstream", "Customer–Supplier: the upstream plans for what this downstream needs"],
  Conformist:        ["downstream", "Conformist: the downstream takes the upstream's model as it is, without translating"],
  ACL:               ["downstream", "Anti-Corruption Layer: the downstream translates the upstream's model into its own"],
  OHS:               ["upstream", "Open Host Service: the upstream offers one protocol to all its consumers"],
  SharedKernel:      ["both", "Shared Kernel: the two systems share a part of their model"],
  PublishedLanguage: ["both", "Published Language: a documented exchange language owned by neither side"],
  Partnership:       ["both", "Partnership: the two teams adapt to each other and succeed or fail together"],
};
const CRITICALITY_INFO = { critical: "is down too", degraded: "keeps running with reduced service", tolerant: "shows no user-visible impact" };
function patternChips(d) {
  return d.patterns.map(p => {
    const info = PATTERN_INFO[p];
    const side = info ? (info[0] === "downstream" ? `downstream side (${d.from})` : info[0] === "upstream" ? `upstream side (${d.to})` : "both sides") : "";
    return `<span class="pattern-tag" title="${esc(info ? `${side} — ${info[1]}` : "unknown pattern")}">${esc(p)}</span>`;
  }).join(" ");
}
/* Level-0 item behind a selection key ("system:ERP", "dependency:ERP->CRM",
   "area:…", "person:…", "externalSystem:…"), read from the parsed organization */
function orgItemOf(a, key) {
  if (!isOrgArch(a) || !key) return null;
  const i = key.indexOf(":"), kind = key.slice(0, i), name = key.slice(i + 1);
  const pool = { system: a.systems, externalSystem: a.externalSystems, person: a.persons, area: a.areas, dependency: a.dependencies }[kind];
  const item = pool && pool.find(x => (kind === "dependency" ? x.id : x.name) === name);
  return item ? { kind, name, item } : null;
}
const orgKindOf = (a, name) => (a.systems.some(s => s.name === name) ? "system"
  : a.externalSystems.some(x => x.name === name) ? "externalSystem"
  : a.persons.some(p => p.name === name) ? "person" : null);
/* a name of the organization as a link that selects it (tree, canvas, sheet) */
function orgLink(a, name, kind) {
  kind = kind || orgKindOf(a, name);
  if (!kind) return `<span class="rel-plain">${esc(name)}</span>`;
  return `<button class="arch-link" data-archsel="${esc(kind + ":" + name)}">${archSwatch(kind)}${esc(name)}</button>`;
}
const dependencyLink = (d, text) =>
  `<button class="arch-link dep" data-archsel="dependency:${esc(d.id)}" title="${esc(dependsOn(d))} — open the dependency">${esc(text || dependsOn(d))}</button>`;

/* Architecture view tree: the system in focus, element counts keyed by the
   canvas colours, the fold-level hint, then the systems and containers as
   selectable rows (`data-archsel="kind:name"`): a row selects and frames the
   element in the diagram and opens its details. The filter box is hidden. */
function renderArchTree() {
  const tree = document.getElementById("tree");
  const a = curArch();
  if (!a) {
    tree.innerHTML = `<div class="tree-empty">No .arch file loaded — list one in <code class="inline">ARCH_FILES</code> (top of app.js).</div>`;
    return;
  }
  if (archModeOf(a) === "landscape") { renderOrgTree(tree, a); return; }
  const sys = a.system || { description: "" }, n = a.counts, dorg = archDomainOrg(a);
  const multi = isOrgArch(a) || a.systems.length > 1;   // an organization, or a landscape (scripts/merge-arch.mjs)
  const info = (lead, name, count, title, depth) =>
    `<li><div class="tree-info" style="--indent:${(depth || 0) * 16}px"${title ? ` title="${esc(title)}"` : ""}>${lead}<span class="row-name">${esc(name)}</span>${count != null ? `<span class="row-count">${esc(count)}</span>` : ""}</div></li>`;
  const desc = multi ? a.description : sys.description || a.description;
  let html = `<div class="arch-head">
      <div class="arch-name">${archSwatch("system")}<span>${esc(archTitle(a))}</span></div>
      ${desc ? `<p class="arch-desc">${esc(desc)}</p>` : ""}
      <p class="arch-source">${a.domainSource
        ? `domain-source <code class="inline">${esc(a.domainSource)}</code> · ${dorg ? "linked — double-click a card to open what it realizes" : "not loaded"}`
        : "no domain-source"}</p>
      ${isOrgArch(a) && hasLandscape(a) ? `<p class="arch-source">C4 view of the organization's systems — <button class="arch-link" data-archmode="landscape">back to the landscape</button></p>` : ""}
    </div>
    <ul class="arch-legend">
      <li><div class="tree-group-label" style="--indent:0px">Elements</div></li>`;
  for (const [kind, key, label] of [
    ...(multi ? [["system", "systems", "Systems"]] : []),
    ["person", "persons", "Persons"], ["externalSystem", "externalSystems", "External systems"],
    ["container", "containers", "Containers"], ["component", "components", "Components"], ["channel", "channels", "Channels"]])
    html += info(archSwatch(kind), label, n[key]);
  for (const [key, label, title] of [
    ["interfaces", "Interfaces", "edge labels and provides / requires rows"],
    ["connectors", "Connectors", "drawn as edges; parallel ones merged"],
    ["environments", "Environments", "deployment view — not drawn"]])
    html += info(archSwatch(null), label, n[key], title);
  const pick = (kind, name, count, title, depth) => {
    const key = `${kind}:${name}`;
    return `<li><button class="tree-row arch-row${state.archSel === key ? " selected" : ""}" data-archsel="${esc(key)}" style="--indent:${depth * 16}px"${title ? ` title="${esc(title)}"` : ""}>${archSwatch(kind)}<span class="row-name">${esc(name)}</span>${count != null ? `<span class="row-count">${esc(count)}</span>` : ""}</button></li>`;
  };
  html += `<li><div class="tree-group-label" style="--indent:0px">Fold levels</div></li>
      <li><div class="tree-hint">Groups <b>1</b> ${multi ? "systems" : "context"} · <b>2</b> containers · <b>3</b> components</div></li>
      <li><div class="tree-group-label" style="--indent:0px">${multi ? "Systems and containers" : "System and containers"}</div></li>`;
  for (const s of a.systems) {
    html += pick("system", s.name, `${s.containers.length} ct`, s.description, 0);
    for (const c of s.containers) {
      const chans = s.channels.filter(ch => ch.broker === c.name).length;
      const count = c.components.length ? c.components.length : chans ? `${chans} ch` : "—";
      const title = [c.technology, c.description].filter(Boolean).join(" — ");
      html += pick("container", c.name, count, title, 1);
    }
  }
  html += `</ul>`;
  tree.innerHTML = html;
}

/* Organization tree (level 0, landscape mode): the organization and how its
   concept names resolved, what the readers could not read, then the areas
   with their systems, the external systems, the persons, the dependencies
   and the phases. Rows select like the C4 rows (`data-archsel`); the selected
   system unfolds its main concepts (links into the Domain Navigator), the
   selected dependency its flows (a row jumps to the flow in the sheet). */
function renderOrgTree(tree, a) {
  const res = archResolution(a), sum = res.summary;
  const group = label => `<li><div class="tree-group-label" style="--indent:0px">${label}</div></li>`;
  const pick = (kind, id, label, count, title, depth) => {
    const key = `${kind}:${id}`;
    return `<li><button class="tree-row arch-row${state.archSel === key ? " selected" : ""}" data-archsel="${esc(key)}" style="--indent:${depth * 16}px"${title ? ` title="${esc(title)}"` : ""}>${kind === "dependency" ? "" : archSwatch(kind)}<span class="row-name">${label}</span>${count != null && count !== "" ? `<span class="row-count">${esc(count)}</span>` : ""}</button></li>`;
  };
  /* the main concepts of the selected system, source of truth first */
  const conceptRows = (holder, depth) => [["masters", "●", "source of truth (masters)"], ["handles", "○", "handled, not mastered"]]
    .map(([site, mark, tip]) => (holder[site] || []).map(ref =>
      `<li><div class="tree-info tree-concept" style="--indent:${depth * 16}px"><span class="concept-mark ${site}" title="${tip}">${mark}</span>${conceptHtml(a, ref)}</div></li>`).join("")).join("");
  const systemRow = (s, depth) => {
    const marks = [s.detail === "inline" ? "C4" : "", s.hotspots.length ? `${s.hotspots.length} hot` : ""].filter(Boolean).join(" · ");
    const title = [s.technology, s.description].filter(Boolean).join(" — ");
    return pick("system", s.name, esc(s.name), marks, title, depth)
      + (state.archSel === "system:" + s.name ? conceptRows(s, depth + 1) : "");
  };

  /* why concept names are not linked, when they are not: the counts are the
     tree's own (groups below, Problems), the file name is the picker's */
  const resolution = !res.sources.length ? `no <code class="inline">domain-source</code> — concept names are plain text`
    : !res.orgs.length ? `domain-source ${res.sources.map(s => `<code class="inline">${esc(s)}</code>`).join(", ")} not loaded — concept names are plain text`
    : res.missing.length ? `not loaded: ${res.missing.map(s => `<code class="inline">${esc(s)}</code>`).join(", ")}` : "";
  let html = `<div class="arch-head">
      <div class="arch-name">${badge(ORG_BADGE)}<span>${esc(a.name)}</span></div>
      ${a.description ? `<p class="arch-desc">${esc(a.description)}</p>` : ""}
      ${resolution ? `<p class="arch-source arch-resolution">${resolution}</p>` : ""}
    </div>
    <ul class="arch-legend">`;

  /* what the readers could not read, link or decide */
  const problems = (a.issues || []).map(p => ({ line: p.line, text: p.message }))
    .concat(sum && !res.missing.length ? sum.problems.map(p => ({ line: p.line, text: p.message })) : [])
    .concat(sum ? sum.domainProblems.map(p => ({ line: 0, text: p.message })) : []);
  if (problems.length) {
    html += group(`Problems (${problems.length})`)
      + problems.slice(0, 40).map(p => `<li><div class="tree-problem">${p.line ? `<span class="tree-problem-line">line ${esc(p.line)}</span> ` : ""}${esc(p.text)}</div></li>`).join("")
      + (problems.length > 40 ? `<li><div class="tree-problem">… and ${problems.length - 40} more</div></li>` : "");
  }

  html += group("Areas and systems");
  for (const area of a.areas) {
    const members = a.systems.filter(s => s.area === area.name);
    html += pick("area", area.name, esc(area.name), members.length, area.description, 0);
    for (const s of members) html += systemRow(s, 1);
  }
  const known = new Set(a.areas.map(x => x.name));
  const loose = a.systems.filter(s => !known.has(s.area));
  if (loose.length && a.areas.length) html += `<li><div class="tree-info" style="--indent:0px"><span class="row-name tree-muted">no area</span></div></li>`;
  for (const s of loose) html += systemRow(s, a.areas.length ? 1 : 0);

  if (a.externalSystems.length) {
    html += group("External systems");
    for (const x of a.externalSystems)
      html += pick("externalSystem", x.name, esc(x.name), "", x.description, 0)
        + (state.archSel === "externalSystem:" + x.name ? conceptRows(x, 1) : "");
  }
  if (a.persons.length) {
    html += group("Persons");
    for (const p of a.persons)
      html += pick("person", p.name, esc(p.name), a.systems.filter(s => s.usedBy.includes(p.name)).length || "", p.description, 0);
  }

  if (a.dependencies.length) {
    html += `<li><div class="tree-group-label" style="--indent:0px" title="A → B reads “A depends on B”: A is downstream, B upstream">Dependencies · A → B: A depends on B</div></li>`;
    for (const d of a.dependencies) {
      const nums = d.flows.map(f => f.number);
      const title = [dependsOn(d), d.patterns.join(", "), d.criticality ? "criticality " + d.criticality : "",
        d.mutual ? (isPartnership(a, d) ? "Partnership (both directions)" : "mutual dependency") : "", d.description].filter(Boolean).join(" — ");
      html += pick("dependency", d.id,
        `${esc(d.from)} <span class="sm-arrow" aria-label="depends on">→</span> ${esc(d.to)}${d.mutual ? ` <span class="dep-mutual" title="${isPartnership(a, d) ? "Partnership" : "mutual dependency"}: the opposite dependency exists too">⇄</span>` : ""}`,
        nums.length ? "#" + (nums.length > 1 && nums[nums.length - 1] - nums[0] === nums.length - 1 ? `${nums[0]}–${nums[nums.length - 1]}` : nums.join(",")) : "no flow",
        title, 0);
      if (state.archSel === "dependency:" + d.id)
        for (const f of d.flows)
          html += `<li><button class="tree-row arch-row tree-flow" data-flowjump="${esc(f.number)}" style="--indent:16px" title="${esc(`flow ${f.number} — ${f.sender} → ${f.receiver}`)}"><span class="flow-num">${esc(f.number)}</span><span class="row-name">${esc(f.label)}</span></button></li>`;
    }
  }

  if (a.phases.length) {
    html += group("Phases · in order");
    a.phases.forEach((p, i) => {
      html += `<li><div class="tree-info" style="--indent:0px"><span class="flow-num phase">${i + 1}</span><span class="row-name">${esc(p.name)}</span></div>
        ${p.description ? `<div class="tree-hint tree-phase-desc">${esc(p.description)}</div>` : ""}</li>`;
    });
  }
  html += `</ul>`;
  tree.innerHTML = html;
}

function renderTree() {
  if (state.view === "req") { renderReqTree(); return; }
  if (state.view === "diagram") { renderDiagramTree(); return; }
  if (state.view === "arch") { renderArchTree(); return; }
  if (state.view === "synth") { SpecySynth.renderTree(document.getElementById("tree")); return; }
  const c = ctx();
  const f = state.filter.trim().toLowerCase();
  let html = `<ul><li>${treeRow({ id: "ctx:" + c.id, name: c.name + " — context map", k: null, depth: 0, hasChildren: false })}</li>`;

  for (const mod of c.modules) {
    const modKey = "mod:" + mod.id;
    const matching = mod.elements.filter(e => elementMatches(e, f));
    if (f && matching.length === 0) continue;
    const open = f ? true : state.expanded.has(modKey);
    html += `<li>${treeRow({ id: modKey, name: mod.name, k: KINDS.module, depth: 0, hasChildren: true, expanded: open, count: mod.elements.length })}`;
    if (open) {
      html += "<ul>";
      const nested = new Set(); // entities shown under their aggregate
      for (const el of matching) if (el.kind === "aggregate") (el.contains || []).forEach(r => nested.add(r.ref));
      for (const [groupName, kinds] of GROUPS) {
        const els = matching.filter(e => kinds.includes(e.kind) && !nested.has(e.id));
        if (!els.length) continue;
        html += `<li><div class="tree-group-label" style="--indent:16px">${esc(groupName)}</div></li>`;
        for (const el of els) {
          html += `<li>${treeRow({ id: el.id, name: el.name, k: kindOf(el), depth: 2, hasChildren: false })}`;
          if (el.kind === "aggregate") {
            for (const r of el.contains || []) {
              const child = INDEX[r.ref];
              if (child && elementMatches(child.el, f)) {
                html += `<ul><li>${treeRow({ id: child.el.id, name: child.el.name, k: kindOf(child.el), depth: 3, hasChildren: false })}</li></ul>`;
              }
            }
          }
          html += "</li>";
        }
      }
      html += "</ul>";
    }
    html += "</li>";
  }
  html += "</ul>";
  if (f && html.indexOf("data-select=\"" + "mod:") === -1 && c.modules.every(m => m.elements.filter(e => elementMatches(e, f)).length === 0)) {
    html = `<div class="tree-empty">No element matches “${esc(state.filter)}” in this context.</div>`;
  }
  document.getElementById("tree").innerHTML = html;
}

/* ================= Detail sections ================= */

function sectionHeader(el, k, eyebrowText, breadcrumbParts) {
  const crumbs = breadcrumbParts.map(p =>
    p.id ? `<a href="#${esc(p.id)}" data-goto="${esc(p.id)}">${esc(p.name)}</a>` : `<span class="here">${esc(p.name)}</span>`
  ).join(`<span class="sep"> › </span>`);
  const chips = [];
  if (el.identity) chips.push(`<span class="chip">identity: ${esc(el.identity)}</span>`);
  for (const req of el.satisfies || []) chips.push(reqChip(req));
  return `
    <nav class="breadcrumb">${crumbs}</nav>
    <p class="eyebrow">${esc(eyebrowText)}</p>
    <div class="detail-title">${badge(k, true)}<h1>${esc(el.name)}</h1></div>
    <p class="detail-lead">${esc(el.description || "")}</p>
    ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}`;
}

/* ClassCard-style structure box: title · fields · operations. */
function structureCard(el, k) {
  const fields = el.fields || [];
  const ops = (el.operations || []).filter(o => typeof o === "object");  // repositories carry plain signature strings
  const refs = el.references || [];
  if (!fields.length && !ops.length && !refs.length) return "";
  let html = `<p class="card-caption">Structure</p><div class="card structure">
    <div class="classcard-title">${badge(k)}<span class="name">${esc(el.name)}</span></div>`;
  if (fields.length) {
    html += `<ul class="classcard-list">` + fields.map(fld => {
      const type = fld.ref ? refLink(fld.ref) : `<span class="ftype">${esc(fld.type)}</span>`;
      return `<li><span class="tick">▫</span><span><span class="fname">${esc(fld.name)}:</span> ${type}${fld.optional ? `<span class="fopt"> optional</span>` : ""}${fld.note ? `<span class="fnote"> — ${esc(fld.note)}</span>` : ""}</span></li>`;
    }).join("") + `</ul>`;
  }
  if (refs.length) {
    html += `<ul class="classcard-list">` + refs.map(r => {
      const type = INDEX[el.id.replace(/[^:]+$/, "") + r.type] || null;
      const typeHtml = type ? refLink(type.el.id) : `<span class="ftype">${esc(r.type)}</span>`;
      return `<li><span class="tick">▹</span><span><span class="fname">${esc(r.name)}:</span> ${typeHtml} <span class="ftype">${esc(r.card)}</span>${r.note ? `<span class="fnote"> — ${esc(r.note)}</span>` : ""}</span></li>`;
    }).join("") + `</ul>`;
  }
  if (ops.length) {
    html += `<ul class="classcard-list">` + ops.map(op => {
      const flags = [];
      if (op.safe === true) flags.push(`<span class="op-flag">safe</span>`);
      if (op.safe === false) flags.push(`<span class="op-flag">unsafe</span>`);
      if (op.idempotent) flags.push(`<span class="op-flag">idempotent</span>`);
      let extra = "";
      if (op.handlesCommand) extra += `<div class="op-extra">handles ${refLink(op.handlesCommand)}</div>`;
      if (op.emits && op.emits.length) extra += `<div class="op-extra">emits ${op.emits.map(refLink).join(", ")}</div>`;
      for (const pre of op.preconditions || [])
        extra += `<div class="op-extra">requires <code class="inline">${esc(pre.predicate || pre.name)}</code>${pre.violation ? ` — “${esc(pre.violation)}”` : ""}</div>`;
      for (const post of op.postconditions || [])
        extra += `<div class="op-extra">ensures <code class="inline">${esc(post.predicate)}</code></div>`;
      if (op.returnsExpr) extra += `<div class="op-extra">returns <code class="inline">${esc(op.returnsExpr)}</code></div>`;
      if (op.satisfies && op.satisfies.length) extra += `<div class="op-extra">satisfies ${op.satisfies.map(reqLink).join(", ")}</div>`;
      if (op.note) extra += `<div class="op-extra">${esc(op.note)}</div>`;
      return `<li><span class="tick" style="color:#172741">•</span><span><span class="fname">${esc(op.label)}</span> <span class="ftype">${esc(op.sig || "")}</span>${flags.join("")}${extra}</span></li>`;
    }).join("") + `</ul>`;
  }
  return html + `</div>`;
}

/* Relations card: rows of metamodel-vocabulary links. */
function relationsCard(rows) {
  const filled = rows.filter(r => r[1]);
  if (!filled.length) return "";
  return `<p class="card-caption">Relations</p><div class="card"><table class="rel-table">` +
    filled.map(([name, value]) => `<tr><td class="rel-name">${esc(name)}</td><td>${value}</td></tr>`).join("") +
    `</table></div>`;
}

function stateMachineCards(el) {
  return (el.stateMachines || []).map((sm, i) => {
    const states = sm.states.map(s =>
      `<span class="state-pill${s.initial ? " initial" : ""}${s.final ? " final" : ""}">${esc(s.name)}</span>` +
      (s.description ? ` <span class="rel-note">— ${esc(s.description)}</span>` : "") +
      (s.invariants && s.invariants.length ? ` <span class="rel-note">· holds: ${s.invariants.map(n => `<code class="inline">${esc(n)}</code>`).join(", ")}</span>` : "")
    ).map(s => `<li>${s}</li>`).join("");
    const starts = (sm.starts || []).map(t =>
      `<tr><td><span class="sm-initial-dot" title="initial pseudo-state">●</span></td>
       <td><span class="sm-arrow">—</span> ${esc(t.operation)} <span class="sm-arrow">→</span></td>
       <td><span class="state-pill initial">${esc(t.to)}</span></td>
       <td class="rel-note">${t.guard ? `guard: <code class="inline">${esc(t.guard)}</code>` : ""}</td></tr>`
    ).join("");
    const trans = sm.transitions.map(t =>
      `<tr><td><span class="state-pill${isInitial(sm, t.from) ? " initial" : ""}">${esc(t.from)}</span></td>
       <td><span class="sm-arrow">—</span> ${esc(t.operation)} <span class="sm-arrow">→</span></td>
       <td><span class="state-pill${isFinal(sm, t.to) ? " final" : ""}">${esc(t.to)}</span></td>
       <td class="rel-note">${t.guard ? `guard: <code class="inline">${esc(t.guard)}</code>` : ""}</td></tr>`
    ).join("");
    return `<p class="card-caption">State machine · ${esc(sm.name)}</p><div class="card">
      <div class="sm-flow-host" data-sm-host="${i}"></div>
      <ul class="card-rows">${states}</ul>
      <table class="sm-table"><tr><th>From</th><th>Transition (entity operation)</th><th>To</th><th></th></tr>${starts}${trans}</table>
    </div>`;
  }).join("");
}
const isInitial = (sm, n) => sm.states.some(s => s.name === n && s.initial);
const isFinal = (sm, n) => sm.states.some(s => s.name === n && s.final);

/* ================= Detail renderers per kind ================= */

function crumbsFor(hit) {
  const parts = [{ id: null, name: hit.org.name }];
  parts[0] = { id: "ctx:" + hit.ctx.id, name: hit.org.id }; // org shown in header; keep path compact
  const out = [{ id: "ctx:" + hit.ctx.id, name: hit.ctx.shortname || hit.ctx.name }];
  if (hit.mod) out.push({ id: "mod:" + hit.mod.id, name: hit.mod.name });
  if (hit.el) out.push({ id: null, name: hit.el.name });
  else if (hit.mod) out[out.length - 1] = { id: null, name: hit.mod.name };
  else out[0] = { id: null, name: hit.ctx.shortname || hit.ctx.name };
  return out;
}

function renderContextDetail(c) {
  const o = org();
  let html = `
    <nav class="breadcrumb"><span class="here">${esc(o.id)}</span><span class="sep"> › </span><span class="here">${esc(c.shortname || c.id)}</span></nav>
    <p class="eyebrow">Bounded context</p>
    <div class="detail-title"><h1>${esc(c.name)}</h1></div>
    <p class="detail-lead">${esc(c.description)}</p>
    <div class="chips">
      <span class="chip">shortname: ${esc(c.shortname)}</span>
      ${o.requirementsSource ? `<span class="chip req">requirements-source: ${esc(o.requirementsSource)}</span>` : ""}
    </div>`;

  if (c.relations && c.relations.length) {
    html += `<p class="card-caption">Context map</p><div class="tile-grid">` + c.relations.map(r => {
      const other = org().contexts.find(x => x.id === r.with);
      return `<button class="tile" data-goto="ctx:${esc(r.with)}">
        <div class="tile-head"><span class="pattern-tag">${esc(r.pattern)}</span><span class="position-tag">${esc(r.position)}</span></div>
        <div class="tile-name">${esc(other ? other.name : r.with)}</div>
        <div class="tile-desc">${esc(r.note || "")}</div>
      </button>`;
    }).join("") + `</div>`;
  }

  html += `<p class="card-caption">Modules</p><div class="tile-grid">` + c.modules.map(m =>
    `<button class="tile" data-goto="mod:${esc(m.id)}">
      <div class="tile-head">${badge(KINDS.module)}<span class="tile-name">${esc(m.name)}</span></div>
      <div class="tile-desc">${esc(m.description)} <br><span class="rel-note">${m.elements.length} element${m.elements.length === 1 ? "" : "s"}</span></div>
    </button>`).join("") + `</div>`;
  return html;
}

function renderModuleDetail(hit) {
  const m = hit.mod;
  let html = sectionHeader(m, KINDS.module, "Module", crumbsFor(hit));
  const apis = m.elements.filter(e => e.kind === "interface" && e.role === "API");
  const spis = m.elements.filter(e => e.kind === "interface" && e.role === "SPI");
  html += relationsCard([
    ["belongs to", refLink("ctx:" + hit.ctx.id)],
    ["exposes (APIs)", apis.map(a => refLink(a.id)).join(", ")],
    ["depends on (SPIs)", spis.map(a => refLink(a.id)).join(", ")],
  ]);
  for (const [groupName, kinds] of GROUPS) {
    const els = m.elements.filter(e => kinds.includes(e.kind));
    if (!els.length) continue;
    html += `<p class="card-caption">${esc(groupName)}</p><div class="tile-grid">` + els.map(el =>
      `<button class="tile" data-goto="${esc(el.id)}">
        <div class="tile-head">${badge(kindOf(el))}<span class="tile-name">${esc(el.name)}</span></div>
        <div class="tile-desc">${esc(el.description || "")}</div>
      </button>`).join("") + `</div>`;
  }
  return html;
}

function renderElementDetail(hit) {
  const el = hit.el;
  const k = kindOf(el);
  let eyebrow = k.title;
  if (el.kind === "event" && el.temporalFlavor) eyebrow = `${el.temporalFlavor} temporal event`;
  if (el.kind === "interface") eyebrow = `Interface · ${el.role} ${el.role === "API" ? "— driving port" : "— driven port"}`;
  if (el.kind === "repository" && el.readOnly) eyebrow = "Repository · read-only";

  let html = sectionHeader(el, k, eyebrow, crumbsFor(hit));

  /* kind-specific chips */
  const extraChips = [];
  if (el.syncPattern) extraChips.push(`<span class="chip warn">synced via ${esc(el.syncPattern)}</span>`);
  if (el.duplicateDetection) extraChips.push(`<span class="chip">duplicate detection declared</span>`);
  if (extraChips.length) html += `<div class="chips">${extraChips.join("")}</div>`;

  html += structureCard(el, k);

  const rel = [];
  rel.push(["belongs to", refLink("mod:" + hit.mod.id)]);

  switch (el.kind) {
    case "aggregate":
      rel.push(["contains", refList(el.contains)]);
      rel.push(["derives", el.repository ? refLink(el.repository.ref) : ""]);
      rel.push(["constrained by", refList(el.invariants)]);
      break;
    case "entity":
      rel.push(["part of aggregate", el.partOf ? refLink(el.partOf.ref) : ""]);
      rel.push(["derives", el.repository ? refLink(el.repository.ref) : ""]);
      rel.push(["constrained by", refList(el.invariants)]);
      if (el.duplicateDetection) rel.push(["duplicate detection", `<code class="inline">${esc(el.duplicateDetection)}</code>`]);
      break;
    case "readonly-entity":
      rel.push(["sourced from", `<span class="rel-plain">${esc(el.sourcedFrom)}</span>`]);
      rel.push(["synced via", `<code class="inline">${esc(el.syncPattern)}</code>`]);
      rel.push(["projected by", el.projectedBy ? refLink(el.projectedBy.ref) : ""]);
      rel.push(["derives", el.repository ? refLink(el.repository.ref) : ""]);
      break;
    case "value":
      rel.push(["composes", refList(el.composes)]);
      rel.push(["embedded in", refList(el.embeddedIn)]);
      break;
    case "enum":
      rel.push(["references", el.referencesValueType ? `<span class="rel-plain">${esc(el.referencesValueType)}</span>` : ""]);
      rel.push(["holds", (el.values || []).map(v => `<code class="inline">${esc(v)}</code>`).join(" ")]);
      break;
    case "command":
      rel.push(["targets", el.targets ? refLink(el.targets.ref) : ""]);
      rel.push(["triggers", `<span class="rel-plain">operation “${esc(el.triggers)}”</span>`]);
      rel.push(["produces", refList(el.produces)]);
      break;
    case "query":
      rel.push(["reads from", el.readsFrom ? refLink(el.readsFrom.ref) : ""]);
      rel.push(["style", `<code class="inline">${esc(el.queryStyle)}</code> <span class="rel-note">· safe, idempotent</span>`]);
      rel.push(["carries", el.carries ? `<code class="inline">${esc(el.carries)}</code>` : ""]);
      rel.push(["returns", el.returns ? `<code class="inline">${esc(el.returns)}</code>` : ""]);
      break;
    case "event": {
      if (el.about) rel.push(["about", refLink(el.about.ref)]);
      if (el.raisedBy) rel.push(["raised by", `${refLink(el.raisedBy.ref)} <span class="rel-note">· operation “${esc(el.raisedBy.operation)}”</span>`]);
      if (el.sourcedFrom) rel.push(["sourced from", `<span class="rel-plain">${esc(el.sourcedFrom)}</span>`]);
      if (el.reference) rel.push(["references", refLink(el.reference.ref)]);
      if (el.instant) rel.push(["instant", `<code class="inline">${esc(el.instant)}</code>`]);
      if (el.offset) rel.push(["offset by", `<code class="inline">${esc(el.offset)}</code>`]);
      if (el.schedule) rel.push(["schedule", `<code class="inline">${esc(el.schedule)}</code>`]);
      if (el.guard) rel.push(["guarded by", `<code class="inline">${esc(el.guard)}</code>`]);
      if (el.recomputation) rel.push(["recomputation", `<span class="rel-note">${esc(el.recomputation)}</span>`]);
      if (el.causedBy) rel.push(["caused by", refLink(el.causedBy.ref)]);
      const reactions = allElements().filter(x => x.kind === "reaction" && (x.triggeredBy || []).some(t => t.ref === el.id));
      rel.push(["triggers", reactions.map(r => refLink(r.id)).join(", ")]);
      break;
    }
    case "reaction":
      rel.push(["triggered by", refList(el.triggeredBy)]);
      rel.push(["guarded by", el.guard ? `<code class="inline">${esc(el.guard)}</code>` : `<span class="rel-note">none — fires on every occurrence</span>`]);
      rel.push(["effects", el.effects ? refLink(el.effects.ref) : ""]);
      break;
    case "domain-service":
      rel.push(["calls", refList(el.calls)]);
      rel.push(["targeted by", allElements().filter(x => x.kind === "command" && x.targets && x.targets.ref === el.id).map(x => refLink(x.id)).join(", ")]);
      break;
    case "application-service":
      rel.push(["delegates to", refList(el.delegatesTo)]);
      rel.push(["exposed by", el.exposedBy ? refLink(el.exposedBy.ref) : ""]);
      break;
    case "infrastructure-service":
      rel.push(["described by", el.describedBy ? refLink(el.describedBy.ref) : ""]);
      rel.push(["used by", refList(el.usedBy)]);
      break;
    case "repository":
      rel.push(["derived from", el.derivedFrom ? refLink(el.derivedFrom.ref) : ""]);
      rel.push(["provides", (el.operations || []).map(o => `<code class="inline">${esc(o)}</code>`).join(" ")]);
      rel.push(["described by", el.describedBy ? refLink(el.describedBy.ref) : ""]);
      rel.push(["read by", refList(el.readBy)]);
      break;
    case "interface":
      rel.push(["plays", `<code class="inline">${esc(el.role)}</code> <span class="rel-note">${el.role === "API" ? "· driving port — the domain is called" : "· driven port — the domain calls out"}</span>`]);
      rel.push(["exposes", (el.exposes || []).map(o => `<code class="inline">${esc(o)}</code>`).join(" ")]);
      rel.push(["exposes from", refList(el.exposesFrom)]);
      rel.push(["describes", el.describes ? refLink(el.describes.ref) : ""]);
      rel.push(["used by", refList(el.usedBy)]);
      break;
    case "invariant":
      rel.push(["scoped to", el.scopedTo ? `${refLink(el.scopedTo.ref)}${el.scopedState ? ` <span class="rel-note">· state <code class="inline">${esc(el.scopedState)}</code></span>` : ""}` : ""]);
      rel.push(["predicate", el.predicate ? `<code class="inline">${esc(el.predicate)}</code>` : ""]);
      rel.push(["enforcement", `<span class="enforcement ${esc(el.enforcement)}">${esc(el.enforcement)}</span>`]);
      break;
    case "agreement":
      rel.push(["arity", `<code class="inline">${esc(el.arity)}</code>`]);
      rel.push(["involves", refList(el.involves)]);
      rel.push(["predicate", `<code class="inline">${esc(el.predicate)}</code>`]);
      rel.push(["inconsistency window", el.inconsistencyWindow ? `<span class="rel-note">${esc(el.inconsistencyWindow)}</span>` : ""]);
      rel.push(["maintained by", el.maintainedBy ? refLink(el.maintainedBy.ref) : ""]);
      break;
    case "reconciliation":
      rel.push(["maintains", el.maintains ? refLink(el.maintains.ref) : ""]);
      rel.push(["trigger", `<span class="rel-plain">${esc(el.trigger)}</span>`]);
      rel.push(["detection", `<span class="rel-plain">${esc(el.detection)}</span>`]);
      rel.push(["coordination", el.coordination ? `<span class="rel-plain">${esc(el.coordination)}</span>` : ""]);
      rel.push(["issues", refList(el.compensation)]);
      break;
  }
  html += relationsCard(rel);
  html += stateMachineCards(el);

  if (el.kind === "reconciliation" && el.escalation) {
    html += `<p class="card-caption">Escalation chain</p><div class="card"><ul class="card-rows">` +
      el.escalation.map((s, i) => `<li><span class="row-title">${i + 1}. ${esc(s.action)}</span>${s.maxAttempts ? ` <code class="inline">max ${s.maxAttempts} attempts</code>` : ""}<br><span class="row-sub">when: ${esc(s.condition)}${s.note ? ` — ${esc(s.note)}` : ""}</span></li>`).join("") +
      `</ul></div>`;
  }
  return html;
}

function allElements() {
  const out = [];
  for (const mod of ctx().modules) out.push(...mod.elements);
  return out;
}

/* ================= Requirement detail ================= */

/* Highlight EARS keywords in a statement (escape first, then wrap) */
function earsHighlight(statement) {
  return esc(statement)
    .replace(/\b(While|When|Where|If|then)\b/g, `<span class="ears-kw">$1</span>`)
    .replace(/\bshall\b/g, `<span class="ears-shall">shall</span>`);
}

function prioChip(priority) {
  const cls = PRIORITY_CHIP[priority] ?? "";
  return `<span class="chip ${cls}">priority ${esc(priority || "—")}</span>`;
}

function coverageRows(reqId) {
  const hits = elementsSatisfying(reqId);
  if (!hits.length) return null;
  return hits.map(h => `<tr>
    <td>${refLink(h.el.id)}${h.via ? ` <span class="rel-note">· operation “${esc(h.via)}”</span>` : ""}</td>
    <td class="rel-note">${esc(h.org.name)}</td>
    <td><code class="inline">${esc(h.via ? "implemented-by" : roleOf(h.el))}</code></td>
  </tr>`).join("");
}

function renderReqDetail(hit) {
  const r = hit.req;
  const k = PATTERN_KINDS[r.pattern] || PATTERN_KINDS.ubiquitous;
  let html = `
    <nav class="breadcrumb"><span class="here">${esc(hit.set.file)}.sysreq</span><span class="sep"> › </span>
      <a href="#reqset:${esc(hit.set.id)}" data-goto="reqset:${esc(hit.set.id)}">${esc(hit.set.name)}</a>
      <span class="sep"> › </span><span class="here">${esc(r.id)}</span></nav>
    <p class="eyebrow">Requirement · ${esc(k.title)}</p>
    <div class="detail-title">${badge(k, true)}<h1>${esc(r.title)}</h1></div>
    <div class="chips">
      <span class="chip">${esc(r.id)}</span>
      ${prioChip(r.priority)}
      <span class="chip">pattern: ${esc(r.pattern)}</span>
    </div>
    <p class="card-caption">EARS statement</p>
    <div class="card"><p class="ears-statement">${earsHighlight(r.statement || "")}</p></div>`;

  const rel = [];
  if (r.rationale) rel.push(["rationale", `<span class="rel-plain">${esc(r.rationale)}</span>`]);
  rel.push(["scoped to", `<span class="rel-plain">${esc(hit.set.scopedTo)}</span> <span class="rel-note">· inherited from the set</span>`]);
  rel.push(["belongs to", `<a class="ref" href="#reqset:${esc(hit.set.id)}" data-goto="reqset:${esc(hit.set.id)}">${esc(hit.set.name)}</a>`]);
  if (r.source) rel.push(["sourced from", `<code class="inline">${esc(r.source)}</code>`]);
  if (r.dependsOn) rel.push(["depends on", r.dependsOn.map(reqLink).join(", ")]);
  if (r.conflictsWith) rel.push(["conflicts with", r.conflictsWith.map(reqLink).join(", ")]);
  if (r.decomposedInto) rel.push(["decomposed into", r.decomposedInto.map(reqLink).join(", ")]);
  html += relationsCard(rel);

  const rows = coverageRows(r.id);
  html += `<p class="card-caption">Satisfied by — traced from the domain models (role derived from element kind)</p>`;
  if (rows) {
    html += `<div class="card"><table class="sm-table">
      <tr><th>Domain element</th><th>Model</th><th>Satisfaction role</th></tr>${rows}</table></div>`;
  } else {
    html += `<div class="card"><ul class="card-rows"><li><span class="row-title">Unsatisfied.</span>
      <span class="row-sub">No element in any loaded domain model references ${esc(r.id)} — a modeling gap, or an obligation satisfied below the domain layer.</span></li></ul></div>`;
  }
  return html;
}

function renderReqSetDetail(hit) {
  const set = hit.set;
  const total = set.requirements.length;
  const satisfied = set.requirements.filter(r => elementsSatisfying(r.id).length > 0);
  const unsatisfied = set.requirements.filter(r => !elementsSatisfying(r.id).length);
  const byPrio = {};
  for (const r of set.requirements) byPrio[r.priority || "—"] = (byPrio[r.priority || "—"] || 0) + 1;
  let html = `
    <nav class="breadcrumb"><span class="here">${esc(set.file)}.sysreq</span><span class="sep"> › </span><span class="here">${esc(set.name)}</span></nav>
    <p class="eyebrow">Requirement set</p>
    <div class="detail-title"><h1>${esc(set.name)}</h1></div>
    <div class="chips">
      <span class="chip">scoped-to ${esc(set.scopedTo)}</span>
      <span class="chip">${total} requirements</span>
      ${Object.entries(byPrio).map(([p, n]) => `<span class="chip ${PRIORITY_CHIP[p] ?? ""}">${n} ${esc(p)}</span>`).join("")}
      ${set.prdSource ? `<span class="chip">prd-source: ${esc(set.prdSource)}</span>` : ""}
    </div>
    <p class="card-caption">Coverage — computed from the satisfies lists of every loaded domain model</p>
    <div class="card"><ul class="card-rows">
      <li><span class="row-title">${satisfied.length} / ${total} satisfied</span>
        <span class="row-sub">· ${unsatisfied.length} unsatisfied</span></li>
    </ul></div>`;
  if (unsatisfied.length) {
    html += `<p class="card-caption">Unsatisfied requirements</p><div class="card"><ul class="card-rows">` +
      unsatisfied.map(r => `<li>${reqLink(r.id)} <span class="row-sub">${esc(r.title)}</span> ${prioChip(r.priority)}</li>`).join("") +
      `</ul></div>`;
  }
  html += `<p class="card-caption">Patterns</p><div class="tile-grid">` + PATTERN_ORDER.map(p => {
    const reqs = set.requirements.filter(r => r.pattern === p);
    if (!reqs.length) return "";
    const k = PATTERN_KINDS[p];
    return `<div class="tile" style="cursor:default">
      <div class="tile-head">${badge(k)}<span class="tile-name">${esc(k.title)}</span></div>
      <div class="tile-desc">${reqs.length} requirement${reqs.length === 1 ? "" : "s"}</div>
    </div>`;
  }).join("") + `</div>`;
  return html;
}

/* ================= Render root ================= */

/* ---- Diagram engine islands (vendor/specy-diagram-engine.js). Every mount
   handle is kept here and disposed before the detail panel re-renders. ---- */
let diagramMounts = [];
function unmountDiagrams() {
  for (const h of diagramMounts) { try { h.unmount(); } catch (e) { console.warn("diagram unmount failed:", e); } }
  diagramMounts = [];
}
const hasDiagramEngine = () => typeof SpecyDiagramEngine !== "undefined" && SpecyDiagramEngine && typeof SpecyDiagramEngine.mount === "function";
function mountDiagram(host, file, opts) {
  if (!hasDiagramEngine()) {
    host.innerHTML = `<div class="diagram-missing">Diagram engine not loaded — build <code class="inline">diagram-engine</code> (<code class="inline">npm run build</code>) and copy the bundle to <code class="inline">ui/vendor/specy-diagram-engine.js</code>.</div>`;
    return null;
  }
  try {
    const handle = SpecyDiagramEngine.mount(host, file, opts);
    diagramMounts.push(handle);
    return handle;
  } catch (e) {
    console.error("diagram mount failed for " + file.model.id + ":", e);
    host.innerHTML = `<div class="diagram-missing">Could not render diagram <code class="inline">${esc(file.model.id)}</code>: ${esc(e && e.message ? e.message : e)}</div>`;
    return null;
  }
}

/* ---- Legend: the strip above the organization diagrams, the engine's panel
   under the class diagrams. The diagram bar's "legend" toggle hides it, in
   every diagram at once; the choice is kept per browser ---- */
const LEGEND_KEY = "specy-navigator:legend-hidden";
let legendHidden = (() => { try { return localStorage.getItem(LEGEND_KEY) === "1"; } catch (e) { return false; } })();
document.body.classList.toggle("legend-hidden", legendHidden);
function legendToggleHtml() {
  return `<label class="diag-opt diag-opt-legend" title="Show or hide the legend"><input type="checkbox" data-legendopt="1"${legendHidden ? "" : " checked"}/>legend</label>`;
}

/* Diagram view fills the main panel with an engine-rendered class diagram:
   one module, every concept of the context, or the organization's concepts
   grouped by system (state.diagramScope) */
function renderDiagramView(target) {
  if (state.diagramScope === "org") { renderOrgConceptsView(target); return; }
  if (state.diagramScope === "context") { renderContextConceptsView(target); return; }
  const c = ctx();
  const mod = c.modules.find(m => m.id === state.diagramModId) || c.modules[0];
  if (!mod) {
    target.innerHTML = `<div class="empty-state"><span class="brackets">[ ]</span>This context has no modules to diagram.</div>`;
    return;
  }
  state.diagramModId = mod.id;
  const show = state.diagramShow;
  const opts = [["interfaces", "interfaces"], ["entities", "entities / aggregates"], ["values", "values"], ["services", "services"]];
  target.innerHTML = `<div class="diagram-wrap">
    <div class="diagram-bar">
      ${badge(KINDS.module)}<span class="diagram-title">${esc(mod.name)}</span>
      <span class="spacer"></span>
      <div class="diagram-opts">${opts.map(([key, label]) =>
        `<label class="diag-opt"><input type="checkbox" data-diagopt="${key}"${show[key] ? " checked" : ""}/>${esc(label)}</label>`).join("")}
        ${legendToggleHtml()}
      </div>
      <button class="diagram-open" data-goto="mod:${esc(mod.id)}">open module detail ↗</button>
    </div>
    <div id="flow" class="flow-host"></div>
  </div>`;
  const file = SpecyDomainDiagrams.moduleClassDiagram(mod, c, show, org().id);
  mountDiagram(document.getElementById("flow"), file, {
    storagePrefix: file.model.id,
    interactive: true,
    wheel: "pan",
    fitView: true,
    logo: false,
    onNavigate: ref => { if (ref && ref.elementId) goto(ref.elementId); },
  });
}

/* The context at once: every module's entities and aggregates (the other
   categories by toggle) on one class diagram — SpecyDomainDiagrams.contextClassDiagram */
function renderContextConceptsView(target) {
  const c = ctx();
  const D = SpecyDomainDiagrams;
  if (!state.conceptShow) state.conceptShow = Object.assign({}, D.CONCEPTS_SHOW);
  const show = state.conceptShow;
  const shown = D.countVisibleIn(c.modules, show);
  const opts = [["interfaces", "interfaces"], ["entities", "entities / aggregates"], ["values", "values"], ["services", "services"]];
  target.innerHTML = `<div class="diagram-wrap">
    <div class="diagram-bar">
      ${badge(CTX_BADGE)}<span class="diagram-title">${esc(c.name)} — concepts</span>
      <span class="spacer"></span>
      <div class="diagram-opts">${opts.map(([key, label]) =>
        `<label class="diag-opt"><input type="checkbox" data-conceptopt="${key}"${show[key] ? " checked" : ""}/>${esc(label)}</label>`).join("")}
        ${legendToggleHtml()}
      </div>
      <button class="diagram-open" data-goto="ctx:${esc(c.id)}">open context map ↗</button>
    </div>
    <div id="flow" class="flow-host"></div>
  </div>`;
  if (!shown) {
    document.getElementById("flow").innerHTML = `<div class="empty-state"><span class="brackets">[ ]</span>Nothing to draw with these toggles — this context has no element of the categories checked.</div>`;
    return;
  }
  const file = D.contextClassDiagram(c, show, org().id);
  mountDiagram(document.getElementById("flow"), file, {
    storagePrefix: file.model.id,
    interactive: true,
    wheel: "pan",
    fitView: true,
    logo: false,
    onNavigate: ref => { if (ref && ref.elementId) goto(ref.elementId); },
  });
}

/* The organization: every concept a system masters or handles, as cards
   inside the system's group, the systems grouped by area, the level-0
   dependencies between them — SpecyArchDiagrams.conceptLandscapeDiagram on
   the organization .arch whose domain-source is this model (conceptArchFor),
   the concept names resolved as the Architecture diagram resolves them
   (archResolution). Double-click a card (or its ⋯ menu) to open the domain
   element; the browser's Back button returns here. */
function renderOrgConceptsView(target) {
  const o = org();
  const a = conceptArchFor(o);
  const D = SpecyArchDiagrams;
  if (!a || typeof D.conceptLandscapeDiagram !== "function") {
    target.innerHTML = `<div class="empty-state"><span class="brackets">[ ]</span>No level-0 architecture is loaded for this organization — an <code class="inline">organization</code> <code class="inline">.arch</code> whose <code class="inline">domain-source</code> is <code class="inline">${esc(o.id)}.domain</code>, listed in <code class="inline">ARCH_FILES</code> (top of app.js) — so its concepts cannot be grouped by system.</div>`;
    return;
  }
  const res = archResolution(a);
  const show = Object.assign({}, D.CONCEPT_LANDSCAPE_DEFAULT_SHOW, state.conceptLandShow);
  const report = {};
  let file = null;
  try {
    file = D.conceptLandscapeDiagram(a, show, { resolution: res.summary, domainOrgs: res.orgs, report });
    if (!file || !file.model || !file.diagram) throw new Error("no DiagramFile returned");
  } catch (e) {
    console.error("concept landscape conversion failed for " + a.id + ".arch:", e);
    target.innerHTML = `<div class="diagram-missing">Could not build the concept diagram of <code class="inline">${esc(a.id)}.arch</code>: ${esc(e && e.message ? e.message : e)}</div>`;
    return;
  }
  const opts = [["externalSystems", "external systems"], ["handled", "handled concepts"], ["edgeLabels", "edge labels"], ["flows", "flows"], ["unplaced", "unplaced concepts"]];
  const legend = kindLegendHtml(file, D.KIND_LEGEND) + landscapeLegendHtml(D.CONCEPT_LANDSCAPE_LEGEND);
  target.innerHTML = `<div class="diagram-wrap">
    <div class="diagram-bar arch-bar">
      ${badge(ORG_BADGE)}<span class="diagram-title">Domain concepts by system</span>
      <span class="spacer"></span>
      <div class="diagram-opts">${opts.map(([key, label]) =>
        `<label class="diag-opt"><input type="checkbox" data-conceptlandopt="${key}"${show[key] ? " checked" : ""}/>${esc(label)}</label>`).join("")}
        ${legendToggleHtml()}
      </div>
      <a class="diagram-open" href="#arch:${esc(a.id)}" title="The same organization as a system landscape, in the Architecture diagram">open landscape ↗</a>
    </div>
    <div class="land-legend">
      <span class="land-legend-text"><b>A system holds the concepts it masters</b> (solid cards: its source of truth) <b>and handles</b> (dashed: owned by another system). <b>An arrow means “depends on”</b>: A <span class="sm-arrow">→</span> B reads “A depends on B”. Fold the systems (Groups 1) to get the landscape back.</span>
      ${legend ? `<span class="land-legend-items">${legend}</span>` : ""}
    </div>
    <div id="flow" class="flow-host"></div>
  </div>`;
  mountDiagram(document.getElementById("flow"), file, {
    storagePrefix: D.conceptLandscapeModelIdOf(a),
    interactive: true,
    wheel: "pan",
    fitView: true,
    logo: false,
    onNavigate: (ref, node) => {
      const d = node && node.data && node.data.domainRef;
      if (d && INDEX[d.id]) goto(d.id);
    },
  });
}

/* Architecture view: the .arch system as a nested, foldable C4 diagram —
   the engine's group levels are the C4 zoom (system folded = context,
   containers folded = containers, all open = components). Double-click (or
   the card's "Open module" action) jumps to the realized domain module or
   context in the Domain Navigator. */
function renderArchView(target) {
  const a = curArch();
  if (!a) {
    target.innerHTML = `<div class="empty-state"><span class="brackets">[ ]</span>No .arch file loaded — list one in <code class="inline">ARCH_FILES</code> (top of app.js).</div>`;
    return;
  }
  state.archId = a.id;
  if (archModeOf(a) === "landscape" && renderLandscapeView(target, a)) return;
  const show = state.archShow;
  const opts = [["persons", "persons"], ["externalSystems", "external systems"], ["channels", "channels"], ["edgeLabels", "edge labels"]];
  target.innerHTML = `<div class="diagram-wrap">
    <div class="diagram-bar arch-bar">
      ${badge(ARCH_BADGE)}<span class="diagram-title">${esc(archTitle(a))}</span>
      <span class="spacer"></span>
      ${archModeSwitch(a, "c4")}
      <div class="diagram-opts">${opts.map(([key, label]) =>
        `<label class="diag-opt"><input type="checkbox" data-archopt="${key}"${show[key] ? " checked" : ""}/>${esc(label)}</label>`).join("")}
      </div>
    </div>
    ${archBodyHtml("c4")}
  </div>`;
  const file = SpecyArchDiagrams.architectureDiagram(a, show, { domainOrg: archDomainOrg(a) });
  archView = { arch: a, file, mount: null, mode: "c4" };
  archView.mount = mountDiagram(document.getElementById("flow"), file, {
    storagePrefix: file.model.id,
    interactive: true,
    wheel: "pan",
    fitView: true,
    logo: false,
    onNavigate: (ref, node) => {
      const d = node && node.data && node.data.domainRef;
      if (d && INDEX[d.id]) goto(d.id);
    },
    // a click in the canvas selects too: the details and the tree follow
    onSelect: ref => {
      const el = ref && archView && archView.file.model.elements.find(e => e.id === ref.elementId);
      const key = el ? `${el.type}:${el.data.name}` : null;
      /* the echo of the focus that unfolded a system (below): back to the system */
      const unfold = archView && archView.unfold;
      if (unfold && el && el.id === unfold.via) {
        archView.unfold = null;
        archView.mount.focus({ elementId: unfold.system });
        return;
      }
      if (key !== state.archSel) selectArchElement(key, { focus: false });
    },
  });
  // keep the selection across re-renders (toggles, tab switches)
  if (state.archSel) {
    if (archElementOf(state.archSel)) selectArchElement(state.archSel, { focus: true });
    else selectArchElement(null);
  }
  /* "Open C4 view" of a system detailed inline: a system group opens folded
     (level 1), and focusing a group does not unfold it — focusing its first
     container does (the engine opens the groups around a focused element);
     onSelect then hands the selection back to the system. */
  const unfold = state.archUnfold;
  state.archUnfold = null;
  if (unfold && unfold === state.archSel && archView.mount && archView.mount.focus) {
    const sys = a.systems.find(s => "system:" + s.name === unfold), sysEl = archElementOf(unfold);
    const member = sys && file.diagram.nodes.find(n => sysEl && n.parentId === "node-" + sysEl.id);
    if (member) {
      const pending = archView.unfold = { via: member.data.modelRef.elementId, system: sysEl.id };
      archView.mount.focus({ elementId: pending.via });
      setTimeout(() => { if (archView && archView.unfold === pending) archView.unfold = null; }, 2000);   // no echo came
    }
  }
}

/* The canvas and, beside it, the details of the selection: a drag handle
   (`data-archresize`) sets the panel's width, kept per kind of panel — the
   C4 details ("c4") and the wider level-0 sheet ("sheet"). */
const archBodyHtml = kind => `<div class="arch-body">
      <div id="flow" class="flow-host"></div>
      <div class="arch-resizer" data-archresize role="separator" aria-orientation="vertical" tabindex="0"
           title="Drag to resize the panel · double-click to reset" hidden></div>
      <aside id="arch-details" class="arch-details${kind === "sheet" ? " sheet" : ""}" data-panel="${kind}" hidden></aside>
    </div>`;
/* Landscape | C4 switch of the diagram bar — organization files only */
function archModeSwitch(a, mode) {
  if (!isOrgArch(a) || !hasLandscape(a)) return "";
  const btn = (m, label, title) =>
    `<button class="arch-mode-btn${m === mode ? " active" : ""}" data-archmode="${m}" title="${esc(title)}"${m === mode ? ` aria-pressed="true"` : ""}>${label}</button>`;
  return `<div class="arch-mode" role="group" aria-label="View">${
    btn("landscape", "Landscape", "Level 0 — the systems by area, what each one masters, and who depends on whom")}${
    btn("c4", "C4", "Levels 1–3 — the systems detailed inline with their containers and components, the others as black boxes")}</div>`;
}

/* How the landscape encodes its edges (SpecyArchDiagrams.LANDSCAPE_LEGEND),
   printed as line samples. The converter owns the encoding; this reads a
   list or a keyed map of { label, stroke | color, strokeDasharray | dash,
   strokeWidth | width, description } tolerantly. */
function landscapeLegendHtml(legend) {
  legend = legend || SpecyArchDiagrams.LANDSCAPE_LEGEND;
  if (!legend || typeof legend !== "object") return "";
  const items = Array.isArray(legend) ? legend
    : Object.entries(legend).map(([key, v]) => (v && typeof v === "object" ? Object.assign({ key }, v) : { key, label: String(v) }));
  return items.filter(it => it && typeof it === "object").map(it => {
    const st = Object.assign({}, it, it.style && typeof it.style === "object" ? it.style : {});
    const stroke = st.stroke || st.color || "#F65D60";
    const dash = st.strokeDasharray || st.dash || (st.dashed ? "6 4" : "");
    const width = Math.min(Number(st.strokeWidth || st.width) || 1.8, 6);
    const label = it.label || it.title || it.key || "";
    const tip = it.description || it.meaning || "";
    return `<span class="land-legend-item"${tip ? ` title="${esc(tip)}"` : ""}><svg width="28" height="8" viewBox="0 0 28 8" aria-hidden="true"><line x1="1" y1="4" x2="27" y2="4" stroke="${esc(stroke)}" stroke-width="${width}"${dash ? ` stroke-dasharray="${esc(dash)}"` : ""}/></svg>${esc(label)}</span>`;
  }).join("");
}

/* The kinds of card and group a level-0 diagram draws, said once in the
   legend strip, as arch-landscape.css shows no eyebrow on them. `legend`
   maps a node kind to { label, color, border, dashed }; a concept card is
   said by its domain kind, the colour of its left bar (KINDS), in the order
   of the tree's GROUPS, the kinds of one colour in one item; a name with no
   domain element by its grey card. */
function kindLegendHtml(file, legend) {
  const data = new Map(file.model.elements.map(e => [e.id, e.data || {}]));
  const kinds = [], domainKinds = new Set();   // node kinds in drawing order; domain kinds of the concept cards
  let notes = false;
  for (const node of file.diagram.nodes) {
    const d = node.data || {}, el = data.get(d.modelRef && d.modelRef.elementId) || {};
    if (d.kind === "concept" && KINDS[el.domainKind]) domainKinds.add(el.domainKind);
    else if (d.kind === "concept-note") notes = true;
    else if (legend[d.kind] && !kinds.includes(d.kind)) kinds.push(d.kind);
  }
  const bars = new Map();   // bar colour → domain kind titles
  for (const k of GROUPS.flatMap(([, ks]) => ks).filter(k => domainKinds.has(k)))
    bars.set(KINDS[k].color, (bars.get(KINDS[k].color) || []).concat(KINDS[k].title));
  const item = (swatch, label) => `<span class="land-legend-item">${swatch}${esc(label)}</span>`;
  return kinds.map(k => item(`<span class="arch-swatch${legend[k].dashed ? " dashed" : ""}" style="background:${esc(legend[k].color)};border-color:${esc(legend[k].border)}"></span>`, legend[k].label.toLowerCase())).join("")
    + [...bars].map(([color, titles]) => item(`<span class="arch-swatch concept-swatch" style="--bar:${esc(color)}"></span>`, titles.join(" / ").toLowerCase())).join("")
    + (notes ? item(`<span class="arch-swatch concept-swatch note"></span>`, "not in the domain model") : "");
}

/* Organization view (level 0): the landscape — systems grouped by area with
   their main concepts, one "depends on" edge per dependency labelled with its
   numbered flows — drawn by SpecyArchDiagrams.landscapeDiagram, and the sheet
   of the selection beside it. Returns false when the converter fails: the
   caller then shows the C4 view. */
function renderLandscapeView(target, a) {
  const D = SpecyArchDiagrams;
  const res = archResolution(a);
  const show = Object.assign({ externalSystems: true, persons: true, edgeLabels: true, concepts: true },
    D.LANDSCAPE_DEFAULT_SHOW || {}, state.landShow);
  let file = null;
  try {
    file = D.landscapeDiagram(a, show, { resolution: res.orgs.length ? res.summary : null });
    if (!file || !file.model || !file.diagram) throw new Error("no DiagramFile returned");
  } catch (e) {
    console.error("landscape conversion failed for " + a.id + ".arch — showing the C4 view:", e);
    landscapeFailed.add(a.id);
    renderTree();
    return false;
  }
  const opts = [["externalSystems", "external systems"], ["persons", "persons"], ["edgeLabels", "edge labels"], ["concepts", "concepts"]];
  /* the concepts a system masters are its card's first row, set bold, with no key */
  const mastered = show.concepts && a.systems.concat(show.externalSystems ? a.externalSystems : []).some(s => s.masters.length)
    ? `<span class="land-legend-item"><b>Bold</b>&nbsp;concepts: the system is their source of truth (masters)</span>` : "";
  const legend = kindLegendHtml(file, D.LANDSCAPE_KIND_LEGEND) + mastered + landscapeLegendHtml();
  target.innerHTML = `<div class="diagram-wrap">
    <div class="diagram-bar arch-bar">
      ${badge(ORG_BADGE)}<span class="diagram-title">${esc(a.name)}</span>
      <span class="spacer"></span>
      ${archModeSwitch(a, "landscape")}
      <div class="diagram-opts">${opts.map(([key, label]) =>
        `<label class="diag-opt"><input type="checkbox" data-landopt="${key}"${show[key] ? " checked" : ""}/>${esc(label)}</label>`).join("")}
        ${legendToggleHtml()}
      </div>
    </div>
    <div class="land-legend">
      <span class="land-legend-text"><b>An arrow means “depends on”</b>, not “sends data to”: A <span class="sm-arrow">→</span> B reads “A depends on B”, so changing B may affect A. Data may travel either way — each numbered flow states its own direction.</span>
      ${legend ? `<span class="land-legend-items">${legend}</span>` : ""}
    </div>
    ${archBodyHtml("sheet")}
  </div>`;
  const host = document.getElementById("flow");
  archView = { arch: a, file, mount: null, mode: "landscape" };
  archView.mount = mountDiagram(host, file, {
    storagePrefix: typeof D.landscapeModelIdOf === "function" ? D.landscapeModelIdOf(a) : file.model.id,
    interactive: true,
    wheel: "pan",
    fitView: true,
    logo: false,
    // double-click a system: the first bounded context it realizes
    onNavigate: (ref, node) => {
      const d = node && node.data && node.data.domainRef;
      if (d && INDEX[d.id]) goto(d.id);
    },
    // a click on a card selects it: the sheet and the tree follow
    onSelect: ref => {
      if (!archView || archView.file !== file) return;
      const el = ref && file.model.elements.find(e => e.id === ref.elementId);
      const key = el ? archKeyOf(el) : null;
      if (key === state.archSel) return;
      /* cards deselect when an edge or a tree row takes over: a selection
         that is no card (a dependency, a hidden kind) stays; the canvas
         background closes it (below) */
      if (!key && state.archSel && !archElementOf(state.archSel)) return;
      selectArchElement(key, { focus: false });
    },
  });
  /* the engine reports card selections only: an edge click selects its
     dependency, a click on the empty canvas closes a sheet that is no card's.
     Listened to on the way down (capture): the engine keeps canvas clicks
     from bubbling. */
  host.addEventListener("click", e => {
    if (!archView || archView.file !== file || !e.target || !e.target.closest) return;
    const g = e.target.closest(".react-flow__edge[data-id]");
    if (g) {
      const edge = file.diagram.edges.find(x => x.id === g.getAttribute("data-id"));
      const dep = edge && landscapeDependencyOf(a, edge);
      if (dep) selectArchElement("dependency:" + dep.id, { focus: false });
    } else if (e.target.classList && e.target.classList.contains("react-flow__pane")) {
      if (state.archSel && !archElementOf(state.archSel)) selectArchElement(null);
    }
  }, true);
  // keep the selection across re-renders (toggles, mode and tab switches, Back)
  if (state.archSel) selectArchElement(orgItemOf(a, state.archSel) ? state.archSel : null, { focus: true });
  return true;
}
/* the dependency an edge of the landscape stands for (relation id = dependency id) */
function landscapeDependencyOf(a, edge) {
  const d = edge.data || {};
  const ids = (d.relationIds || []).concat(d.modelRef && d.modelRef.relationId ? [d.modelRef.relationId] : []);
  return a.dependencies.find(x => ids.includes(x.id)) || null;
}
/* Marks the edge of the selected dependency. The engine owns the edge
   elements, so this is a stylesheet rule keyed by the edge id, never a class
   on its DOM. */
function markArchEdge(key) {
  let style = document.getElementById("arch-edge-mark");
  const depId = key && key.startsWith("dependency:") && archView && archView.mode === "landscape" ? key.slice("dependency:".length) : null;
  const edge = depId && archView.file.diagram.edges.find(e => { const d = landscapeDependencyOf(archView.arch, e); return d && d.id === depId; });
  if (!edge) { if (style) style.remove(); return; }
  if (!style) { style = document.createElement("style"); style.id = "arch-edge-mark"; document.head.appendChild(style); }
  const sel = `.flow-host .react-flow__edge[data-id="${String(edge.id).replace(/["\\]/g, "\\$&")}"]`;
  style.textContent = `${sel} path:not(.react-flow__edge-interaction) { stroke-width: 3.6px !important; }
${sel} { filter: drop-shadow(0 0 3px rgba(246, 94, 94, 0.7)); }`;
}

/* ---- Architecture selection: tree row / canvas click → details panel ---- */
let archView = null;   // { arch, file, mount, mode: "c4" | "landscape" } of the mounted architecture diagram

const ARCH_KIND_TITLE = {
  system: "System", container: "Container", component: "Component",
  person: "Person", externalSystem: "External system", channel: "Channel",
};
function archElementOf(key) {
  if (!key || !archView) return null;
  const i = key.indexOf(":");
  const kind = key.slice(0, i), name = key.slice(i + 1);
  return archView.file.model.elements.find(e => e.type === kind && e.data.name === name) || null;
}
const archKeyOf = el => `${el.type}:${el.data.name}`;

/* Select an element (by "kind:name", or null to clear): tree highlight,
   details panel, and — from the tree or the panel — frame it in the canvas. */
function selectArchElement(key, { focus } = {}) {
  state.archSel = key;
  const landscape = !!archView && archView.mode === "landscape";
  if (landscape) {
    /* the organization tree unfolds the selection (a system's concepts, a
       dependency's flows): re-render it, keeping the keyboard focus on its row */
    const active = document.activeElement && document.activeElement.closest ? document.activeElement.closest("#tree [data-archsel]") : null;
    const activeKey = active && active.dataset.archsel;
    renderTree();
    if (activeKey) for (const b of document.querySelectorAll("#tree [data-archsel]")) if (b.dataset.archsel === activeKey) { b.focus({ preventScroll: true }); break; }
  }
  let row = null;
  for (const b of document.querySelectorAll("#tree [data-archsel]")) {
    const on = b.dataset.archsel === key;
    b.classList.toggle("selected", on);
    if (on) row = b;
  }
  if (row && !focus) row.scrollIntoView({ block: "nearest" });
  const el = archElementOf(key);
  if (landscape) renderOrgSheet(key);
  else renderArchDetails(el);
  if (focus && el && archView && archView.mount && archView.mount.focus) archView.mount.focus({ elementId: el.id });
  markArchEdge(key);
  syncArchHash();
}

/* ---- Deep link of the architecture view: `#arch:<stem>` — plus `/c4` for
   the C4 view of an organization file, plus `/<kind>:<name>` for the
   selection (`#arch:retail-media/system:ERP`). Kept current with
   replaceState, so that Back returns to this exact place after a concept
   link was followed into the Domain Navigator. ---- */
function archHash() {
  const a = curArch();
  if (!a) return "#arch:";
  return "#arch:" + a.id + (isOrgArch(a) && archModeOf(a) === "c4" ? "/c4" : "") + (state.archSel ? "/" + state.archSel : "");
}
function syncArchHash() {
  if (state.view === "arch" && curArch()) history.replaceState(null, "", archHash());
}
/* what the "back to …" link of the Domain Navigator names */
function archReturn() {
  const a = curArch();
  if (!a) return null;
  const sel = orgItemOf(a, state.archSel);
  const name = sel ? (sel.kind === "dependency" ? dependsOn(sel.item) : sel.name) : state.archSel ? state.archSel.slice(state.archSel.indexOf(":") + 1) : "";
  return { hash: archHash(), label: (name ? name + " · " : "") + archTitle(a) + " — architecture" };
}

/* ---- Details panel: show / hide, and its width (drag handle) ---- */
const ARCH_PANEL_KEY = "specy-navigator:arch-panel-width";
const archPanelWidth = (() => {
  try { return Object.assign({}, JSON.parse(localStorage.getItem(ARCH_PANEL_KEY) || "{}")); } catch (e) { return {}; }
})();
function applyArchPanelWidth(aside) {
  const w = Number(archPanelWidth[aside.dataset.panel]);
  aside.style.flexBasis = aside.style.width = w > 0 ? w + "px" : "";
}
function setArchPanelWidth(aside, width, keep = true) {
  if (width > 0) archPanelWidth[aside.dataset.panel] = Math.round(width); else delete archPanelWidth[aside.dataset.panel];
  applyArchPanelWidth(aside);
  if (!keep) return;   // mid-drag
  try { localStorage.setItem(ARCH_PANEL_KEY, JSON.stringify(archPanelWidth)); } catch (e) { /* private mode: the width lasts the session */ }
}
function showArchPanel(aside, html) {
  const bar = aside.previousElementSibling;
  if (html == null) { aside.hidden = true; aside.innerHTML = ""; }
  else { aside.innerHTML = html; applyArchPanelWidth(aside); aside.hidden = false; aside.scrollTop = 0; }
  if (bar && bar.hasAttribute("data-archresize")) bar.hidden = aside.hidden;
}

/* ================= Level-0 sheets (organization files) =================
   What the organization file says of the selection, read from the parsed
   shape (arch-parser.js): a system, an external system, a dependency, a
   person or an area. Every concept name goes through conceptHtml. */
/* the head stays in view while the sheet scrolls, and then names the selection */
const sheetHead = (eyebrow, name) => `<div class="arch-details-head">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <span class="sheet-head-name" aria-hidden="true">${esc(name)}</span>
    <button class="arch-details-close" data-archclose title="Close">×</button>
  </div>`;
const safeUrl = url => (/^https?:\/\//i.test(String(url || "")) ? String(url) : "");

function mechanismHtml(m) {
  if (!m || (m.over == null && m.mode == null))
    return `<span class="mech-open" title="No mechanism stated: how this flow is carried is not decided yet">undecided</span>`;
  const mode = m.mode ? `<span class="mech-mode ${esc(m.mode)}" title="${m.mode === "manual" ? "A person performs the transfer" : "No person performs the transfer"}">${esc(m.mode)}</span>` : "";
  return m.over ? `<span class="mech-over">${esc(m.over)}</span>${mode ? ` <span class="mech-tail"><span class="mech-sep">·</span> ${mode}</span>` : ""}` : mode;
}

/* The flow table of a sheet: number, label, the concepts carried (`X as Y`:
   X in the sender's model becomes Y in the receiver's), then the mechanism —
   one column per phase when the organization declares phases, a mechanism
   stated once spanning them all, an open phase reading "undecided".
   `groups` = [{ head: html | "", flows }]; `opts.direction` adds the
   sender → receiver column, `opts.hotspots` (flow number → names) the marks. */
function flowTableHtml(a, groups, opts = {}) {
  const phases = a.phases || [];
  const ncols = 3 + (opts.direction ? 1 : 0) + Math.max(1, phases.length);
  const row = f => {
    const carried = f.carries.map(c =>
      `<div class="fl-carried">${conceptHtml(a, c.concept)}${c.as
        ? ` <span class="fl-as" title="${esc(`${c.concept.raw} in ${f.sender}'s model becomes ${c.as.raw} in ${f.receiver}'s`)}">as</span> ${conceptHtml(a, c.as)}` : ""}</div>`).join("");
    let mech;
    if (f.perPhase.length && phases.length)
      mech = phases.map(p => `<td class="fl-mech" data-label="${esc(p.name)}">${mechanismHtml(flowMechanism(f, p.name))}</td>`).join("");
    else if (f.perPhase.length)   // phases the organization does not declare
      mech = `<td class="fl-mech" data-label="Mechanism">${f.perPhase.map(p => `<div><span class="rel-note">${esc(p.phase)}:</span> ${mechanismHtml(p)}</div>`).join("")}</td>`;
    else
      mech = `<td class="fl-mech${phases.length > 1 ? " fl-every" : ""}" colspan="${Math.max(1, phases.length)}" data-label="${phases.length ? "Every phase" : "Mechanism"}"${
        phases.length && f.mechanism ? ` title="Stated once: the same in every phase"` : ""}>${mechanismHtml(f.mechanism)}</td>`;
    const hot = ((opts.hotspots && opts.hotspots.get(f.number)) || [])
      .map(h => `<span class="hot-mark" title="Concerned by hotspot ${esc(h)}">${esc(h)}</span>`).join("");
    return `<tr data-flow="${esc(f.number)}">
      <td class="fl-n"><span class="flow-num" title="flow ${esc(f.number)}">${esc(f.number)}</span></td>
      <td class="fl-label">${esc(f.label)}${f.description ? `<div class="row-sub">${esc(f.description)}</div>` : ""}${hot ? `<div class="fl-hot">${hot}</div>` : ""}</td>
      ${opts.direction ? `<td class="fl-dir" data-label="Data goes">${orgLink(a, f.sender)} <span class="sm-arrow">→</span> ${orgLink(a, f.receiver)}</td>` : ""}
      <td class="fl-carries" data-label="Carries">${carried}</td>
      ${mech}
    </tr>`;
  };
  return `<table class="sm-table flow-table${opts.direction ? " with-direction" : ""}">
    <thead><tr><th class="fl-n">#</th><th class="fl-label">Flow</th>${opts.direction ? `<th class="fl-dir">Data goes</th>` : ""}<th class="fl-carries">Carries</th>${
      phases.length ? phases.map(p => `<th class="fl-mech"${p.description ? ` title="${esc(p.description)}"` : ""}>${esc(p.name)}</th>`).join("") : `<th class="fl-mech">Mechanism</th>`}</tr></thead>
    <tbody>${groups.map(g => (g.head ? `<tr class="flow-group"><td colspan="${ncols}">${g.head}</td></tr>` : "") + g.flows.map(row).join("")).join("")}</tbody>
  </table>`;
}

/* System (or external system) sheet */
function systemSheetHtml(a, sys, kind) {
  const ext = kind === "externalSystem";
  const of = v => v || [];
  let html = sheetHead(ext ? "External system · outside the organization" : "System", sys.name);
  html += `<h2 class="arch-details-title">${esc(sys.name)}</h2>`;
  if (sys.technology) html += `<p class="sheet-product" title="The product that implements this system"><span class="rel-note">product</span> ${esc(sys.technology)}</p>`;

  const chips = [];
  if (sys.status) chips.push(`<span class="chip ${/final|agreed|done|live/i.test(sys.status) ? "ok" : "warn"}" title="Status of the system's target definition">status: ${esc(sys.status)}</span>`);
  if (sys.area) chips.push(`<span class="chip">area ${orgLink(a, sys.area, a.areas.some(x => x.name === sys.area) ? "area" : null)}</span>`);
  if (!ext) chips.push(sys.detail === "inline" ? `<span class="chip info" title="Its containers and components are described in this file">detailed inline</span>`
    : sys.detail === "file" ? `<span class="chip info">detailed in ${esc(sys.detailedIn)}</span>`
    : `<span class="chip" title="Not detailed: everything known about it is at level 0">black box</span>`);
  html += `<div class="chips">${chips.join("")}</div>`;
  html += sys.description
    ? `<p class="arch-details-desc"><span class="sheet-label">Purpose</span>${esc(sys.description)}</p>`
    : `<p class="arch-details-desc sheet-missing">No purpose stated.</p>`;

  const actions = [];
  if (sys.detail === "inline")
    actions.push(`<button class="diagram-open" data-archmode="c4" data-sel="system:${esc(sys.name)}" title="Its containers and components, in the C4 view of this file">Open C4 view ↗</button>`);
  const detailFile = sys.detailedIn ? ARCHS.find(x => x.id === String(sys.detailedIn).split("/").pop().replace(/\.arch$/, "")) : null;
  if (detailFile) actions.push(`<button class="diagram-open" data-archfile="${esc(detailFile.id)}">Open ${esc(detailFile.id)}.arch ↗</button>`);
  const contexts = archContexts(a, sys.contexts);
  for (const c of contexts)
    if (c.ctx && INDEX["ctx:" + c.ctx.id]) actions.push(`<button class="diagram-open" data-goto="ctx:${esc(c.ctx.id)}">Open context “${esc(c.ctx.name)}” ↗</button>`);
  if (actions.length) html += `<div class="sheet-actions">${actions.join("")}</div>`;

  /* who uses it, contacts, documents, bounded contexts */
  const rows = [];
  if (!ext) rows.push(["used by", of(sys.usedBy).length ? sys.usedBy.map(p => orgLink(a, p, a.persons.some(x => x.name === p) ? "person" : null)).join(", ")
    : `<span class="rel-note">nobody stated</span>`]);
  if (of(sys.contacts).length) rows.push(["contacts", `<ul class="sheet-list">${sys.contacts.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`]);
  if (of(sys.documents).length) rows.push(["documents", `<ul class="sheet-list">${sys.documents.map(d => {
    const url = safeUrl(d.url);
    return `<li>${url ? `<a class="ref doc" href="${esc(url)}" target="_blank" rel="noopener">${esc(d.label || url)} ↗</a>`
      : `${esc(d.label)}${d.url && d.url !== d.label ? ` <code class="inline">${esc(d.url)}</code>` : ""}`}</li>`;
  }).join("")}</ul>`]);
  rows.push(["bounded contexts", contexts.length
    ? contexts.map(c => contextLink(c.name, c.ctx)).join(", ")
    : `<span class="rel-note">realizes none${ext ? "" : " — its concept names are looked up in the whole domain model"}</span>`]);
  for (const [k, v] of Object.entries(sys.meta || {}))
    if (!["status", "contacts", "documents"].includes(k)) rows.push([k, `<span class="rel-plain">${esc(v)}</span>`]);
  html += `<p class="card-caption">${ext ? "Bounded contexts" : "Users, contacts and documents"}</p><div class="card"><table class="rel-table">` +
    rows.map(([k, v]) => `<tr><td class="rel-name">${esc(k)}</td><td>${v}</td></tr>`).join("") + `</table></div>`;

  /* main entities: source of truth, then merely handled */
  const sourceLink = name => (orgKindOf(a, name) ? orgLink(a, name) : (c => contextLink(name, c.ctx))(archContexts(a, [name])[0]));
  const conceptLine = (ref, site) => {
    const x = conceptResolution(a, ref);
    let note = "";
    if (x.status === "resolved") {
      note = `${esc(x.kindLabel)} · ${contextLink(x.context, INDEX["ctx:" + x.contextId] && INDEX["ctx:" + x.contextId].ctx)}`;
      if (x.sourcedFrom) note += site === "handles"
        ? ` — a read-only copy sourced from ${sourceLink(x.sourcedFrom)}`
        : x.sourcedFrom === sys.name ? ` — the domain model holds it as a read-only copy sourced from this system`
        : ` — a read-only copy sourced from ${sourceLink(x.sourcedFrom)}`;
    }
    return `<li><span class="concept-mark ${site}">${site === "masters" ? "●" : "○"}</span><span>${conceptHtml(a, ref, { bare: x.status === "resolved", reason: true })}${note ? ` <span class="rel-note">${note}</span>` : ""}</span></li>`;
  };
  const masters = of(sys.masters), handles = of(sys.handles);
  html += `<p class="card-caption">Main entities</p><div class="card">`;
  if (masters.length) html += `<div class="sheet-sub" title="System of record: where an instance is created and where its truth lives"><span class="concept-mark masters">●</span>Source of truth for <span class="rel-note">· masters (${masters.length})</span></div>
    <ul class="concept-list">${masters.map(r => conceptLine(r, "masters")).join("")}</ul>`;
  if (handles.length) html += `<div class="sheet-sub" title="Other main concepts it holds: copies, projections, documents it receives and works on"><span class="concept-mark handles">○</span>Also handles <span class="rel-note">· not the source of truth (${handles.length})</span></div>
    <ul class="concept-list">${handles.map(r => conceptLine(r, "handles")).join("")}</ul>`;
  if (!masters.length && !handles.length) html += `<ul class="card-rows"><li><span class="row-sub">None stated — what it receives and sends is in its flows.</span></li></ul>`;
  html += `</div>`;

  /* hotspots */
  const hotspots = of(sys.hotspots);
  const hotOf = new Map();   // flow number → hotspot names
  for (const h of hotspots) for (const num of h.flows) { if (!hotOf.has(num)) hotOf.set(num, []); hotOf.get(num).push(h.name); }
  if (hotspots.length) {
    const flowChip = num => {
      const f = a.flows.find(x => x.number === num);
      return `<button class="flow-num jump" data-flowjump="${esc(num)}" title="${esc(f ? `flow ${num} — ${f.label} (${f.sender} → ${f.receiver}) · show it below` : `flow ${num} — not declared`)}">${esc(num)}</button>`;
    };
    html += `<p class="card-caption">Hotspots (${hotspots.length})</p><div class="card"><ul class="card-rows hotspots">` + hotspots.map(h =>
      `<li><span class="row-title">${esc(h.name)}</span>
        ${h.description ? `<div class="hot-desc">${esc(h.description)}</div>` : ""}
        ${h.flows.length || h.concepts.length ? `<div class="hot-concerns"><span class="rel-note">concerns</span> ${h.flows.length ? `<span class="rel-note">flows</span> ${h.flows.map(flowChip).join(" ")}` : ""}${
          h.concepts.length ? ` ${h.flows.length ? `<span class="rel-note">·</span> ` : ""}${h.concepts.map(r => conceptHtml(a, r)).join(", ")}` : ""}</div>` : ""}</li>`).join("") +
      `</ul></div>`;
  }

  /* flows by the direction of the data, grouped by peer system, each group
     naming the dependency it belongs to (the two directions are independent) */
  const depById = new Map(a.dependencies.map(d => [d.id, d]));
  const grouped = (flows, peerOf, word) => {
    const groups = [], peers = [];
    for (const f of flows) {
      const peer = peerOf(f), key = peer + "|" + f.dependency;
      let g = groups.find(x => x.key === key);
      if (!g) { groups.push(g = { key, peer, dep: depById.get(f.dependency), flows: [] }); if (!peers.includes(peer)) peers.push(peer); }
      g.flows.push(f);
    }
    groups.sort((x, y) => peers.indexOf(x.peer) - peers.indexOf(y.peer));
    for (const g of groups)
      g.head = `<span class="fl-peer"><span class="rel-note">${word}</span> ${orgLink(a, g.peer)}</span>`
        + (g.dep ? `<span class="fl-dep">${dependencyLink(g.dep)} ${patternChips(g.dep)}</span>` : "");
    return groups;
  };
  const inbound = a.flows.filter(f => f.receiver === sys.name), outbound = a.flows.filter(f => f.sender === sys.name);
  for (const [title, hint, flows, peerOf, word] of [
    ["Inbound flows", `data ${sys.name} receives`, inbound, f => f.sender, "from"],
    ["Outbound flows", `data ${sys.name} sends`, outbound, f => f.receiver, "to"]]) {
    html += `<p class="card-caption">${title} (${flows.length}) <span class="caption-hint">— ${esc(hint)}</span></p>`;
    html += flows.length
      ? `<div class="card flow-card">${flowTableHtml(a, grouped(flows, peerOf, word), { hotspots: hotOf })}</div>`
      : `<div class="card"><ul class="card-rows"><li><span class="row-sub">None.</span></li></ul></div>`;
  }

  /* dependencies: what it needs, and what a change to it may affect */
  const upstream = a.dependencies.filter(d => d.from === sys.name), downstream = a.dependencies.filter(d => d.to === sys.name);
  const depItem = (d, peer) => `<span class="dep-item">${orgLink(a, peer)}${d.criticality ? ` <span class="chip crit ${esc(d.criticality)}" title="${esc(`If ${d.to} is down, ${d.from} ${CRITICALITY_INFO[d.criticality] || d.criticality}`)}">${esc(d.criticality)}</span>` : ""}
      <button class="arch-link dep quiet" data-archsel="dependency:${esc(d.id)}" title="${esc(dependsOn(d))} — open the dependency">${d.flows.length} flow${d.flows.length === 1 ? "" : "s"}</button></span>`;
  if (upstream.length || downstream.length) {
    html += `<p class="card-caption">Dependencies</p><div class="card"><table class="rel-table">
      <tr><td class="rel-name">depends on</td><td>${upstream.map(d => depItem(d, d.to)).join("") || `<span class="rel-note">nothing</span>`}</td></tr>
      <tr><td class="rel-name" title="Read backwards: the systems a change to ${esc(sys.name)} may affect">depended on by</td><td>${downstream.map(d => depItem(d, d.from)).join("") || `<span class="rel-note">nothing</span>`}</td></tr>
    </table></div>`;
  }
  return html;
}

/* Dependency sheet: "A depends on B", its patterns, the pair it forms, its
   criticality, and its flows with the direction of each */
function dependencySheetHtml(a, d) {
  const back = reverseDependency(a, d), partners = isPartnership(a, d);
  let html = sheetHead("Dependency", dependsOn(d));
  html += `<h2 class="arch-details-title dep-title">${orgLink(a, d.from)} <span class="dep-verb">depends on</span> ${orgLink(a, d.to)}</h2>`;
  const chips = [patternChips(d)];
  if (partners) chips.push(`<span class="chip info">Partnership</span>`);
  else if (back) chips.push(`<span class="chip warn">mutual dependency</span>`);
  if (d.criticality) chips.push(`<span class="chip crit ${esc(d.criticality)}">criticality: ${esc(d.criticality)}</span>`);
  html += `<div class="chips">${chips.filter(Boolean).join("")}</div>`;
  if (d.description) html += `<p class="arch-details-desc">${esc(d.description)}</p>`;
  html += `<p class="sheet-reading">${esc(d.from)} is <b>downstream</b>, ${esc(d.to)} <b>upstream</b>: ${esc(d.from)} cannot do its job without what ${esc(d.to)} holds or does, so changing ${esc(d.to)} may affect ${esc(d.from)}. The arrow is the need, not the data: each flow below states where its data goes.</p>`;

  const side = s => d.patterns.filter(p => PATTERN_INFO[p] && PATTERN_INFO[p][0] === s);
  const explain = ps => ps.map(p => `<div class="pattern-line"><span class="pattern-tag">${esc(p)}</span> <span class="rel-note">${esc(PATTERN_INFO[p][1])}</span></div>`).join("");
  const ctxOf = name => {
    const s = a.systems.find(x => x.name === name) || a.externalSystems.find(x => x.name === name);
    const cs = s ? archContexts(a, s.contexts) : [];
    return cs.length ? ` <span class="rel-note">· realizes ${cs.map(c => contextLink(c.name, c.ctx)).join(", ")}</span>` : "";
  };
  const unknown = d.patterns.filter(p => !PATTERN_INFO[p]);
  const rows = [
    ["downstream", `${orgLink(a, d.from)}${ctxOf(d.from)}${explain(side("downstream"))}`],
    ["upstream", `${orgLink(a, d.to)}${ctxOf(d.to)}${explain(side("upstream"))}`],
  ];
  if (side("both").length) rows.push(["both sides", explain(side("both"))]);
  if (unknown.length) rows.push(["patterns", unknown.map(p => `<code class="inline">${esc(p)}</code>`).join(" ") + ` <span class="rel-note">unknown</span>`]);
  if (!d.patterns.length) rows.push(["patterns", `<span class="rel-note">none stated — nobody has decided who adapts to whom, or the two systems realize the same bounded context</span>`]);
  rows.push(["pair", partners
    ? `<b>Partnership</b> <span class="rel-note">— written on both dependencies; the opposite one:</span> ${dependencyLink(back)}`
    : back ? `<b>Mutual dependency</b> <span class="rel-note">— two independent relations, each with its own patterns and flows; the opposite one:</span> ${dependencyLink(back)}`
    : `<span class="rel-plain">one-way</span> <span class="rel-note">— ${esc(d.to)} does not depend on ${esc(d.from)}</span>`]);
  rows.push(["criticality", d.criticality
    ? `<span class="chip crit ${esc(d.criticality)}">${esc(d.criticality)}</span> <span class="rel-note">if ${esc(d.to)} is down, ${esc(d.from)} ${esc(CRITICALITY_INFO[d.criticality] || "— unknown level")}</span>`
    : `<span class="rel-note">unstated — nobody has said yet what ${esc(d.from)} suffers when ${esc(d.to)} is down</span>`]);
  for (const [k, v] of Object.entries(d.meta || {})) rows.push([k, `<span class="rel-plain">${esc(v)}</span>`]);
  html += `<p class="card-caption">Relation</p><div class="card"><table class="rel-table">` +
    rows.map(([k, v]) => `<tr><td class="rel-name">${esc(k)}</td><td>${v}</td></tr>`).join("") + `</table></div>`;

  html += `<p class="card-caption">Flows (${d.flows.length}) <span class="caption-hint">— numbered, with the direction of the data</span></p>`;
  html += d.flows.length
    ? `<div class="card flow-card">${flowTableHtml(a, [{ head: "", flows: d.flows }], { direction: true })}</div>`
    : `<div class="card"><ul class="card-rows"><li><span class="row-sub">No flow details this dependency yet.</span></li></ul></div>`;
  return html;
}

function personSheetHtml(a, p) {
  const uses = a.systems.filter(s => s.usedBy.includes(p.name));
  return sheetHead("Person", p.name) + `<h2 class="arch-details-title">${esc(p.name)}</h2>`
    + (p.description ? `<p class="arch-details-desc">${esc(p.description)}</p>` : "")
    + `<p class="card-caption">Uses (${uses.length})</p><div class="card"><ul class="card-rows">`
    + (uses.map(s => `<li>${orgLink(a, s.name, "system")}${s.technology ? ` <span class="rel-note">${esc(s.technology)}</span>` : ""}${s.description ? `<div class="row-sub">${esc(s.description)}</div>` : ""}</li>`).join("")
      || `<li><span class="row-sub">No system states this person in its used-by.</span></li>`)
    + `</ul></div>`;
}

function areaSheetHtml(a, area) {
  const members = a.systems.filter(s => s.area === area.name);
  return sheetHead("Area", area.name) + `<h2 class="arch-details-title">${esc(area.name)}</h2>`
    + (area.description ? `<p class="arch-details-desc">${esc(area.description)}</p>` : "")
    + `<p class="sheet-reading">An area groups systems as the organization chart does. It is neither the set of their users nor a bounded context.</p>`
    + `<p class="card-caption">Systems (${members.length})</p><div class="card"><ul class="card-rows">`
    + (members.map(s => `<li>${orgLink(a, s.name, "system")}${s.technology ? ` <span class="rel-note">${esc(s.technology)}</span>` : ""}${s.description ? `<div class="row-sub">${esc(s.description)}</div>` : ""}</li>`).join("")
      || `<li><span class="row-sub">No system sits in this area.</span></li>`)
    + `</ul></div>`;
}

function renderOrgSheet(key) {
  const aside = document.getElementById("arch-details");
  if (!aside) return;
  const a = archView && archView.arch, sel = orgItemOf(a, key);
  showArchPanel(aside, !sel ? null
    : sel.kind === "dependency" ? dependencySheetHtml(a, sel.item)
    : sel.kind === "person" ? personSheetHtml(a, sel.item)
    : sel.kind === "area" ? areaSheetHtml(a, sel.item)
    : systemSheetHtml(a, sel.item, sel.kind));
}
/* Shows a flow in the open sheet (a hotspot's "concerns", a flow row of the
   tree); a flow the sheet does not list opens its dependency first. */
function jumpToFlow(number) {
  const find = () => [...document.querySelectorAll("#arch-details tr[data-flow]")].find(r => r.dataset.flow === String(number));
  let row = find();
  if (!row && archView && archView.mode === "landscape") {
    const f = (archView.arch.flows || []).find(x => x.number === Number(number));
    if (f) { selectArchElement("dependency:" + f.dependency, { focus: false }); row = find(); }
  }
  if (!row) return;
  row.scrollIntoView({ block: "center" });
  row.classList.remove("flash");
  void row.offsetWidth;   // restart the animation
  row.classList.add("flash");
}

/* The element and everything drawn inside it (a system's containers and
   their components, a container's components / channels). */
function archDescendants(elementId) {
  const nodes = archView.file.diagram.nodes;
  const elOfNode = new Map(nodes.map(n => [n.id, n.data.modelRef.elementId]));
  const parentEl = new Map(nodes.filter(n => n.parentId).map(n => [elOfNode.get(n.id), elOfNode.get(n.parentId)]));
  const out = new Set([elementId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [child, parent] of parentEl) if (out.has(parent) && !out.has(child)) { out.add(child); grew = true; }
  }
  return out;
}

function renderArchDetails(el) {
  const aside = document.getElementById("arch-details");
  if (!aside) return;
  if (!el || !archView) { showArchPanel(aside, null); return; }
  const { file, arch } = archView;
  const d = el.data || {};
  const byId = new Map(file.model.elements.map(e => [e.id, e]));
  const node = file.diagram.nodes.find(n => n.data.modelRef.elementId === el.id);
  const parentOf = n => n && n.parentId && file.diagram.nodes.find(p => p.id === n.parentId);
  const link = e => `<button class="arch-link" data-archsel="${esc(archKeyOf(e))}">${archSwatch(e.type)}${esc(e.data.name)}</button>`;
  const list = v => (Array.isArray(v) ? v : v ? [v] : []).filter(Boolean);

  // where it lives: container → system, component → container › system
  const trail = [];
  for (let p = parentOf(node); p; p = parentOf(p)) trail.push(byId.get(p.data.modelRef.elementId));
  let html = `<div class="arch-details-head">
      <p class="eyebrow">${esc(ARCH_KIND_TITLE[el.type] || el.type)}</p>
      <button class="arch-details-close" data-archclose title="Close details">×</button>
    </div>
    <h2 class="arch-details-title">${esc(d.name)}</h2>`;
  const chips = [];
  if (trail.length) chips.push(`<span class="chip">in ${trail.map(link).join(" › ")}</span>`);
  if (d.technology) chips.push(`<span class="chip info">${esc(d.technology)}</span>`);
  if (d.boundedContext) chips.push(`<span class="chip">«${esc(d.boundedContext)}»</span>`);
  if (d.broker) chips.push(`<span class="chip">on ${esc(d.broker)}</span>`);
  if (chips.length) html += `<div class="chips">${chips.join("")}</div>`;
  const desc = d.description || (el.type === "person" || el.type === "externalSystem" ? d.subtitle : "");
  if (desc) html += `<p class="arch-details-desc">${esc(desc)}</p>`;
  const domainRef = node && node.data.domainRef;
  if (domainRef && INDEX[domainRef.id]) {
    const action = (node.data.actions || [])[0];
    html += `<button class="diagram-open arch-details-open" data-goto="${esc(domainRef.id)}">${esc(action ? action.label : "Open in the domain")} ↗</button>`;
  }
  // a system of an organization file: its level-0 sheet is in the landscape
  if (el.type === "system" && orgItemOf(arch, archKeyOf(el)) && hasLandscape(arch))
    html += `<button class="diagram-open arch-details-open" data-archmode="landscape" data-sel="${esc(archKeyOf(el))}" title="Purpose, main entities, hotspots and flows — in the landscape view">Open system sheet ↗</button>`;

  // contracts
  const bodyRows = (node && node.data.body && node.data.body.rows) || [];
  const rel = [];
  for (const [key, label] of [["provides", "provides"], ["requires", "requires"], ["consumes", "consumes"]]) {
    const v = list(d[key]).length ? list(d[key]) : (bodyRows.find(r => r.key === key) || {}).value;
    if (v && (!Array.isArray(v) || v.length)) rel.push([label, Array.isArray(v) ? v.join(", ") : v]);
  }
  for (const key of ["publishes", "subscribes", "carries", "realizes", "satisfies"]) {
    const r = bodyRows.find(x => x.key === key);
    const v = r ? r.value : list(d[key]).join(", ");
    if (v) rel.push([key, v]);
  }
  if (rel.length) html += `<p class="card-caption">Contracts</p><div class="card"><table class="rel-table">` +
    rel.map(([k, v]) => `<tr><td class="rel-name">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("") + `</table></div>`;

  // structure: what is drawn inside it
  const children = file.diagram.nodes.filter(n => node && n.parentId === node.id).map(n => byId.get(n.data.modelRef.elementId));
  if (children.length) {
    html += `<p class="card-caption">${el.type === "system" ? "Containers" : "Components and channels"} (${children.length})</p><div class="card"><ul class="card-rows">` +
      children.map(c => `<li>${link(c)}${c.data.technology || c.data.boundedContext
        ? ` <span class="row-sub">${esc(c.data.technology || "«" + c.data.boundedContext + "»")}</span>` : ""}</li>`).join("") +
      `</ul></div>`;
  }

  // deployment (containers)
  if (el.type === "container") {
    const deploys = [];
    for (const s of arch.systems) for (const env of s.environments)
      for (const dep of env.deploys) if (dep.container === d.name) deploys.push({ env, replicas: dep.replicas });
    if (deploys.length) html += `<p class="card-caption">Deployment</p><div class="card"><ul class="card-rows">` +
      deploys.map(x => `<li><span class="row-title">${esc(x.env.name)}</span>${x.replicas ? ` <span class="chip">× ${x.replicas}</span>` : ""}${x.env.description
        ? ` <span class="row-sub">— ${esc(x.env.description)}</span>` : ""}</li>`).join("") + `</ul></div>`;
  }

  // flows crossing its boundary
  const inside = archDescendants(el.id);
  const flowRow = (r, dir) => {
    const mine = byId.get(dir === "out" ? r.sourceElementId : r.targetElementId);
    const other = byId.get(dir === "out" ? r.targetElementId : r.sourceElementId);
    const rd = r.data || {};
    const what = r.type === "connect"
      ? [rd.interface, rd.protocol].filter(Boolean).join(" · ")
      : r.type === "publishes" ? `publishes ${list(rd.messages).join(", ")}` : "subscribes";
    const style = r.type === "connect" ? rd.style : "async";
    return `<li><div class="arch-flow-head">${dir === "out" ? "→" : "←"} ${other ? link(other) : "?"}${style ? ` <span class="chip">${esc(style)}</span>` : ""}</div>
      ${mine && mine.id !== el.id ? `<div class="row-sub">via ${link(mine)}</div>` : ""}
      ${what ? `<div class="arch-flow-what">${esc(what)}</div>` : ""}
      ${rd.description ? `<div class="row-sub">${esc(rd.description)}</div>` : ""}</li>`;
  };
  const out = file.model.relations.filter(r => inside.has(r.sourceElementId) && !inside.has(r.targetElementId));
  const inc = file.model.relations.filter(r => inside.has(r.targetElementId) && !inside.has(r.sourceElementId));
  for (const [title, rows, dir] of [["Outgoing flows", out, "out"], ["Incoming flows", inc, "in"]]) {
    if (!rows.length) continue;
    html += `<p class="card-caption">${title} (${rows.length})</p><div class="card"><ul class="card-rows arch-flows">` +
      rows.map(r => flowRow(r, dir)).join("") + `</ul></div>`;
  }

  showArchPanel(aside, html);
}

/* One read-only statechart per `[data-sm-host]` placeholder rendered by
   stateMachineCards. Called after the detail innerHTML is set. */
function mountStateMachines(container, hit) {
  const machines = hit.el.stateMachines || [];
  let n = 0;
  for (const host of container.querySelectorAll("[data-sm-host]")) {
    const sm = machines[Number(host.dataset.smHost)];
    if (!sm || !sm.states.length) { host.remove(); continue; }
    host.id = "sm-host-" + (n++);
    const file = SpecyDomainDiagrams.stateMachineDiagram(hit.el, sm, hit);
    mountDiagram(host, file, {
      storagePrefix: file.model.id,
      interactive: false,
      wheel: "page",
      autoHeight: true,
      fitView: true,
      logo: false,
    });
  }
}

function renderDetail() {
  const target = document.getElementById("detail");
  unmountDiagrams();
  markArchEdge(null);
  document.getElementById("main").classList.toggle("diagram-mode", state.view === "diagram" || state.view === "arch");
  if (state.view === "diagram") { renderDiagramView(target); return; }
  if (state.view === "arch") { renderArchView(target); return; }
  if (state.view === "synth") { SpecySynth.renderMain(target); return; }
  const hit = INDEX[state.view === "req" ? state.reqSelected : state.selected];
  let html;
  if (!hit) {
    html = `<div class="empty-state"><span class="brackets">[ ]</span>Select an element in the tree to inspect it.</div>`;
  } else if (hit.req) {
    html = renderReqDetail(hit);
  } else if (hit.set) {
    html = renderReqSetDetail(hit);
  } else if (hit.el) {
    html = renderElementDetail(hit);
  } else if (hit.mod) {
    html = renderModuleDetail(hit);
  } else {
    html = renderContextDetail(hit.ctx);
  }
  /* arrived from the Architecture diagram (a concept link, a card's menu or
     double-click): a way back to that exact place — the browser's Back
     button does the same */
  const back = state.returnTo
    ? `<a class="return-link" href="${esc(state.returnTo.hash)}" title="Back to where you were in the Architecture diagram">← ${esc(state.returnTo.label)}</a>` : "";
  target.innerHTML = `<div class="main-inner">${back}${html}</div>`;
  if (hit && hit.el && (hit.el.stateMachines || []).length) mountStateMachines(target, hit);
  document.getElementById("main").scrollTop = 0;
}

function renderHeader() {
  const sel = document.getElementById("org-select");
  sel.innerHTML = MODEL.organizations.map(o =>
    `<option value="${esc(o.id)}"${o.id === state.orgId ? " selected" : ""}>${esc(o.name)}</option>`).join("");
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === state.view));
  document.querySelector(".org-picker").style.visibility = state.view === "req" || state.view === "arch" ? "hidden" : "visible";
}

function renderContextSelect() {
  const label = document.getElementById("panel-label");
  const sel = document.getElementById("context-select");
  document.getElementById("tree-filter").style.display = state.view === "arch" || state.view === "synth" ? "none" : "";
  if (state.view === "arch") {
    const cur = curArch();
    label.textContent = "Architecture";
    sel.innerHTML = ARCHS.map(a =>
      `<option value="${esc(a.id)}"${cur && a.id === cur.id ? " selected" : ""}>${esc(archTitle(a))} (${esc(a.id)}.arch)</option>`).join("")
      || `<option>— no .arch loaded —</option>`;
  } else if (state.view === "synth") {
    label.textContent = "Scenario";
    sel.innerHTML = SpecySynth.selectOptions();
  } else if (state.view === "req") {
    label.textContent = "Requirement set";
    sel.innerHTML = REQSETS.map(s =>
      `<option value="${esc(s.id)}"${s.id === (curSet() && curSet().id) ? " selected" : ""}>${esc(s.name)}</option>`).join("")
      || `<option>— no .sysreq loaded —</option>`;
  } else {
    label.textContent = "Bounded context";
    sel.innerHTML = org().contexts.map(c =>
      `<option value="${esc(c.id)}"${c.id === state.ctxId ? " selected" : ""}>${esc(c.name)} (${esc(c.shortname)})</option>`).join("");
  }
  renderTreeTop();
}

/* ---- Diagram view: the organization-wide entry above the context dropdown ----
   The domain concepts grouped by system come from the level-0 `.arch` (an
   `organization` file) whose `domain-source` is this organization — the
   first one loaded through ARCH_FILES. */
function conceptArchFor(o) {
  if (typeof SpecyArchConcepts === "undefined" || !o) return null;
  return ARCHS.find(a => isOrgArch(a) && SpecyArchConcepts.domainSources(a).some(s => SpecyArchConcepts.domainStem(s) === o.id)) || null;
}
function renderTreeTop() {
  const top = document.getElementById("tree-top");
  if (state.view !== "diagram") { top.innerHTML = ""; return; }
  const o = org();
  const a = conceptArchFor(o);
  const sel = state.diagramScope === "org" ? " selected" : "";
  const hint = a ? `${a.id}.arch` : `no level-0 .arch names ${o.id}.domain — list one in ARCH_FILES`;
  const tip = a ? "Every concept a system masters or handles, grouped by system, with the dependencies between the systems (level 0)"
    : "Load an organization .arch (level 0) whose domain-source is this model to group its concepts by system";
  top.innerHTML = `<button class="tree-row scope-row org-row${sel}" data-select="diagorg"${a ? "" : " disabled"} title="${esc(tip)}">
    <span class="caret leaf">▶</span>${badge(ORG_BADGE)}<span class="row-name">Domain concepts by system</span>
    <span class="row-hint">${esc(hint)}</span>
  </button>`;
}
/* deep link of what the diagram view shows */
function diagramHash() {
  if (state.diagramScope === "org") return "#concepts:" + org().id;
  if (state.diagramScope === "context" || !state.diagramModId) return "#concepts:ctx:" + ctx().id;
  return "#concepts:mod:" + state.diagramModId;
}
function syncDiagramHash() {
  if (state.view === "diagram") history.replaceState(null, "", diagramHash());
}
/* what the "back to …" link of the Domain Navigator names */
function diagramReturn() {
  const o = org();
  if (!o) return null;
  const label = state.diagramScope === "org" ? `${o.name} — concepts by system`
    : state.diagramScope === "context" ? `${ctx().name} — concepts`
    : `${(INDEX["mod:" + state.diagramModId] || { mod: { name: "module" } }).mod.name} — class diagram`;
  return { hash: diagramHash(), label };
}

function renderAll() {
  renderHeader();
  renderContextSelect();
  renderTree();
  renderDetail();
}

/* ---- Navigation: select an id, switching view/org/context when the target
   lives elsewhere (cross-context links, satisfies chips, coverage rows). */
function goto(id) {
  const hit = INDEX[id];
  if (!hit) return;
  /* leaving the Architecture diagram pushes a history entry — its own entry
     holds the current `#arch:…` deep link, so Back returns there — and
     remembers the place for the "back to …" link; elsewhere the entry is
     replaced, as before */
  const back = state.view === "arch" ? archReturn() : state.view === "diagram" ? diagramReturn() : null;
  if (back) state.returnTo = back;
  selectById(id, hit);
  if (back) history.pushState(null, "", "#" + id);
  else history.replaceState(null, "", "#" + id);
  renderAll();
}
function selectById(id, hit) {
  if (hit.req || hit.set) {
    state.view = "req";
    state.reqSetId = hit.set.id;
    state.reqSelected = id;
  } else {
    state.view = "domain";
    state.orgId = hit.org.id;
    state.ctxId = hit.ctx.id;
    if (hit.mod) state.expanded.add("mod:" + hit.mod.id);
    state.selected = id;
  }
}

/* ---- Deep links: applies a location hash to the state (no rendering, no
   history). `#arch:<stem>[/c4][/<kind>:<name>]` opens the Architecture
   diagram; any INDEX id (`ctx:…`, `mod:…`, an element id, `req:…`) opens
   its navigator. Returns false when the hash names nothing known. ---- */
function currentHash() {
  try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return location.hash.slice(1); }
}
function applyHash(hash) {
  /* `#synth[:<org id>]` — the Synthetic data tab of an organization */
  if (hash === "synth" || hash.startsWith("synth:")) {
    if (!MODEL.organizations.length) return false;
    const o = MODEL.organizations.find(x => x.id === hash.slice("synth:".length));
    if (o && o.id !== state.orgId) enterOrg(o);
    state.view = "synth";
    return true;
  }
  if (hash.startsWith("arch:")) {
    if (!ARCHS.length) return false;
    const rest = hash.slice("arch:".length), cut = rest.indexOf("/");
    const a = ARCHS.find(x => x.id === (cut < 0 ? rest : rest.slice(0, cut)));
    let tail = a && cut >= 0 ? rest.slice(cut + 1) : "";
    const c4 = tail === "c4" || tail.startsWith("c4/");
    if (c4) tail = tail.slice(3);
    state.view = "arch";
    state.archId = (a || ARCHS[0]).id;
    if (a && isOrgArch(a)) state.archMode[a.id] = c4 ? "c4" : "landscape";
    state.archSel = tail || null;
    return true;
  }
  /* `#concepts:<org id>` — the organization's concepts by system;
     `#concepts:ctx:<context id>` — every concept of a context;
     `#concepts:mod:<module id>` — one module's class diagram */
  if (hash.startsWith("concepts:")) {
    const rest = hash.slice("concepts:".length);
    const m = rest.match(/^(ctx|mod):(.+)$/);
    if (m) {
      const key = m[1] + ":" + m[2], hit = INDEX[key];
      if (!hit || !hit.ctx) return false;
      selectById(key, hit);
      state.view = "diagram";
      state.diagramScope = m[1] === "mod" ? "module" : "context";
      if (m[1] === "mod") state.diagramModId = m[2];
      return true;
    }
    const o = MODEL.organizations.find(x => x.id === rest);
    if (!o) return false;
    if (o.id !== state.orgId) enterOrg(o);
    state.view = "diagram";
    state.diagramScope = "org";
    return true;
  }
  const hit = hash && INDEX[hash];
  if (!hit) return false;
  selectById(hash, hit);
  return true;
}
/* Back / Forward, a hash typed in the address bar, and the plain `#…` links
   of a diagram card's "⋯" menu (the app's own links go through goto) */
window.addEventListener("hashchange", () => {
  const back = state.view === "arch" ? archReturn() : state.view === "diagram" ? diagramReturn() : null;
  if (!applyHash(currentHash())) return;
  if (state.view === "arch" || state.view === "diagram") state.returnTo = null;
  else if (back) state.returnTo = back;
  renderAll();
});

/* ---- Events ---- */
document.addEventListener("click", e => {
  const tab = e.target.closest("[data-view]");
  if (tab) {
    /* no .domain loaded (see boot): the two domain tabs have nothing to show */
    if (!MODEL.organizations.length && tab.dataset.view !== "arch" && tab.dataset.view !== "req") return;
    state.view = tab.dataset.view;
    if (state.view === "req" && !state.reqSelected && REQSETS.length) {
      state.reqSetId = REQSETS[0].id;
      state.reqSelected = "reqset:" + REQSETS[0].id;
    }
    if (state.view === "diagram") {
      if (!ctx().modules.some(m => m.id === state.diagramModId)) state.diagramModId = ctx().modules.length ? ctx().modules[0].id : null;
      syncDiagramHash();
    }
    if (state.view === "arch") {
      if (!ARCHS.some(a => a.id === state.archId)) state.archId = ARCHS.length ? ARCHS[0].id : null;
      syncArchHash();
    }
    if (state.view === "synth") history.replaceState(null, "", "#synth:" + org().id);
    state.returnTo = null;   // a tab click starts a new path
    state.filter = "";
    document.getElementById("tree-filter").value = "";
    renderAll();
    return;
  }
  /* organization files: Landscape | C4 switch, "Open C4 view" / "Open system
     sheet" (`data-sel` = the selection to arrive on; else it is kept when
     the other view has it) */
  const mode = e.target.closest("[data-archmode]");
  if (mode) {
    const a = curArch();
    if (a && isOrgArch(a)) {
      state.archMode[a.id] = mode.dataset.archmode === "c4" ? "c4" : "landscape";
      if (mode.dataset.sel) state.archSel = mode.dataset.sel;
      if (mode.dataset.sel && state.archMode[a.id] === "c4") state.archUnfold = mode.dataset.sel;   // arrive on its containers
      syncArchHash();
      renderAll();
    }
    return;
  }
  const archFile = e.target.closest("[data-archfile]");   // a system detailed in its own, loaded, .arch file
  if (archFile && ARCHS.some(a => a.id === archFile.dataset.archfile)) {
    state.archId = archFile.dataset.archfile;
    state.archSel = null;
    history.pushState(null, "", archHash());
    renderAll();
    return;
  }
  const flowJump = e.target.closest("[data-flowjump]");
  if (flowJump) { e.preventDefault(); jumpToFlow(flowJump.dataset.flowjump); return; }
  const archSel = e.target.closest("[data-archsel]");
  if (archSel) { e.preventDefault(); selectArchElement(archSel.dataset.archsel, { focus: true }); return; }
  if (e.target.closest("[data-archclose]")) { selectArchElement(null); return; }
  const nav = e.target.closest("[data-goto]");
  if (nav) { e.preventDefault(); goto(nav.dataset.goto); return; }
  const row = e.target.closest("[data-select]");
  if (row) {
    const id = row.dataset.select;
    if (id === "diagorg" || id === "diagctx" || id.startsWith("diagmod:")) {
      state.diagramScope = id === "diagorg" ? "org" : id === "diagctx" ? "context" : "module";
      if (id.startsWith("diagmod:")) state.diagramModId = id.slice("diagmod:".length);
      syncDiagramHash();
      renderTreeTop();
      renderTree();
      renderDetail();
      return;
    }
    if (state.view === "req") {
      state.reqSelected = id;
    } else {
      if (row.dataset.toggle && state.selected === id) {
        // second click on an already-selected expandable row toggles it
        state.expanded.has(id) ? state.expanded.delete(id) : state.expanded.add(id);
      } else if (row.dataset.toggle) {
        state.expanded.add(id);
      }
      state.selected = id;
    }
    history.replaceState(null, "", "#" + id);
    renderTree();
    renderDetail();
  }
});

document.getElementById("org-select").addEventListener("change", e => {
  enterOrg(MODEL.organizations.find(o => o.id === e.target.value) || MODEL.organizations[0]);
  state.filter = "";
  document.getElementById("tree-filter").value = "";
  syncDiagramHash();
  renderAll();
});

document.getElementById("context-select").addEventListener("change", e => {
  if (state.view === "arch") {
    state.archId = e.target.value;
    state.archSel = null;
    syncArchHash();
  } else if (state.view === "req") {
    state.reqSetId = e.target.value;
    state.reqSelected = "reqset:" + e.target.value;
  } else if (state.view === "synth") {
    SpecySynth.onSelect(e.target.value);
    return;
  } else {
    state.ctxId = e.target.value;
    state.selected = "ctx:" + state.ctxId;
    state.diagramModId = null;
    state.expanded.clear();
    /* the dropdown picks a context: from the organization diagram it opens that context's concepts */
    if (state.view === "diagram" && state.diagramScope === "org") state.diagramScope = "context";
    syncDiagramHash();
  }
  renderAll();
});

document.getElementById("tree-filter").addEventListener("input", e => {
  state.filter = e.target.value;
  renderTree();
});

/* Diagram header toggles: domain categories (data-diagopt), architecture
   kinds / edge labels (data-archopt) and the landscape's (data-landopt); the
   legend (data-legendopt) only shows or hides, nothing is redrawn */
document.addEventListener("change", e => {
  const ds = e.target && e.target.dataset;
  if (!ds) return;
  if (ds.legendopt) {
    legendHidden = !e.target.checked;
    document.body.classList.toggle("legend-hidden", legendHidden);
    try { localStorage.setItem(LEGEND_KEY, legendHidden ? "1" : "0"); } catch (err) { /* private mode: the choice lasts the session */ }
    return;
  }
  if (ds.diagopt) state.diagramShow[ds.diagopt] = e.target.checked;
  else if (ds.conceptopt) {
    if (!state.conceptShow) state.conceptShow = Object.assign({}, SpecyDomainDiagrams.CONCEPTS_SHOW);
    state.conceptShow[ds.conceptopt] = e.target.checked;
  }
  else if (ds.conceptlandopt) state.conceptLandShow[ds.conceptlandopt] = e.target.checked;
  else if (ds.archopt) state.archShow[ds.archopt] = e.target.checked;
  else if (ds.landopt) state.landShow[ds.landopt] = e.target.checked;
  else return;
  renderDetail();
});

/* Details panel width: drag the handle between the canvas and the panel
   (arrow keys when it has the focus); a double-click returns to the default */
document.addEventListener("pointerdown", e => {
  const bar = e.target.closest && e.target.closest("[data-archresize]");
  const aside = bar && bar.nextElementSibling;
  if (!aside || e.button > 0) return;
  e.preventDefault();
  const body = bar.parentElement;
  const move = ev => {
    const r = body.getBoundingClientRect();
    setArchPanelWidth(aside, Math.min(Math.max(r.right - ev.clientX, 300), Math.max(300, r.width - 200)), false);
  };
  const up = () => {
    bar.removeEventListener("pointermove", move);
    bar.removeEventListener("pointerup", up);
    bar.removeEventListener("pointercancel", up);
    document.body.classList.remove("arch-resizing");
    setArchPanelWidth(aside, Number(archPanelWidth[aside.dataset.panel]) || 0);
  };
  try { bar.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the handle still tracks while hovered */ }
  document.body.classList.add("arch-resizing");
  bar.addEventListener("pointermove", move);
  bar.addEventListener("pointerup", up);
  bar.addEventListener("pointercancel", up);
});
document.addEventListener("dblclick", e => {
  const bar = e.target.closest && e.target.closest("[data-archresize]");
  if (bar && bar.nextElementSibling) setArchPanelWidth(bar.nextElementSibling, 0);
});
document.addEventListener("keydown", e => {
  const bar = e.target.closest && e.target.closest("[data-archresize]");
  const aside = bar && bar.nextElementSibling;
  if (!aside || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
  e.preventDefault();
  const max = Math.max(300, bar.parentElement.getBoundingClientRect().width - 200);
  setArchPanelWidth(aside, Math.min(Math.max(aside.getBoundingClientRect().width + (e.key === "ArrowLeft" ? 32 : -32), 300), max));
});

/* ---- Boot: list the models, load them by kind, then honor a deep link ---- */
async function listModels() {
  try {
    const res = await fetch(MODELS_API, NO_CACHE);
    if (res.status === 401) { reloadForLogin(); return []; }
    if (!res.ok) { console.warn(`could not list the models: HTTP ${res.status}`); return []; }
    return ((await res.json()).files || []).filter(f => f && f.org && f.name);
  } catch (e) {
    console.warn("could not list the models:", e);
    return [];
  }
}
async function fetchModel(f) {
  const res = await fetch(`${MODELS_API}/${encodeURIComponent(f.org)}/${encodeURIComponent(f.name)}`, NO_CACHE);
  if (res.status === 401) reloadForLogin();
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.text();
}
const kindOfFile = f => f.kind || (f.name.match(/\.(domain|sysreq|arch)$/) || [])[1];

/* An expired hosted session: the fetches get 401 (X-Requested-With), a page
   load gets the login page. At most one reload per minute, so a server that
   kept answering 401 could not loop the browser. */
function reloadForLogin() {
  const key = "specy-nav:reload-at";
  let last = 0;
  try { last = Number(sessionStorage.getItem(key) || 0); } catch (e) { /* storage blocked: reload anyway */ }
  if (Date.now() - last < 60000) return;
  try { sessionStorage.setItem(key, String(Date.now())); } catch (e) { /* as above */ }
  location.reload();
}

/* Header: who is signed in (api/me) and where "Sign out" goes; the menu stays
   hidden when the server has no identity to show (a plain file server). */
async function loadMe() {
  const el = document.getElementById("user-menu");
  if (!el) return;
  try {
    const res = await fetch("api/me", NO_CACHE);
    if (res.status === 401) return reloadForLogin();
    if (!res.ok) return;
    const me = await res.json();
    const name = me.user && (me.user.name || me.user.email);
    if (!name) return;
    el.innerHTML =
      `<span class="user-name" title="${esc(me.user.email || "")}">${esc(name)}</span>` +
      (me.tenant && me.tenant.name ? `<span class="user-tenant">${esc(me.tenant.name)}</span>` : "") +
      (me.logoutUrl ? `<a class="user-signout" href="${esc(me.logoutUrl)}">Sign out</a>` : "");
    el.hidden = false;
  } catch (e) { /* no api/me here: no menu */ }
}

/* Nothing listed by the server (a hosted space with no published model yet):
   an empty state instead of a navigator with nothing to navigate. */
function renderEmpty() {
  document.querySelector(".org-picker").style.visibility = "hidden";
  document.querySelectorAll(".tab").forEach(t => { t.disabled = true; });
  document.querySelector(".tree-head").style.display = "none";
  document.getElementById("main").innerHTML =
    `<div class="main-inner empty-state"><h2>No model published yet</h2>` +
    `<p>Nothing is listed for this space. Once a model is published, reload this page.</p></div>`;
}

(async function boot() {
  loadMe();
  const files = await listModels();
  const loaded = await Promise.all(files.map(f => fetchModel(f).then(text => ({ f, text }), error => ({ f, error }))));
  const byKind = kind => loaded.filter(x => kindOfFile(x.f) === kind).sort((a, b) => a.f.name.localeCompare(b.f.name));
  const stem = (f, ext) => f.name.slice(0, -ext.length);
  for (const { f, text, error } of byKind("domain")) {
    try { if (error) throw error; const o = parseDomain(text, stem(f, ".domain")); MODEL.organizations.push(o); DOMAIN_TEXT[o.id] = text; }
    catch (e) { console.warn("could not load " + f.name + ":", e); }
  }
  for (const { f, text, error } of byKind("sysreq")) {
    try { if (error) throw error; REQSETS.push(...parseSysreq(text, stem(f, ".sysreq"))); }
    catch (e) { console.warn("could not load " + f.name + ":", e); }
  }
  for (const { f, text, error } of byKind("arch")) {
    try { if (error) throw error; ARCHS.push(parseArch(text, stem(f, ".arch"))); }
    catch (e) { console.warn("could not load " + f.name + ":", e); }
  }
  buildIndex();
  if (!MODEL.organizations.length && !ARCHS.length && !REQSETS.length) { renderEmpty(); return; }
  if (!org() && MODEL.organizations.length) enterOrg(MODEL.organizations[0]);   // data.js shipped no sample
  const known = applyHash(currentHash());
  if (!MODEL.organizations.length) {
    /* architectures or requirements only (a landscape published without its
       .domain): the two domain tabs have nothing to show */
    document.querySelectorAll(".tab[data-view=domain], .tab[data-view=diagram], .tab[data-view=synth]").forEach(t => { t.disabled = true; t.title = "No domain model loaded"; });
    if (state.view === "domain" || state.view === "diagram") {
      if (ARCHS.length) { state.view = "arch"; state.archId = ARCHS[0].id; }
      else { state.view = "req"; state.reqSetId = REQSETS[0].id; state.reqSelected = "reqset:" + REQSETS[0].id; }
    }
  } else if (!known || state.view === "arch") {
    /* nothing to open, or the Architecture diagram: the Domain Navigator keeps
       its first module unfolded */
    state.expanded.add("mod:" + ctx().modules[0].id);
  }
  renderAll();
})();

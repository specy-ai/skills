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

/* ---- .domain / .sysreq files loaded at boot ---- */
const DOMAIN_FILES = ["fipro.domain", "fipro.refactored.domain"];
const SYSREQ_FILES = ["fipro.sysreq"];

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
        for (const el of mod.elements) INDEX[el.id] = { el, mod, ctx, org };
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
  view: "domain",            // "domain" | "diagram" | "req"
  orgId: MODEL.organizations[0].id,
  ctxId: MODEL.organizations[0].contexts[0].id,
  selected: "ctx:" + MODEL.organizations[0].contexts[0].id,
  reqSetId: null,
  reqSelected: null,
  diagramModId: null,        // module rendered in the diagram view
  diagramShow: { interfaces: true, entities: true, values: true, services: true },
  expanded: new Set(),
  filter: "",
};

const curSet = () => REQSETS.find(s => s.id === state.reqSetId) || REQSETS[0];

const org = () => MODEL.organizations.find(o => o.id === state.orgId);
const ctx = () => org().contexts.find(c => c.id === state.ctxId) || org().contexts[0];

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

/* Diagram view tree: one row per module of the current context */
function renderDiagramTree() {
  const c = ctx();
  if (!c.modules.some(m => m.id === state.diagramModId))
    state.diagramModId = c.modules.length ? c.modules[0].id : null;
  const f = state.filter.trim().toLowerCase();
  const mods = c.modules.filter(m => !f || m.name.toLowerCase().includes(f));
  if (!mods.length) {
    document.getElementById("tree").innerHTML = `<div class="tree-empty">No module matches “${esc(state.filter)}”.</div>`;
    return;
  }
  let html = `<ul><li><div class="tree-group-label" style="--indent:0px">Modules</div></li>`;
  for (const mod of mods) {
    const mains = mod.elements.filter(e => SpecyDiagram.MAIN_KINDS.has(e.kind)).length;
    const sel = state.diagramModId === mod.id ? " selected" : "";
    html += `<li><button class="tree-row${sel}" data-select="diagmod:${esc(mod.id)}" style="--indent:0px" title="${esc(mod.description || mod.name)}">
      <span class="caret leaf">▶</span>${badge(KINDS.module)}<span class="row-name">${esc(mod.name)}</span>
      <span class="row-count">${mains}/${mod.elements.length}</span>
    </button></li>`;
  }
  html += "</ul>";
  document.getElementById("tree").innerHTML = html;
}

function renderTree() {
  if (state.view === "req") { renderReqTree(); return; }
  if (state.view === "diagram") { renderDiagramTree(); return; }
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

/* Diagram view fills the main panel with a React Flow canvas */
function renderDiagramView(target) {
  const c = ctx();
  const mod = c.modules.find(m => m.id === state.diagramModId) || c.modules[0];
  if (!mod) {
    target.innerHTML = `<div class="empty-state"><span class="brackets">[ ]</span>This context has no modules to diagram.</div>`;
    return;
  }
  state.diagramModId = mod.id;
  const show = state.diagramShow;
  const shown = SpecyDiagram.countVisible(mod, show);
  const opts = [["interfaces", "interfaces"], ["entities", "entities / aggregates"], ["values", "values"], ["services", "services"]];
  target.innerHTML = `<div class="diagram-wrap">
    <div class="diagram-bar">
      ${badge(KINDS.module)}<span class="diagram-title">${esc(mod.name)}</span>
      <span class="diagram-sub">${esc(c.shortname || c.name)} · ${shown} of ${mod.elements.length} elements</span>
      <span class="spacer"></span>
      <div class="diagram-opts">${opts.map(([key, label]) =>
        `<label class="diag-opt"><input type="checkbox" data-diagopt="${key}"${show[key] ? " checked" : ""}/>${esc(label)}</label>`).join("")}
      </div>
      <button class="diagram-open" data-goto="mod:${esc(mod.id)}">open module detail ↗</button>
    </div>
    <div id="flow" class="flow-host"></div>
  </div>`;
  SpecyDiagram.mount(document.getElementById("flow"), mod, c, show);
}

function renderDetail() {
  const target = document.getElementById("detail");
  if (typeof SpecyDiagram !== "undefined") SpecyDiagram.unmount();
  document.getElementById("main").classList.toggle("diagram-mode", state.view === "diagram");
  if (state.view === "diagram") { renderDiagramView(target); return; }
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
  target.innerHTML = `<div class="main-inner">${html}</div>`;
  if (hit && hit.el && (hit.el.stateMachines || []).length && typeof SpecyDiagram !== "undefined")
    SpecyDiagram.mountStateMachines(target, hit.el.stateMachines);
  document.getElementById("main").scrollTop = 0;
}

function renderHeader() {
  const sel = document.getElementById("org-select");
  sel.innerHTML = MODEL.organizations.map(o =>
    `<option value="${esc(o.id)}"${o.id === state.orgId ? " selected" : ""}>${esc(o.name)}</option>`).join("");
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === state.view));
  document.querySelector(".org-picker").style.visibility = state.view === "req" ? "hidden" : "visible";
}

function renderContextSelect() {
  const label = document.getElementById("panel-label");
  const sel = document.getElementById("context-select");
  if (state.view === "req") {
    label.textContent = "Requirement set";
    sel.innerHTML = REQSETS.map(s =>
      `<option value="${esc(s.id)}"${s.id === (curSet() && curSet().id) ? " selected" : ""}>${esc(s.name)}</option>`).join("")
      || `<option>— no .sysreq loaded —</option>`;
  } else {
    label.textContent = "Bounded context";
    sel.innerHTML = org().contexts.map(c =>
      `<option value="${esc(c.id)}"${c.id === state.ctxId ? " selected" : ""}>${esc(c.name)} (${esc(c.shortname)})</option>`).join("");
  }
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
  history.replaceState(null, "", "#" + id);
  renderAll();
}

/* ---- Events ---- */
document.addEventListener("click", e => {
  const tab = e.target.closest("[data-view]");
  if (tab) {
    state.view = tab.dataset.view;
    if (state.view === "req" && !state.reqSelected && REQSETS.length) {
      state.reqSetId = REQSETS[0].id;
      state.reqSelected = "reqset:" + REQSETS[0].id;
    }
    if (state.view === "diagram" && !ctx().modules.some(m => m.id === state.diagramModId)) {
      state.diagramModId = ctx().modules.length ? ctx().modules[0].id : null;
    }
    state.filter = "";
    document.getElementById("tree-filter").value = "";
    renderAll();
    return;
  }
  const nav = e.target.closest("[data-goto]");
  if (nav) { e.preventDefault(); goto(nav.dataset.goto); return; }
  const row = e.target.closest("[data-select]");
  if (row) {
    const id = row.dataset.select;
    if (id.startsWith("diagmod:")) {
      state.diagramModId = id.slice("diagmod:".length);
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
  state.orgId = e.target.value;
  state.ctxId = org().contexts[0].id;
  state.selected = "ctx:" + state.ctxId;
  state.diagramModId = null;
  state.expanded.clear();
  state.filter = "";
  document.getElementById("tree-filter").value = "";
  renderAll();
});

document.getElementById("context-select").addEventListener("change", e => {
  if (state.view === "req") {
    state.reqSetId = e.target.value;
    state.reqSelected = "reqset:" + e.target.value;
  } else {
    state.ctxId = e.target.value;
    state.selected = "ctx:" + state.ctxId;
    state.diagramModId = null;
    state.expanded.clear();
  }
  renderAll();
});

document.getElementById("tree-filter").addEventListener("input", e => {
  state.filter = e.target.value;
  renderTree();
});

/* Diagram header category toggles */
document.addEventListener("change", e => {
  const key = e.target && e.target.dataset ? e.target.dataset.diagopt : null;
  if (!key) return;
  state.diagramShow[key] = e.target.checked;
  renderDetail();
});

/* ---- Boot: load .domain and .sysreq files, then honor a deep link ---- */
(async function boot() {
  for (const file of DOMAIN_FILES) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;
      const org = parseDomain(await res.text(), file.replace(/\.domain$/, ""));
      MODEL.organizations.push(org);
    } catch (e) {
      console.warn("could not load " + file + ":", e);
    }
  }
  for (const file of SYSREQ_FILES) {
    try {
      const res = await fetch(file);
      if (!res.ok) continue;
      REQSETS.push(...parseSysreq(await res.text(), file.replace(/\.sysreq$/, "")));
    } catch (e) {
      console.warn("could not load " + file + ":", e);
    }
  }
  buildIndex();
  const hash = decodeURIComponent(location.hash.slice(1));
  const hit = hash && INDEX[hash];
  if (hit && (hit.req || hit.set)) {
    state.view = "req";
    state.reqSetId = hit.set.id;
    state.reqSelected = hash;
  } else if (hit) {
    state.orgId = hit.org.id;
    state.ctxId = hit.ctx.id;
    if (hit.mod) state.expanded.add("mod:" + hit.mod.id);
    state.selected = hash;
  } else {
    state.expanded.add("mod:" + ctx().modules[0].id);
  }
  renderAll();
})();

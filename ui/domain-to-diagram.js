/* Specy Navigator → Specy Diagram Engine converters.
   Pure functions (no DOM, no React) turning the navigator's parsed domain
   shape (domain-parser.js / data.js) into DiagramFile JSON for the engine
   bundle (vendor/specy-diagram-engine.js), per the normative contract
   diagram-engine/docs/DERIVED-DIAGRAMS.md:
     - moduleClassDiagram(mod, context, show, orgId?)  → metamodel "domain-class"
     - stateMachineDiagram(el, sm, hit?)               → metamodel "state-machine"
   The view half (layout, node components, edge routing) lives in the engine;
   this file is the model half of the former diagram.js.
   KINDS / kindOf come from app.js through the shared global lexical scope
   when present (load order: app.js before this file); KINDS_FALLBACK keeps
   the converter self-contained for scripts/check-diagram-export.mjs. */

"use strict";

const SpecyDomainDiagrams = (() => {

  /* ---- Kind registry fallback — a copy of KINDS in app.js (checked for
     drift by scripts/check-diagram-export.mjs) ---- */
  const KINDS_FALLBACK = {
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

  const kindsTable = () => (typeof KINDS !== "undefined" && KINDS) ? KINDS : KINDS_FALLBACK;
  const kindInfo = el => {
    if (typeof kindOf === "function") return kindOf(el);
    const t = kindsTable();
    return t[el.kind] || t.entity;
  };

  /* compact eyebrow titles — a 260px card can't afford "Infrastructure Service" */
  const KIND_SHORT = {
    "domain-service": "Domain svc", "application-service": "App svc",
    "infrastructure-service": "Infra svc", "readonly-entity": "Read-only",
  };

  const MAIN_KINDS = new Set([
    "entity", "readonly-entity", "aggregate",
    "domain-service", "application-service", "infrastructure-service",
  ]);

  /* toggle category per kind — kinds not listed never appear in the class diagram */
  const CATEGORY_OF = {
    "entity": "entities", "readonly-entity": "entities", "aggregate": "entities",
    "value": "values", "enum": "values",
    "domain-service": "services", "application-service": "services", "infrastructure-service": "services",
    "interface": "interfaces",
  };
  const DEFAULT_SHOW = { interfaces: true, entities: true, values: true, services: true };

  const isVisible = (el, show) => {
    const cat = CATEGORY_OF[el.kind];
    return !!(cat && show[cat]);
  };
  const countVisible = (mod, show) => mod.elements.filter(el => isVisible(el, show || DEFAULT_SHOW)).length;

  const MAX_FIELDS = 12, MAX_OPS = 10, MAX_ENUM = 8;

  const CLASS_LAYOUT = { engine: "dagre", rankdir: "LR", nodesep: 26, ranksep: 80 };
  const SM_LAYOUT = { engine: "dagre", rankdir: "TB", nodesep: 55, ranksep: 65 };

  /* ---- Model ids ----
     Class diagram: <org>.<ctx>.<module>. The parser (domain-parser.js idOf)
     already scopes context ids as "<fileStem>:<shortname>", so the org is
     only prepended when the context id does not embed it (data.js samples:
     org "acme-mobility", context "ride-hailing"). ':' separators become '.'
     so both sources yield the same dotted shape. */
  const dotted = s => String(s == null ? "" : s).trim().replace(/[:/]+/g, ".");
  const slug = s => dotted(s).replace(/\s+/g, "-").replace(/[^\w.\-\[\]*]+/g, "-");

  function moduleModelId(mod, context, orgId) {
    const ctxId = String(context.id);
    const parts = [];
    if (orgId && ctxId !== orgId && !ctxId.startsWith(orgId + ":") && !ctxId.startsWith(orgId + "."))
      parts.push(orgId);
    parts.push(ctxId, mod.name);
    return parts.map(dotted).join(".");
  }

  /* State machine: <element id>.<machine name> — element ids are unique
     context-wide, which keeps the storage prefix unique per machine. */
  const machineModelId = (el, sm) => slug(el.id) + "." + slug(sm.name);

  /* ============ Class-card compartments ============ */

  function capRows(rows, max) {
    if (rows.length <= max) return rows;
    const kept = rows.slice(0, max - 1);
    kept.push({ left: `+ ${rows.length - (max - 1)} more…`, cls: "more" });
    return kept;
  }

  function compartmentsFor(el, byId, invariantsByScope) {
    const secs = [];

    /* attributes: identity first, then typed fields */
    const attrs = [];
    if (el.identity) {
      const m = String(el.identity).split(/\s*:\s*/);
      attrs.push({ left: m[0], right: m[1] || "", cls: "id", title: "identity " + el.identity });
    }
    for (const f of el.fields || []) {
      const type = f.ref && byId[f.ref] ? byId[f.ref].el.name : (f.type || "");
      attrs.push({ left: f.name, right: type + (f.optional ? "?" : ""), title: `${f.name}: ${type}${f.note ? " — " + f.note : ""}` });
    }
    if (attrs.length) secs.push({ rows: capRows(attrs, MAX_FIELDS) });

    /* enum literals */
    if (el.kind === "enum" && (el.values || []).length) {
      secs.push({ rows: capRows(el.values.map(v => ({ left: v, cls: "lit" })), MAX_ENUM) });
    }

    /* operations (interfaces expose signature strings) */
    const ops = [];
    if (el.kind === "interface") {
      for (const sig of el.exposes || []) ops.push({ left: sig, cls: "op", title: sig });
    } else {
      for (const op of el.operations || []) {
        if (typeof op !== "object" || op === null) continue;
        ops.push({ left: op.label, right: op.sig || "", cls: "op", title: `${op.label} ${op.sig || ""}` });
      }
    }
    if (ops.length) secs.push({ rows: capRows(ops, MAX_OPS) });

    /* invariants scoped to this element → UML-style {constraint} rows */
    const invs = invariantsByScope[el.id] || [];
    if (invs.length) secs.push({ rows: invs.map(name => ({ left: `{ ${name} }`, cls: "inv", title: "invariant " + name })) });

    return secs;
  }

  /* raw domain data carried by a model element (contract §3) */
  function elementData(el, mod, invariantsByScope) {
    const d = { name: el.name, description: el.description || "", module: mod.name };
    if (el.identity) d.identity = String(el.identity);
    if (el.fields && el.fields.length)
      d.fields = el.fields.map(f => {
        const o = { name: f.name, type: f.type || "", optional: !!f.optional, note: f.note || "" };
        if (f.ref) o.ref = f.ref;
        return o;
      });
    const ops = (el.operations || []).filter(op => op && typeof op === "object");
    if (ops.length) d.operations = ops.map(op => ({ label: op.label, sig: op.sig || "" }));
    if (el.kind === "enum") d.values = (el.values || []).slice();
    if (el.kind === "interface") d.exposes = (el.exposes || []).slice();
    const invs = invariantsByScope[el.id] || [];
    if (invs.length) d.invariants = invs.slice();
    return d;
  }

  const nodeKindData = el => {
    const k = kindInfo(el);
    return { name: el.name, kind: el.kind, kindLabel: k.label, kindTitle: k.title,
      kindShort: KIND_SHORT[el.kind] || k.title, color: k.color };
  };

  /* ============ Module class diagram ============ */

  function moduleClassDiagram(mod, context, show, orgId) {
    show = show || DEFAULT_SHOW;
    const modelId = moduleModelId(mod, context, orgId);

    const byId = {};            // id → {el, mod} across the whole context
    const nameToId = {};        // element name → id (context-wide, mirrors the parser's byName)
    for (const m of context.modules)
      for (const e of m.elements) { byId[e.id] = { el: e, mod: m }; nameToId[e.name] = e.id; }

    const els = mod.elements.filter(el => isVisible(el, show));
    const present = new Set(els.map(e => e.id));

    const invariantsByScope = {};
    for (const inv of mod.elements.filter(e => e.kind === "invariant")) {
      const scope = inv.scopedTo && inv.scopedTo.ref;
      if (scope) (invariantsByScope[scope] = invariantsByScope[scope] || []).push(inv.name);
    }

    const relations = [], edges = [];
    const seen = new Set();
    const ghosts = new Map();   // element id → ghost node id

    /* endpoint: visible in this module → itself; cross-module element of a
       shown category → ghost card; hidden or unknown → edge dropped */
    function endpoint(id) {
      if (!id || !byId[id]) return null;
      if (present.has(id)) return id;
      const hit = byId[id];
      if (hit.mod.id === mod.id || !isVisible(hit.el, show)) return null;
      if (!ghosts.has(id)) ghosts.set(id, "ghost:" + id);
      return ghosts.get(id);
    }

    function addEdge(srcId, tgtId, type, label, opts) {
      const s = endpoint(srcId), t = endpoint(tgtId);
      if (!s || !t || s === t) return;
      const key = s + "|" + t + "|" + label;
      if (seen.has(key)) return;
      seen.add(key);
      const o = opts || {};
      const rid = "r" + relations.length;
      relations.push({ id: rid, type, sourceElementId: srcId, targetElementId: tgtId, data: { label } });
      edges.push({
        id: "e" + edges.length, source: s, target: t, type: "class-edge",
        data: { modelRef: { modelId, relationId: rid }, label, strong: !!o.strong, quiet: !!o.quiet },
      });
    }

    const deref = r => (r && r.ref) || null;
    const derefList = arr => (arr || []).map(deref).filter(Boolean);

    for (const el of els) {
      /* structure: typed attributes and references */
      for (const f of el.fields || [])
        if (f.ref && f.ref !== el.id) addEdge(el.id, f.ref, "attribute-type", f.name, { quiet: true });
      for (const r of el.references || []) {
        const tid = nameToId[r.type];
        if (tid && tid !== el.id) addEdge(el.id, tid, "reference", `${r.name} ${r.card}`);
      }

      switch (el.kind) {
        case "aggregate":
          for (const t of derefList(el.contains)) addEdge(el.id, t, "contains", "CONTAINS", { strong: true });
          break;
        case "readonly-entity":
          if (el.projectedBy) addEdge(deref(el.projectedBy), el.id, "projects", "PROJECTS");
          break;
        case "value":
          for (const t of derefList(el.composes)) addEdge(el.id, t, "composes", "COMPOSES", { quiet: true });
          break;
        case "domain-service":
        case "infrastructure-service":
          for (const t of derefList(el.calls)) addEdge(el.id, t, "calls", "CALLS");
          break;
        case "application-service":
          for (const t of derefList(el.delegatesTo)) addEdge(el.id, t, "delegates-to", "DELEGATES TO");
          for (const t of derefList(el.calls)) addEdge(el.id, t, "calls", "CALLS");
          break;
        case "interface":
          if (el.describes) addEdge(el.id, deref(el.describes), "describes", "DESCRIBES");
          for (const t of derefList(el.exposesFrom)) addEdge(el.id, t, "exposes", "EXPOSES");
          break;
      }
    }

    /* ---- model elements + class-card nodes (no positions: the engine lays out) ---- */
    const elements = els.map(el => ({ id: el.id, type: el.kind, data: elementData(el, mod, invariantsByScope) }));
    const nodes = els.map(el => ({
      id: el.id, type: "class-card",
      data: Object.assign({ modelRef: { modelId, elementId: el.id } }, nodeKindData(el), {
        description: el.description || "",
        compartments: compartmentsFor(el, byId, invariantsByScope),
      }),
    }));
    for (const [id, gid] of ghosts) {
      const hit = byId[id];
      nodes.push({
        id: gid, type: "ghost-card",
        data: Object.assign({ modelRef: { modelId: moduleModelId(hit.mod, context, orgId), elementId: id } },
          nodeKindData(hit.el), { module: hit.mod.name }),
      });
    }

    return {
      version: 1,
      model: { id: modelId, name: mod.name, metamodel: "domain-class", elements, relations },
      diagram: { id: modelId + "#class", name: mod.name, layout: Object.assign({}, CLASS_LAYOUT), nodes, edges },
    };
  }

  /* ============ UML statechart per entity / aggregate machine ============ */

  function stateMachineDiagram(el, sm, hit) {
    const modelId = machineModelId(el, sm);
    const name = `${el.name} · ${sm.name}`;
    const states = (sm.states || []).slice();
    const starts = (sm.starts || []).length ? sm.starts
      : states.filter(s => s.initial).map(s => ({ to: s.name, operation: "", guard: "" }));
    const hasStart = starts.length > 0 || states.some(s => s.initial);

    const elements = [], nodes = [];
    if (hasStart) {
      elements.push({ id: "[*]", type: "initial", data: {} });
      nodes.push({ id: "[*]", type: "sm-initial", data: { modelRef: { modelId, elementId: "[*]" } } });
    }
    const known = new Set();
    const addState = s => {
      if (known.has(s.name)) return;
      known.add(s.name);
      const d = { name: s.name, description: s.description || "", invariants: (s.invariants || []).slice(),
        initial: !!s.initial, final: !!s.final };
      elements.push({ id: s.name, type: "state", data: d });
      nodes.push({ id: s.name, type: "sm-state", data: Object.assign({ modelRef: { modelId, elementId: s.name } }, d) });
    };
    for (const s of states) addState(s);
    /* a transition naming a state the machine never declared still gets a box
       (mirrors the parser's ensureState) rather than a dangling edge */
    const ensure = n => { if (n !== "[*]" && !known.has(n)) addState({ name: n }); };

    const relations = [], edges = [];
    const addTransition = (from, to, t) => {
      ensure(from); ensure(to);
      const id = "t" + relations.length;
      const d = { operation: t.operation || "", guard: t.guard || "" };
      relations.push({ id, type: "transition", sourceElementId: from, targetElementId: to, data: d });
      edges.push({ id, source: from, target: to, type: "sm-transition",
        data: Object.assign({ modelRef: { modelId, relationId: id } }, d) });
    };
    for (const t of starts) addTransition("[*]", t.to, t);
    for (const t of sm.transitions || []) addTransition(t.from, t.to, t);

    return {
      version: 1,
      model: { id: modelId, name, metamodel: "state-machine", elements, relations },
      diagram: { id: modelId + "#statechart", name, layout: Object.assign({}, SM_LAYOUT), nodes, edges },
    };
  }

  return {
    moduleClassDiagram, stateMachineDiagram,
    moduleModelId, machineModelId, compartmentsFor,
    MAIN_KINDS, CATEGORY_OF, DEFAULT_SHOW, KIND_SHORT, KINDS_FALLBACK,
    isVisible, countVisible,
  };
})();

/* Node (scripts/check-diagram-export.mjs loads this file through vm; the
   browser ignores this block) */
if (typeof module !== "undefined" && module.exports) module.exports = SpecyDomainDiagrams;

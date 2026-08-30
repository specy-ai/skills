/* Specy Domain Diagram — React Flow islands inside the vanilla-JS navigator.
   1. Module class diagram: entities, aggregates, services, values, enums and
      interfaces are class cards (title · attributes · operations · constraints
      compartments); relations between them are labeled edges (CONTAINS, CALLS,
      DELEGATES TO, DESCRIBES, EXPOSES, PROJECTS, COMPOSES, reference/field
      names). Invariants fold into their scoped card as {…} constraint rows.
      The header offers per-category visibility toggles. Layout: dagre LR for
      the connected graph, edge-less cards in a wrapped grid.
   2. UML state diagram per entity/aggregate state machine, embedded in the
      detail page above the states/transitions table (mountStateMachines).
   Reuses KINDS / kindOf / goto from app.js (shared global lexical scope). */

"use strict";

const SpecyDiagram = (() => {
  const RF = window.ReactFlow;
  const h = window.React ? React.createElement : null;

  const MAIN_KINDS = new Set([
    "entity", "readonly-entity", "aggregate",
    "domain-service", "application-service", "infrastructure-service",
  ]);

  /* toggle category per kind — kinds not listed never appear in this diagram */
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

  /* Geometry constants — kept in sync with the .specy-node / .cc-* CSS */
  const HEAD = 40, ROW = 18, SECPAD = 10, GHOST_W = 190, GHOST_H = 44;
  const WIDTH_BY_CAT = { entities: 260, services: 260, interfaces: 250, values: 220 };
  const MAX_FIELDS = 12, MAX_OPS = 10, MAX_ENUM = 8;

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

  /* ============ Graph construction ============ */

  function buildGraph(mod, context, show) {
    show = show || DEFAULT_SHOW;
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

    const edges = [];
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

    function addEdge(srcId, tgtId, label, opts) {
      const s = endpoint(srcId), t = endpoint(tgtId);
      if (!s || !t || s === t) return;
      const key = s + "|" + t + "|" + label;
      if (seen.has(key)) return;
      seen.add(key);
      const o = opts || {};
      edges.push({
        id: "e" + edges.length + ":" + key,
        source: s, target: t, label,
        type: "default",          // bezier
        style: {
          stroke: "#172741",
          strokeWidth: o.strong ? 1.8 : 1.2,
          opacity: o.quiet ? 0.55 : 1,
        },
        markerEnd: { type: RF.MarkerType.ArrowClosed, width: 15, height: 15, color: "#172741" },
        labelStyle: { fontFamily: '"Fira Code", monospace', fontSize: 9, fill: "#4b5d6c", letterSpacing: "0.05em" },
        labelBgStyle: { fill: "#f6f7f8", fillOpacity: 0.92 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 2,
      });
    }

    const deref = r => (r && r.ref) || null;
    const derefList = arr => (arr || []).map(deref).filter(Boolean);

    for (const el of els) {
      /* structure: typed attributes and references */
      for (const f of el.fields || [])
        if (f.ref && f.ref !== el.id) addEdge(el.id, f.ref, f.name, { quiet: true });
      for (const r of el.references || []) {
        const tid = nameToId[r.type];
        if (tid && tid !== el.id) addEdge(el.id, tid, `${r.name} ${r.card}`);
      }

      switch (el.kind) {
        case "aggregate":
          for (const t of derefList(el.contains)) addEdge(el.id, t, "CONTAINS", { strong: true });
          break;
        case "readonly-entity":
          if (el.projectedBy) addEdge(deref(el.projectedBy), el.id, "PROJECTS");
          break;
        case "value":
          for (const t of derefList(el.composes)) addEdge(el.id, t, "COMPOSES", { quiet: true });
          break;
        case "domain-service":
        case "infrastructure-service":
          for (const t of derefList(el.calls)) addEdge(el.id, t, "CALLS");
          break;
        case "application-service":
          for (const t of derefList(el.delegatesTo)) addEdge(el.id, t, "DELEGATES TO");
          for (const t of derefList(el.calls)) addEdge(el.id, t, "CALLS");
          break;
        case "interface":
          if (el.describes) addEdge(el.id, deref(el.describes), "DESCRIBES");
          for (const t of derefList(el.exposesFrom)) addEdge(el.id, t, "EXPOSES");
          break;
      }
    }

    /* ---- nodes: class cards + cross-module ghosts ---- */
    const units = [];
    for (const el of els) {
      const secs = compartmentsFor(el, byId, invariantsByScope);
      const w = WIDTH_BY_CAT[CATEGORY_OF[el.kind]] || 240;
      const hgt = HEAD + secs.reduce((a, s) => a + SECPAD + s.rows.length * ROW, 0) + 2;
      units.push({ id: el.id, el, secs, type: "card", w, h: hgt });
    }
    for (const [id, gid] of ghosts) {
      const hit = byId[id];
      units.push({ id: gid, refId: id, el: hit.el, modName: hit.mod.name,
        type: "ghost", w: GHOST_W, h: GHOST_H });
    }

    /* ---- layout: dagre for the connected part, grid shelf for the rest ---- */
    const degree = {};
    for (const e of edges) {
      degree[e.source] = (degree[e.source] || 0) + 1;
      degree[e.target] = (degree[e.target] || 0) + 1;
    }
    const connected = units.filter(u => degree[u.id]);
    const isolated = units.filter(u => !degree[u.id]);

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 26, ranksep: 80, marginx: 24, marginy: 24 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const u of connected) g.setNode(u.id, { width: u.w, height: u.h });
    for (const e of edges) g.setEdge(e.source, e.target);
    let graphW = 0, graphH = 0;
    if (connected.length) {
      dagre.layout(g);
      for (const u of connected) {
        const pos = g.node(u.id);
        u.pos = { x: pos.x - u.w / 2, y: pos.y - u.h / 2 };
      }
      graphW = g.graph().width || 0;
      graphH = g.graph().height || 0;
    }
    if (isolated.length) {
      const totalH = isolated.reduce((a, u) => a + u.h + 20, 0);
      const colH = Math.max(Math.min(graphH, 1600), 700, Math.ceil(totalH / 4));
      let x = graphW + (connected.length ? 80 : 24), y = 24, colW = 0;
      for (const u of isolated) {
        if (y > 24 && y + u.h > colH) { x += colW + 32; y = 24; colW = 0; }
        u.pos = { x, y };
        y += u.h + 20;
        colW = Math.max(colW, u.w);
      }
    }

    const nodes = units.map(u => ({
      id: u.id, type: u.type, position: u.pos,
      data: { el: u.el, secs: u.secs, refId: u.refId, modName: u.modName, width: u.w },
    }));
    return { nodes, edges };
  }

  /* ============ Node components (React.createElement, no JSX) ============ */

  /* compact eyebrow titles — a 260px card can't afford "Infrastructure Service" */
  const KIND_SHORT = {
    "domain-service": "Domain svc", "application-service": "App svc",
    "infrastructure-service": "Infra svc", "readonly-entity": "Read-only",
  };

  const handles = () => [
    h(RF.Handle, { key: "t", type: "target", position: RF.Position.Left, className: "specy-handle" }),
    h(RF.Handle, { key: "s", type: "source", position: RF.Position.Right, className: "specy-handle" }),
  ];

  function CardNode({ data }) {
    const el = data.el, k = kindOf(el);
    return h("div", { className: "specy-node card kind-" + el.kind, style: { width: data.width } },
      handles(),
      h("div", { className: "specy-node-head", title: el.description || el.name },
        h("span", { className: "badge", style: { background: k.color } }, k.label),
        h("span", { className: "specy-node-name" }, el.name),
        h("span", { className: "specy-node-kind", title: k.title }, KIND_SHORT[el.kind] || k.title)),
      data.secs.map((sec, i) =>
        h("div", { className: "cc-sec", key: i },
          sec.rows.map((r, j) =>
            h("div", { className: "cc-row " + (r.cls || ""), key: j, title: r.title || r.left },
              h("span", { className: "cc-name" }, r.left),
              r.right ? h("span", { className: "cc-type" }, ": " + r.right) : null)))));
  }

  function GhostNode({ data }) {
    const k = kindOf(data.el);
    return h("div", { className: "specy-ghost", title: "Defined in module " + data.modName },
      handles(),
      h("span", { className: "badge", style: { background: k.color } }, k.label),
      h("div", { className: "specy-ghost-text" },
        h("span", { className: "specy-ghost-name" }, data.el.name),
        h("span", { className: "specy-ghost-mod" }, data.modName)));
  }

  const NODE_TYPES = { card: CardNode, ghost: GhostNode };

  function DiagramApp({ nodes, edges }) {
    return h(RF.ReactFlow, {
      defaultNodes: nodes,
      defaultEdges: edges,
      nodeTypes: NODE_TYPES,
      fitView: true,
      fitViewOptions: { padding: 0.1, maxZoom: 1 },
      minZoom: 0.12,
      maxZoom: 1.75,
      nodesConnectable: false,
      deleteKeyCode: null,
      onNodeDoubleClick: (ev, node) => {
        const id = node.data.refId || (node.data.el && node.data.el.id);
        if (id) goto(id);
      },
    },
      h(RF.Background, { variant: "dots", gap: 18, size: 1.1, color: "#d5d9dd" }),
      h(RF.Controls, { showInteractive: false, position: "bottom-right" }),
      h(RF.MiniMap, {
        pannable: true, position: "top-right",
        nodeColor: n => (n.data && n.data.el ? kindOf(n.data.el).color : "#c4c4c4"),
        nodeStrokeWidth: 0, maskColor: "rgba(246,247,248,0.75)",
      }),
      h(RF.Panel, { position: "bottom-left", className: "specy-legend" },
        h("span", { className: "specy-legend-item" }, h("span", { className: "specy-legend-line strong" }), "contains"),
        h("span", { className: "specy-legend-item" }, h("span", { className: "specy-legend-line solid" }), "relation"),
        h("span", { className: "specy-legend-item" }, h("span", { className: "specy-legend-line quiet" }), "attribute type"),
        h("span", { className: "specy-legend-hint" }, "double-click an element to open it")));
  }

  /* ============ UML state diagram (entity / aggregate detail pages) ============
     One React Flow island per `machine`: initial pseudo-state bullet, rounded
     state boxes with {invariant} compartments, final states double-bordered,
     transitions as `operation [guard]` edges. Layout: dagre TB; self-loops are
     drawn as an arc on the right of their state (dagre never sees them). */

  const SM_HEAD = 33, SM_ROW = 16, SM_DOT = 16;

  /* mirrors .specy-state CSS: name row + optional invariants compartment */
  function stateSize(s) {
    let w = 36 + s.name.length * 7;
    const invs = s.invariants || [];
    for (const inv of invs) w = Math.max(w, 30 + (inv.length + 4) * 5.8);
    w = Math.max(110, Math.min(Math.round(w), 250));
    let hgt = SM_HEAD + (invs.length ? 6 + invs.length * SM_ROW : 0);
    if (s.final && invs.length) hgt += 3;
    return { width: w, height: hgt };
  }

  const smLabel = t => t.operation + (t.guard ? ` [${t.guard.length > 30 ? t.guard.slice(0, 29) + "…" : t.guard}]` : "");

  function smEdge(id, source, target, t, type, data) {
    return {
      id, source, target, type: type || "default", data,
      label: smLabel(t) || undefined,
      style: { stroke: "#172741", strokeWidth: 1.2 },
      markerEnd: { type: RF.MarkerType.ArrowClosed, width: 15, height: 15, color: "#172741" },
      labelStyle: { fontFamily: '"Fira Code", monospace', fontSize: 9, fill: "#4b5d6c", letterSpacing: "0.05em" },
      labelBgStyle: { fill: "#f6f7f8", fillOpacity: 0.92 },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 2,
    };
  }

  /* does the source-bottom → target-top curve, bowed sideways by k (0 =
     straight), cross another state? The bow offset follows the bezier bell. */
  function smCrosses(g, from, to, k) {
    const s = g.node(from), t = g.node(to);
    for (const name of g.nodes()) {
      if (name === from || name === to) continue;
      const n = g.node(name);
      if (n.y <= s.y || n.y >= t.y) continue;
      const fr = (n.y - s.y) / (t.y - s.y);
      const lx = s.x + fr * (t.x - s.x) + 3 * fr * (1 - fr) * (k || 0);
      if (Math.abs(lx - n.x) < n.width / 2 + 26) return true;
    }
    return false;
  }

  /* long transition needing a reroute → the bow offset that clears obstacles */
  function smBowOffset(g, from, to) {
    const s = g.node(from), t = g.node(to);
    if (t.y - s.y < s.height / 2 + t.height / 2 + 80) return 0;
    if (!smCrosses(g, from, to, 0)) return 0;
    for (const k of [-110, 110, -180, 180])
      if (!smCrosses(g, from, to, k)) return k;
    return -110;
  }

  function buildStateGraph(sm) {
    const sizes = {};
    for (const s of sm.states) sizes[s.name] = stateSize(s);

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "TB", nodesep: 55, ranksep: 65, marginx: 24, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));

    const hasStart = sm.starts.length > 0 || sm.states.some(s => s.initial);
    if (hasStart) g.setNode("[*]", { width: SM_DOT, height: SM_DOT });
    for (const s of sm.states) g.setNode(s.name, sizes[s.name]);

    const starts = sm.starts.length ? sm.starts
      : sm.states.filter(s => s.initial).map(s => ({ to: s.name, operation: "" }));
    const flat = [], selfs = [];
    starts.forEach(t => flat.push({ from: "[*]", to: t.to, t }));
    for (const t of sm.transitions)
      (t.from === t.to ? selfs : flat).push({ from: t.from, to: t.to, t });
    for (const e of flat) g.setEdge(e.from, e.to);

    dagre.layout(g);

    /* fan the endpoints of plain edges across the node border so several
       transitions on one state don't knot at its center */
    const bySrc = {}, byTgt = {};
    for (const e of flat) {
      (bySrc[e.from] = bySrc[e.from] || []).push(e);
      (byTgt[e.to] = byTgt[e.to] || []).push(e);
    }
    for (const [name, list] of Object.entries(bySrc)) {
      list.sort((a, b) => g.node(a.to).x - g.node(b.to).x);
      const step = Math.min(30, (g.node(name).width - 20) / list.length);
      list.forEach((e, i) => {
        e.so = (i - (list.length - 1) / 2) * step;
        e.li = i - (list.length - 1) / 2;   // label stagger index
      });
    }
    for (const [name, list] of Object.entries(byTgt)) {
      list.sort((a, b) => g.node(a.from).x - g.node(b.from).x);
      const step = Math.min(30, (g.node(name).width - 20) / list.length);
      list.forEach((e, i) => { e.to2 = (i - (list.length - 1) / 2) * step; });
    }

    const edges = flat.map((e, i) => {
      const up = g.node(e.to).y < g.node(e.from).y - 10;
      if (up) return smEdge("t" + i, e.from, e.to, e.t, "bow", { side: -1, back: true });
      const k = smBowOffset(g, e.from, e.to);
      if (k) return smEdge("t" + i, e.from, e.to, e.t, "bow", { k });
      return smEdge("t" + i, e.from, e.to, e.t, "fan", { so: e.so, to: e.to2, li: e.li });
    });
    const selfIdx = {};
    selfs.forEach((e, i) => {
      const n = selfIdx[e.from] || 0;
      selfIdx[e.from] = n + 1;
      edges.push(smEdge("self" + i, e.from, e.to, e.t, "selfloop", { w: sizes[e.from].width, n }));
    });

    const nodes = [];
    if (hasStart) {
      const p = g.node("[*]");
      nodes.push({ id: "[*]", type: "smInitial", position: { x: p.x - SM_DOT / 2, y: p.y - SM_DOT / 2 } });
    }
    for (const s of sm.states) {
      const p = g.node(s.name), sz = sizes[s.name];
      nodes.push({ id: s.name, type: "smState", position: { x: p.x - sz.width / 2, y: p.y - sz.height / 2 }, data: { st: s, width: sz.width } });
    }
    return { nodes, edges, height: (g.graph().height || 0) + 20 };
  }

  const smHandles = () => [
    h(RF.Handle, { key: "t", type: "target", position: RF.Position.Top, className: "specy-handle" }),
    h(RF.Handle, { key: "s", type: "source", position: RF.Position.Bottom, className: "specy-handle" }),
  ];

  function StateNode({ data }) {
    const s = data.st;
    return h("div", {
      className: "specy-state" + (s.final ? " final" : ""),
      style: { width: data.width },
      title: s.description ? `${s.name} — ${s.description}` : s.name,
    },
      smHandles(),
      h("div", { className: "specy-state-name" }, s.name),
      (s.invariants || []).length
        ? h("div", { className: "specy-state-invs" },
            s.invariants.map((n, i) => h("div", { className: "specy-state-inv", key: i, title: "invariant " + n }, `{ ${n} }`)))
        : null);
  }

  function InitialNode() {
    return h("div", { className: "specy-sm-initial", title: "initial" }, smHandles());
  }

  const baseEdgeProps = (props, path, labelX, labelY) => ({
    id: props.id, path, labelX, labelY,
    label: props.label, labelStyle: props.labelStyle,
    labelBgStyle: props.labelBgStyle, labelBgPadding: props.labelBgPadding,
    labelBgBorderRadius: props.labelBgBorderRadius,
    style: props.style, markerEnd: props.markerEnd,
  });

  /* bottom-center → arc around the right side → top-center of the same state;
     the label sits right of the arc, clear of the node (data.w = node width).
     data.n nests several loops on the same state outward with stepped labels. */
  function SelfLoopEdge(props) {
    const { sourceX, sourceY, targetX, targetY } = props;
    const d = props.data || {};
    const halfW = (d.w || 140) / 2;
    const n = d.n || 0;
    const cx = sourceX + halfW + 62 + n * 34;
    const path = `M ${sourceX},${sourceY} C ${cx},${sourceY + 40 + n * 10} ${cx},${targetY - 40 - n * 10} ${targetX},${targetY}`;
    const labelX = sourceX + halfW + 14 + n * 34 + (props.label ? String(props.label).length * 2.8 : 0);
    return h(RF.BaseEdge, baseEdgeProps(props, path, labelX, (sourceY + targetY) / 2 + n * 16));
  }

  /* transition rerouted sideways: either a long edge whose straight line would
     cross other states (data.k = signed bow offset), or a back-transition
     (target above source, data.back — arcs around the side, label outside) */
  function BowEdge(props) {
    const { sourceX, sourceY, targetX, targetY } = props;
    const d = props.data || {};
    let path, labelX;
    if (d.back) {
      const side = d.side || -1;
      const bx = (side < 0 ? Math.min(sourceX, targetX) : Math.max(sourceX, targetX)) + side * 110;
      path = `M ${sourceX},${sourceY} C ${bx},${sourceY + 50} ${bx},${targetY - 50} ${targetX},${targetY}`;
      labelX = bx + side * ((props.label ? String(props.label).length * 2.8 : 0) + 8);
    } else {
      const k = d.k || -110;
      const dy = (targetY - sourceY) / 3;
      path = `M ${sourceX},${sourceY} C ${sourceX + k},${sourceY + dy} ${targetX + k},${targetY - dy} ${targetX},${targetY}`;
      labelX = (sourceX + targetX) / 2 + k * 0.75;
    }
    return h(RF.BaseEdge, baseEdgeProps(props, path, labelX, (sourceY + targetY) / 2));
  }

  /* plain downward transition with fanned endpoints (data.so / data.to are
     horizontal offsets from the source-bottom / target-top handle centers;
     data.li staggers sibling labels vertically) */
  function FanEdge(props) {
    const d = props.data || {};
    const sx = props.sourceX + (d.so || 0), sy = props.sourceY;
    const tx = props.targetX + (d.to || 0), ty = props.targetY;
    const pull = Math.max(28, (ty - sy) * 0.38);
    const path = `M ${sx},${sy} C ${sx},${sy + pull} ${tx},${ty - pull} ${tx},${ty}`;
    return h(RF.BaseEdge, baseEdgeProps(props, path, (sx + tx) / 2, (sy + ty) / 2 + (d.li || 0) * 14));
  }

  const SM_NODE_TYPES = { smState: StateNode, smInitial: InitialNode };
  const SM_EDGE_TYPES = { selfloop: SelfLoopEdge, bow: BowEdge, fan: FanEdge };

  function StateMachineApp({ nodes, edges }) {
    return h(RF.ReactFlow, {
      defaultNodes: nodes,
      defaultEdges: edges,
      nodeTypes: SM_NODE_TYPES,
      edgeTypes: SM_EDGE_TYPES,
      fitView: true,
      fitViewOptions: { padding: 0.12, maxZoom: 1 },
      minZoom: 0.3,
      maxZoom: 1.5,
      nodesConnectable: false,
      deleteKeyCode: null,
      /* the diagram lives inside a scrolling detail page — let wheel events scroll it */
      zoomOnScroll: false,
      panOnScroll: false,
      preventScrolling: false,
    },
      h(RF.Background, { variant: "dots", gap: 18, size: 1.1, color: "#d5d9dd" }),
      h(RF.Controls, { showInteractive: false, position: "bottom-right" }));
  }

  /* ============ Mount / unmount ============ */

  let roots = [];
  function unmount() { for (const r of roots) r.unmount(); roots = []; }
  function mount(container, mod, context, show) {
    unmount();
    const { nodes, edges } = buildGraph(mod, context, show);
    const root = ReactDOM.createRoot(container);
    root.render(h(DiagramApp, { nodes, edges }));
    roots.push(root);
  }

  /* Mount one state diagram per `[data-sm-host]` placeholder rendered by
     stateMachineCards (app.js). Called after the detail innerHTML is set. */
  function mountStateMachines(container, stateMachines) {
    for (const hostEl of container.querySelectorAll("[data-sm-host]")) {
      const sm = stateMachines[Number(hostEl.dataset.smHost)];
      if (!sm || !sm.states.length) { hostEl.remove(); continue; }
      const { nodes, edges, height } = buildStateGraph(sm);
      hostEl.style.height = Math.max(180, Math.min(height + 40, 520)) + "px";
      const root = ReactDOM.createRoot(hostEl);
      root.render(h(StateMachineApp, { nodes, edges }));
      roots.push(root);
    }
  }

  return { mount, unmount, mountStateMachines, MAIN_KINDS, countVisible, DEFAULT_SHOW };
})();

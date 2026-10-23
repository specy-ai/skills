/* Specy Navigator → Specy Diagram Engine: software-architecture converter.
   Pure function (no DOM, no React) turning the parsed .arch shape
   (arch-parser.js) into a DiagramFile for the engine bundle, per
   diagram-engine/docs/DERIVED-DIAGRAMS.md §7 (groups) and §8
   (software-architecture):
     - architectureDiagram(arch, show, opts) → metamodel "software-architecture"
   The system in focus is a foldable `er-group` (kind "system") holding the
   containers; a container with components (or a broker with channels) is a
   nested `er-group`, a black-box container an `er-concept`. The group fold
   levels are the C4 zoom levels: system folded = L1 context, containers
   folded = L2 containers, everything open = L3 components. Nodes carry no
   position and only a width: the engine lays the nested groups out itself
   (`layout.engine "dagre"`) and derives the edge sides (`handles: "auto"`).
     - landscapeDiagram(arch, show, opts) → the level-0 overview of an
   `organization` file, same metamodel and layout contract: areas are
   `er-group`s (kind "area"), each system one card (role, product, mastered
   and handled concepts), each dependency one directed edge downstream →
   upstream labelled with its flow numbers. Its canvas-only styles (the
   `area` group, the system card, the handle offsets that keep two opposite
   edges apart) are in arch-landscape.css.
     - conceptLandscapeDiagram(arch, show, opts) → the same organization at
   concept granularity: each system is an `er-group` holding one card per
   concept it `masters` or `handles` (resolved against the domain model
   through `opts.resolution`, the resolveAll() summary of arch-concepts.js),
   the systems grouped by area, the same dependency edges between the
   system nodes — folding the systems gives the landscape back. Optional
   flow edges, concept to concept; optional group of the domain concepts no
   system names. Styles: arch-landscape.css (`.concept-card`). */

"use strict";

const SpecyArchDiagrams = (() => {

  /* Toggle map of the diagram bar */
  const DEFAULT_SHOW = { persons: true, externalSystems: true, channels: true, edgeLabels: true };

  /* kind → eyebrow label and colours — mirrors the engine's
     EntityRelationApp.css `.er-node--kind-*` rules (and the `system` group's
     dashed boundary) so the host legend matches the canvas */
  const KIND_LEGEND = {
    person:         { label: "Person",          color: "#d6dff0", border: "#9fb1d6" },
    externalSystem: { label: "External system", color: "#ececec", border: "#9a9a9a" },
    system:         { label: "System",          color: "#eef2f9", border: "#5b7bb5", dashed: true },
    container:      { label: "Container",       color: "#f7f9fc", border: "#9fb1d6" },
    component:      { label: "Component",       color: "#ffffff", border: "#3a3f46" },
    channel:        { label: "Channel",         color: "#f6efe2", border: "#b7a480" },
    /* level 0 (landscapeDiagram): the group of an area — arch-landscape.css `.group-node--kind-area` */
    area:           { label: "Area",            color: "#f8f5ee", border: "#b7a480" },
  };

  const LAYOUT = { engine: "dagre", rankdir: "TB", nodesep: 40, ranksep: 90, handles: "auto" };
  const WIDTH = { person: 190, concept: 230 };
  const FOLDED_WIDTH = { system: 320, container: 240 };
  /* A folded (level 1) or name-only group box shows its whole name: its
     header also holds the ⋯ menu and the 1|2|3 control (~120 px), and the
     title runs at ~7.4 px per character (11pt condensed bold; 13pt for the
     system). */
  const foldedWidthFor = (name, min, perChar) =>
    Math.round(Math.min(420, Math.max(min, 124 + perChar * String(name || "").length)));

  const ACCENT = "#F65D60";
  const EDGE_STYLE = {
    sync:      { stroke: ACCENT, strokeWidth: 1.8 },
    async:     { stroke: ACCENT, strokeWidth: 1.6, strokeDasharray: "6 4" },
    streaming: { stroke: ACCENT, strokeWidth: 1.6, strokeDasharray: "2 3" },
  };
  const LABEL_MAX = 32;

  const modelIdOf = arch => `${arch.id}-architecture`;

  /* ---- small helpers ---- */
  const cap = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
  const shortProtocol = p => String(p || "").split(" (")[0].trim();
  const norm = s => String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[^a-z0-9]/g, "");   // NFD splits accents off, then they go too
  const list = a => (a || []).filter(Boolean);

  function row(key, values) {
    const v = Array.isArray(values) ? list(values) : values;
    if (!v || (Array.isArray(v) && !v.length)) return null;
    return { key, value: Array.isArray(v) ? v.join(", ") : v };
  }
  function kv(rows) {
    const kept = rows.filter(Boolean);
    return kept.length ? { kind: "kv", rows: kept } : undefined;
  }
  /* `realizes` refs as body text: modules quoted (they are multi-word names
     in .domain), the other kinds prefixed with their keyword */
  const realizesText = refs => list(refs).map(r => (r.kind === "module" ? `"${r.name}"` : `${r.kind} ${r.name}`));
  /* `publishes A, B → ch1; C → ch2` */
  function publishesText(pubs) {
    const byChannel = new Map();
    for (const p of list(pubs)) {
      if (!byChannel.has(p.channel)) byChannel.set(p.channel, []);
      byChannel.get(p.channel).push(p.event);
    }
    return [...byChannel].map(([ch, evs]) => `${evs.join(", ")} → ${ch || "?"}`).join("; ");
  }

  /* ---- domain navigation: `realizes module "…"` / `realizes context X`
     resolved by name in the organization parsed from the .arch's
     domain-source; ids are app.js INDEX keys (`mod:<module id>`, `ctx:<context id>`) ---- */
  function domainResolver(org) {
    const modules = new Map(), contexts = new Map();
    for (const c of (org && org.contexts) || []) {
      for (const k of [c.name, c.shortname]) if (k && !contexts.has(norm(k))) contexts.set(norm(k), c);
      for (const m of c.modules || []) if (!modules.has(norm(m.name))) modules.set(norm(m.name), m);
    }
    return ref => {
      if (ref.kind === "module") {
        const m = modules.get(norm(ref.name));
        return m ? { id: "mod:" + m.id, label: `Open module "${m.name}"` } : null;
      }
      if (ref.kind === "context") {
        const c = contexts.get(norm(ref.name));
        return c ? { id: "ctx:" + c.id, label: `Open context "${c.name}"` } : null;
      }
      return null;
    };
  }

  /* ---- the model and the diagram under construction: `add` makes one
     model element and its node; ids come from the name, a clash is prefixed
     with the type ---- */
  function sheet(modelId) {
    const elements = [], relations = [];
    const nodes = [], edges = [];
    const usedIds = new Set();
    const parentOf = new Map();     // node id → parent node id

    const uniqueId = (name, type) => {
      const base = String(name).replace(/[^\w.-]+/g, "-") || type;
      let id = base;
      if (usedIds.has(id)) id = `${type}-${base}`;
      for (let i = 2; usedIds.has(id); i++) id = `${type}-${base}-${i}`;
      usedIds.add(id);
      return id;
    };

    /* `display` is shared by the element and its node, `extra` only lands on
       the element (raw .arch data), `nodeProps` and `link` only on the node;
       without `nodeProps` the element is kept in the model and not drawn */
    function add(type, name, display, extra, nodeProps, link) {
      const id = uniqueId(name, type);
      const nodeId = "node-" + id;
      elements.push({ id, type, data: Object.assign({}, display, extra || {}) });
      if (!nodeProps) return { elementId: id, nodeId: null };
      const node = Object.assign({ id: nodeId }, nodeProps, {
        data: Object.assign({ modelRef: { modelId, elementId: id } }, display, link || {}),
      });
      if (node.parentId) { node.extent = "parent"; parentOf.set(nodeId, node.parentId); }
      nodes.push(node);
      return { elementId: id, nodeId };
    }
    return { elements, relations, nodes, edges, parentOf, add };
  }

  /* ============ Architecture diagram ============ */

  function architectureDiagram(arch, show, opts) {
    show = Object.assign({}, DEFAULT_SHOW, show || {});
    opts = opts || {};
    const report = opts.report || {};
    for (const k of ["unresolved", "dropped", "merged", "domainRefs"]) report[k] = [];

    const modelId = modelIdOf(arch);
    /* one system in focus, or a landscape (several `system` blocks, see
       scripts/merge-arch.mjs): each system is its own foldable group */
    const systems = list(arch.systems && arch.systems.length ? arch.systems : [arch.system || {}]);
    const resolveDomain = domainResolver(opts.domainOrg);

    const { elements, relations, nodes, edges, parentOf, add } = sheet(modelId);
    const byName = new Map();       // .arch name → { elementId, nodeId, kind, visible }
    /* An `organization` file (level 0) holds several systems whose member
       names are local to them: its elements are also kept by path
       (`container:System/Container`), and its connector ends, which the
       parser resolved, are looked up there instead of by bare name. */
    const org = arch.root === "organization";
    const scoped = new Map();       // `kind:path` → the same entries as byName

    /* domainRef + declared "Open …" action for the first resolvable ref */
    function domainLink(elementId, refs) {
      let hit = null;
      for (const r of list(refs)) {
        if (r.kind !== "module" && r.kind !== "context") continue;
        const res = opts.domainOrg ? resolveDomain(r) : null;
        report.domainRefs.push({ elementId, ref: `${r.kind} ${r.name}`, resolved: res ? res.id : null });
        if (res && !hit) hit = res;
      }
      return hit ? { domainRef: { id: hit.id }, actions: [{ label: hit.label, navigate: true }] } : {};
    }

    const register = (name, entry, path) => {
      if (name && !byName.has(name)) byName.set(name, entry);
      if (path && !scoped.has(path)) scoped.set(path, entry);
    };

    /* ---- persons (top level; first in the name index on a name clash) ---- */
    for (const p of list(arch.persons)) {
      if (!show.persons) { register(p.name, { kind: "person", visible: false }, "person:" + p.name); continue; }
      const r = add("person", p.name,
        { name: p.name, kind: "person", kindLabel: KIND_LEGEND.person.label, subtitle: p.description || "" },
        null, { type: "er-concept", style: { width: WIDTH.person } });
      register(p.name, Object.assign({ kind: "person", visible: true }, r), "person:" + p.name);
    }

    const containerNode = new Map();   // container → node id
    const channelNode = new Map();     // channel name → { elementId, nodeId }
    const systemOf = new Map();        // container → name of its system
    /* a channel is looked up by name; in an organization file, within its system */
    const channelKey = (sysName, name) => (org ? sysName + "/" + name : name);
    const allContainers = [];
    for (const sys of systems) {
      const containers = list(sys.containers);
      const channels = show.channels ? list(sys.channels) : [];
      const sysName = sys.name || arch.name;

      /* ---- the system (a group when it has containers or channels) ---- */
      const sysNode = containers.length || channels.length
        ? add("system", sysName,
            { name: sysName, kind: "system", kindLabel: KIND_LEGEND.system.label,
              // a landscape opens on its systems (C4 landscape), one system in focus opened
              subtitle: sys.description || "", level: systems.length > 1 ? 1 : 3,
              foldedWidth: foldedWidthFor(sysName, FOLDED_WIDTH.system, 8.8) },
            { description: sys.description || "", satisfies: list(sys.satisfies),
              realizes: realizesText(sys.realizes), boundedContexts: list(sys.boundedContexts).map(b => b.name) },
            { type: "er-group" }, domainLink(sysName, sys.realizes))
        : !org
        ? add("system", sysName,
            { name: sysName, kind: "system", kindLabel: KIND_LEGEND.system.label,
              subtitle: sys.description || "" },
            { description: sys.description || "", satisfies: list(sys.satisfies) },
            { type: "er-concept", style: { width: WIDTH.concept } })
        /* organization file: a system not detailed here is a black box — its
           role, the product behind it, and the context it realizes */
        : add("system", sysName,
            { name: sysName, kind: "system", kindLabel: KIND_LEGEND.system.label,
              subtitle: sys.technology || "" },
            { description: sys.description || "", satisfies: list(sys.satisfies), technology: sys.technology || "",
              realizes: realizesText(sys.realizes), detail: sys.detail || "none" },
            { type: "er-concept", style: { width: WIDTH.concept } }, domainLink(sysName, sys.realizes));
      // a connector end naming a whole system lands on its box
      register(sysName, Object.assign({ kind: "system", visible: true }, sysNode), "system:" + sysName);

      /* ---- containers: group iff it has members (components, or hosted channels) ---- */
      const channelsOn = new Map();
      const containerNames = new Set(containers.map(c => c.name));
      for (const ch of channels) {
        const host = containerNames.has(ch.broker) ? ch.broker : "";
        if (!channelsOn.has(host)) channelsOn.set(host, []);
        channelsOn.get(host).push(ch);
      }
      const byContainerName = new Map();
      for (const c of containers) {
        const isGroup = list(c.components).length > 0 || (channelsOn.get(c.name) || []).length > 0;
        const raw = { description: c.description || "", technology: c.technology || "",
          provides: list(c.provides), requires: list(c.requires), satisfies: list(c.satisfies),
          realizes: realizesText(c.realizes), system: sysName };
        const base = { name: c.name, kind: "container", kindLabel: KIND_LEGEND.container.label, subtitle: c.technology || "" };
        const r = isGroup
          ? add("container", c.name, Object.assign(base, { level: 3, foldedWidth: foldedWidthFor(c.name, FOLDED_WIDTH.container, 7.4) }), raw,
              { type: "er-group", parentId: sysNode.nodeId }, domainLink(c.name, c.realizes))
          : add("container", c.name, Object.assign(base, {
                align: "left",
                attributes: c.description ? [c.description] : [],
                body: kv([row("provides", c.provides), row("requires", c.requires),
                  row("realizes", realizesText(c.realizes)), row("satisfies", c.satisfies)]),
              }), raw,
              { type: "er-concept", parentId: sysNode.nodeId, style: { width: WIDTH.concept } }, domainLink(c.name, c.realizes));
        containerNode.set(c, r.nodeId);
        byContainerName.set(c.name, r.nodeId);
        systemOf.set(c, sysName);
        allContainers.push(c);
        register(c.name, Object.assign({ kind: "container", visible: true }, r), `container:${sysName}/${c.name}`);
      }

      /* ---- components (inside their container) ---- */
      for (const c of containers) {
        for (const k of list(c.components)) {
          const r = add("component", k.name, {
            name: k.name, kind: "component", kindLabel: KIND_LEGEND.component.label, align: "left",
            subtitle: k.boundedContext ? `«${k.boundedContext}»` : "",
            attributes: k.description ? [k.description] : [],
            body: kv([
              row("provides", k.provides), row("requires", k.requires),
              row("publishes", publishesText(k.publishes)), row("subscribes", k.subscribes),
              row("realizes", realizesText(k.realizes)), row("satisfies", k.satisfies),
            ]),
          }, Object.assign({ description: k.description || "", container: c.name, boundedContext: k.boundedContext || "" },
            org ? { system: sysName } : null),
          { type: "er-concept", parentId: containerNode.get(c), style: { width: WIDTH.concept } },
          domainLink(k.name, k.realizes));
          register(k.name, Object.assign({ kind: "component", visible: true }, r), `component:${sysName}/${c.name}/${k.name}`);
        }
      }

      /* ---- channels (inside their broker; in the system when the broker is unknown) ---- */
      for (const ch of channels) {
        const r = add("channel", ch.name, {
          name: ch.name, kind: "channel", kindLabel: KIND_LEGEND.channel.label, align: "left",
          subtitle: ch.broker ? `on ${ch.broker}` : "",
          attributes: ch.description ? [ch.description] : [],
          body: kv([row("carries", ch.carries)]),
        }, { description: ch.description || "", broker: ch.broker || "" },
        { type: "er-concept", parentId: byContainerName.get(ch.broker) || sysNode.nodeId, style: { width: WIDTH.concept } });
        if (!channelNode.has(channelKey(sysName, ch.name))) channelNode.set(channelKey(sysName, ch.name), r);
      }
    }

    /* ---- external systems (top level, after the system so they rank below it) ---- */
    for (const x of list(arch.externalSystems)) {
      if (!show.externalSystems) { register(x.name, { kind: "externalSystem", visible: false }, "externalSystem:" + x.name); continue; }
      const r = add("externalSystem", x.name, {
        name: x.name, kind: "externalSystem", kindLabel: KIND_LEGEND.externalSystem.label, align: "left",
        subtitle: x.description || "",
        body: kv([row("provides", x.provides), row("consumes", x.consumes), row("realizes", realizesText(x.realizes))]),
      }, null, { type: "er-concept", style: { width: WIDTH.concept } }, domainLink(x.name, x.realizes));
      register(x.name, Object.assign({ kind: "externalSystem", visible: true }, r), "externalSystem:" + x.name);
    }

    /* ============ relations + edges ============ */

    const isAncestor = (a, b) => { for (let p = parentOf.get(b); p; p = parentOf.get(p)) if (p === a) return true; return false; };
    const related = (a, b) => a === b || isAncestor(a, b) || isAncestor(b, a);
    const edgeByKey = new Map();
    const partsOf = new Map();        // merged edge → [{ iface, proto }] of its connectors

    /* parallel connectors over one protocol: `A / B · SSO`; over several:
       `2 connectors · SSO, HTTPS` (each one stays in `data.description`) */
    function mergedLabel(parts) {
      const byProto = new Map();
      for (const { iface, proto } of parts) {
        if (!byProto.has(proto)) byProto.set(proto, []);
        const ifs = byProto.get(proto);
        if (iface && !ifs.includes(iface)) ifs.push(iface);
      }
      if (byProto.size > 1) return cap(`${parts.length} connectors · ${[...byProto.keys()].join(", ")}`, LABEL_MAX);
      const [[proto, ifs]] = [...byProto];
      return cap(ifs.length ? `${ifs.join(" / ")} · ${proto}` : proto, LABEL_MAX);
    }

    function addEdge(key, rel, srcNode, tgtNode, style, label, description, part) {
      const existing = key && edgeByKey.get(key);
      if (existing) {
        const d = existing.data;
        d.relationIds.push(rel.id);
        const parts = partsOf.get(existing);
        if (part) parts.push(part);
        if (show.edgeLabels && parts.length) d.label = mergedLabel(parts);
        d.description = [d.description, description].filter(Boolean).join("\n");
        return;
      }
      const data = { modelRef: { modelId, relationId: rel.id }, relationIds: [rel.id] };
      if (label && show.edgeLabels) data.label = label;
      data.description = description || "";
      data.points = [];
      const edge = { id: "edge-" + rel.id, source: srcNode, target: tgtNode, type: "er-edge",
        markerEnd: "er-arrow", style: Object.assign({}, EDGE_STYLE[style] || EDGE_STYLE.sync), data };   // bare marker id: see LANDSCAPE_ARROW
      edges.push(edge);
      if (key) { edgeByKey.set(key, edge); partsOf.set(edge, part ? [part] : []); }
    }

    /* connectors: an endpoint resolves by the name before the dot, the rest
       is the interface; in a deeper ref (`Container.Component.Iface`) the
       innermost known element before the interface wins */
    function endpoint(ep) {
      const parts = [ep.name].concat(ep.iface ? String(ep.iface).split(".") : []);
      let at = 0;
      for (let i = 1; i < parts.length - 1; i++) if (byName.has(parts[i])) at = i;
      return { name: parts[at], entry: byName.get(parts[at]), iface: parts.slice(at + 1).join(".") };
    }
    /* organization file: the parser resolved each end within its system
       (`kind`, `system`, `container`, `component`, `interface`) */
    function scopedEndpoint(ep) {
      const path = ep.kind === "component" ? `component:${ep.system}/${ep.container}/${ep.component}`
        : ep.kind === "container" ? `container:${ep.system}/${ep.container}`
        : ep.kind === "system" ? `system:${ep.system}`
        : ep.kind ? `${ep.kind}:${ep.name}` : "";
      return { name: ep.name, entry: scoped.get(path), iface: ep.interface || "" };
    }
    const endOf = org ? scopedEndpoint : endpoint;
    for (const c of systems.flatMap(sys => list(sys.connectors))) {
      const from = endOf(c.from), to = endOf(c.to);
      const src = from.entry, tgt = to.entry;
      if (!src || !tgt) {
        if (!src) report.unresolved.push({ id: c.id, side: "from", name: from.name });
        if (!tgt) report.unresolved.push({ id: c.id, side: "to", name: to.name });
        continue;
      }
      if (!src.visible || !tgt.visible) {
        report.dropped.push({ id: c.id, reason: `hidden ${(!src.visible ? src : tgt).kind}` });
        continue;
      }
      const style = EDGE_STYLE[c.style] ? c.style : "sync";
      const iface = to.iface || from.iface || "";
      const proto = shortProtocol(c.protocol);
      const rel = { id: c.id, type: "connect", sourceElementId: src.elementId, targetElementId: tgt.elementId,
        data: { interface: iface || undefined, protocol: c.protocol || "", style, description: c.description || "" } };
      relations.push(rel);
      if (related(src.nodeId, tgt.nodeId)) {
        /* kept in the model, not drawn: a stub into its own group header that
           would become a self-loop once the group folds (§8) */
        report.dropped.push({ id: c.id, reason: src.nodeId === tgt.nodeId ? "self loop" : "own container" });
        continue;
      }
      const label = cap(iface ? `${iface} · ${proto}` : proto, LABEL_MAX);
      const description = (iface ? iface + ": " : "") + (c.protocol || "") + ` (${style})` + (c.description ? " — " + c.description : "");
      addEdge(`connect|${src.nodeId}|${tgt.nodeId}|${style}`, rel, src.nodeId, tgt.nodeId, style, label, description,
        { iface, proto });
    }
    for (const e of edges) if (e.data.relationIds.length > 1) report.merged.push({ edgeId: e.id, relationIds: e.data.relationIds.slice() });

    /* publishes (merged per component × channel) and subscribes */
    if (show.channels) {
      let p = 0, s = 0;
      for (const c of allContainers) {
        for (const k of list(c.components)) {
          const sysName = systemOf.get(c);
          const comp = org ? scoped.get(`component:${sysName}/${c.name}/${k.name}`) : byName.get(k.name);
          if (!comp || comp.kind !== "component") continue;
          const perChannel = new Map();
          for (const pub of list(k.publishes)) {
            if (!perChannel.has(pub.channel)) perChannel.set(pub.channel, []);
            const evs = perChannel.get(pub.channel);
            if (!evs.includes(pub.event)) evs.push(pub.event);
          }
          for (const [chName, messages] of perChannel) {
            const ch = channelNode.get(channelKey(sysName, chName));
            if (!ch) { report.unresolved.push({ id: `publishes ${k.name} → ${chName}`, side: "to", name: chName }); continue; }
            const rel = { id: "p" + (++p), type: "publishes", sourceElementId: comp.elementId, targetElementId: ch.elementId, data: { messages } };
            relations.push(rel);
            addEdge(null, rel, comp.nodeId, ch.nodeId, "async",
              cap("publishes " + messages.join(", "), LABEL_MAX), `publishes ${messages.join(", ")} to ${chName}`);
          }
          for (const chName of list(k.subscribes)) {
            const ch = channelNode.get(channelKey(sysName, chName));
            if (!ch) { report.unresolved.push({ id: `subscribes ${k.name} → ${chName}`, side: "to", name: chName }); continue; }
            const rel = { id: "s" + (++s), type: "subscribes", sourceElementId: comp.elementId, targetElementId: ch.elementId, data: {} };
            relations.push(rel);
            addEdge(null, rel, comp.nodeId, ch.nodeId, "async", "subscribes", `subscribes to ${chName}`);
          }
        }
      }
    }

    const name = systems.length > 1
      ? `${arch.name} — software architecture (${systems.length} systems)`
      : `${systems[0].name || arch.name} — software architecture`;
    return {
      version: 1,
      model: { id: modelId, name, metamodel: "software-architecture", elements, relations },
      diagram: { id: modelId + "#architecture", name, layout: Object.assign({}, LAYOUT), nodes, edges },
    };
  }

  /* number of element nodes drawn with this toggle map */
  function countVisible(arch, show) {
    show = Object.assign({}, DEFAULT_SHOW, show || {});
    const systems = list(arch.systems && arch.systems.length ? arch.systems : [arch.system || {}]);
    return systems.length
      + (show.persons ? list(arch.persons).length : 0)
      + (show.externalSystems ? list(arch.externalSystems).length : 0)
      + systems.reduce((n, sys) => n
        + list(sys.containers).reduce((m, c) => m + 1 + list(c.components).length, 0)
        + (show.channels ? list(sys.channels).length : 0), 0);
  }

  /* ============ Landscape diagram (level 0 — an `organization` file) ============
     The overview of the organization: its systems grouped by area, what each
     one masters and handles, and the dependencies between them. A dependency
     `A -> B` is one edge from A (downstream) to B (upstream): the arrowhead is
     on the system depended upon. Two opposite dependencies stay two edges. */

  /* Toggle map of the landscape's diagram bar; `concepts` are the masters /
     handles rows of the cards */
  const LANDSCAPE_DEFAULT_SHOW = { externalSystems: true, persons: false, edgeLabels: true, concepts: true };

  const landscapeModelIdOf = arch => `${arch.id}-landscape`;

  /* Areas side by side (LR); inside an area the systems stack along their
     dependencies (TB): a dependency inside an area runs up or down, one
     between two areas runs sideways, so the two kinds leave a card by
     different sides. The gaps are sized for the edge labels (one line, at
     most LANDSCAPE_LABEL_MAX characters, at mid-edge). A system with no
     dependency inside its area goes to the area's shelf, one column wide. */
  const LANDSCAPE_LAYOUT = { engine: "dagre", rankdir: "LR", nodesep: 90, ranksep: 170, handles: "auto" };
  const AREA_LAYOUT = { rankdir: "TB", nodesep: 90, ranksep: 110, shelfColumns: 1 };
  const LANDSCAPE_WIDTH = { card: 250, person: 190 };
  /* Every card of the landscape carries this class (React Flow copies a
     node's `className` onto its wrapper): arch-landscape.css offsets its
     source and target handles, which keeps the two edges of a mutual pair
     apart — the engine draws both between the same two points otherwise.
     A card whose first row is `masters` also says so, for the row to be set
     heavier than the others. */
  const LANDSCAPE_CARD_CLASS = "landscape-card";
  const MASTERS_CLASS = "landscape-card--masters";
  /* a system detailed in containers and components: the one card whose
     eyebrow the Navigator shows (the others say their kind by colour) */
  const DETAILED_CLASS = "landscape-card--detailed";

  /* kind → label and colours of what the landscape draws, for the host
     legend: here a system is a card, where KIND_LEGEND.system is the dashed
     boundary of the C4 view (arch-landscape.css `.er-node--kind-system`) */
  const LANDSCAPE_KIND_LEGEND = {
    area:           KIND_LEGEND.area,
    system:         { label: "System", color: "#f1f5fb", border: "#3573c3" },
    externalSystem: KIND_LEGEND.externalSystem,
    person:         KIND_LEGEND.person,
  };

  const CONCEPT_MAX = 6;            // names in a masters / handles row, then "+ N more"
  const HOTSPOT_MAX = 2;            // hotspot names on a card
  const ACTION_MAX = 12;            // "Open <Concept>" actions of a card: covers both full rows
  const LANDSCAPE_LABEL_MAX = 30;   // characters of an edge label

  /* How a dependency is drawn. Two independent channels, nothing else:
     the stroke width says `critical`, the colour says Partnership. */
  const NAVY = "#172741";
  const DEPENDENCY_STYLE = { stroke: ACCENT, strokeWidth: 1.8 };
  const CRITICAL_WIDTH = 3.6;
  const LANDSCAPE_LEGEND = [
    { key: "dependency", label: "depends on",
      description: "A → B: A depends on B. The arrowhead is on the system depended upon (upstream); the label gives the flow numbers, then the flow labels.",
      style: Object.assign({}, DEPENDENCY_STYLE) },
    { key: "critical", label: "critical dependency",
      description: "criticality critical: when the system depended upon is down, the dependent one is down.",
      style: Object.assign({}, DEPENDENCY_STYLE, { strokeWidth: CRITICAL_WIDTH }) },
    { key: "partnership", label: "Partnership",
      description: "One of the two dependencies of a Partnership pair. A pair is always two edges, one per direction.",
      style: Object.assign({}, DEPENDENCY_STYLE, { stroke: NAVY }) },
  ];
  /* The arrowhead, as the bare id of the engine's marker: React Flow wraps a
     string `markerEnd` into `url('#…')` itself, so the `url(#er-arrow)` form
     ends up as a reference to nothing and no head is drawn. A direction that
     does not show would defeat the whole diagram. */
  const LANDSCAPE_ARROW = "er-arrow";
  const dependencyStyle = (d, partnership) => Object.assign({}, DEPENDENCY_STYLE,
    partnership ? { stroke: NAVY } : null, d.criticality === "critical" ? { strokeWidth: CRITICAL_WIDTH } : null);

  /* a list capped as `a, b, c, + N more` */
  const capped = (items, max) => (items.length > max ? items.slice(0, max).concat(`+ ${items.length - max} more`) : items);

  /* flow numbers as text: a run of three or more becomes a range (`1–3`) */
  function numberRanges(numbers) {
    const ns = [...new Set(numbers.filter(n => typeof n === "number"))].sort((a, b) => a - b);
    const out = [];
    for (let i = 0; i < ns.length;) {
      let j = i;
      while (j + 1 < ns.length && ns[j + 1] === ns[j] + 1) j++;
      if (j - i >= 2) out.push(`${ns[i]}–${ns[j]}`);
      else for (let k = i; k <= j; k++) out.push(String(ns[k]));
      i = j + 1;
    }
    return out.join(", ");
  }

  /* `1–3 · Ad products, Accounts, …`: the flow numbers, then as many whole
     flow labels as fit LANDSCAPE_LABEL_MAX; a first label too long is cut */
  function flowsLabel(flows) {
    const numbers = numberRanges(flows.map(f => f.number));
    const names = flows.map(f => f.label).filter(Boolean);
    if (!names.length) return numbers;
    let text = (numbers ? numbers + " · " : "") + names[0];
    const room = more => LANDSCAPE_LABEL_MAX - (more ? 3 : 0);   // `, …` after the last label kept
    if (text.length > room(names.length > 1)) return cap(text, LANDSCAPE_LABEL_MAX);
    for (let i = 1; i < names.length; i++) {
      const next = text + ", " + names[i];
      if (next.length > room(i < names.length - 1)) return text + ", …";
      text = next;
    }
    return text;
  }

  /* the full list behind an edge label: one line per flow, `<n>. <label> — <concepts>` */
  const carriedText = c => (c.as ? `${c.concept.raw} as ${c.as.raw}` : c.concept.raw);
  const flowLine = f => `${f.number}. ${f.label || "(unnamed)"} — ${list(f.carries).map(carriedText).join(", ")}`;

  /* the areas, each name once (a second declaration of a name is a defect of
     the file, not a second group) */
  const landscapeAreas = arch => list(arch.areas).filter((a, i, all) => a.name && all.findIndex(x => x.name === a.name) === i);

  function landscapeDiagram(arch, show, opts) {
    show = Object.assign({}, LANDSCAPE_DEFAULT_SHOW, show || {});
    opts = opts || {};
    const report = opts.report || {};
    for (const k of ["unresolved", "dropped", "merged", "domainRefs", "concepts"]) report[k] = [];

    const modelId = landscapeModelIdOf(arch);
    const { elements, relations, nodes, edges, add } = sheet(modelId);

    /* ---- domain links: a concept resolves through the resolveAll() summary
       of arch-concepts.js; without it concepts are plain names ---- */
    const resolution = opts.resolution && typeof opts.resolution.of === "function" ? opts.resolution : null;
    const resolved = ref => {
      const x = resolution ? resolution.of(ref) : null;
      return x && x.status === "resolved" && x.id ? x : null;
    };
    /* the bounded contexts the references resolved into, by name (the summary
       carries no index of the contexts themselves) */
    const contexts = new Map();
    for (const r of list(resolution && resolution.references)) {
      const x = r.resolution;
      for (const d of !x ? [] : x.status === "resolved" ? [x] : list(x.candidates))
        if (d.context && d.contextId && !contexts.has(norm(d.context))) contexts.set(norm(d.context), { id: d.contextId, name: d.context });
    }
    /* what a card links to: double-click opens the first context the system
       realizes that resolves; the ⋯ menu opens each resolved concept, masters first */
    function domainLinks(holder) {
      const refs = list(holder.masters).concat(list(holder.handles));
      let ctx = null;
      for (const name of list(holder.contexts)) {
        /* by name; a context named by its shortname is known from the
           references the system resolved in its own contexts */
        const own = refs.map(resolved).find(x => x && x.via === "own-context" && x.contextId);
        const hit = contexts.get(norm(name)) || (list(holder.contexts).length === 1 && own ? { id: own.contextId, name: own.context } : null);
        report.domainRefs.push({ elementId: holder.name, ref: `context ${name}`, resolved: hit ? "ctx:" + hit.id : null });
        if (hit && !ctx) ctx = hit;
      }
      const actions = ctx ? [{ label: `Open context "${ctx.name}"`, navigate: true }] : [];
      const seen = new Set();
      for (const [site, items] of [["masters", holder.masters], ["handles", holder.handles]]) {
        for (const ref of list(items)) {
          const x = resolved(ref);
          report.concepts.push({ elementId: holder.name, site, ref: ref.raw, resolved: x ? x.id : null });
          if (!x || seen.has(x.id) || seen.size >= ACTION_MAX) continue;
          seen.add(x.id);
          actions.push({ label: `Open ${ref.raw}`, href: "#" + encodeURI(x.id) });
        }
      }
      return Object.assign(ctx ? { domainRef: { id: "ctx:" + ctx.id } } : {}, actions.length ? { actions } : {});
    }

    /* ---- cards ---- */
    const names = refs => list(refs).map(r => r.raw);
    /* The rows of a card: the concepts it is the source of truth for
       (`masters`, first and set heavier by the stylesheet), the other main
       concepts it holds (`handles`), and — with the persons shown — who works
       with it. `nodeProps` carries the card's classes. */
    function cardBody(holder) {
      const masters = show.concepts ? capped(names(holder.masters), CONCEPT_MAX) : [];
      return {
        body: kv([row("masters", masters), show.concepts ? row("handles", capped(names(holder.handles), CONCEPT_MAX)) : null,
          show.persons ? row("used by", list(holder.usedBy)) : null]),
        nodeProps: { type: "er-concept", className: LANDSCAPE_CARD_CLASS + (masters.length ? " " + MASTERS_CLASS : ""),
          style: { width: LANDSCAPE_WIDTH.card } },
      };
    }
    const facts = (x, more) => Object.assign({ description: x.description || "", technology: "", area: "", detail: "none", status: "" }, more);

    const ends = new Map();           // system / external system name → { elementId, nodeId, kind, visible }
    const landed = (name, entry) => { if (name && !ends.has(name)) ends.set(name, entry); };

    function systemCard(s, parentId) {
      const hotspots = list(s.hotspots).map(h => h.name).filter(Boolean);
      const detailed = !!s.detail && s.detail !== "none";
      const card = cardBody(s);
      if (detailed) card.nodeProps.className += " " + DETAILED_CLASS;
      const display = {
        name: s.name, kind: "system",
        kindLabel: detailed ? "Detailed" : KIND_LEGEND.system.label,
        align: "left", subtitle: s.technology || "",
        attributes: hotspots.length ? [`hotspot${hotspots.length > 1 ? "s" : ""}: ${capped(hotspots, HOTSPOT_MAX).join(", ")}`] : [],
        body: card.body,
      };
      if (s.detail === "inline") display.emphasis = true;   // it opens into containers and components (C4 view)
      const raw = facts(s, {
        technology: s.technology || "", area: s.area || "", detail: s.detail || "none", detailedIn: s.detailedIn || "",
        status: s.status || "", usedBy: list(s.usedBy), contexts: list(s.contexts),
        masters: names(s.masters), handles: names(s.handles),
        hotspots: list(s.hotspots).map(h => ({ name: h.name, description: h.description || "", flows: list(h.flows), concepts: names(h.concepts) })),
        contacts: list(s.contacts), documents: list(s.documents),
      });
      const r = add("system", s.name, display, raw, Object.assign(card.nodeProps, parentId ? { parentId } : null), domainLinks(s));
      landed(s.name, Object.assign({ kind: "system", visible: true }, r));
    }

    /* ---- areas (groups, open), each followed by its systems; an area no
       system sits in stays in the model and is not drawn ---- */
    const areas = landscapeAreas(arch);
    const areaNames = new Set(areas.map(a => a.name));
    const systems = list(arch.systems);
    for (const a of areas) {
      const members = systems.filter(s => s.area === a.name);
      const display = { name: a.name, kind: "area", kindLabel: KIND_LEGEND.area.label, subtitle: a.description || "" };
      const raw = facts(a, { area: a.name, systems: members.map(s => s.name) });
      if (!members.length) { add("area", a.name, display, raw, null); continue; }
      const g = add("area", a.name,
        Object.assign(display, { level: 3, foldedWidth: foldedWidthFor(a.name, FOLDED_WIDTH.container, 7.4) }),
        raw, { type: "er-group" }, { layout: Object.assign({}, AREA_LAYOUT) });
      for (const s of members) systemCard(s, g.nodeId);
    }
    /* ---- systems in no (declared) area: top level ---- */
    for (const s of systems) if (!s.area || !areaNames.has(s.area)) systemCard(s, null);

    /* ---- external systems: outside the areas ---- */
    for (const x of list(arch.externalSystems)) {
      if (!show.externalSystems) { landed(x.name, { kind: "externalSystem", visible: false }); continue; }
      const card = cardBody(x);
      const r = add("externalSystem", x.name,
        { name: x.name, kind: "externalSystem", kindLabel: KIND_LEGEND.externalSystem.label, align: "left", body: card.body },
        facts(x, { contexts: list(x.contexts), masters: names(x.masters), handles: names(x.handles) }),
        card.nodeProps, domainLinks(x));
      landed(x.name, Object.assign({ kind: "externalSystem", visible: true }, r));
    }

    /* ---- persons: cards beside the landscape, tied to nothing — who uses a
       system is a row of its card. One edge per use (about as many as there
       are dependencies) would take over the layout and pull the areas apart:
       the picture stays the one of the dependencies, the same with and
       without the persons. ---- */
    if (show.persons) {
      for (const p of list(arch.persons))
        add("person", p.name,
          { name: p.name, kind: "person", kindLabel: KIND_LEGEND.person.label, subtitle: p.description || "" },
          facts(p, { uses: systems.filter(s => list(s.usedBy).includes(p.name)).map(s => s.name) }),
          { type: "er-concept", style: { width: LANDSCAPE_WIDTH.person } });
    }

    /* ---- dependencies: one relation and one edge each ---- */
    addDependencies(arch, ends, show.edgeLabels, modelId, relations, edges, report);

    const name = `${arch.name} — system landscape`;
    return {
      version: 1,
      model: { id: modelId, name, metamodel: "software-architecture", elements, relations },
      diagram: { id: modelId + "#landscape", name, layout: Object.assign({}, LANDSCAPE_LAYOUT), nodes, edges: walkMutualFirst(edges) },
    };
  }

  /* One relation and one edge per dependency, downstream → upstream, between
     the nodes `ends` maps the system names to (`{ elementId, nodeId, kind,
     visible }`); nothing is merged, a mutual pair is two edges. Shared by the
     landscape and the concept landscape, whose system nodes differ (a card
     there, a group here). */
  function addDependencies(arch, ends, edgeLabels, modelId, relations, edges, report) {
    for (const d of list(arch.dependencies)) {
      const src = ends.get(d.from), tgt = ends.get(d.to);
      if (!src || !tgt) {
        if (!src) report.unresolved.push({ id: d.id, side: "from", name: d.from });
        if (!tgt) report.unresolved.push({ id: d.id, side: "to", name: d.to });
        continue;
      }
      if (!src.visible || !tgt.visible) {
        report.dropped.push({ id: d.id, reason: `hidden ${(!src.visible ? src : tgt).kind}` });
        continue;
      }
      if (src.nodeId === tgt.nodeId) { report.dropped.push({ id: d.id, reason: "self loop" }); continue; }
      const flows = list(d.flows);
      const patterns = list(d.patterns);
      const partnership = patterns.includes("Partnership");
      const facets = { patterns, criticality: d.criticality || null, mutual: !!d.mutual, partnership };
      relations.push({ id: d.id, type: "dependency", sourceElementId: src.elementId, targetElementId: tgt.elementId,
        data: Object.assign({ from: d.from, to: d.to, description: d.description || "" }, facets, {
          flows: flows.map(f => ({ number: f.number, label: f.label || "", sender: f.sender, receiver: f.receiver,
            carries: list(f.carries).map(c => ({ concept: c.concept.raw, as: c.as ? c.as.raw : null })) })),
        }) });
      const data = { modelRef: { modelId, relationId: d.id }, relationIds: [d.id] };
      const label = flowsLabel(flows);
      if (label && edgeLabels) data.label = label;
      data.description = flows.map(flowLine).join("\n");
      data.points = [];
      Object.assign(data, facets);
      edges.push({ id: "edge-" + d.id, source: src.nodeId, target: tgt.nodeId, type: "er-edge",
        markerEnd: LANDSCAPE_ARROW, style: dependencyStyle(d, partnership), data });
    }
  }

  /* The engine's layout (dagre) walks the edges in the order given, and
     where two systems depend on each other it is the first edge walked that
     decides which one comes first: the dependencies of mutual pairs go
     first, so that partners land in neighbouring ranks instead of at the
     two ends of a chain. The relations keep the order of the file. */
  function walkMutualFirst(edges) {
    const pairOf = e => [e.source, e.target].sort().join("\u0000");
    const perPair = new Map();
    for (const e of edges) perPair.set(pairOf(e), (perPair.get(pairOf(e)) || 0) + 1);
    return edges.map((e, i) => [e, i])
      .sort((a, b) => perPair.get(pairOf(b[0])) - perPair.get(pairOf(a[0])) || a[1] - b[1]).map(x => x[0]);
  }

  /* number of nodes the landscape draws with this toggle map */
  function landscapeCountVisible(arch, show) {
    show = Object.assign({}, LANDSCAPE_DEFAULT_SHOW, show || {});
    const systems = list(arch.systems);
    return systems.length
      + landscapeAreas(arch).filter(a => systems.some(s => s.area === a.name)).length
      + (show.externalSystems ? list(arch.externalSystems).length : 0)
      + (show.persons ? list(arch.persons).length : 0);
  }

  /* ============ Concept landscape (level 0): the domain concepts by system ============
     Every concept a system `masters` or `handles`, as a card inside that
     system's group; the systems grouped by area as in the landscape; one
     "depends on" edge per dependency between the system nodes. Folding the
     systems (Groups 1) gives the landscape back: the engine aggregates the
     edges. Needs the resolveAll() summary of arch-concepts.js: a reference
     that resolved is drawn as the domain element (its kind, its context, a
     link into the Domain Navigator); an acknowledged or unresolved one as a
     note card named as written. */

  /* Toggle map of the concept landscape's diagram bar: `handled` draws the
     `handles` cards next to the `masters` ones; `flows` one edge per concept
     a flow carries, from the sender's card to the receiver's; `unplaced` a
     group of the domain's entities and aggregates no system names. */
  const CONCEPT_LANDSCAPE_DEFAULT_SHOW = { externalSystems: true, handled: true, edgeLabels: true, flows: false, unplaced: false };

  const conceptLandscapeModelIdOf = arch => `${arch.id}-concepts`;

  const CONCEPT_WIDTH = 180;
  const CONCEPT_CARD_CLASS = "concept-card";     // arch-landscape.css styles the cards by that class
  const UNPLACED_NAME = "Not placed on any system";
  /* what the `unplaced` group lists: the main concepts of the domain */
  const UNPLACED_KINDS = new Set(["entity", "aggregate", "readonly-entity"]);
  const NOTE_MAX = 90;                           // characters of a NOTE on a note card
  /* the concept cards of a system have no edges between them: they sit on
     the group's grid, about square, at most four wide */
  const conceptGridLayout = n => ({ shelfColumns: Math.max(2, Math.min(4, Math.ceil(Math.sqrt(Math.max(n, 1))))), shelfGap: 14 });
  const FLOW_STYLE = { stroke: "#8d7e63", strokeWidth: 1.2, strokeDasharray: "4 3" };
  const CONCEPT_LANDSCAPE_LEGEND = LANDSCAPE_LEGEND.concat([
    { key: "flow", label: "flow (concept → concept)",
      description: "With flows on: the concept a flow carries, from the sender's card to the receiver's (its `as` name when the receiver translates it); the label is the flow number.",
      style: Object.assign({}, FLOW_STYLE) },
  ]);

  function conceptLandscapeDiagram(arch, show, opts) {
    show = Object.assign({}, CONCEPT_LANDSCAPE_DEFAULT_SHOW, show || {});
    opts = opts || {};
    const report = opts.report || {};
    Object.assign(report, { unresolved: [], dropped: [], flowsDropped: [], multiMastered: [],
      systems: 0, groups: 0, cards: 0, notes: 0, flows: 0, flowsAtSystem: 0, unplaced: 0, placed: 0 });

    const modelId = conceptLandscapeModelIdOf(arch);
    const { elements, relations, nodes, edges, add } = sheet(modelId);
    const resolution = opts.resolution && typeof opts.resolution.of === "function" ? opts.resolution : null;
    const resolvedOf = ref => (resolution && resolution.of(ref)) || { status: resolution ? "unresolved" : "plain" };
    const isResolved = x => x.status === "resolved" && !!x.id;
    /* one card per concept and system: a resolved reference by its domain
       element, the others by their name */
    const keyOf = (ref, x) => (isResolved(x) ? x.id : "name:" + norm(ref.name));
    const holders = list(arch.systems).map(s => ({ holder: s, kind: "system" }))
      .concat(list(arch.externalSystems).map(x => ({ holder: x, kind: "externalSystem" })));

    /* who masters what — a concept with several systems of record says so on
       each of its cards (a violation check-arch-landscape.mjs reports; the
       diagram shows it) */
    const mastersOf = new Map();
    for (const { holder } of holders)
      for (const ref of list(holder.masters)) {
        const key = keyOf(ref, resolvedOf(ref));
        if (!mastersOf.has(key)) mastersOf.set(key, []);
        if (!mastersOf.get(key).includes(holder.name)) mastersOf.get(key).push(holder.name);
      }
    for (const [key, who] of mastersOf) if (who.length > 1) report.multiMastered.push({ key, systems: who.slice() });

    /* the concepts of a holder: masters first, then (shown) handles, each once */
    function conceptsOf(holder) {
      const seen = new Set(), items = [];
      for (const [site, refs] of [["masters", holder.masters], ["handles", show.handled ? holder.handles : []]]) {
        for (const ref of list(refs)) {
          const x = resolvedOf(ref);
          const key = keyOf(ref, x);
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ ref, site, x, key });
        }
      }
      return items;
    }

    const ends = new Map();            // system / external system name → { elementId, nodeId, kind, visible }
    const cardsBySystem = new Map();   // system name → Map(key → { elementId, nodeId })
    const placed = new Set();          // domain element ids drawn under a system
    const landed = (name, entry) => { if (name && !ends.has(name)) ends.set(name, entry); };
    const titleCase = s => s.charAt(0).toUpperCase() + s.slice(1);

    /* a concept card: the domain element (kind, context, link) when the
       reference resolved, a note card named as written otherwise */
    function conceptCard(holderName, item, parentId) {
      const { ref, site, x } = item;
      const resolved = isResolved(x);
      const also = site === "masters" ? (mastersOf.get(item.key) || []).filter(n => n !== holderName) : [];
      const attributes = [];
      if (also.length) attributes.push(`also mastered by ${also.join(", ")}`);
      if (!resolved) attributes.push(x.status === "acknowledged" ? cap(x.note ? `NOTE: ${x.note}` : "acknowledged by a // NOTE:", NOTE_MAX)
        : x.status === "unresolved" ? "not in the domain model" : "no domain model loaded");
      const display = {
        name: resolved ? x.name : ref.name,
        kind: resolved ? "concept" : "concept-note",
        kindLabel: resolved ? titleCase(x.kindLabel) : "Concept",   // the site is the border: solid masters, dashed handles
        align: "left",
        subtitle: resolved ? x.context + (x.sourcedFrom ? ` · copy of ${x.sourcedFrom}` : "") : "",   // the attribute says why
        attributes,
      };
      const raw = { system: holderName, site, ref: ref.raw, status: x.status, domainId: resolved ? x.id : null,
        domainKind: resolved ? x.kind : null, context: resolved ? x.context : "", sourcedFrom: resolved && x.sourcedFrom ? x.sourcedFrom : "",
        alsoMasteredBy: also, note: !resolved && x.note ? x.note : "" };
      const classes = [CONCEPT_CARD_CLASS, `${CONCEPT_CARD_CLASS}--${site}`, `${CONCEPT_CARD_CLASS}--${resolved ? x.kind : "note"}`];
      const link = resolved ? { domainRef: { id: x.id }, actions: [{ label: `Open ${x.name}`, href: "#" + encodeURI(x.id) }] } : null;
      const r = add("concept", `${holderName}.${ref.name}`, display, raw,
        { type: "er-concept", className: classes.join(" "), style: { width: CONCEPT_WIDTH }, parentId }, link);
      if (resolved) { placed.add(x.id); report.cards++; } else report.notes++;
      return r;
    }

    /* a system: a group holding its concept cards, or a plain card when it names none */
    function systemNode(holder, kind, parentId) {
      const items = conceptsOf(holder);
      const legend = kind === "system" ? KIND_LEGEND.system : KIND_LEGEND.externalSystem;
      const display = { name: holder.name, kind, kindLabel: legend.label, subtitle: holder.technology || "" };
      const raw = { description: holder.description || "", technology: holder.technology || "", area: holder.area || "",
        detail: holder.detail || "none", status: holder.status || "", contexts: list(holder.contexts),
        masters: list(holder.masters).map(r => r.raw), handles: list(holder.handles).map(r => r.raw), concepts: items.length };
      const inParent = parentId ? { parentId } : null;
      let r;
      if (!items.length) {
        r = add(kind, holder.name, Object.assign(display, { align: "left", attributes: holder.description ? [cap(holder.description, 120)] : [] }), raw,
          Object.assign({ type: "er-concept", className: LANDSCAPE_CARD_CLASS, style: { width: LANDSCAPE_WIDTH.card } }, inParent));
        cardsBySystem.set(holder.name, new Map());
      } else {
        r = add(kind, holder.name,
          Object.assign(display, { level: 3, foldedWidth: foldedWidthFor(holder.name, FOLDED_WIDTH.container, 7.4) }), raw,
          Object.assign({ type: "er-group" }, inParent), { layout: conceptGridLayout(items.length) });
        const cards = new Map();
        for (const item of items) cards.set(item.key, conceptCard(holder.name, item, r.nodeId));
        cardsBySystem.set(holder.name, cards);
        report.groups++;
      }
      report.systems++;
      landed(holder.name, Object.assign({ kind, visible: true }, r));
    }

    /* ---- areas (groups, open) with their systems; then the systems in no
       declared area; then the external systems ---- */
    const areas = landscapeAreas(arch);
    const areaNames = new Set(areas.map(a => a.name));
    const systems = list(arch.systems);
    for (const a of areas) {
      const members = systems.filter(s => s.area === a.name);
      const display = { name: a.name, kind: "area", kindLabel: KIND_LEGEND.area.label, subtitle: a.description || "" };
      const raw = { description: a.description || "", area: a.name, systems: members.map(s => s.name) };
      if (!members.length) { add("area", a.name, display, raw, null); continue; }
      const g = add("area", a.name,
        Object.assign(display, { level: 3, foldedWidth: foldedWidthFor(a.name, FOLDED_WIDTH.container, 7.4) }),
        raw, { type: "er-group" }, { layout: Object.assign({}, AREA_LAYOUT) });
      for (const s of members) systemNode(s, "system", g.nodeId);
    }
    for (const s of systems) if (!s.area || !areaNames.has(s.area)) systemNode(s, "system", null);
    for (const x of list(arch.externalSystems)) {
      if (!show.externalSystems) { landed(x.name, { kind: "externalSystem", visible: false }); continue; }
      systemNode(x, "externalSystem", null);
    }

    /* ---- the domain's main concepts no system names: one group, each card
       subtitled with its bounded context ---- */
    if (show.unplaced) {
      const orphans = [];
      for (const org of list(opts.domainOrgs))
        for (const c of list(org.contexts))
          for (const m of list(c.modules))
            for (const el of list(m.elements))
              if (el && UNPLACED_KINDS.has(el.kind) && !placed.has(el.id)) orphans.push({ el, ctx: c, org });
      if (orphans.length) {
        const g = add("unplaced", UNPLACED_NAME,
          { name: UNPLACED_NAME, kind: "unplaced", kindLabel: "Domain model", subtitle: "entities and aggregates no system masters or handles",
            level: 3, foldedWidth: foldedWidthFor(UNPLACED_NAME, FOLDED_WIDTH.container, 7.4) },
          { description: "", concepts: orphans.length }, { type: "er-group" }, { layout: conceptGridLayout(orphans.length) });
        for (const { el, ctx } of orphans) {
          const k = kindsOf(el);
          add("concept", `unplaced.${ctx.shortname || ctx.name}.${el.name}`,
            { name: el.name, kind: "concept", kindLabel: titleCase(k), align: "left",
              subtitle: ctx.name + (el.sourcedFrom ? ` · copy of ${el.sourcedFrom}` : ""), attributes: [] },
            { system: "", site: "unplaced", ref: el.name, status: "resolved", domainId: el.id, domainKind: el.kind, context: ctx.name,
              sourcedFrom: el.sourcedFrom || "", alsoMasteredBy: [], note: "" },
            { type: "er-concept", className: `${CONCEPT_CARD_CLASS} ${CONCEPT_CARD_CLASS}--unplaced ${CONCEPT_CARD_CLASS}--${el.kind}`,
              style: { width: CONCEPT_WIDTH }, parentId: g.nodeId },
            { domainRef: { id: el.id }, actions: [{ label: `Open ${el.name}`, href: "#" + encodeURI(el.id) }] });
          report.unplaced++;
        }
      }
    }
    report.placed = placed.size;

    /* ---- dependencies between the system nodes (groups or cards) ---- */
    addDependencies(arch, ends, show.edgeLabels, modelId, relations, edges, report);
    const walked = walkMutualFirst(edges);

    /* ---- flows, concept to concept: the sender's card of the concept
       carried to the receiver's card of its `as` name (or of the same
       concept). A side that lists no such card — the system handles the
       concept without declaring it — is the system node itself. One edge
       per (node, node), labelled with the flow numbers. ---- */
    if (show.flows) {
      const perPair = new Map();
      const endOf = (system, key) => {
        const card = (cardsBySystem.get(system) || new Map()).get(key);
        if (card) return { end: card, atCard: true };
        const sys = ends.get(system);
        return sys && sys.visible ? { end: sys, atCard: false } : null;
      };
      for (const d of list(arch.dependencies)) {
        for (const f of list(d.flows)) {
          for (const c of list(f.carries)) {
            const sKey = keyOf(c.concept, resolvedOf(c.concept));
            const rKey = c.as ? keyOf(c.as, resolvedOf(c.as)) : sKey;
            const s = endOf(f.sender, sKey), t = endOf(f.receiver, rKey);
            if (!s || !t || s.end.nodeId === t.end.nodeId) {
              report.flowsDropped.push({ flow: f.number, concept: c.concept.raw, as: c.as ? c.as.raw : null,
                reason: !s ? `${f.sender} not drawn` : !t ? `${f.receiver} not drawn` : "same node" });
              continue;
            }
            if (!s.atCard || !t.atCard) report.flowsAtSystem++;
            const rid = `flow-${f.number}-${relations.length}`;
            relations.push({ id: rid, type: "flow", sourceElementId: s.end.elementId, targetElementId: t.end.elementId,
              data: { number: f.number, label: f.label || "", sender: f.sender, receiver: f.receiver, dependency: d.id,
                concept: c.concept.raw, as: c.as ? c.as.raw : null, senderCard: s.atCard, receiverCard: t.atCard } });
            const sNode = s.end.nodeId, tNode = t.end.nodeId;
            const pair = sNode + "\u0000" + tNode;
            if (!perPair.has(pair)) perPair.set(pair, { source: sNode, target: tNode, rids: [], numbers: [], lines: [] });
            const p = perPair.get(pair);
            p.rids.push(rid); p.numbers.push(f.number); p.lines.push(flowLine(f));
            report.flows++;
          }
        }
      }
      for (const p of perPair.values()) {
        const data = { modelRef: { modelId, relationId: p.rids[0] }, relationIds: p.rids.slice(), flow: true,
          description: [...new Set(p.lines)].join("\n"), points: [] };
        if (show.edgeLabels) data.label = numberRanges(p.numbers);
        walked.push({ id: "edge-" + p.rids[0], source: p.source, target: p.target, type: "er-edge",
          markerEnd: LANDSCAPE_ARROW, style: Object.assign({}, FLOW_STYLE), data });
      }
    }

    const name = `${arch.name} — domain concepts by system`;
    return {
      version: 1,
      model: { id: modelId, name, metamodel: "software-architecture", elements, relations },
      diagram: { id: modelId + "#concepts", name, layout: Object.assign({}, LANDSCAPE_LAYOUT), nodes, edges: walked },
    };
  }
  /* the kind label of a domain element, as arch-concepts.js spells it */
  const kindsOf = el => (typeof SpecyArchConcepts !== "undefined" && SpecyArchConcepts && typeof SpecyArchConcepts.kindLabel === "function"
    ? SpecyArchConcepts.kindLabel(el) : el.kind);

  return { architectureDiagram, modelIdOf, countVisible, DEFAULT_SHOW, KIND_LEGEND,
    landscapeDiagram, landscapeModelIdOf, landscapeCountVisible, LANDSCAPE_DEFAULT_SHOW, LANDSCAPE_LEGEND,
    LANDSCAPE_KIND_LEGEND,
    LANDSCAPE_LIMITS: { concepts: CONCEPT_MAX, hotspots: HOTSPOT_MAX, actions: ACTION_MAX, label: LANDSCAPE_LABEL_MAX },
    conceptLandscapeDiagram, conceptLandscapeModelIdOf, CONCEPT_LANDSCAPE_DEFAULT_SHOW, CONCEPT_LANDSCAPE_LEGEND,
    CONCEPT_LANDSCAPE_LIMITS: { width: CONCEPT_WIDTH, note: NOTE_MAX, unplaced: UNPLACED_NAME } };
})();

/* Node (scripts/check-arch-export.mjs loads this file through vm; the
   browser ignores this block) */
if (typeof module !== "undefined" && module.exports) module.exports = SpecyArchDiagrams;

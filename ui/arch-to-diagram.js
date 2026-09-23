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
   (`layout.engine "dagre"`) and derives the edge sides (`handles: "auto"`). */

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
    system:         { label: "System",          color: "#ffffff", border: "#b0ada6", dashed: true },
    container:      { label: "Container",       color: "#f7f9fc", border: "#9fb1d6" },
    component:      { label: "Component",       color: "#ffffff", border: "#3a3f46" },
    channel:        { label: "Channel",         color: "#f6efe2", border: "#b7a480" },
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

    const elements = [], relations = [];
    const nodes = [], edges = [];
    const usedIds = new Set();
    const byName = new Map();       // .arch name → { elementId, nodeId, kind, visible }
    const parentOf = new Map();     // node id → parent node id

    const uniqueId = (name, type) => {
      const base = String(name).replace(/[^\w.-]+/g, "-") || type;
      let id = base;
      if (usedIds.has(id)) id = `${type}-${base}`;
      for (let i = 2; usedIds.has(id); i++) id = `${type}-${base}-${i}`;
      usedIds.add(id);
      return id;
    };

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

    /* one model element + its node; `display` is shared by both, `extra`
       only lands on the element (raw .arch data), `nodeProps` only on the node */
    function add(type, name, display, extra, nodeProps, link) {
      const id = uniqueId(name, type);
      const nodeId = "node-" + id;
      elements.push({ id, type, data: Object.assign({}, display, extra || {}) });
      const node = Object.assign({ id: nodeId }, nodeProps, {
        data: Object.assign({ modelRef: { modelId, elementId: id } }, display, link || {}),
      });
      if (node.parentId) { node.extent = "parent"; parentOf.set(nodeId, node.parentId); }
      nodes.push(node);
      return { elementId: id, nodeId };
    }
    const register = (name, entry) => { if (name && !byName.has(name)) byName.set(name, entry); };

    /* ---- persons (top level; first in the name index on a name clash) ---- */
    for (const p of list(arch.persons)) {
      if (!show.persons) { register(p.name, { kind: "person", visible: false }); continue; }
      const r = add("person", p.name,
        { name: p.name, kind: "person", kindLabel: KIND_LEGEND.person.label, subtitle: p.description || "" },
        null, { type: "er-concept", style: { width: WIDTH.person } });
      register(p.name, Object.assign({ kind: "person", visible: true }, r));
    }

    const containerNode = new Map();   // container → node id
    const channelNode = new Map();     // channel name → { elementId, nodeId }
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
        : add("system", sysName,
            { name: sysName, kind: "system", kindLabel: KIND_LEGEND.system.label,
              subtitle: sys.description || "" },
            { description: sys.description || "", satisfies: list(sys.satisfies) },
            { type: "er-concept", style: { width: WIDTH.concept } });
      // a connector end naming a whole system lands on its box
      register(sysName, Object.assign({ kind: "system", visible: true }, sysNode));

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
        allContainers.push(c);
        register(c.name, Object.assign({ kind: "container", visible: true }, r));
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
          }, { description: k.description || "", container: c.name, boundedContext: k.boundedContext || "" },
          { type: "er-concept", parentId: containerNode.get(c), style: { width: WIDTH.concept } },
          domainLink(k.name, k.realizes));
          register(k.name, Object.assign({ kind: "component", visible: true }, r));
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
        if (!channelNode.has(ch.name)) channelNode.set(ch.name, r);
      }
    }

    /* ---- external systems (top level, after the system so they rank below it) ---- */
    for (const x of list(arch.externalSystems)) {
      if (!show.externalSystems) { register(x.name, { kind: "externalSystem", visible: false }); continue; }
      const r = add("externalSystem", x.name, {
        name: x.name, kind: "externalSystem", kindLabel: KIND_LEGEND.externalSystem.label, align: "left",
        subtitle: x.description || "",
        body: kv([row("provides", x.provides), row("consumes", x.consumes), row("realizes", realizesText(x.realizes))]),
      }, null, { type: "er-concept", style: { width: WIDTH.concept } }, domainLink(x.name, x.realizes));
      register(x.name, Object.assign({ kind: "externalSystem", visible: true }, r));
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
        markerEnd: "url(#er-arrow)", style: Object.assign({}, EDGE_STYLE[style] || EDGE_STYLE.sync), data };
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
    for (const c of systems.flatMap(sys => list(sys.connectors))) {
      const from = endpoint(c.from), to = endpoint(c.to);
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
          const comp = byName.get(k.name);
          if (!comp || comp.kind !== "component") continue;
          const perChannel = new Map();
          for (const pub of list(k.publishes)) {
            if (!perChannel.has(pub.channel)) perChannel.set(pub.channel, []);
            const evs = perChannel.get(pub.channel);
            if (!evs.includes(pub.event)) evs.push(pub.event);
          }
          for (const [chName, messages] of perChannel) {
            const ch = channelNode.get(chName);
            if (!ch) { report.unresolved.push({ id: `publishes ${k.name} → ${chName}`, side: "to", name: chName }); continue; }
            const rel = { id: "p" + (++p), type: "publishes", sourceElementId: comp.elementId, targetElementId: ch.elementId, data: { messages } };
            relations.push(rel);
            addEdge(null, rel, comp.nodeId, ch.nodeId, "async",
              cap("publishes " + messages.join(", "), LABEL_MAX), `publishes ${messages.join(", ")} to ${chName}`);
          }
          for (const chName of list(k.subscribes)) {
            const ch = channelNode.get(chName);
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

  return { architectureDiagram, modelIdOf, countVisible, DEFAULT_SHOW, KIND_LEGEND };
})();

/* Node (scripts/check-arch-export.mjs loads this file through vm; the
   browser ignores this block) */
if (typeof module !== "undefined" && module.exports) module.exports = SpecyArchDiagrams;

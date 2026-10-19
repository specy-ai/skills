/* Specy Navigator — level-0 concept references resolved against the domain
   model. Pure and DOM-free (global `SpecyArchConcepts`): it takes the
   organization shape of arch-parser.js and the organizations
   domain-parser.js returns (one per `domain-source`) and applies the
   "Concept reference" rule of SOFTWARE-ARCHITECTURE-METAMODEL.md.

   A reference (`{ name, context, raw, line }`) is attached to one system and
   resolves once, for that system:
     1. qualified (`Finance.Invoice`) — the definitions of that name in that
        bounded context;
     2. bare, in the contexts the system realizes — a local definition wins,
        copy or not;
     3. bare, organization-wide — every context of every domain source; a
        copy (read-only entity, external event) is ignored when an owning
        definition of the same name exists.
   At each step one match resolves, several are ambiguous, none goes on (or
   leaves the reference unresolved). An unresolved name is acknowledged when
   a `// NOTE:` covers it (`arch.acknowledged`).

   Names are compared as arch-to-diagram.js `domainResolver` does
   (lower-case, accents stripped, non-alphanumerics dropped); contexts match
   by name or shortname. That tolerance is for navigation: a resolution says
   whether the reference is spelled as the domain spells it (`exact`), and
   `resolveAll()` lists those that are not (`inexact`). Resolved ids are
   domain-parser.js element ids (`<file stem>:<context shortname>:<Name>`),
   the keys app.js `goto()` takes. A context the domain source does not
   declare (the implicit one of a file that starts at a module or a
   definition) can be neither a qualifier nor realized: its definitions
   resolve by bare name, and the source is reported (`domainProblems`).

   Status of a resolution: "resolved" | "ambiguous" | "acknowledged" |
   "unresolved" | "plain" (no domain organization to resolve against). */

"use strict";

const SpecyArchConcepts = (() => {

  const norm = s => String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[^a-z0-9]/g, "");
  const list = a => a || [];
  const put = (map, key, value) => { if (!map.has(key)) map.set(key, []); map.get(key).push(value); };

  /* domain-parser.js kinds a reference may designate; the others (command,
     query, services, repository, interface, reaction, invariant, agreement,
     reconciliation) are an error */
  const REFERABLE = new Set(["entity", "aggregate", "readonly-entity", "value", "enum", "event"]);
  /* copies stand for something owned elsewhere */
  const isCopy = el => el.kind === "readonly-entity" || (el.kind === "event" && el.eventType === "external");
  const KIND_LABEL = { entity: "entity", aggregate: "aggregate", "readonly-entity": "read-only entity", value: "value type", enum: "enum" };
  const kindLabel = el => (el.kind === "event"
    ? (el.eventType && el.eventType !== "internal" ? el.eventType + " event" : "event")
    : KIND_LABEL[el.kind] || el.kind);

  /* ---- domain sources of an architecture ---- */

  /* every `domain-source` path (an `architecture`-rooted file has one at most) */
  const domainSources = arch => (arch && arch.domainSources && arch.domainSources.length
    ? arch.domainSources.slice()
    : arch && arch.domainSource ? [arch.domainSource] : []);
  /* path → the id domain-parser.js gives the organization (the file stem) */
  const domainStem = p => String(p || "").split(/[\\/]/).pop().replace(/\.domain$/, "");
  /* the loaded organizations an architecture resolves against, and the sources not loaded */
  function domainOrgsFor(arch, organizations) {
    const orgs = [], missing = [];
    for (const source of domainSources(arch)) {
      const org = list(organizations).find(o => o && o.id === domainStem(source));
      if (!org) missing.push(source);
      else if (!orgs.includes(org)) orgs.push(org);
    }
    return { orgs, missing };
  }

  /* ---- index of the definitions of the domain organizations ---- */

  function domainIndex(domainOrgs) {
    const orgs = list(domainOrgs).filter(Boolean);
    const contexts = new Map();     // norm(context name | shortname) → [context entry]
    const referable = new Map();    // norm(name) → [definition], every context of every source
    const other = new Map();        // the same, for the kinds a reference may not designate
    const elided = [];              // the implicit context of a source that starts at a module or a definition
    for (const org of orgs) {
      for (const ctx of list(org.contexts)) {
        const entry = { org, ctx, referable: new Map(), other: new Map() };
        /* a context the source does not declare (domain-parser.js `implicit`) has no name to
           qualify with or to realize: its definitions are found by bare name only */
        if (ctx.implicit) elided.push(entry);
        else for (const key of new Set([norm(ctx.name), norm(ctx.shortname)])) if (key) put(contexts, key, entry);
        for (const mod of list(ctx.modules)) {
          for (const el of list(mod.elements)) {
            if (!el || !el.name) continue;
            const def = { id: el.id, name: el.name, kind: el.kind, kindLabel: kindLabel(el), copy: isCopy(el),
              context: ctx.name, contextId: ctx.id, module: mod.name, domain: org.id };
            if (el.kind === "event") def.eventType = el.eventType || "internal";
            if (el.sourcedFrom) def.sourcedFrom = el.sourcedFrom;
            const ok = REFERABLE.has(el.kind);
            put(ok ? entry.referable : entry.other, norm(el.name), def);
            put(ok ? referable : other, norm(el.name), def);
          }
        }
      }
    }
    return { orgs, contexts, referable, other, elided };
  }

  /* ---- every concept reference of an architecture, with the system it is
     attached to: the declaring system for `masters`, `handles` and a
     hotspot; for a carried concept the sender (the name before `as`) and
     the receiver (the name after) ---- */
  function references(arch) {
    const out = [];
    const add = (ref, system, site, hotspot, flow, dependency) =>
      out.push({ ref, system, site, hotspot: hotspot || null, flow: flow == null ? null : flow, dependency: dependency || null });
    for (const s of list(arch && arch.systems).concat(list(arch && arch.externalSystems))) {
      for (const ref of list(s.masters)) add(ref, s.name, "masters");
      for (const ref of list(s.handles)) add(ref, s.name, "handles");
      for (const h of list(s.hotspots)) for (const ref of list(h.concepts)) add(ref, s.name, "hotspot", h.name);
    }
    for (const d of list(arch && arch.dependencies)) {
      for (const f of list(d.flows)) {
        for (const c of list(f.carries)) {
          add(c.concept, f.sender, "carries", null, f.number, d.id);
          if (c.as) add(c.as, f.receiver, "as", null, f.number, d.id);
        }
      }
    }
    return out;
  }

  /* ---- resolver of one architecture against its domain organizations ---- */

  function resolver(arch, domainOrgs) {
    const index = domainIndex(domainOrgs);
    const noted = new Map(list(arch && arch.acknowledged).map(a => [a.name, a]));

    /* system or external system → the context entries it realizes */
    const own = new Map();
    for (const s of list(arch && arch.systems).concat(list(arch && arch.externalSystems))) {
      if (own.has(s.name)) continue;
      const names = s.contexts || list(s.realizes).filter(r => r.kind === "context").map(r => r.name);
      const entries = [];
      for (const n of names) for (const e of index.contexts.get(norm(n)) || []) if (!entries.includes(e)) entries.push(e);
      own.set(s.name, entries);
    }
    const ownContexts = systemName => (own.get(systemName) || [])
      .map(e => ({ name: e.ctx.name, shortname: e.ctx.shortname, id: e.ctx.id, domain: e.org.id }));

    const candidate = d => Object.assign({}, d);
    const several = (defs, via, reason) => ({ status: "ambiguous", via, reason, candidates: defs.map(candidate) });
    /* `exact`: the reference is spelled as the domain spells it — the name, and
       the qualifier when there is one (`spelled` is false when the context
       matched only after normalisation). Navigation does not need it; a
       check lists the inexact ones. */
    const settle = (ref, defs, via, spelled) => {
      if (defs.length > 1)
        return several(defs, via, new Set(defs.map(d => d.contextId)).size > 1 ? "several-contexts" : "same-context");
      return Object.assign({ status: "resolved", via, exact: defs[0].name === ref.name && spelled !== false }, candidate(defs[0]));
    };

    function resolve(ref, systemName) {
      if (!ref) return null;
      if (!index.orgs.length) return { status: "plain" };
      const key = norm(ref.name);
      let reason = "no-match", others;
      if (ref.context) {
        const ctxs = index.contexts.get(norm(ref.context)) || [];
        const found = ctxs.flatMap(c => c.referable.get(key) || []);
        /* a context name declared twice makes every reference qualified by it ambiguous */
        if (found.length && ctxs.length > 1) return several(found, "qualified", "context-declared-twice");
        if (found.length) return settle(ref, found, "qualified", ctxs.some(c => c.ctx.name === ref.context || c.ctx.shortname === ref.context));
        others = ctxs.flatMap(c => c.other.get(key) || []);
        if (!ctxs.length) reason = "unknown-context";
      } else {
        const local = (own.get(systemName) || []).flatMap(c => c.referable.get(key) || []);
        if (local.length) return settle(ref, local, "own-context");
        const all = index.referable.get(key) || [];
        const owning = all.filter(d => !d.copy);
        if (all.length) return settle(ref, owning.length ? owning : all, "organization");
        others = index.other.get(key) || [];
      }
      /* a command, a service…: an error, which no NOTE acknowledges */
      if (others.length) return { status: "unresolved", reason: "not-referable", found: others.map(candidate) };
      const note = noted.get(ref.name);
      return note
        ? { status: "acknowledged", note: note.note, noteLine: note.line }
        : { status: "unresolved", reason };
    }

    const where = r => (r.site === "carries" ? `flow ${r.flow}, sent by ${r.system}`
      : r.site === "as" ? `flow ${r.flow}, received by ${r.system}`
      : r.site === "hotspot" ? `hotspot ${r.hotspot} of ${r.system}`
      : `${r.site} of ${r.system}`);
    function explain(r) {
      const x = r.resolution, at = `${r.ref.raw} (${where(r)})`;
      if (x.status === "ambiguous") {
        const names = x.candidates.map(c => `${c.context}.${c.name}`).join(", ");
        return x.reason === "context-declared-twice"
          ? `${at} is ambiguous: its context is declared in several domain sources (${[...new Set(x.candidates.map(c => c.domain))].join(", ")})`
          : x.reason === "same-context"
          ? `${at} is ambiguous: ${x.candidates.length} definitions of ${x.candidates[0].context}.${x.candidates[0].name} (modules ${x.candidates.map(c => c.module).join(", ")}) — fix the domain model`
          : `${at} is ambiguous: ${names} — qualify it`;
      }
      if (x.reason === "not-referable")
        return `${at} designates ${x.found.map(c => `${c.kindLabel} ${c.context}.${c.name}`).join(", ")}: not a kind a concept reference may name`;
      if (x.reason === "unknown-context") return `${at}: no bounded context ${r.ref.context} in the domain sources`;
      return `${at} is unresolved${r.ref.context ? ` (nothing of that name in context ${r.ref.context})` : ""} and not acknowledged by a // NOTE:`;
    }

    /* every reference of the architecture at once */
    function resolveAll() {
      const refs = references(arch);
      const byRef = new Map();
      const counts = { resolved: 0, ambiguous: 0, acknowledged: 0, unresolved: 0, plain: 0 };
      const distinct = { resolved: new Set(), ambiguous: new Set(), acknowledged: new Set(), unresolved: new Set(), plain: new Set() };
      const problems = [], inexact = [];
      const uses = new Map();
      for (const r of refs) {
        const x = r.resolution = resolve(r.ref, r.system);
        byRef.set(r.ref, x);
        counts[x.status]++;
        if (x.status === "resolved" && !x.exact) {
          const written = (r.ref.context ? x.context + "." : "") + x.name;
          inexact.push({ raw: r.ref.raw, name: r.ref.name, context: r.ref.context, line: r.ref.line || 0, system: r.system,
            site: r.site, hotspot: r.hotspot, flow: r.flow, id: x.id, written,
            message: `${r.ref.raw} (${where(r)}) matches ${x.context}.${x.name} only when case and punctuation are ignored — write ${written}` });
        }
        distinct[x.status].add(x.status === "resolved" ? x.id : x.status === "acknowledged" ? r.ref.name : r.ref.raw);
        if (x.status === "acknowledged") uses.set(r.ref.name, (uses.get(r.ref.name) || 0) + 1);
        if (x.status === "ambiguous" || x.status === "unresolved") {
          problems.push({ status: x.status, reason: x.reason, raw: r.ref.raw, name: r.ref.name, context: r.ref.context,
            line: r.ref.line || 0, system: r.system, site: r.site, hotspot: r.hotspot, flow: r.flow,
            candidates: x.candidates || x.found || [], message: explain(r) });
        }
      }
      /* a context name declared in two domain sources defeats qualification */
      const domainProblems = [], seen = new Set();
      for (const entries of index.contexts.values()) {
        const sources = [...new Set(entries.map(e => e.org.id))];
        const id = entries.map(e => e.ctx.id).sort().join("|");
        if (sources.length < 2 || seen.has(id)) continue;
        seen.add(id);
        domainProblems.push({ context: entries[0].ctx.name, domains: sources,
          message: `context ${entries[0].ctx.name} is declared in ${sources.length} domain sources (${sources.join(", ")}): every reference qualified by it is ambiguous` });
      }
      /* …and so does a source that elides its context */
      for (const e of index.elided)
        domainProblems.push({ context: e.ctx.name, domains: [e.org.id],
          message: `domain source ${e.org.id} elides its bounded context (it starts at a module or a definition): its definitions have nothing to be qualified with` });
      const loaded = index.orgs.length > 0;
      const noteLines = [];           // the NOTE lines of `arch.acknowledged`: { line, note, names }
      for (const a of list(arch && arch.acknowledged)) {
        let n = noteLines.find(x => x.line === a.line);
        if (!n) noteLines.push(n = { line: a.line, note: a.note, names: [] });
        n.names.push(a.name);
      }
      return {
        domains: index.orgs.map(o => o.id),
        total: refs.length,
        counts,
        distinct: Object.fromEntries(Object.entries(distinct).map(([k, v]) => [k, v.size])),
        references: refs,
        problems,
        domainProblems,
        /* resolved references not spelled as the domain spells them: to list, not to refuse */
        inexact,
        acknowledged: noteLines.flatMap(n => n.names.filter(name => uses.has(name))
          .map(name => ({ name, note: n.note, line: n.line, uses: uses.get(name) }))),
        /* NOTE lines whose concept names all resolve. Informational only: such
           a note may be a remark of another kind, which nothing here can tell
           from an acknowledgement that is no longer needed. */
        staleNotes: loaded ? noteLines.filter(n => !n.names.some(name => uses.has(name))) : [],
        of: ref => byRef.get(ref) || null,
      };
    }

    return { resolve, resolveAll, ownContexts, index };
  }

  /* one-shot forms */
  const resolve = (arch, domainOrgs, ref, systemName) => resolver(arch, domainOrgs).resolve(ref, systemName);
  const resolveAll = (arch, domainOrgs) => resolver(arch, domainOrgs).resolveAll();

  return { norm, domainSources, domainStem, domainOrgsFor, domainIndex, references, resolver, resolve, resolveAll, REFERABLE, kindLabel };
})();

/* Node (scripts/check-arch-landscape.mjs loads this file through vm; the
   browser ignores this block) */
if (typeof module !== "undefined" && module.exports) module.exports = SpecyArchConcepts;

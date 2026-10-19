/* Tolerant reader for Specy .arch files (src/grammars/architecture.ebnf,
   SOFTWARE-ARCHITECTURE-METAMODEL.md) → the navigator's architecture shape.
   Structural, like domain-parser.js: comments are stripped (outside
   strings), physical lines are joined into logical lines (multi-line headers
   and operations), the text is folded into a brace-scoped block tree with
   quote-aware brace counting, and each header / statement is interpreted by
   its leading keyword. One-line blocks (`enum X { a = 1 }`, `exception X
   { … }`, `meta { … }`) stay statements. Unknown constructs (struct, enum,
   union, exception, typedef, import, operations) are skipped, never fatal.

   parseArch(text, fileStem) →
     { id, name, description, domainSource, requirementsSource,
       persons, externalSystems, systems: [{ …, containers, channels,
       connectors, environments }], system (= systems[0]), counts }
   A file normally has one system in focus; a merged landscape (see
   scripts/merge-arch.mjs) has one `system` block per system.

   A file rooted at `organization` (level 0: several systems, the
   dependencies between them, numbered flows of domain concepts) returns the
   same object — every field above keeps its meaning, `name` / `description`
   being the organization's — plus the fields below. A file rooted at
   `architecture`, or a bare one, carries none of them and reads exactly as
   before: there the level-0 words are ordinary identifiers.

     root: "organization", meta, domainSources (all of them; `domainSource`
       is the first), issues: [{ line, message }] — what the grammar would
       reject at level 0: a statement the reader could not read or place, or
       one not written as its production (the reader still reads what it
       can); also a second `area` or `detailed-in` in one system,
     phases: [{ id, name, description, meta, line }]            in order
     areas: [{ id, name, description, meta, systems: [name], line }]
     persons[]: + meta, line
     externalSystems[]: + masters, handles (concept refs), contexts, meta, line
     systems[]: + technology, area, usedBy: [person], masters, handles,
       hotspots: [{ id, name, description, flows: [number], concepts: [ref], meta, line }],
       contexts: [name] (its `realizes context`), detailedIn,
       detail: "inline" | "file" | "none" (a black box),
       meta (raw map), status, contacts: [string],
       documents: [{ label, url }] (the conventional meta keys, parsed), line
     systems[].connectors[]: + line; each end (`from`, `to`) + kind:
       "container" | "component" | "system" | "person" | "externalSystem" |
       null (unresolved), system, container, component, interface — names
       declared in a system body are local to it; an end may be local, in a
       peer (`System.Container[.Interface]`), a bare peer system, a person or
       an external system
     dependencies: [{ id: "From->To", from (downstream), to (upstream),
       patterns: [string], criticality, description, meta,
       mutual (the opposite dependency exists), line, flows }]
     flows (every flow, in order; the same objects as dependencies[].flows):
       [{ number, label, description, meta,
          carries: [{ concept: ref, as: ref | null }],
          to (the receiver when written, else null), sender, receiver
          (resolved: upstream → downstream unless `to` names the upstream end),
          mechanism: { over, mode } | null (stated once),
          perPhase: [{ phase, over, mode, line }] (stated per phase),
          dependency (its id), line }]         mode: "manual" | "automated" | null
     concept ref: { name, context (the qualifier, or null), raw, line }
     acknowledged: [{ name, note, line }] — the concept names a `// NOTE:`
       covers (on their line, or in the comment-only lines directly above):
       unresolved, they are accepted wherever the file uses them
     counts: + areas, phases, dependencies, flows, hotspots, mutualPairs
   Absent values are null (enumerations, references, meta) or "" (texts). */

"use strict";

function parseArch(text, fileStem) {

  /* ---- small lexical helpers (quote-aware) ---- */
  const STR = /"(?:[^"\\]|\\.)*"/g;
  const unquoted = s => s.replace(STR, '""');
  const parenDepth = s => { const u = unquoted(s); return (u.match(/\(/g) || []).length - (u.match(/\)/g) || []).length; };
  const openMeta = s => /\bmeta\s*\{[^}]*$/.test(unquoted(s));

  /* ---- 1. strip comments (outside strings), drop blanks. Each kept line
     remembers its source line, and the `// NOTE:` that covers it: one on the
     line itself, or in the comment-only lines directly above (a NOTE may run
     over several comment lines; a blank line ends it). Level 0 reads them
     as acknowledgements of unresolved concept names. ---- */
  const NOTE = /^NOTE\s*:\s*(.*)$/;
  const lines = [], lineNos = [];
  const noteAt = new Map();           // source line → NOTE text
  let noteAbove = null, lineNo = 0;
  for (const raw of String(text || "").split("\n")) {
    lineNo++;
    let out = "", inStr = false, comment = null;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (inStr && c === "\\") { out += c + (raw[i + 1] || ""); i++; continue; }
      if (c === '"') inStr = !inStr;
      if (!inStr && c === "/" && raw[i + 1] === "/") { comment = raw.slice(i + 2).trim(); break; }
      out += c;
    }
    out = out.trim();
    const note = comment != null ? NOTE.exec(comment) : null;
    if (!out) {
      noteAbove = comment == null ? null
        : note ? note[1]
        : noteAbove != null ? (noteAbove + " " + comment).trim() : null;
      continue;
    }
    if (note || noteAbove != null) noteAt.set(lineNo, note ? note[1] : noteAbove);
    noteAbove = null;
    lines.push(out);
    lineNos.push(lineNo);
  }

  /* The root decides how the file is read. Under `organization` (level 0) the
     level-0 statements are interpreted and names declared in a system body
     are local to it; under `architecture` (or in a bare file) nothing below
     differs from the single-system reader, and the level-0 words stay plain
     identifiers. */
  const ORG = /^organization\b/.test(lines.find(l => /^(?:organization|architecture)\s+[A-Za-z_]/.test(l)) || "");

  /* ---- 2. logical lines: a header or operation may continue on the next
     physical lines (`:: "…"`, `realizes …`, `satisfies […]`, `technology`,
     `meta {…}`, `returns`, `throws`), or while a `(` / `meta {` is open ---- */
  const CONT = /^(?:::|(?:realizes|satisfies|technology|meta|returns|throws)\b)/;
  /* Organization files only. The level-0 words are contextual, so none of
     them joins a line by itself: each continues only the statement it
     belongs to — [how the statement so far starts, how the next line starts]. */
  const CONT0 = [
    [/^hotspot\s+[A-Za-z_]/, /^concerns\b/],
    [/^flow\s+\d/, /^(?:carries|to|as|over|manual|automated)\b/],
    [/^phase\s+[A-Za-z_]/, /^(?:over|manual|automated)\b/],
    [/^dependency\s+\S+\s*->/, /^(?::(?!:)|criticality\b)/],
  ];
  const LIST0 = /^(?:(?:masters|handles|used-by|hotspot|system|externalSystem)\s+[A-Za-z_]|flow\s+\d|dependency\s+\S+\s*->)/;   // a list broken at a comma
  /* a statement left open at the end of its line: a clause word without its operand */
  const HEAD0 = /^(?:(?:hotspot|phase)\s+[A-Za-z_]|flow\s+\d|dependency\s+\S+\s*->)/;
  const OPEN0 = /(?:\s(?:carries|as|to|over|concerns|criticality|:)|->)$/;
  const cont0 = (prev, line) => line[0] === "{"   // a body opened on its own line
    || CONT0.some(([head, next]) => head.test(prev) && next.test(line))
    || (LIST0.test(prev) && (prev.endsWith(",") || line.startsWith(",")))
    || (HEAD0.test(prev) && OPEN0.test(prev))
    || /^(?:masters|handles|used-by|flow\s+\d+)$/.test(prev);
  const logical = [];
  const segments = [];                // per logical line: [offset in it, source line] of each physical line
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    const n = logical.length;
    const prev = n ? logical[n - 1] : null;
    if (prev != null && !prev.startsWith("}") &&
        (openMeta(prev) || parenDepth(prev) > 0 || (!prev.endsWith("{") && (CONT.test(line) || (ORG && cont0(prev, line)))))) {
      segments[n - 1].push([prev.length + 1, lineNos[k]]);
      logical[n - 1] = prev + " " + line;
    } else {
      logical.push(line);
      segments.push([[0, lineNos[k]]]);
    }
  }

  /* ---- 3. fold into a block tree (items keep source order). Only braces
     left unmatched on their own line are structural: a matched pair is a
     one-line block and stays inside its statement. ---- */
  const root = { head: "", items: [] };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  for (let k = 0; k < logical.length; k++) {
    const line = logical[k];
    /* an item keeps where its head starts (`src` logical line, `at` offset in it) */
    const startOf = (a, b) => { while (a < b && /\s/.test(line[a])) a++; return a; };
    const opens = [];                 // positions of unmatched `{`
    const structural = new Map();     // position → "{" | "}"
    let inStr = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inStr && c === "\\") { i++; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") opens.push(i);
      else if (c === "}") { if (opens.length) opens.pop(); else structural.set(i, "}"); }
    }
    for (const i of opens) structural.set(i, "{");
    let from = 0;
    for (const i of [...structural.keys()].sort((a, b) => a - b)) {
      const seg = line.slice(from, i).trim();
      const at = startOf(from, i);
      from = i + 1;
      if (structural.get(i) === "{") {
        const node = { head: seg, items: [] };
        top().items.push({ head: seg, node, src: k, at });
        stack.push(node);
      } else {
        if (seg) top().items.push({ head: seg, src: k, at });
        if (stack.length > 1) stack.pop();
      }
    }
    const rest = line.slice(from).trim();
    if (rest) top().items.push({ head: rest, src: k, at: startOf(from, line.length) });
  }
  /* source line of the character `p` of an item's head */
  const lineAt = (it, p) => {
    const segs = it && it.src != null ? segments[it.src] : null;
    if (!segs) return 0;
    const off = (it.at || 0) + (p || 0);
    let ln = segs[0][1];
    for (const [o, l] of segs) { if (o > off) break; ln = l; }
    return ln;
  };

  /* ---- 4. head tokenizer + clause extraction ---- */
  const CLOSE = { "[": "]", "{": "}", "(": ")" };
  function matchClose(s, i) {
    const open = s[i], close = CLOSE[open];
    let depth = 0, inStr = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (inStr && c === "\\") { j++; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === open) depth++;
      else if (c === close && --depth === 0) return j;
    }
    return s.length;
  }
  function tokenize(s) {
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') {
        let j = i + 1, v = "";
        while (j < s.length && s[j] !== '"') {
          if (s[j] === "\\" && j + 1 < s.length) { v += s[j + 1]; j += 2; continue; }
          v += s[j++];
        }
        out.push({ t: "str", v, p: i });
        i = j + 1;
        continue;
      }
      if (c === ":" && s[i + 1] === ":") { out.push({ t: "op", v: "::", p: i }); i += 2; continue; }
      if (c === "-" && s[i + 1] === ">") { out.push({ t: "op", v: "->", p: i }); i += 2; continue; }
      if (CLOSE[c]) {
        const j = matchClose(s, i), inner = s.slice(i + 1, j);
        out.push({ t: c, v: inner.trim(), p: i, ip: i + 1 + inner.length - inner.trimStart().length });   // ip: where `v` starts
        i = j + 1;
        continue;
      }
      if (c === ",") { out.push({ t: ",", p: i }); i++; continue; }
      let j = i;
      while (j < s.length && !/[\s",[\]{}()]/.test(s[j])
        && !(s[j] === ":" && s[j + 1] === ":") && !(s[j] === "-" && s[j + 1] === ">")) j++;
      if (j === i) { out.push({ t: "op", v: c, p: i }); i++; continue; }   // stray `]`, `}`, `)`
      out.push({ t: "w", v: s.slice(i, j), p: i });
      i = j;
    }
    return out;
  }

  /* `meta { key = "value" other = 3 }` → { key: "value", other: "3" } */
  const META = /([A-Za-z_][\w.-]*)\s*=\s*("(?:[^"\\]|\\.)*"|[^\s,;"]+)/g;
  function parseMeta(body) {
    const meta = {};
    for (const m of String(body || "").matchAll(META))
      meta[m[1]] = m[2][0] === '"' ? m[2].slice(1, -1).replace(/\\(.)/g, "$1") : m[2];
    return meta;
  }

  /* Pulls `:: "…"`, `technology "…"`, `satisfies [...]`, `meta {…}` and
     `realizes (module "…" | context X | interface X | event X | value type X)`
     from anywhere in the head; `rest` keeps `keyword Name [on Broker] …`.
     A trailing non-meta `{ … }` is a one-line block body (`inline`, starting
     at `inlineAt` in the head). `meta` is the parsed map, or null. */
  function parseHead(head) {
    const tk = tokenize(head);
    const h = { rest: [], desc: "", technology: "", satisfies: [], realizes: [], inline: null, inlineAt: 0, meta: null };
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i], nx = tk[i + 1];
      if (t.t === "op" && t.v === "::" && nx && nx.t === "str") { h.desc = nx.v; i++; continue; }
      if (t.t === "w" && t.v === "technology" && nx && nx.t === "str") { h.technology = nx.v; i++; continue; }
      if (t.t === "w" && t.v === "satisfies" && nx && nx.t === "[") {
        h.satisfies.push(...nx.v.split(",").map(x => x.trim()).filter(Boolean)); i++; continue;
      }
      if (t.t === "w" && t.v === "meta" && nx && nx.t === "{") { h.meta = Object.assign(h.meta || {}, parseMeta(nx.v)); i++; continue; }
      if (t.t === "w" && t.v === "realizes") {
        let j = i + 1;
        for (;;) {
          const a = tk[j], b = tk[j + 1], c = tk[j + 2];
          if (a && a.t === ",") { j++; continue; }
          if (a && a.t === "w" && (a.v === "module" || a.v === "context") && b && (b.t === "str" || b.t === "w")) {
            h.realizes.push({ kind: a.v, name: b.v }); j += 2; continue;
          }
          if (a && a.t === "w" && (a.v === "interface" || a.v === "event") && b && b.t === "w") {
            h.realizes.push({ kind: a.v, name: b.v }); j += 2; continue;
          }
          if (a && a.t === "w" && a.v === "value" && b && b.v === "type" && c && c.t === "w") {
            h.realizes.push({ kind: "value type", name: c.v }); j += 3; continue;
          }
          break;
        }
        i = j - 1;
        continue;
      }
      if (t.t === "{" && h.inline == null) { h.inline = t.v; h.inlineAt = t.ip; continue; }
      h.rest.push(t);
    }
    return h;
  }

  const word = (h, i) => { const t = h.rest[i]; return t && (t.t === "w" || t.t === "str") ? t.v : ""; };
  /* comma-separated names after the keyword (`carries A, B`, `deploy A, B replicas 2`) */
  const namesAfter = (h, stop) => {
    const out = [];
    for (let i = 1; i < h.rest.length; i++) {
      const t = h.rest[i];
      if (t.t === "w" && stop && t.v === stop) break;
      if (t.t === "w" || t.t === "str") out.push(t.v);
    }
    return out;
  };
  /* one-line block bodies: `{ provides A requires B }` → clause statements */
  const INLINE_SPLIT = /\s+(?=(?:provides|requires|consumes|publishes|subscribes|carries|deploy|boundedContext)\b)/;
  const inlineItems = body => body.split(INLINE_SPLIT).map(s => s.trim()).filter(Boolean).map(s => ({ head: s }));
  const OPERATION = /^(?:(?:safe|oneway|streaming)\s+)?[A-Za-z_]\w*\s*\(/;
  /* Organization files: a one-line body is cut before each top-level word
     (outside strings and brackets) the sticky `start` matches, and every
     statement keeps where it starts. */
  const CLAUSE0 = /(?:provides|requires|consumes|publishes|subscribes|carries|deploy|boundedContext|masters|handles|area|used-by|detailed-in|hotspot)(?![\w-])/y;
  const MEMBER0 = /(?:domain-source|requirements-source|phase|area|person|externalSystem|system|dependency)(?![\w-])/y;
  const FLOW0 = /flow\s+\d/y;
  const PHASE0 = /phase\s+[A-Za-z_]/y;
  function inlineItems0(it, h, start) {
    const body = h.inline, cuts = [0];
    let depth = 0, inStr = false;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (inStr && c === "\\") { i++; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (CLOSE[c]) depth++;
      else if (c === "]" || c === "}" || c === ")") depth--;
      else if (!depth && i && /\s/.test(body[i - 1])) { start.lastIndex = i; if (start.test(body)) cuts.push(i); }
    }
    const out = [];
    cuts.forEach((from, n) => {
      const head = body.slice(from, n + 1 < cuts.length ? cuts[n + 1] : body.length).trim();
      if (head) out.push({ head, src: it.src, at: (it.at || 0) + h.inlineAt + from });
    });
    return out;
  }

  /* ---- 5. interpret ---- */
  const arch = {
    id: fileStem, name: fileStem, description: "", domainSource: "", requirementsSource: "",
    persons: [], externalSystems: [], systems: [], system: null,
    counts: null,
  };
  /* level 0: only an organization file carries these (see the header comment) */
  if (ORG) Object.assign(arch, { root: "organization", meta: null, domainSources: [], phases: [], areas: [],
    dependencies: [], flows: [], acknowledged: [], issues: [] });
  const newSystem = (name, h) => {
    const sys = { id: String(name || "").replace(/[^\w.-]+/g, "-"), name: name || "", description: (h && h.desc) || "",
      satisfies: [], realizes: [], boundedContexts: [], interfaces: [], containers: [], channels: [], connectors: [], environments: [] };
    if (ORG) Object.assign(sys, { technology: "", area: "", usedBy: [], masters: [], handles: [], hotspots: [],
      contexts: [], detailedIn: "", detail: "none", meta: null, status: "", contacts: [], documents: [], line: 0 });
    arch.systems.push(sys);
    return sys;
  };

  /* ---- level 0 (organization root) ---- */
  const refs = [];                    // every concept reference read, for the NOTE acknowledgements
  const issue = (it, message) => arch.issues.push({ line: lineAt(it, 0), message });
  const short = s => (s.length > 60 ? s.slice(0, 59) + "…" : s);

  /* The reader stays tolerant — it reads what it can — but what the grammar
     (src/grammars/architecture.ebnf, "Level 0") would reject is recorded in
     `issues`. A level-0 statement is reduced to the shape of its tokens —
     words as written, a string to "s", `:: "…"` to ::d, `meta {…}` to meta{},
     any other bracket to {} [] () — and compared with its production. */
  function shapeOf(head) {
    const tk = tokenize(head), out = [];
    for (let i = 0; i < tk.length; i++) {
      const t = tk[i], nx = tk[i + 1];
      if (t.t === "op" && t.v === "::" && nx && nx.t === "str") { out.push("::d"); i++; }
      else if (t.t === "w" && t.v === "meta" && nx && nx.t === "{") { out.push("meta{}"); i++; }
      else if (t.t === "str") out.push('"s"');
      else if (t.t === "w") out.push(...t.v.split(/(:)/).filter(Boolean));   // `A: B`, `A :B`: the colon alone
      else if (CLOSE[t.t]) out.push(t.t + CLOSE[t.t]);
      else out.push(t.t === "," ? "," : t.v);
    }
    return out.join(" ");
  }
  const T = "[A-Z][A-Za-z0-9]*";                       // typeName (PascalCase)
  const REF = `${T}(?:\\.${T})?`;                      // conceptRef: [Context.]Concept
  const DM = "(?: ::d)?(?: meta\\{\\})?";              // [description] [metadataBlock]
  const MECH = '(?: over "s"(?: (?:manual|automated))?| (?:manual|automated))';
  const RREF = `(?:(?:module|context) (?:${T}|"s")|(?:interface|event) ${T}|value type ${T})`;
  const REALIZES = `(?: realizes ${RREF}(?: , ${RREF})*)?`;
  const BODY = "(?: \\{\\})?";                         // a body written on the statement's line
  const GRAMMAR0 = {                                   // production → [shape, the form to write]
    organization: [`organization ${T}${DM}${BODY}`, 'organization Name [:: "…"] [meta {…}] { … }'],
    "domain-source": ['domain-source "s"', 'domain-source "path"'],
    "requirements-source": ['requirements-source "s"', 'requirements-source "path"'],
    phase: [`phase ${T}${DM}`, 'phase Name [:: "…"] [meta {…}]'],
    area: [`area ${T}${DM}`, 'area Name [:: "…"] [meta {…}]'],
    areaRef: [`area ${T}`, "area Name"],
    person: [`person ${T}${DM}`, 'person Name [:: "…"] [meta {…}]'],
    externalSystem: [`externalSystem ${T}${DM}${REALIZES}${BODY}`, 'externalSystem Name [:: "…"] [meta {…}] [realizes …] [{ … }]'],
    system: [`system ${T}${DM}(?: technology "s")?(?: satisfies \\[\\])?${REALIZES}${BODY}`,
      'system Name [:: "…"] [meta {…}] [technology "…"] [satisfies […]] [realizes …] [{ … }]'],
    "used-by": [`used-by ${T}(?: , ${T})*`, "used-by Person, …"],
    masters: [`masters ${REF}(?: , ${REF})*`, "masters [Context.]Concept, …"],
    handles: [`handles ${REF}(?: , ${REF})*`, "handles [Context.]Concept, …"],
    hotspot: [`hotspot ${T}${DM}(?: concerns (?:\\d+|${REF})(?: , (?:\\d+|${REF}))*)?`, 'hotspot Name :: "…" [meta {…}] [concerns 1, Concept, …]'],
    "detailed-in": ['detailed-in "s"', 'detailed-in "file.arch"'],
    dependency: [`dependency ${T} -> ${T}(?: : ${T}(?: , ${T})*)?(?: criticality [A-Za-z]+)?${DM}${BODY}`,
      'dependency Downstream -> Upstream [: Pattern, …] [criticality …] [:: "…"] [meta {…}] [{ flows }]'],
    flow: [`flow \\d+ "s"${DM} carries ${REF}(?: as ${REF})?(?: , ${REF}(?: as ${REF})?)*(?: to ${T})?(?:${MECH}|${BODY})`,
      'flow N "label" [:: "…"] [meta {…}] carries A [as B], … [to System] [over "…"] [manual | automated] — or { phase … } in place of the mechanism'],
    phased: [`phase ${T}${MECH}`, 'phase Name [over "…"] [manual | automated], at least one of the two'],
  };
  for (const production of Object.values(GRAMMAR0)) production[0] = new RegExp(`^${production[0]}$`);
  /* records the statement when it is not written as its production — unless a
     more precise issue was recorded for it since `before` */
  function grammar0(it, production, before) {
    if (arch.issues.length > before) return;
    const [shape, form] = GRAMMAR0[production];
    if (!shape.test(shapeOf(it.head))) issue(it, `not written as \`${form}\`: ${short(it.head)}`);
  }
  const PATTERNS0 = new Set(["CS", "Conformist", "ACL", "OHS", "SharedKernel", "PublishedLanguage", "Partnership"]);
  const CRITICALITY0 = new Set(["critical", "degraded", "tolerant"]);
  const CLAUSES0 = new Set(["area", "used-by", "masters", "handles", "hotspot", "detailed-in"]);   // level0Clause
  /* what the organization body holds: its members, and the level-0 words that get a message of their own when misplaced */
  const ORG_BODY = new Set(["domain-source", "requirements-source", "phase", "area", "person", "externalSystem", "system",
    "dependency", "used-by", "masters", "handles", "hotspot", "detailed-in", "flow"]);
  /* what a system body never holds: the roots, the organization's own members, a flow */
  const ORG_ONLY = new Set(["organization", "architecture", "domain-source", "requirements-source", "person", "externalSystem",
    "system", "phase", "dependency", "flow"]);
  /* `[Context.]Concept` */
  function conceptRef(t, it) {
    const parts = t.v.split(".").filter(Boolean);
    const name = parts.pop() || t.v;
    const ref = { name, context: parts.length ? parts.join(".") : null, raw: t.v, line: lineAt(it, t.p) };
    refs.push(ref);
    return ref;
  }
  const semicolons = s => String(s || "").split(";").map(x => x.trim()).filter(Boolean);
  /* `Label <url>`; a bare URL is its own label */
  function documentOf(s) {
    const m = /^(.*?)\s*<\s*([^<>\s]+)\s*>$/.exec(s);
    if (m) return { label: m[1] || m[2], url: m[2] };
    return { label: s, url: /\s/.test(s) ? "" : s };
  }
  /* what a `system` header says at level 0; a repeated block completes it */
  function level0Header(sys, h, it) {
    if (!sys.line) sys.line = lineAt(it, 0);
    if (h.technology && !sys.technology) sys.technology = h.technology;
    for (const r of h.realizes) if (r.kind === "context" && !sys.contexts.includes(r.name)) sys.contexts.push(r.name);
    if (h.meta) {
      sys.meta = Object.assign(sys.meta || {}, h.meta);
      sys.status = sys.meta.status || "";
      sys.contacts = semicolons(sys.meta.contacts);
      sys.documents = semicolons(sys.meta.documents).map(documentOf);
    }
  }
  /* hotspot Name :: "…" [concerns 1, 2, Concept] */
  function hotspotOf(it, h, sys) {
    const name = word(h, 1);
    const hotspot = { id: name, name, description: h.desc, flows: [], concepts: [], meta: h.meta, line: lineAt(it, 0) };
    if (!h.desc) issue(it, `hotspot ${name} of ${sys.name} has no description`);
    const at = h.rest.findIndex((t, i) => i > 1 && t.t === "w" && t.v === "concerns");
    if (at > 0) for (const t of h.rest.slice(at + 1)) {
      if (t.t !== "w") continue;
      if (/^\d+$/.test(t.v)) hotspot.flows.push(Number(t.v));
      else hotspot.concepts.push(conceptRef(t, it));
    }
    sys.hotspots.push(hotspot);
  }
  /* `over "…" [manual | automated]` | `manual` | `automated`, read from token `i` on;
     also picks the `to Receiver` of a flow written after its mechanism */
  function mechanismOf(r, i, flow) {
    const m = { over: null, mode: null };
    for (; i < r.length; i++) {
      const t = r[i], nx = r[i + 1];
      if (t.t !== "w") continue;
      if (t.v === "over" && nx && nx.t === "str") { m.over = nx.v; i++; }
      else if (t.v === "manual" || t.v === "automated") m.mode = t.v;
      else if (flow && t.v === "to" && nx && nx.t === "w") { flow.to = nx.v; i++; }
    }
    return m;
  }
  /* flow N "label" carries A [as B], … [to Receiver] ( [mechanism] | { phase P mechanism … } ) */
  function flowOf(it, dep) {
    const before = arch.issues.length;
    const h = parseHead(it.head);
    const r = h.rest;
    const number = r[1] && r[1].t === "w" && /^\d+$/.test(r[1].v) ? Number(r[1].v) : null;
    if (word(h, 0) !== "flow" || number == null) { issue(it, `dependency ${dep.id}: not a flow: ${short(it.head)}`); return; }
    /* data goes from the upstream system to the downstream one unless `to` names the upstream end */
    const flow = { number, label: "", description: h.desc, meta: h.meta, carries: [], to: null,
      sender: dep.to, receiver: dep.from, mechanism: null, perPhase: [], dependency: dep.id, line: lineAt(it, 0) };
    let i = 2;
    if (r[i] && r[i].t === "str") flow.label = r[i++].v;
    if (r[i] && r[i].t === "w" && r[i].v === "carries") {
      for (i++; r[i] && r[i].t === "w";) {
        const carried = { concept: conceptRef(r[i++], it), as: null };
        if (r[i] && r[i].t === "w" && r[i].v === "as" && r[i + 1] && r[i + 1].t === "w") { carried.as = conceptRef(r[i + 1], it); i += 2; }
        flow.carries.push(carried);
        if (!r[i] || r[i].t !== ",") break;
        i++;
      }
    }
    if (!flow.carries.length) issue(it, `flow ${number} carries nothing`);
    const m = mechanismOf(r, i, flow);
    if (m.over != null || m.mode != null) flow.mechanism = m;
    /* the per-phase block, when one is written: at least one entry, in place of the mechanism */
    const block = it.node ? it.node.items : h.inline != null ? inlineItems0(it, h, PHASE0) : null;
    if (block && !block.length) issue(it, `flow ${number}: an empty { } block — list at least one phase, or write no block`);
    if (block && block.length && flow.mechanism) issue(it, `flow ${number} states its mechanism both once and per phase`);
    grammar0(it, "flow", before);
    for (const p of block || []) {
      const at = arch.issues.length;
      const ph = parseHead(p.head);
      if (word(ph, 0) !== "phase" || !word(ph, 1)) { issue(p, `flow ${number}: not a phase line: ${short(p.head)}`); continue; }
      const pm = mechanismOf(ph.rest, 2);
      if (pm.over == null && pm.mode == null) issue(p, `flow ${number}: phase ${word(ph, 1)} states no mechanism`);
      grammar0(p, "phased", at);
      flow.perPhase.push({ phase: word(ph, 1), over: pm.over, mode: pm.mode, line: lineAt(p, 0) });
    }
    if (flow.to === dep.to) { flow.sender = dep.from; flow.receiver = dep.to; }
    dep.flows.push(flow);
  }
  /* dependency Downstream -> Upstream [: Pattern, …] [criticality c] [:: "…"] [{ flows }] */
  function dependencyOf(it, h) {
    const before = arch.issues.length;
    /* a lone `:` is no token of the head tokenizer: `A : B`, `A: B`, `A :B` come as words */
    const r = h.rest.flatMap(t => (t.t !== "w" || !t.v.includes(":") ? [t]
      : t.v.split(/(:)/).filter(Boolean).map(v => ({ t: "w", v, p: t.p }))));
    const arrow = r.findIndex(t => t.t === "op" && t.v === "->");
    const end = t => (t && t.t === "w" && /^[A-Za-z_]/.test(t.v) ? t.v : "");
    const from = arrow > 0 ? end(r[arrow - 1]) : "", to = arrow > 0 ? end(r[arrow + 1]) : "";
    if (arrow !== 2 || !from || !to) { issue(it, `not a dependency: ${short(it.head)}`); return; }
    let id = `${from}->${to}`;
    for (let n = 2; arch.dependencies.some(d => d.id === id); n++) id = `${from}->${to}#${n}`;
    const dep = { id, from, to, patterns: [], criticality: null, description: h.desc, meta: h.meta,
      flows: [], mutual: false, line: lineAt(it, 0) };
    let i = arrow + 2;
    if (r[i] && r[i].t === "w" && r[i].v === ":") {
      for (i++; r[i] && r[i].t === "w" && r[i].v !== "criticality";) {
        dep.patterns.push(r[i++].v);
        if (r[i] && r[i].t === ",") i++;
      }
    }
    for (; i < r.length; i++)
      if (r[i].t === "w" && r[i].v === "criticality" && r[i + 1] && r[i + 1].t === "w") { dep.criticality = r[i + 1].v; break; }
    arch.dependencies.push(dep);
    for (const p of dep.patterns) if (!PATTERNS0.has(p)) issue(it, `dependency ${from} -> ${to}: unknown pattern ${p}`);
    if (dep.criticality && !CRITICALITY0.has(dep.criticality)) issue(it, `dependency ${from} -> ${to}: unknown criticality ${dep.criticality}`);
    grammar0(it, "dependency", before);
    for (const f of it.node ? it.node.items : h.inline != null ? inlineItems0(it, h, FLOW0) : []) {
      try { flowOf(f, dep); } catch (e) { issue(f, `dependency ${dep.id}: unreadable: ${short(f.head)}`); }
    }
  }
  /* Connector ends, once every system is read. Names declared in a system
     body are local to it; an end is local (`Container[.Component][.Interface]`,
     `Component[.Interface]`), in a peer (`System.Container[…]`), a bare peer
     system (a black box), a person or an external system. */
  function resolveEnds() {
    const systems = new Map(arch.systems.map(s => [s.name, s]));
    const persons = new Set(arch.persons.map(p => p.name));
    const externals = new Set(arch.externalSystems.map(x => x.name));
    const found = (kind, system, container, component, parts, i) =>
      ({ kind, system, container, component, interface: parts.slice(i).join(".") || null });
    const inside = (sys, parts, i) => {
      const container = sys.containers.find(c => c.name === parts[i]);
      const nested = container && container.components.find(k => k.name === parts[i + 1]);
      if (nested) return found("component", sys.name, container.name, nested.name, parts, i + 2);
      if (container) return found("container", sys.name, container.name, null, parts, i + 1);
      for (const c of sys.containers) {
        const k = c.components.find(x => x.name === parts[i]);
        if (k) return found("component", sys.name, c.name, k.name, parts, i + 1);
      }
      return null;
    };
    const resolve = (sys, end) => {
      const parts = [end.name].concat(end.iface ? String(end.iface).split(".") : []);
      const peer = systems.get(parts[0]);
      return inside(sys, parts, 0)
        || (peer && parts.length > 1 && inside(peer, parts, 1))
        || found(peer ? "system" : persons.has(parts[0]) ? "person" : externals.has(parts[0]) ? "externalSystem" : null,
             peer ? peer.name : null, null, null, parts, 1);
    };
    for (const sys of arch.systems)
      for (const c of sys.connectors) { Object.assign(c.from, resolve(sys, c.from)); Object.assign(c.to, resolve(sys, c.to)); }
  }
  /* the system a member belongs to; a bare file (members outside any
     `system` block) gets one implicit system */
  let implicit = null;
  const sysOf = scope => scope.sys || implicit || (implicit = newSystem(""));
  let connectorCount = 0;
  const SYSTEM_MEMBERS = new Set(["boundedContext", "interface", "container", "channel", "connect", "environment"]);

  function connector(h) {
    // connect A[.I] -> B[.I] over "protocol" (sync|async|streaming)
    const r = h.rest;
    const arrow = r.findIndex(t => t.t === "op" && t.v === "->");
    if (arrow < 2) return null;
    const endpoint = t => {
      const parts = (t && (t.t === "w" || t.t === "str") ? t.v : "").split(".").filter(Boolean);
      return parts.length ? { name: parts[0], iface: parts.length > 1 ? parts.slice(1).join(".") : null } : null;
    };
    const from = endpoint(r[arrow - 1]), to = endpoint(r[arrow + 1]);
    if (!from || !to) return null;
    let protocol = "", style = "sync";
    for (let i = arrow + 2; i < r.length; i++) {
      const t = r[i];
      if (t.t === "w" && t.v === "over" && r[i + 1] && r[i + 1].t === "str") { protocol = r[i + 1].v; i++; continue; }
      if (t.t === "w" && /^(sync|async|streaming)$/.test(t.v)) style = t.v;
    }
    return { id: "c" + (++connectorCount), from, to, protocol, style, description: h.desc };
  }

  function walk(items, scope) {
    for (const it of items || []) {
      try { interpret(it, scope); } catch (e) { /* tolerant: skip what cannot be read */ }
    }
  }

  function interpret(it, scope) {
    const h = parseHead(it.head);
    const kw = word(h, 0);
    const sub = it.node ? it.node.items
      : h.inline == null ? null
      : ORG && (kw === "system" || kw === "externalSystem") ? inlineItems0(it, h, CLAUSE0)
      : ORG && kw === "organization" ? inlineItems0(it, h, MEMBER0)
      : inlineItems(h.inline);
    const name = word(h, 1);
    const owner = scope.component || scope.container || scope.ext;
    /* level 0 is read at two places only: the organization body ("org") and a
       system body ("system"); deeper, its words are plain identifiers */
    const level = ORG ? scope.level || "" : "";
    /* what the grammar rejects around a level-0 statement, before reading it */
    const before = ORG ? arch.issues.length : 0;
    if (level === "org" && !ORG_BODY.has(kw)) {
      issue(it, `not a member of an organization (domain-source, requirements-source, phase, area, person, externalSystem, system, dependency): ${short(it.head)}`);
      return;
    }
    if (level === "system") {
      if (CLAUSES0.has(kw)) {
        if (scope.body.member) issue(it, `system ${scope.sys.name}: ${kw} comes after ${scope.body.member} — the level-0 clauses come first in a system body`);
      } else if (ORG_ONLY.has(kw)) {
        /* phase, dependency and flow say so themselves, below */
        if (kw !== "phase" && kw !== "dependency" && kw !== "flow")
          issue(it, `${short(`${kw} ${name}`.trim())} is declared in the organization body, not in system ${scope.sys.name}`);
      } else if (kw && !scope.body.member) {
        scope.body.member = short(`${kw} ${name}`.trim());   // the first member of levels 2–3
      }
    }
    if (ORG && scope.ext && kw !== "provides" && kw !== "consumes" && kw !== "masters")
      issue(it, `${kw || short(it.head)} on external system ${scope.ext.name}: an external system states provides, consumes and masters only`);
    if (ORG && SYSTEM_MEMBERS.has(kw) && !scope.sys) return;   // an organization has no implicit system
    const sys = SYSTEM_MEMBERS.has(kw) ? sysOf(scope) : scope.sys || null;

    switch (kw) {
      case "architecture":
        if (ORG) return;   // the organization is the root of the file: a second root does not rename it
        if (name) arch.name = name;
        if (h.desc) arch.description = h.desc;
        walk(sub, scope);
        return;
      case "organization":
        if (!ORG || level || scope.sys) return;
        if (name) arch.name = name;
        if (h.desc) arch.description = h.desc;
        if (h.meta) arch.meta = Object.assign(arch.meta || {}, h.meta);
        grammar0(it, "organization", before);
        walk(sub, { level: "org" });
        return;
      case "domain-source":
        if (!ORG) arch.domainSource = name;
        else if (name && !arch.domainSources.includes(name)) {
          arch.domainSources.push(name);
          arch.domainSource = arch.domainSources[0];
        }
        if (level === "org") grammar0(it, "domain-source", before);
        return;
      case "requirements-source":
        arch.requirementsSource = name;
        if (level === "org") grammar0(it, "requirements-source", before);
        return;
      case "person":
        if (name) arch.persons.push(ORG
          ? { id: name, name, description: h.desc, meta: h.meta, line: lineAt(it, 0) }
          : { id: name, name, description: h.desc });
        if (level === "org") grammar0(it, "person", before);
        return;
      case "externalSystem": {
        if (level === "org") grammar0(it, "externalSystem", before);
        if (!name) return;
        const ext = { id: name, name, description: h.desc, realizes: h.realizes, provides: [], consumes: [] };
        if (ORG) Object.assign(ext, { masters: [], handles: [],
          contexts: h.realizes.filter(r => r.kind === "context").map(r => r.name), meta: h.meta, line: lineAt(it, 0) });
        arch.externalSystems.push(ext);
        walk(sub, { ext });
        return;
      }
      case "system": {
        if (level === "org") grammar0(it, "system", before);
        // a repeated block of the same system continues it
        const known = arch.systems.find(x => x.name === name && name);
        const target = known || newSystem(name, h);
        if (!target.description && h.desc) target.description = h.desc;
        target.satisfies.push(...h.satisfies);
        target.realizes.push(...h.realizes);
        if (ORG) level0Header(target, h, it);
        walk(sub, ORG ? { sys: target, level: "system", body: { member: "" } } : { sys: target });
        return;
      }
      /* ---- level 0: organization files only; elsewhere these words are not
         keywords and fall to the unknown statements, as before ---- */
      case "phase":
        if (level === "org") {
          if (name) arch.phases.push({ id: name, name, description: h.desc, meta: h.meta, line: lineAt(it, 0) });
          grammar0(it, "phase", before);
        } else if (level) issue(it, `phase ${name} is neither in the organization body nor in a flow`);
        return;
      case "area":
        if (!level) return;
        if (level === "org") {
          if (name) arch.areas.push({ id: name, name, description: h.desc, meta: h.meta, systems: [], line: lineAt(it, 0) });
          grammar0(it, "area", before);
          return;
        }
        if (scope.sys.area) issue(it, `system ${scope.sys.name} states its area more than once`);
        else if (name) scope.sys.area = name;
        grammar0(it, "areaRef", before);
        return;
      case "used-by":
        if (level === "system") {
          for (const n of namesAfter(h)) if (!scope.sys.usedBy.includes(n)) scope.sys.usedBy.push(n);
          grammar0(it, "used-by", before);
        } else if (level) issue(it, "used-by outside a system");
        return;
      case "masters":
      case "handles": {
        if (!ORG) return;
        const holder = level === "system" ? scope.sys : scope.ext;
        if (!holder || !Array.isArray(holder[kw])) { if (level) issue(it, `${kw} outside a system or an external system`); return; }
        for (const t of h.rest.slice(1)) {
          if (t.t !== "w") continue;
          const ref = conceptRef(t, it);
          if (!holder[kw].some(x => x.raw === ref.raw)) holder[kw].push(ref);   // repeated lists merge
        }
        grammar0(it, kw, before);
        return;
      }
      case "hotspot":
        if (level === "system" && name) { hotspotOf(it, h, scope.sys); grammar0(it, "hotspot", before); }
        else if (level === "system") grammar0(it, "hotspot", before);
        else if (level) issue(it, `hotspot ${name} outside a system`);
        return;
      case "detailed-in":
        if (level !== "system") { if (level) issue(it, "detailed-in outside a system"); return; }
        if (scope.sys.detailedIn) issue(it, `system ${scope.sys.name} states detailed-in more than once`);
        else scope.sys.detailedIn = name;
        grammar0(it, "detailed-in", before);
        return;
      case "dependency":
        if (level === "org") dependencyOf(it, h);
        else if (level) issue(it, `a dependency is declared in the organization body, not in system ${scope.sys.name}`);
        return;
      case "flow":
        if (level) issue(it, `flow outside a dependency: ${short(it.head)}`);
        return;
      case "boundedContext":
        if (!name) return;
        if (scope.component) scope.component.boundedContext = name;
        else sys.boundedContexts.push({ id: name, name, description: h.desc });
        return;
      case "interface":
        if (!name) return;
        sys.interfaces.push({ id: name, name, description: h.desc, realizes: h.realizes,
          operations: (sub || []).filter(x => !x.node && OPERATION.test(x.head)).length });
        return;
      case "container": {
        if (!name) return;
        const container = { id: name, name, description: h.desc, technology: h.technology,
          satisfies: h.satisfies, realizes: h.realizes, provides: [], requires: [], components: [] };
        sys.containers.push(container);
        walk(sub, { container, sys });
        return;
      }
      case "component": {
        if (!name || !scope.container) return;   // a component lives in a container
        const component = { id: name, name, description: h.desc, boundedContext: "",
          satisfies: h.satisfies, realizes: h.realizes, provides: [], requires: [], publishes: [], subscribes: [] };
        scope.container.components.push(component);
        walk(sub, { container: scope.container, component, sys });
        return;
      }
      case "provides":
      case "requires":
      case "consumes":
        if (name && owner && Array.isArray(owner[kw])) owner[kw].push(name);
        return;
      case "publishes": {
        // publishes Event to channel
        const to = h.rest.findIndex(t => t.t === "w" && t.v === "to");
        const channel = to > 0 ? word(h, to + 1) : "";
        if (name && scope.component) scope.component.publishes.push({ event: name, channel });
        return;
      }
      case "subscribes":
        if (name && scope.component) scope.component.subscribes.push(name);
        return;
      case "channel": {
        if (!name) return;
        const on = h.rest.findIndex(t => t.t === "w" && t.v === "on");
        const channel = { id: name, name, broker: on > 0 ? word(h, on + 1) : "", description: h.desc, carries: [] };
        sys.channels.push(channel);
        walk(sub, { channel, sys });
        return;
      }
      case "carries":
        if (scope.channel) scope.channel.carries.push(...namesAfter(h));
        return;
      case "connect": {
        const c = connector(h);
        if (c && ORG) c.line = lineAt(it, 0);
        if (c) sys.connectors.push(c);
        return;
      }
      case "environment": {
        if (!name) return;
        const env = { id: name, name, description: h.desc, deploys: [] };
        sys.environments.push(env);
        walk(sub, { env, sys });
        return;
      }
      case "node":
        // a node's deploys (nested nodes included) belong to its environment; resources are skipped
        if (scope.env) walk(sub, scope);
        return;
      case "deploy": {
        if (!scope.env) return;
        const rep = h.rest.findIndex(t => t.t === "w" && t.v === "replicas");
        const replicas = rep > 0 && /^\d+$/.test(word(h, rep + 1)) ? Number(word(h, rep + 1)) : null;
        for (const container of namesAfter(h, "replicas")) scope.env.deploys.push({ container, replicas });
        return;
      }
      default:
        // struct / enum / union / exception / typedef / import / operations / unknown
        return;
    }
  }

  /* the file normally holds one `architecture` block; a bare file (members at
     top level) is read the same way */
  walk(root.items, {});
  if (!arch.systems.length && !ORG) newSystem(arch.name);   // an organization never gets a made-up system
  for (const sys of arch.systems) if (!sys.name) { sys.name = arch.name; sys.id = String(arch.name).replace(/[^\w.-]+/g, "-"); }
  arch.system = arch.systems[0] || null;

  const sum = f => arch.systems.reduce((n, s) => n + f(s), 0);
  arch.counts = {
    systems: arch.systems.length,
    persons: arch.persons.length,
    externalSystems: arch.externalSystems.length,
    containers: sum(s => s.containers.length),
    components: sum(s => s.containers.reduce((n, c) => n + c.components.length, 0)),
    interfaces: sum(s => s.interfaces.length),
    channels: sum(s => s.channels.length),
    connectors: sum(s => s.connectors.length),
    environments: sum(s => s.environments.length),
  };

  /* ---- 6. level 0: what is known once the whole organization is read ---- */
  if (ORG) {
    for (const a of arch.areas) a.systems = arch.systems.filter(s => s.area === a.name).map(s => s.name);
    for (const s of arch.systems)
      s.detail = s.detailedIn ? "file"
        : s.containers.length || s.interfaces.length || s.channels.length || s.connectors.length || s.environments.length ? "inline"
        : "none";
    /* two dependencies in opposite directions form a mutual pair */
    const pairs = new Set(arch.dependencies.map(d => `${d.from}->${d.to}`));
    for (const d of arch.dependencies) d.mutual = d.from !== d.to && pairs.has(`${d.to}->${d.from}`);
    arch.flows = arch.dependencies.flatMap(d => d.flows);
    resolveEnds();
    /* a NOTE covers every concept name of its line, and thereby every other use of those names */
    const noted = new Map();
    for (const r of refs) {
      const note = noteAt.get(r.line);
      if (note != null && !noted.has(r.name)) noted.set(r.name, { name: r.name, note, line: r.line });
    }
    arch.acknowledged = [...noted.values()];
    Object.assign(arch.counts, {
      areas: arch.areas.length,
      phases: arch.phases.length,
      dependencies: arch.dependencies.length,
      flows: arch.flows.length,
      hotspots: sum(s => s.hotspots.length),
      mutualPairs: [...pairs].filter(p => { const [a, b] = p.split("->"); return a < b && pairs.has(`${b}->${a}`); }).length,
    });
  }
  return arch;
}

/* Node (scripts/check-arch-export.mjs loads this file through vm; the
   browser ignores this block) */
if (typeof module !== "undefined" && module.exports) module.exports = parseArch;

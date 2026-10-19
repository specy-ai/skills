/* Tolerant reader for Specy v3 .domain files → the navigator's organization
   shape (see data.js). Structural, not grammatical: comments are stripped, the
   text is folded into a brace-scoped block tree, and block headers are
   interpreted by pattern. Unknown constructs are skipped, never fatal.

   Forms read (src/grammars/domain.ebnf lets the outer containers be elided):
   - a definition laid out one clause per line, or written whole on ONE line
     (`entity Contact :: "…" { identity id : uuid  fields { … } }`): both give
     the same element, in source order;
   - a definition written directly under a `context`, outside any `module`:
     the context gets one implicit module for them, placed after its declared
     modules — id `<fileStem>:<ctxShortname>:(context)`, name `(context)`
     (no declared module can bear that name), `implicit: true`. Its elements
     keep the ordinary id `<fileStem>:<ctxShortname>:<Name>`;
   - a file with no `organization`: the organization is implicit — id = the
     file stem as always, named after a `// Organization: Name` comment when
     there is one, else after the file stem, `implicit: true`;
   - `module`s or definitions at top level, outside any `context`: they go to
     one implicit context `<OrgName>Context`, whose shortname is the initials
     of the file stem in upper case (`business-loan` → `BL`), `implicit: true`
     — the names scripts/check-diagram-export.mjs gave such files by wrapping
     them, so their ids do not change.
   Inside a definition laid out over several lines, a sub-block may likewise
   hold on one line (`fields { a : string }`, `entities { A B }`, `must { … }`,
   `precondition p { … } rejects "…"`, an operation inside `operations { }`);
   a `satisfies [ … ]` list may span lines; enum values may share a line.
   Still line-oriented: a block header and its `{` share a line (only the
   `:: "description"` may sit alone on the next line, before the `{`). */

"use strict";

function parseDomain(text, fileStem) {

  /* ---- 1. strip comments (outside strings), drop blanks ---- */
  const lines = [];
  for (const raw of text.split("\n")) {
    let out = "", inStr = false;
    for (let i = 0; i < raw.length; i++) {
      const c = raw[i];
      if (c === '"') inStr = !inStr;
      if (!inStr && c === "/" && raw[i + 1] === "/") break;
      out += c;
    }
    out = out.trim();
    if (out) lines.push(out);
  }

  /* ---- 2. fold into a block tree ---- */
  const root = { header: "", children: [], statements: [] };
  const stack = [root];
  let headOf = null;   // the block whose last statement was the previous line, when that line may be the start of a header
  let listOf = null;   // the block whose last statement is a `satisfies [` list still open at the end of its line
  for (const line of lines) {
    if (listOf && !line.startsWith("}")) {   // `satisfies [REQ-A-001,` ⏎ `REQ-B-002]`: one statement
      listOf.statements[listOf.statements.length - 1] += " " + line;
      if (line.includes("]")) listOf = null;
      headOf = null;
      continue;
    }
    listOf = null;
    if (line.startsWith("}")) {
      if (stack.length > 1) {
        const closed = stack.pop();
        const tail = line.slice(1).trim();
        if (tail) closed.tail = tail;   // e.g. `} rejects "…"`
      }
      headOf = null;
      continue;
    }
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    const parent = stack[stack.length - 1];
    if (line.endsWith("{") && opens === closes + 1) {
      let header = line.slice(0, -1).trim();
      /* a header whose description sits on the next line — `repository Rides for Ride`
         ⏎ `:: "…" {` — is one header: `::` never starts a construct */
      if (header.startsWith("::") && headOf === parent) header = parent.statements.pop() + " " + header;
      const node = { header, children: [], statements: [] };
      parent.children.push(node);
      stack.push(node);
      headOf = null;
    } else {
      parent.statements.push(line);
      /* a whole block on one line: remembered with its place among the child
         blocks, for definitionNodes (below) */
      if (opens && opens === closes) (parent.inline = parent.inline || []).push({ at: parent.children.length, text: line });
      if (/^satisfies\s*\[[^\]]*$/.test(line)) listOf = parent;
      headOf = opens || closes ? null : parent;
    }
  }

  /* ---- helpers ---- */
  const descOf = h => { const m = h.match(/^(.*?)\s*::\s*"([^"]*)"\s*$/); return m ? { head: m[1].trim(), desc: m[2] } : { head: h.trim(), desc: "" }; };
  const satisfiesOf = node => {
    for (const s of node.statements) {
      const m = s.match(/^satisfies\s*\[(.*)\]$/);
      if (m) return m[1].split(",").map(x => x.trim()).filter(Boolean);
    }
    return [];
  };
  const childNamed = (node, name) => node.children.find(c => c.header === name || c.header.startsWith(name + " "));
  const blockText = node => node ? node.statements.join(" ") : "";

  function parseField(line) {
    const { head, desc } = descOf(line);
    const m = head.match(/^(\w+)\s*:\s*(\S+)\s*(.*)$/);
    if (!m) return null;
    const mods = m[3].trim();
    const noteBits = [];
    if (/\brequired\b/.test(mods)) noteBits.push("required");
    if (/\bimmutable\b/.test(mods)) noteBits.push("immutable");
    if (/\bcode\b/.test(mods)) noteBits.push("code field");
    const constraints = mods.match(/\b(?:min|max|minLength|maxLength|default)\([^)]*\)|\b(?:past|pastOrPresent|future)\b/g);
    if (constraints) noteBits.push(...constraints);
    if (desc) noteBits.push(desc);
    return {
      name: m[1], type: m[2],
      optional: /\boptional\b/.test(mods) || undefined,
      note: noteBits.join(" · ") || undefined,
      typeBase: m[2].replace(/^(?:list|set)<(.+)>$/, "$1"),
    };
  }
  const parseFields = node => (node ? node.statements.map(parseField).filter(Boolean) : []);

  function parseOperation(entry, isBlock) {
    // Two header forms: `"Label" on Command` and `name(args) [: ret]`
    const header = isBlock ? entry.header : entry;
    const { head, desc } = descOf(header);
    const op = { label: head, sig: "", emits: [], preconditions: [], postconditions: [] };
    let m = head.match(/^"([^"]+)"\s+on\s+(\w+)$/);
    if (m) { op.label = m[1]; op.onCommand = m[2]; }
    else {
      m = head.match(/^([\w]+)\s*\((.*)\)\s*(?::\s*(.+))?$/);
      if (m) { op.label = m[1]; op.sig = `${m[1]}(${m[2]})${m[3] ? " : " + m[3] : ""}`; }
      else if (!isBlock) return null;
    }
    if (desc) op.note = desc;
    if (!isBlock) return op;

    const words = s => (/^(?:safe|unsafe|idempotent)(?:\s+(?:safe|unsafe|idempotent))+$/.test(s) ? s.split(/\s+/) : [s]);   // `safe idempotent` on one line
    for (const s of entry.statements.flatMap(words)) {
      if (s === "safe") op.safe = true;
      else if (s === "unsafe") op.safe = false;
      else if (s === "idempotent") op.idempotent = true;
      else if (s.startsWith("returns ")) op.returnsExpr = s.slice(8);
      else {
        const sm = s.match(/^satisfies\s*\[(.*)\]$/);
        if (sm) op.satisfies = sm[1].split(",").map(x => x.trim()).filter(Boolean);
      }
    }
    for (const c of entry.children) {
      const h = descOf(c.header);
      let mm = h.head.match(/^precondition\s+(\w+)$/);
      if (mm) {
        const rej = (c.tail || "").match(/rejects\s+"([^"]*)"/);
        op.preconditions.push({ name: h.desc || mm[1], predicate: blockText(c), violation: rej ? rej[1] : "" });
        continue;
      }
      mm = h.head.match(/^postcondition\s+(\w+)$/);
      if (mm) { op.postconditions.push({ name: h.desc || mm[1], predicate: blockText(c) }); continue; }
      mm = h.head.match(/^emits\s+(\w+)$/);
      if (mm) { op.emits.push(mm[1]); continue; }
      // emits may also appear nested inside foreach blocks
      for (const cc of c.children) {
        const e = descOf(cc.header).head.match(/^emits\s+(\w+)$/);
        if (e) op.emits.push(e[1]);
      }
    }
    // one-line postcondition/emits statements (rare)
    for (const s of entry.statements) {
      const e = s.match(/^emits\s+(\w+)$/);
      if (e) op.emits.push(e[1]);
    }
    return op;
  }

  function parseOperations(node) {
    if (!node) return [];
    const ops = [];
    for (const c of node.children) { const op = parseOperation(c, true); if (op) ops.push(op); }
    for (const s of node.statements) { const op = parseOperation(s, false); if (op) ops.push(op); }
    return ops;
  }

  function parseStateMachines(node) {
    if (!node) return [];
    const machines = [];
    for (const mNode of node.children) {
      const mh = descOf(mNode.header).head.match(/^machine\s+(\w+)$/);
      if (!mh) continue;
      const sm = { name: descOf(mNode.header).desc || mh[1], states: [], transitions: [], starts: [] };
      const ensureState = n => {
        let st = sm.states.find(s => s.name === n);
        if (!st) { st = { name: n }; sm.states.push(st); }
        return st;
      };
      const handleTransition = (line, guard) => {
        const t = line.match(/^(\[\*\]|\w+)\s*-->\s*(\w+)\s+on\s+"([^"]+)"$/);
        if (!t) return false;
        if (t[1] === "[*]") {
          ensureState(t[2]).initial = true;
          sm.starts.push({ to: t[2], operation: t[3], guard });
          return true;
        }
        ensureState(t[1]); ensureState(t[2]);
        sm.transitions.push({ from: t[1], to: t[2], operation: t[3], guard });
        return true;
      };
      const handleState = (head, desc) => {
        const st = head.match(/^(state|final)\s+(\w+)$/);
        if (!st) return null;
        const x = ensureState(st[2]);
        if (st[1] === "final") x.final = true;
        if (desc) x.description = desc;
        return x;
      };
      for (const s of mNode.statements) {
        const { head, desc } = descOf(s);
        if (!handleState(head, desc)) handleTransition(head);
      }
      for (const c of mNode.children) {
        const ch = descOf(c.header);
        // state with an invariants block
        const x = handleState(ch.head, ch.desc);
        if (x) {
          const invBlock = c.children.find(b => descOf(b.header).head === "invariants");
          if (invBlock) x.invariants = invBlock.children.map(i => descOf(i.header).head).filter(Boolean);
          continue;
        }
        // transition with a guard precondition block
        const pre = c.children[0];
        let guard;
        if (pre) {
          const ph = descOf(pre.header);
          guard = ph.desc || blockText(pre);
        }
        handleTransition(ch.head, guard);
      }
      machines.push(sm);
    }
    return machines;
  }

  /* ---- 2b. one-line blocks ----
     The fold keeps `entity Contact { identity id : uuid  fields { … } }` as a
     statement of the enclosing block. definitionNodes gives it back as the
     node the same text would fold into when laid out one clause per line, so
     that step 3 reads both layouts through the same code. With no line ends
     to rely on, a body is cut into clauses by the keywords of its kind. */
  const DEFINITIONS = [   // definition header → the kind of its body
    [/^enum\s/, "enum"],
    [/^value\s/, "value"],
    [/^(?:aggregate|entity|read-only\s+entity)\s/, "entity"],
    [/^command\s/, "command"],
    [/^query\s/, "query"],
    [/^(?:(?:error|external|temporal)\s+)?event\s/, "event"],
    [/^(?:domain|application|infrastructure)\s+service\s/, "service"],
    [/^(?:api|spi)\s+interface\s|^(?:read-only\s+)?repository\s/, "port"],
    [/^reaction\s/, "reaction"],
    [/^invariant\s/, "invariant"],
    [/^agreement\s/, "agreement"],
  ];
  const defKind = header => { const d = DEFINITIONS.find(([re]) => re.test(header + " ")); return d ? d[1] : null; };

  const SUB_BLOCKS = [    // sub-block header → the kind of its body; any other body is kept as raw text
    [/^(?:fields|references)$/, "decls"],
    [/^entities$/, "names"],
    [/^operations$/, "operations"],
    [/^states$/, "states"],
    [/^machine\s/, "machine"],
    [/^invariants$/, "invariants"],
    [/^reconciliation\s/, "reconciliation"],
    [/^escalation$/, "escalation"],
    [/^step\s/, "step"],
    [/^foreach\s/, "opBody"],
  ];
  function bodyKind(parent, header) {
    const h = descOf(header).head;
    if (parent === "operations") return "opBody";
    if (parent === "invariants") return "scoped";
    if (parent === "machine") return /^(?:state|final)\s/.test(h) ? "state" : "transition";
    const sub = SUB_BLOCKS.find(([re]) => re.test(h));
    return sub ? sub[1] : "raw";
  }

  const CLAUSES = {       // body kind → the keywords that open a clause in it
    entity: "satisfies identity duplicate fields references operations states invariants entities sourced-from synced-via projected-by",
    value: "satisfies fields operations invariants",
    command: "satisfies identity fields",
    query: "satisfies reads-from fields returns",
    event: "satisfies about caused-by from sourced-from reference offset instant schedule guard fields",
    service: "satisfies calls exposed-by described-by operations",
    port: "satisfies exposes describes described-by",
    reaction: "satisfies triggered-by guard effects",
    invariant: "satisfies on must enforcement",
    agreement: "satisfies participants predicate reconciliation",
    reconciliation: "satisfies trigger detection compensation coordination escalation",
    escalation: "satisfies step",
    step: "satisfies when action",
    states: "machine",
    state: "satisfies invariants",
    transition: "satisfies precondition postcondition",
    opBody: "satisfies safe unsafe idempotent returns emits resolves creates sets foreach precondition postcondition",
    map: "upstream downstream symmetric",
  };
  const STARTS = {        // body kind → what else opens a statement, as a pattern over masked text
    decls: "\\w+\\s*:(?!:)",                                          // name : Type
    operations: "\\w+\\s*\\(|\"_*\"\\s+on\\s",                        // name(…)  |  "Label" on Command
    port: "\\w+\\s*\\(",                                              // name(…)
    machine: "satisfies\\s|(?:state|final)\\s+\\w|(?:\\[_*\\]|\\w+)\\s*-->",   // state x | a --> b
  };
  const FLAT = new Set(["decls", "names", "enum"]);   // bodies made of statements only
  const startRe = {};
  const startsOf = kind => {
    if (!(kind in startRe)) {
      const alts = [];
      if (CLAUSES[kind]) alts.push("(?:" + CLAUSES[kind].split(" ").join("|") + ")(?![\\w.-])");
      if (STARTS[kind]) alts.push(STARTS[kind]);
      startRe[kind] = alts.length ? new RegExp("(^|\\s)(?:" + alts.join("|") + ")", "g") : null;
    }
    return startRe[kind];
  };

  /* same-length copy with the contents of strings, ( ) and [ ] blanked: only
     the structure is left to scan */
  function mask(s) {
    let out = "", inStr = false, depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') { inStr = !inStr; out += depth ? "_" : c; }
      else if (inStr) out += "_";
      else if (c === "(" || c === "[") out += depth++ ? "_" : c;
      else if (c === ")" || c === "]") { depth = Math.max(0, depth - 1); out += depth ? "_" : c; }
      else out += depth ? "_" : c;
    }
    return out;
  }

  /* enum values, separated by commas or by blanks alone; `= literal` and
     `:: "description"` stay with their value */
  function splitEnum(text) {
    const m = mask(text), out = [], re = /satisfies\s*\[_*\]|"_*"|::|[=,:]|[^\s"=,:]+/g;
    let tok, start = -1, prev = "";
    const cut = end => { if (start >= 0 && text.slice(start, end).trim()) out.push(text.slice(start, end).trim()); start = -1; };
    while ((tok = re.exec(m))) {
      const t = tok[0];
      if (t === ",") cut(tok.index);
      else if (prev !== "=" && prev !== "::" && /^\w/.test(t)) { cut(tok.index); start = tok.index; }
      prev = t;
    }
    cut(text.length);
    return out;
  }

  /* the statements a flat text holds, for a body of that kind */
  function splitAt(text, kind) {
    if (kind === "names") return text.split(/[\s,]+/).filter(Boolean);
    if (kind === "enum") return splitEnum(text);
    const re = startsOf(kind), m = mask(text), cuts = [0];
    if (re) {
      re.lastIndex = 0;
      for (let x; (x = re.exec(m)); ) {
        const at = x.index + x[1].length;
        if (kind === "machine" && /-->\s*$/.test(m.slice(0, at))) continue;   // `a --> final on …`: a target state
        if (at > 0) cuts.push(at);
      }
    }
    return cuts.map((c, i) => text.slice(c, cuts[i + 1]).trim()).filter(Boolean).flatMap(s => {
      const bare = kind === "opBody" && s.match(/^(safe|unsafe|idempotent)\s+(\S.*)$/);   // a one-word clause ends there
      return bare ? [bare[1], bare[2]] : [s];
    });
  }

  /* `head { a { b } c } tail` → ["head", ["a", ["b"], "c"], "tail"]; null when
     the braces (outside strings) do not balance. Each group also keeps the
     text between its braces as written (`raw`). */
  function braceItems(s) {
    const top = [], open = [top], from = [];
    let buf = "", inStr = false;
    const flush = () => { if (buf.trim()) open[open.length - 1].push(buf.trim()); buf = ""; };
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '"') inStr = !inStr;
      if (!inStr && c === "{") { flush(); const group = []; open[open.length - 1].push(group); open.push(group); from.push(i); }
      else if (!inStr && c === "}") { flush(); if (open.length === 1) return null; open.pop().raw = s.slice(from.pop() + 1, i).trim(); }
      else buf += c;
    }
    flush();
    return open.length === 1 ? top : null;
  }

  /* the content of a `{ … }` group as the statements and child blocks of a node */
  function expand(items, kind) {
    const node = { children: [], statements: [] };
    if (FLAT.has(kind)) { node.statements = splitAt(items.raw || "", kind); return node; }
    let header = "", last = null;
    items.forEach((item, i) => {
      if (typeof item === "string") {
        let rest = item;
        const tail = last && rest.match(/^rejects\s+"[^"]*"/);      // `precondition x { … } rejects "…"`
        if (tail) { last.tail = tail[0]; rest = rest.slice(tail[0].length).trim(); }
        last = null;
        const chunks = rest ? splitAt(rest, kind) : [];
        header = Array.isArray(items[i + 1]) ? chunks.pop() || "" : "";
        node.statements.push(...chunks);
        return;
      }
      const sub = bodyKind(kind, header);
      const child = { header, children: [], statements: [] };
      if (sub === "raw") child.statements = [item.raw].filter(Boolean);
      else if (sub === "scoped") {                                    // `name { expression enforcement strategy }`
        const enf = item.raw.match(/^(.*?)\s*\b(enforcement\s+(?:compensation\s+\w+|\w+))$/);
        child.statements = (enf ? [enf[1], enf[2]] : [item.raw]).filter(Boolean);
      }
      else Object.assign(child, expand(item, sub));
      node.children.push(last = child);
      header = "";
    });
    return node;
  }

  /* the definitions (and context map) written whole on one line */
  function inlineNodes(text) {
    const items = braceItems(text) || [], out = [];
    for (let i = 1; i < items.length; i++) {
      if (!Array.isArray(items[i]) || typeof items[i - 1] !== "string") continue;
      const header = items[i - 1], kind = header === "map" ? "map" : defKind(header);
      if (kind) out.push(Object.assign({ header }, expand(items[i], kind)));
    }
    return out;
  }

  /* the child blocks of a node together with its one-line definitions, in source order */
  function definitionNodes(node) {
    if (!node.inline) return node.children;
    const out = [];
    let k = 0;
    for (let i = 0; i <= node.children.length; i++) {
      for (; k < node.inline.length && node.inline[k].at === i; k++) out.push(...inlineNodes(node.inline[k].text));
      if (i < node.children.length) out.push(node.children[i]);
    }
    return out;
  }

  /* ---- 2c. one-line sub-blocks inside a definition laid out over several lines ----
     `fields { a : string }`, `entities { A B }`, `must { … }`, a one-line
     operation inside `operations { … }`, `precondition p { … } rejects "…"`…
     are statements of the enclosing block after the fold; each becomes the
     child block it would be when laid out over several lines, in place, and
     any clause written before it on the same line stays a statement. Bodies
     whose statements may legitimately hold braces (expressions, enum values,
     field declarations, interface and repository signatures) are left as
     they are. Containers keep their one-line definitions for definitionNodes. */
  function attachInline(node, kind) {
    if (kind && kind !== "raw" && kind !== "scoped" && kind !== "port" && !FLAT.has(kind) && node.inline) {
      const children = [];
      let k = 0;
      for (let i = 0; i <= node.children.length; i++) {
        for (; k < node.inline.length && node.inline[k].at === i; k++) {
          const { text } = node.inline[k], items = braceItems(text);
          const at = node.statements.indexOf(text);
          if (!items || items.length < 2 || at < 0) continue;
          const part = expand(items, kind);
          node.statements.splice(at, 1, ...part.statements);
          /* `precondition p { … }` ⏎ `rejects "…"`: the reason on the next line */
          const next = at + part.statements.length, last = part.children[part.children.length - 1];
          if (last && !last.tail && /^rejects\s+"[^"]*"$/.test(node.statements[next] || "")) last.tail = node.statements.splice(next, 1)[0];
          children.push(...part.children);
        }
        if (i < node.children.length) children.push(node.children[i]);
      }
      node.children = children;
      delete node.inline;
    }
    for (const c of node.children) attachInline(c, kind ? bodyKind(kind, c.header) : defKind(c.header));
  }
  attachInline(root, null);

  /* ---- 3. interpret ---- */
  const IMPLICIT_MODULE = "(context)";   // not an identifier: no declared module can bear it
  const isContext = c => c.header.startsWith("context ");
  const isModule = c => /^module\s+\w+/.test(c.header);

  const orgNode = root.children.find(c => c.header.startsWith("organization "));
  const orgHead = descOf(orgNode ? orgNode.header : "");
  const orgName = orgNode ? orgHead.head.replace(/^organization\s+/, "")
    : (text.match(/^\/\/\s*Organization:\s*(\w+)/m) || [])[1] || fileStem.replace(/\W+/g, "") || "Organization";
  const organization = {
    id: fileStem,
    name: `${orgName} (${fileStem})`,
    description: orgHead.desc,
    contexts: [],
  };
  if (!orgNode) organization.implicit = true;

  /* the contexts of the organization, then those written at top level, then
     one implicit context for the modules and definitions written at top level */
  const ctxNodes = (orgNode ? orgNode.children : []).filter(isContext).concat(root.children.filter(isContext));
  const loose = definitionNodes(root).filter(n => n !== orgNode && !isContext(n));
  if (loose.some(n => isModule(n) || defKind(n.header))) {
    const short = fileStem.split(/\W+/).map(w => w[0] || "").join("").toUpperCase() || "CTX";
    ctxNodes.push({ header: `context ${orgName}Context (${short})`, children: loose, statements: root.statements, implicit: true });
  }

  const PATTERN_NAMES = { CS: "Customer/Supplier", OHS: "OHS", ACL: "ACL", Conf: "Conformist", SK: "Shared Kernel", PL: "Published Language", P: "Partnership", SW: "Separate Ways" };

  for (const ctxNode of ctxNodes) {
    const ch = descOf(ctxNode.header);
    const cm = ch.head.match(/^context\s+(\w+)(?:\s*\((\w+)\))?$/);
    const ctxName = cm ? cm[1] : ch.head;
    const shortname = (cm && cm[2]) || ctxName;
    const scope = `${fileStem}:${shortname}`;
    const ctx = { id: scope, name: ctxName, shortname, description: ch.desc, relations: [], modules: [] };
    if (ctxNode.implicit) ctx.implicit = true;

    for (const s of ctxNode.statements) {
      const rs = s.match(/^requirements-source\s+"([^"]*)"$/);
      if (rs) organization.requirementsSource = rs[1];
    }
    const members = definitionNodes(ctxNode);   // modules, direct definitions, map
    const mapNode = childNamed(ctxNode, "map") || members.find(n => n.header === "map");
    if (mapNode) {
      for (const s of mapNode.statements) {
        const m = s.match(/^(upstream|downstream|symmetric)\s+(\w+)\s*:\s*(\w+)$/);
        if (m) ctx.relations.push({ with: m[2], position: m[1], pattern: PATTERN_NAMES[m[3]] || m[3] });
      }
    }

    const byName = {};   // context-wide name → element id
    const idOf = name => `${scope}:${name}`;

    /* the declared modules, then one implicit module for the definitions
       written directly under the context */
    const modNodes = members.filter(isModule);
    const direct = members.filter(n => defKind(n.header));
    if (direct.length) modNodes.push({ header: "", children: direct, statements: [], implicit: true });

    for (const modNode of modNodes) {
      const mh = descOf(modNode.header);
      const modName = modNode.implicit ? IMPLICIT_MODULE : mh.head.replace(/^module\s+/, "");
      const mod = { id: `${scope}:${modName}`, name: modName,
        description: modNode.implicit ? `Definitions declared directly in context ${ctxName}, outside any module` : mh.desc, elements: [] };
      if (modNode.implicit) mod.implicit = true;
      const add = el => { mod.elements.push(el); byName[el.name] = el.id; return el; };

      for (const node of definitionNodes(modNode)) {
        const { head, desc } = descOf(node.header);
        const sat = satisfiesOf(node);
        const base = name => ({ id: idOf(name), name, description: desc, satisfies: sat.length ? sat : undefined });
        let m;

        if ((m = head.match(/^(api|spi)\s+interface\s+(\w+)$/))) {
          const el = add({ ...base(m[2]), kind: "interface", role: m[1].toUpperCase(), exposes: [], _exposesFromNames: [] });
          for (const s of node.statements) {
            let mm = s.match(/^exposes\s+(\w+)\.(\w+)$/);
            if (mm) { el.exposes.push(mm[2]); if (!el._exposesFromNames.includes(mm[1])) el._exposesFromNames.push(mm[1]); continue; }
            mm = s.match(/^describes\s+(\w+)$/);
            if (mm) { el._describesName = mm[1]; continue; }
            const op = parseOperation(s, false);
            if (op && op.sig) el.exposes.push(op.sig);
          }
        }
        else if ((m = head.match(/^enum\s+(\w+)$/))) {
          const el = add({ ...base(m[1]), kind: "enum", values: [] });
          for (const s of node.statements) {
            for (const part of splitEnum(s)) {   // one value per line, or several separated by commas or blanks
              const e = descOf(part);
              const v = e.head.match(/^(\w+)(?:\s*=\s*"([^"]*)")?$/);
              if (v) el.values.push(v[2] != null ? `${v[1]} = "${v[2]}"` : v[1]);
            }
          }
        }
        else if ((m = head.match(/^value\s+(\w+)$/))) {
          add({ ...base(m[1]), kind: "value",
            fields: parseFields(childNamed(node, "fields")),
            operations: parseOperations(childNamed(node, "operations")) });
        }
        else if ((m = head.match(/^(domain|application|infrastructure)\s+service\s+(\w+)$/))) {
          const el = add({ ...base(m[2]), kind: m[1] + "-service",
            operations: parseOperations(childNamed(node, "operations")) });
          const calls = childNamed(node, "calls");
          if (calls) el._callsNames = blockText(calls).split(/[\s,]+/).filter(Boolean);
          for (const s of node.statements) {
            const d = s.match(/^described-by\s+(\w+)$/);
            if (d) el._describedByName = d[1];
          }
        }
        else if ((m = head.match(/^(aggregate|entity|read-only entity)\s+(\w+)$/))) {
          const kind = m[1] === "aggregate" ? "aggregate" : m[1] === "entity" ? "entity" : "readonly-entity";
          const el = add({ ...base(m[2]), kind,
            fields: parseFields(childNamed(node, "fields")),
            operations: parseOperations(childNamed(node, "operations")),
            stateMachines: parseStateMachines(childNamed(node, "states")) });
          for (const s of node.statements) {
            let mm = s.match(/^identity\s+(\w+)\s*:\s*(\S+)$/);
            if (mm) { el.identity = `${mm[1]} : ${mm[2]}`; continue; }
            mm = s.match(/^sourced-from\s+(?:"([^"]*)"|(\S+))$/);   // string literal or bare type name
            if (mm) { el.sourcedFrom = mm[1] != null ? mm[1] : mm[2]; continue; }
            mm = s.match(/^synced-via\s+(\S+)$/);
            if (mm) el.syncPattern = mm[1];
          }
          const dup = childNamed(node, "duplicate detection");
          if (dup) el.duplicateDetection = blockText(dup);
          else { const inline = node.statements.find(s => s.startsWith("duplicate detection")); if (inline) el.duplicateDetection = inline.replace(/^duplicate detection\s*{\s*/, "").replace(/\s*}$/, ""); }
          const ents = childNamed(node, "entities");
          if (ents) el._containsNames = ents.statements.map(s => s.trim()).filter(s => /^\w+$/.test(s));
          const refsNode = childNamed(node, "references");
          if (refsNode) {
            el.references = refsNode.statements.map(s => {
              const d = descOf(s);
              const r = d.head.match(/^(\w+)\s*:\s*(\w+)\s+([\d.N*]+\.\.[\d.N*]+)$/);
              return r ? { name: r[1], type: r[2], card: r[3], note: d.desc || undefined } : null;
            }).filter(Boolean);
          }
          const invs = childNamed(node, "invariants");
          if (invs) {
            el.invariants = [];
            for (const iv of invs.children) {
              const ih = descOf(iv.header);
              const enf = (iv.statements.find(s => s.startsWith("enforcement ")) || "enforcement rejection").replace("enforcement ", "");
              const pred = iv.statements.filter(s => !s.startsWith("enforcement ")).join(" ");
              const invEl = add({ id: idOf(`${m[2]}.${ih.head}`), name: ih.head, kind: "invariant",
                description: ih.desc, predicate: pred, enforcement: enf, scopedTo: { ref: el.id } });
              el.invariants.push({ ref: invEl.id });
            }
          }
        }
        else if ((m = head.match(/^(read-only\s+)?repository\s+(\w+)\s+for\s+(\w+)$/))) {
          const el = add({ ...base(m[2]), kind: "repository", readOnly: !!m[1], _derivedFromName: m[3], operations: [] });
          for (const s of node.statements) {
            const d = s.match(/^described-by\s+(\w+)$/);
            if (d) { el._describedByName = d[1]; continue; }
            const op = parseOperation(s, false);
            if (op && op.sig) el.operations.push(op.sig);
          }
        }
        else if ((m = head.match(/^query\s+(\w+)$/))) {
          const el = add({ ...base(m[1]), kind: "query",
            queryStyle: /^(get|Get)/.test(m[1]) ? "get" : "find",
            fields: parseFields(childNamed(node, "fields")) });
          for (const s of node.statements) {
            let mm = s.match(/^reads-from\s+(\w+)$/);
            if (mm) { el._readsFromName = mm[1]; continue; }
            mm = s.match(/^returns\s+(.+)$/);
            if (mm) el.returns = mm[1];
          }
        }
        else if ((m = head.match(/^command\s+(\w+)$/))) {
          const el = add({ ...base(m[1]), kind: "command", fields: parseFields(childNamed(node, "fields")) });
          const idl = node.statements.find(s => s.startsWith("identity "));
          if (idl) el.identity = idl.replace(/^identity\s+/, "");
        }
        else if ((m = head.match(/^(error\s+|external\s+|temporal\s+)?event\s+(\w+)$/))) {
          const el = add({ ...base(m[2]), kind: "event",
            eventType: m[1] ? m[1].trim() : "internal",
            fields: parseFields(childNamed(node, "fields")) });
          for (const s of node.statements) {
            let mm = s.match(/^about\s+(\w+)$/);          if (mm) { el._aboutName = mm[1]; continue; }
            mm = s.match(/^caused-by\s+(\w+)$/);          if (mm) { el._causedByName = mm[1]; continue; }
            mm = s.match(/^sourced-from\s+"?([^"]+)"?$/); if (mm) { el.sourcedFrom = mm[1]; continue; }
            mm = s.match(/^instant\s+(.+)$/);             if (mm) { el.instant = mm[1]; el.temporalFlavor = "absolute"; continue; }
            mm = s.match(/^schedule\s+(.+)$/);            if (mm) { el.schedule = mm[1]; el.temporalFlavor = "recurring"; continue; }
            mm = s.match(/^reference\s+(\w+)$/);          if (mm) { el._referenceName = mm[1]; el.temporalFlavor = "relative"; continue; }
            mm = s.match(/^offset\s+(.+)$/);              if (mm) { el.offset = mm[1]; continue; }
            mm = s.match(/^guard\s*{\s*(.*?)\s*}$/);      if (mm) el.guard = mm[1];
          }
          const g = childNamed(node, "guard");
          if (g) el.guard = blockText(g);
        }
        else if ((m = head.match(/^reaction\s+(\w+)$/))) {
          const el = add({ ...base(m[1]), kind: "reaction", _triggeredByNames: [], });
          for (const s of node.statements) {
            let mm = s.match(/^triggered-by\s+(.+)$/);
            if (mm) { el._triggeredByNames.push(...mm[1].split(",").map(x => x.trim())); continue; }
            mm = s.match(/^effects\s+(\w+)$/);
            if (mm) { el._effectsName = mm[1]; continue; }
            mm = s.match(/^guard\s*{\s*(.*?)\s*}$/);
            if (mm) el.guard = mm[1];
          }
          const g = childNamed(node, "guard");
          if (g) el.guard = blockText(g);
        }
        else if ((m = head.match(/^invariant\s+(\w+)$/))) {
          const el = add({ ...base(m[1]), kind: "invariant", enforcement: "rejection" });
          for (const s of node.statements) {
            let mm = s.match(/^on\s+(\w+)(?:\.(\w+))?$/);
            if (mm) { el._scopedToName = mm[1]; el.scopedState = mm[2]; continue; }
            mm = s.match(/^enforcement\s+(\w+)$/);
            if (mm) el.enforcement = mm[1];
          }
          const must = childNamed(node, "must");
          if (must) el.predicate = blockText(must);
        }
        else if ((m = head.match(/^agreement\s+(\w+)$/))) {
          const el = add({ ...base(m[1]), kind: "agreement", _involvesNames: [] });
          const parts = childNamed(node, "participants");
          if (parts) el._involvesNames = blockText(parts).split(/[\s,]+/).filter(Boolean);
          else {
            const inline = node.statements.find(s => s.startsWith("participants"));
            if (inline) el._involvesNames = (inline.match(/{\s*(.*?)\s*}/) || [, ""])[1].split(/[\s,]+/).filter(Boolean);
          }
          el.arity = el._involvesNames.length > 2 ? "multilateral" : "bilateral";
          const pred = childNamed(node, "predicate");
          if (pred) el.predicate = blockText(pred);
          const recNode = node.children.find(c => c.header.startsWith("reconciliation "));
          if (recNode) {
            const rh = descOf(recNode.header);
            const rec = add({ id: idOf(rh.head.replace(/^reconciliation\s+/, "")), name: rh.head.replace(/^reconciliation\s+/, ""),
              kind: "reconciliation", description: rh.desc, maintains: { ref: el.id }, escalation: [] });
            el.maintainedBy = { ref: rec.id };
            for (const s of recNode.statements) {
              let mm = s.match(/^trigger\s+event\s+(.+)$/);
              if (mm) { rec.trigger = "event — " + mm[1]; continue; }
              mm = s.match(/^trigger\s+schedule\s+(.+)$/);
              if (mm) { rec.trigger = "schedule — " + mm[1]; continue; }
              mm = s.match(/^detection\s+(\w+)$/);
              if (mm) { rec.detection = mm[1] === "query" ? "query-based" : mm[1]; continue; }
              mm = s.match(/^coordination\s+(\w+)$/);
              if (mm) { rec.coordination = mm[1]; continue; }
              mm = s.match(/^compensation\s*{\s*(.*?)\s*}$/);
              if (mm) rec._compensationNames = mm[1].split(/[\s,]+/).filter(Boolean);
            }
            const comp = childNamed(recNode, "compensation");
            if (comp) rec._compensationNames = blockText(comp).split(/[\s,]+/).filter(Boolean);
            const escNode = childNamed(recNode, "escalation");
            if (escNode) {
              for (const st of escNode.children) {
                const sh = descOf(st.header);
                const step = { condition: "", action: "", note: sh.desc || undefined };
                for (const s of st.statements) {
                  let mm = s.match(/^when\s*{\s*(.*?)\s*}$/);
                  if (mm) { step.condition = mm[1]; continue; }
                  mm = s.match(/^action\s+retry\((\d+)\)$/);
                  if (mm) { step.action = "retry"; step.maxAttempts = +mm[1]; continue; }
                  mm = s.match(/^action\s+(\w+)(?:\s+"([^"]*)")?$/);
                  if (mm) { step.action = mm[1]; if (mm[2]) step.note = (step.note ? step.note + " — " : "") + mm[2]; }
                }
                const w = childNamed(st, "when");
                if (w) step.condition = blockText(w);
                rec.escalation.push(step);
              }
            }
          }
        }
      }
      if (mod.elements.length || !modNode.implicit) ctx.modules.push(mod);
    }

    /* ---- 4. resolve names → refs, derive back-links ---- */
    const ref = name => (name && byName[name]) ? { ref: byName[name] } : null;
    const all = ctx.modules.flatMap(mm => mm.elements);
    const find = id => all.find(e => e.id === id);

    for (const el of all) {
      for (const f of el.fields || []) {
        if (f.typeBase && byName[f.typeBase] && byName[f.typeBase] !== el.id) f.ref = byName[f.typeBase];
        delete f.typeBase;
      }
      if (el._exposesFromNames) { el.exposesFrom = el._exposesFromNames.map(ref).filter(Boolean); delete el._exposesFromNames; }
      if (el._describesName) { el.describes = ref(el._describesName); delete el._describesName; }
      if (el._describedByName) { el.describedBy = ref(el._describedByName); delete el._describedByName; }
      if (el._callsNames) { el.calls = el._callsNames.map(ref).filter(Boolean); delete el._callsNames; }
      if (el._derivedFromName) {
        el.derivedFrom = ref(el._derivedFromName);
        const owner = el.derivedFrom && find(el.derivedFrom.ref);
        if (owner) owner.repository = { ref: el.id };
        delete el._derivedFromName;
      }
      if (el._readsFromName) { el.readsFrom = ref(el._readsFromName); delete el._readsFromName; }
      if (el._aboutName) { el.about = ref(el._aboutName); delete el._aboutName; }
      if (el._causedByName) { el.causedBy = ref(el._causedByName); delete el._causedByName; }
      if (el._referenceName) { el.reference = ref(el._referenceName); delete el._referenceName; }
      if (el._triggeredByNames) { el.triggeredBy = el._triggeredByNames.map(ref).filter(Boolean); delete el._triggeredByNames; }
      if (el._effectsName) { el.effects = ref(el._effectsName); delete el._effectsName; }
      if (el._scopedToName) { el.scopedTo = ref(el._scopedToName); delete el._scopedToName; }
      if (el._involvesNames) { el.involves = el._involvesNames.map(ref).filter(Boolean); delete el._involvesNames; }
      if (el._compensationNames) { el.compensation = el._compensationNames.map(ref).filter(Boolean); delete el._compensationNames; }
      if (el._containsNames) {
        el.contains = el._containsNames.map(ref).filter(Boolean);
        for (const r of el.contains) { const child = find(r.ref); if (child && child.kind === "entity") child.partOf = { ref: el.id }; }
        delete el._containsNames;
      }
      // operations: resolve emits + back-link commands and events
      for (const op of el.operations || []) {
        if (typeof op !== "object" || op === null) continue;  // repository ops are plain signature strings
        const emitted = op.emits;
        op.emits = (emitted || []).map(n => byName[n]).filter(Boolean);
        for (const evId of op.emits) {
          const ev = find(evId);
          if (ev && !ev.raisedBy) ev.raisedBy = { ref: el.id, operation: op.label };
        }
        if (op.onCommand && byName[op.onCommand]) {
          const cmd = find(byName[op.onCommand]);
          op.handlesCommand = byName[op.onCommand];
          if (cmd) {
            cmd.targets = cmd.targets || { ref: el.id };
            cmd.triggers = cmd.triggers || op.label;
            if (op.emits.length) cmd.produces = (cmd.produces || []).concat(op.emits.map(id2 => ({ ref: id2 })));
          }
        }
      }
    }
    if (ctx.modules.length || !ctxNode.implicit) organization.contexts.push(ctx);
  }
  if (!orgNode && !organization.contexts.length)
    throw new Error("no organization, context, module or definition block in " + fileStem);
  return organization;
}

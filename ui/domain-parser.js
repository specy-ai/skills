/* Tolerant reader for Specy v3 .domain files → the navigator's organization
   shape (see data.js). Structural, not grammatical: comments are stripped, the
   text is folded into a brace-scoped block tree, and block headers are
   interpreted by pattern. Unknown constructs are skipped, never fatal. */

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
  for (const line of lines) {
    if (line.startsWith("}")) {
      if (stack.length > 1) {
        const closed = stack.pop();
        const tail = line.slice(1).trim();
        if (tail) closed.tail = tail;   // e.g. `} rejects "…"`
      }
      continue;
    }
    const opens = (line.match(/{/g) || []).length;
    const closes = (line.match(/}/g) || []).length;
    if (line.endsWith("{") && opens === closes + 1) {
      const node = { header: line.slice(0, -1).trim(), children: [], statements: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
    } else {
      stack[stack.length - 1].statements.push(line);
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

    for (const s of entry.statements) {
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
      const sm = { name: descOf(mNode.header).desc || mh[1], states: [], transitions: [] };
      const ensureState = n => {
        let st = sm.states.find(s => s.name === n);
        if (!st) { st = { name: n }; sm.states.push(st); }
        return st;
      };
      const handleTransition = (line, guard) => {
        const t = line.match(/^(\[\*\]|\w+)\s*-->\s*(\w+)\s+on\s+"([^"]+)"$/);
        if (!t) return false;
        if (t[1] === "[*]") { ensureState(t[2]).initial = true; return true; }
        ensureState(t[1]); ensureState(t[2]);
        sm.transitions.push({ from: t[1], to: t[2], operation: t[3], guard });
        return true;
      };
      for (const s of mNode.statements) {
        const { head, desc } = descOf(s);
        let st = head.match(/^state\s+(\w+)$/);
        if (st) { const x = ensureState(st[1]); if (desc) x.invariants = [desc]; continue; }
        st = head.match(/^final\s+(\w+)$/);
        if (st) { const x = ensureState(st[1]); x.final = true; if (desc) x.invariants = [desc]; continue; }
        handleTransition(head);
      }
      for (const c of mNode.children) {
        // transition with a guard precondition block
        const pre = c.children[0];
        let guard;
        if (pre) {
          const ph = descOf(pre.header);
          guard = ph.desc || blockText(pre);
        }
        handleTransition(descOf(c.header).head, guard);
      }
      machines.push(sm);
    }
    return machines;
  }

  /* ---- 3. interpret ---- */
  const orgNode = root.children.find(c => c.header.startsWith("organization "));
  if (!orgNode) throw new Error("no organization block in " + fileStem);
  const orgHead = descOf(orgNode.header);
  const orgName = orgHead.head.replace(/^organization\s+/, "");
  const organization = {
    id: fileStem,
    name: `${orgName} (${fileStem})`,
    description: orgHead.desc,
    contexts: [],
  };

  const PATTERN_NAMES = { CS: "Customer/Supplier", OHS: "OHS", ACL: "ACL", Conf: "Conformist", SK: "Shared Kernel", PL: "Published Language", P: "Partnership", SW: "Separate Ways" };

  for (const ctxNode of orgNode.children.filter(c => c.header.startsWith("context "))) {
    const ch = descOf(ctxNode.header);
    const cm = ch.head.match(/^context\s+(\w+)(?:\s*\((\w+)\))?$/);
    const ctxName = cm ? cm[1] : ch.head;
    const shortname = (cm && cm[2]) || ctxName;
    const scope = `${fileStem}:${shortname}`;
    const ctx = { id: scope, name: ctxName, shortname, description: ch.desc, relations: [], modules: [] };

    for (const s of ctxNode.statements) {
      const rs = s.match(/^requirements-source\s+"([^"]*)"$/);
      if (rs) organization.requirementsSource = rs[1];
    }
    const mapNode = childNamed(ctxNode, "map");
    if (mapNode) {
      for (const s of mapNode.statements) {
        const m = s.match(/^(upstream|downstream|symmetric)\s+(\w+)\s*:\s*(\w+)$/);
        if (m) ctx.relations.push({ with: m[2], position: m[1], pattern: PATTERN_NAMES[m[3]] || m[3] });
      }
    }

    const byName = {};   // context-wide name → element id
    const idOf = name => `${scope}:${name}`;

    for (const modNode of ctxNode.children.filter(c => /^module\s+\w+/.test(c.header))) {
      const mh = descOf(modNode.header);
      const modName = mh.head.replace(/^module\s+/, "");
      const mod = { id: `${scope}:${modName}`, name: modName, description: mh.desc, elements: [] };
      const add = el => { mod.elements.push(el); byName[el.name] = el.id; return el; };

      for (const node of modNode.children) {
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
            const e = descOf(s);
            const v = e.head.match(/^(\w+)(?:\s*=\s*"([^"]*)")?$/);
            if (v) el.values.push(v[2] != null ? `${v[1]} = "${v[2]}"` : v[1]);
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
            mm = s.match(/^sourced-from\s+"([^"]*)"$/);
            if (mm) { el.sourcedFrom = mm[1]; continue; }
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
      ctx.modules.push(mod);
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
    organization.contexts.push(ctx);
  }
  return organization;
}

/* Synthetic data tab — synthy in the browser.
   Takes the organization's `.domain` source kept at boot (DOMAIN_TEXT in app.js),
   parses it in the page with the Langium parser bundle (vendor/specy-domain-langium.js:
   the CLI's parser, not the Navigator's lenient one), and drives synthy
   (vendor/synthy.js): a .synth scenario edited here is parsed against the
   model by the same bundle (an unknown field is an error before any row exists)
   and checked by synthy as you type — JSON and YAML scenarios are read too, and
   Import / Download move a scenario in and out in any of the three encodings —
   conflicts come back as compiler errors with the arithmetic and a remedy — then
   Generate produces the tables and Verify asks DuckDB-wasm every question of the
   certificate. Nothing leaves the page; scenarios persist in localStorage per
   organization.

   Exposed as window.SpecySynth: renderTree(el), renderMain(el), selectOptions(),
   onSelect(value). app.js calls them when state.view === "synth". */
const SpecySynth = (() => {
  const KEY = orgId => `specy-synth:${orgId}`;
  const DEBOUNCE_MS = 250;
  const PREVIEW_ROWS = 50;

  const S = {
    orgId: null,
    name: null,          // current scenario name
    text: "",            // its text: .synth, or the same document as JSON or YAML
    format: "synth",     // what the text is: "synth" | "json" | "yaml" (Synthy.detectFormat)
    domains: {},         // orgId → { model, diagnostics, ok } | { parsing: Promise } | { missing: true }
    scenario: null,      // parsed Scenario when the text is valid
    textError: null,     // string, or [{line, column, message, code}] (.synth diagnostics, SYN-E022 document problems)
    report: null,        // synthy check report
    caps: null,          // the browser-cap conflict, if any
    dataset: null,
    certificate: null,
    engine: null,        // the DuckDB engine of the session, created at the first Verify
    busy: null,          // "generate" | "verify" | null
    status: "",
    statusBad: false,
    table: null,         // table shown in the preview
    open: new Set(),     // expanded questions
    timer: null,
  };

  /* ---- persistence ---- */
  const load = orgId => {
    try { return Object.assign({ scenarios: {}, current: null }, JSON.parse(localStorage.getItem(KEY(orgId)) || "null") || {}); }
    catch (e) { return { scenarios: {}, current: null }; }
  };
  const save = (orgId, data) => { try { localStorage.setItem(KEY(orgId), JSON.stringify(data)); } catch (e) { /* private mode: lasts the session */ } };
  /* The starter is built as an object; the editor shows it in the language. */
  const starterText = (orgId, model) => Synthy.printScenario(Synthy.starterScenario(model), { domain: orgId + ".domain" });
  const FORMAT_LABEL = { synth: ".synth", json: "JSON", yaml: "YAML" };

  /* ---- the domain, parsed in the page ---- */
  function domainOf(orgId) {
    const d = S.domains[orgId];
    if (d) return d;
    const text = typeof DOMAIN_TEXT !== "undefined" ? DOMAIN_TEXT[orgId] : undefined;
    if (text === undefined) return (S.domains[orgId] = { missing: true });
    if (typeof SpecyDomainLangium === "undefined") return (S.domains[orgId] = { missing: true, reason: "the parser bundle vendor/specy-domain-langium.js is not loaded" });
    const parsing = SpecyDomainLangium.parseDomain(text, orgId + ".domain").then(
      r => { S.domains[orgId] = r; afterDomain(orgId); },
      e => { S.domains[orgId] = { ok: false, diagnostics: [{ severity: "error", line: 0, column: 0, message: String(e && e.message || e) }] }; afterDomain(orgId); });
    return (S.domains[orgId] = { parsing });
  }
  const ready = orgId => { const d = domainOf(orgId); return d && d.model ? d : null; };
  function afterDomain(orgId) {
    if (S.orgId !== orgId) return;
    if (!S.name) openScenario(defaultName(orgId));   // parses, checks and refreshes once the text is in
    else parseText().then(() => { runCheck(); refresh(); });
    renderContextSelectIfAny();   // the Scenario dropdown was drawn before the parse named one
  }

  /* ---- scenarios of the organization ---- */
  function defaultName(orgId) {
    const st = load(orgId);
    if (st.current && st.scenarios[st.current] !== undefined) return st.current;
    const names = Object.keys(st.scenarios);
    return names.length ? names[0] : "starter";
  }
  function openScenario(name) {
    const st = load(S.orgId);
    let text = st.scenarios[name];
    if (text === undefined) {
      const d = ready(S.orgId);
      text = d ? starterText(S.orgId, d.model) : "";
      if (d) { st.scenarios[name] = text; }
    }
    st.current = name;
    save(S.orgId, st);
    S.name = name;
    S.text = text;
    S.dataset = null; S.certificate = null; S.table = null; S.open.clear(); S.status = "";
    parseText().then(() => { runCheck(); refresh(); });
  }
  function storeText() {
    const st = load(S.orgId);
    st.scenarios[S.name] = S.text;
    st.current = S.name;
    save(S.orgId, st);
  }
  function newScenario() {
    const st = load(S.orgId);
    let i = 1, name;
    do { name = `scenario-${i++}`; } while (st.scenarios[name] !== undefined);
    openScenario(name);
  }
  function resetToStarter() {
    const d = ready(S.orgId);
    if (!d) return;
    S.text = starterText(S.orgId, d.model);
    storeText();
    S.dataset = null; S.certificate = null;
    parseText().then(() => { runCheck(); refresh(); });
  }
  function deleteScenario() {
    const st = load(S.orgId);
    delete st.scenarios[S.name];
    st.current = null;
    save(S.orgId, st);
    S.name = null;
    openScenario(defaultName(S.orgId));
  }
  function renameScenario(name) {
    name = (name || "").trim();
    if (!name || name === S.name) return;
    const st = load(S.orgId);
    if (st.scenarios[name] !== undefined) { setStatus(`a scenario named ${name} already exists`, true); return; }
    delete st.scenarios[S.name];
    st.scenarios[name] = S.text;
    st.current = name;
    save(S.orgId, st);
    S.name = name;
  }

  /* ---- check as you type ----
     The text is .synth, parsed in the page against the organization's .domain by the
     Langium bundle: every entity, field, state and member is resolved there, with the
     planner's conflict codes. The same document as JSON or YAML is read by synthy
     (structure here, names and figures by check); Convert to .synth brings back the
     in-editor resolution. Parsing is asynchronous; a parse that finishes after a newer
     edit is dropped. */
  let parseSeq = 0;
  function parseText() {
    const seq = ++parseSeq;
    S.scenario = null; S.textError = null;
    const text = S.text;
    S.format = Synthy.detectFormat(text);
    if (!text.trim()) { S.textError = "empty scenario"; return Promise.resolve(); }
    if (S.format !== "synth") {
      try { S.scenario = Synthy.readScenario(text, { format: S.format }); }
      catch (e) { S.textError = documentProblems(e); }
      return Promise.resolve();
    }
    const domainText = typeof DOMAIN_TEXT !== "undefined" ? DOMAIN_TEXT[S.orgId] : undefined;
    if (typeof SpecyDomainLangium === "undefined" || typeof SpecyDomainLangium.parseSynth !== "function") {
      S.textError = "the parser bundle vendor/specy-domain-langium.js does not read .synth; rebuild it (npm run build:browser in specy-skill/src/langium/specy-domain)";
      return Promise.resolve();
    }
    if (domainText === undefined) { S.textError = "the organization's .domain source is not loaded"; return Promise.resolve(); }
    return SpecyDomainLangium.parseSynth(text, domainText, (S.name || "scenario") + ".synth").then(r => {
      if (seq !== parseSeq) return;
      const errors = r.diagnostics.filter(d => d.severity === "error");
      if (errors.length) { S.textError = errors; return; }
      try { S.scenario = Synthy.parseScenario(r.scenario); }
      catch (e) { S.textError = String(e && e.message || e); }
    }, e => {
      if (seq !== parseSeq) return;
      S.textError = String(e && e.message || e);
    });
  }
  /* A ScenarioFormatError (SYN-E022) lists its problems; "(line 3, column 5)" becomes the position. */
  function documentProblems(e) {
    if (!e || !Array.isArray(e.problems)) return String(e && e.message || e);
    return e.problems.map(p => {
      const m = /\s*\(line (\d+),? column (\d+)\)/.exec(p);
      return { code: e.code || "SYN-E022", message: m ? p.replace(m[0], "") : p, line: m ? Number(m[1]) : 0, column: m ? Number(m[2]) : 0 };
    });
  }

  /* ---- the three encodings: import, convert, download ---- */
  const scenarioFile = (format) => `${S.name || "scenario"}${Synthy.scenarioExtension(format)}`;
  /* .synth as the user wrote it when the text is .synth (comments and layout kept); otherwise written from the document. */
  function scenarioAs(format) {
    if (format === S.format && format === "synth") return S.text;
    return Synthy.writeScenario(S.scenario, format, { domain: S.orgId + ".domain" });
  }
  function downloadScenario(format) {
    if (!S.scenario) return;
    const type = format === "json" ? "application/json" : format === "yaml" ? "application/yaml" : "text/plain";
    downloadBlob(new Blob([scenarioAs(format)], { type }), scenarioFile(format));
  }
  function convertToSynth() {
    if (!S.scenario || S.format === "synth") return;
    S.text = scenarioAs("synth");
    storeText();
    parseText().then(() => { runCheck(); refresh(); });
  }
  /* A file of any encoding becomes a new scenario; JSON and YAML arrive as .synth, so
     every name is resolved in the editor. A file synthy cannot read arrives as it is,
     with its problems listed. */
  function importFile(file) {
    if (!file) return;
    file.text().then(text => {
      const format = Synthy.detectFormat(text, file.name);
      let converted = text;
      if (format !== "synth") {
        try { converted = Synthy.writeScenario(Synthy.readScenario(text, { format }), "synth", { domain: S.orgId + ".domain" }); }
        catch (e) { converted = text; }
      }
      const st = load(S.orgId);
      const base = file.name.replace(/(\.synth)?\.(synth|json|ya?ml)$/i, "") || "imported";
      let name = base, i = 2;
      while (st.scenarios[name] !== undefined) name = `${base}-${i++}`;
      st.scenarios[name] = converted;
      save(S.orgId, st);
      openScenario(name);
      setStatus(`imported ${file.name}${format !== "synth" && converted !== text ? ` (${FORMAT_LABEL[format]}, converted to .synth)` : ""}`);
      renderContextSelectIfAny();
    }, e => setStatus(`cannot read ${file.name}: ${String(e && e.message || e)}`, true));
  }
  function runCheck() {
    S.report = null; S.caps = null;
    const d = ready(S.orgId);
    if (!d || !S.scenario) return;
    try {
      S.report = Synthy.check(d.model, S.scenario);
      if (S.report.ok && S.report.summary) S.caps = Synthy.capsConflict(S.report.summary) || null;
    } catch (e) {
      S.report = { ok: false, conflicts: [{ code: "SYN-E000", severity: "error", message: String(e && e.message || e), declarations: [] }] };
    }
  }
  function onEdit(text) {
    S.text = text;
    clearTimeout(S.timer);
    S.timer = setTimeout(() => {
      storeText();
      parseText().then(() => {
        runCheck();
        renderCheck();
        renderActions();
        renderScenarioBar();
        renderTreeIfSynth();
        const ed = document.getElementById("synth-editor");
        if (ed) ed.classList.toggle("invalid", !!S.textError);
      });
    }, DEBOUNCE_MS);
  }

  /* ---- generate and verify ---- */
  const canGenerate = () => !S.busy && S.report && S.report.ok && !S.caps;
  function doGenerate() {
    if (!canGenerate()) return;
    const d = ready(S.orgId);
    S.busy = "generate"; S.certificate = null; setStatus("generating…");
    renderActions();
    setTimeout(() => {
      try {
        const t0 = performance.now();
        S.dataset = Synthy.generate(d.model, S.scenario);
        S.table = S.dataset.tables[0] ? S.dataset.tables[0].name : null;
        const rows = S.dataset.tables.reduce((n, t) => n + t.rows.length, 0);
        setStatus(`${fmt(rows)} rows in ${fmt(S.dataset.tables.length)} tables, ${fmt(S.dataset.facts.length)} facts, ${Math.round(performance.now() - t0)} ms`);
      } catch (e) {
        S.dataset = null;
        setStatus(`generation failed: ${String(e && e.message || e)}`, true);
      }
      S.busy = null;
      renderResults();
      renderActions();
    }, 20);
  }
  async function engineOnce() {
    if (S.engine) return S.engine;
    S.engine = await Synthy.createBrowserEngine({
      onProgress: (stage, detail) => setStatus(stage === "loading" ? `loading DuckDB-wasm (${detail}; about 36 MB the first time)…` : stage === "ready" ? `DuckDB ${detail} ready` : "selecting a DuckDB build…"),
    });
    return S.engine;
  }
  async function doVerify() {
    if (S.busy) return;
    if (!S.dataset) { doGenerate(); await new Promise(r => setTimeout(r, 60)); if (!S.dataset) return; }
    S.busy = "verify"; renderActions();
    try {
      const engine = await engineOnce();
      setStatus("asking DuckDB every question of the certificate…");
      const t0 = performance.now();
      S.certificate = await Synthy.certify(S.dataset, engine);
      const c = S.certificate.summary;
      setStatus(`${S.certificate.passed ? "certificate passed" : "certificate FAILED"}: hard ${c.hard.passed}/${c.hard.total}, advisory ${c.advisory.passed}/${c.advisory.total}${c.plausibility && c.plausibility.total ? `, plausibility ${c.plausibility.passed}/${c.plausibility.total}` : ""}, ${Math.round(performance.now() - t0)} ms`, !S.certificate.passed);
    } catch (e) {
      setStatus(`verification failed: ${String(e && e.message || e)}`, true);
    }
    S.busy = null;
    renderResults();
    renderActions();
  }
  function downloadZip() {
    if (!S.dataset) return;
    const bytes = Synthy.datasetArchive(S.dataset, { certificate: S.certificate || undefined, scenario: S.scenario });
    downloadBlob(new Blob([bytes], { type: "application/zip" }), `${S.orgId}-${S.name}-seed${S.dataset.manifest.seed}.zip`);
  }
  function downloadCertificate() {
    if (!S.certificate) return;
    downloadBlob(new Blob([JSON.stringify(S.certificate, null, 2)], { type: "application/json" }), `${S.orgId}-${S.name}-certificate.json`);
  }
  function downloadCsv(name) {
    const t = S.dataset && S.dataset.tables.find(x => x.name === name);
    if (t) downloadBlob(new Blob([Synthy.toCsv(t)], { type: "text/csv" }), `${name}.csv`);
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---- rendering ---- */
  const fmt = n => Number(n).toLocaleString("en-US");
  function setStatus(text, bad) {
    S.status = text; S.statusBad = !!bad;
    const el = document.getElementById("synth-status");
    if (el) { el.textContent = text; el.classList.toggle("bad", !!bad); }
  }
  function refresh() {
    if (typeof state === "undefined" || state.view !== "synth") return;
    renderTree(document.getElementById("tree"));
    renderMain(document.getElementById("detail"));
  }
  function renderTreeIfSynth() { if (typeof state !== "undefined" && state.view === "synth") renderTree(document.getElementById("tree")); }

  function enter() {
    const o = typeof org === "function" ? org() : null;
    if (!o) return null;
    if (S.orgId !== o.id) {
      S.orgId = o.id; S.name = null; S.text = ""; S.scenario = null; S.report = null; S.caps = null;
      S.dataset = null; S.certificate = null; S.table = null; S.open.clear(); S.status = "";
      const d = domainOf(o.id);
      if (d.model) { openScenario(defaultName(o.id)); runCheck(); }
      else if (d.missing) { S.name = defaultName(o.id); S.text = load(o.id).scenarios[S.name] || ""; parseText(); }
    }
    return o;
  }

  function selectOptions() {
    enter();
    const st = S.orgId ? load(S.orgId) : { scenarios: {} };
    const names = Object.keys(st.scenarios);
    if (!names.includes(S.name) && S.name) names.unshift(S.name);
    return names.map(n => `<option value="${esc(n)}"${n === S.name ? " selected" : ""}>${esc(n)}</option>`).join("") +
      `<option value="__new__">+ new scenario</option>`;
  }
  function onSelect(value) {
    enter();
    if (value === "__new__") newScenario();
    else { openScenario(value); runCheck(); }
    refresh();
  }

  function renderTree(treeEl) {
    const o = enter();
    if (!treeEl) return;
    if (!o) { treeEl.innerHTML = ""; return; }
    const st = load(o.id);
    const names = Object.keys(st.scenarios);
    let html = `<ul class="synth-tree"><li><div class="tree-group-label" style="--indent:0">Scenarios</div></li>`;
    for (const n of names) {
      html += `<li><button class="tree-row${n === S.name ? " selected" : ""}" data-synth="open" data-name="${esc(n)}" style="--indent:8px">
        <span class="caret leaf">▶</span><span class="row-name">${esc(n)}</span></button></li>`;
    }
    html += `<li><button class="tree-row add" data-synth="new" style="--indent:8px"><span class="caret leaf">▶</span><span class="row-name">new scenario…</span></button></li>`;
    if (S.report && S.report.summary) {
      const est = Synthy.estimateRows(S.report.summary);
      html += `<li><div class="tree-group-label" style="--indent:0">Plan · ${fmt(est.total)} rows</div></li>`;
      for (const e of S.report.summary.entities) {
        const mode = e.mode === "count" ? `${fmt(e.count)}` : e.mode === "per" ? `per ${e.per.parent} ${e.per.exactly !== undefined ? "×" + e.per.exactly : e.per.min + "..." + e.per.max}` : "given";
        html += `<li><div class="tree-row" style="--indent:8px"><span class="caret leaf"></span><span class="row-name">${esc(e.name)}</span><span class="row-hint">${esc(mode)} → ${fmt(est.byEntity[e.name] || 0)}</span></div></li>`;
      }
    }
    html += `</ul>`;
    treeEl.innerHTML = html;
  }

  function renderMain(target) {
    const o = enter();
    if (!target) return;
    if (!o) { target.innerHTML = `<div class="main-inner"><div class="empty-state">No domain model loaded.</div></div>`; return; }
    const d = domainOf(o.id);
    target.innerHTML = `<div class="main-inner synth-wide">
      <p class="eyebrow">Synthetic data</p>
      <div class="detail-title"><h1>${esc(o.name)}</h1>${typeof Synthy !== "undefined" ? `<span class="chip">synthy ${esc(Synthy.VERSION)}</span>` : ""}</div>
      <p class="detail-lead">Declare what the data must add up to. synthy generates rows that satisfy the domain model and the scenario, then DuckDB verifies every claim and signs a certificate. Everything runs in this page; nothing is sent anywhere.</p>
      ${renderDomainStatus(d)}
      <div class="synth-top">
        <section>
          <div class="card">
            <div class="synth-toolbar">
              <input id="synth-name" class="synth-name" value="${esc(S.name || "")}" title="Scenario name (rename here)" aria-label="Scenario name" />
              <span id="synth-format">${formatChipHtml()}</span>
              <span class="grow"></span>
              <button class="synth-btn quiet" data-synth="import" title="Open a scenario file: .synth, .synth.json or .synth.yaml (JSON and YAML arrive as .synth)">Import…</button>
              <input id="synth-import" type="file" accept=".synth,.json,.yaml,.yml" hidden />
              <button class="synth-btn quiet" data-synth="starter" title="Replace the text with a starter scenario derived from the model">Reset to starter</button>
              <button class="synth-btn quiet" data-synth="delete" title="Delete this scenario">Delete</button>
            </div>
            <textarea id="synth-editor" class="synth-editor${S.textError ? " invalid" : ""}" spellcheck="false" aria-label="Scenario (.synth, JSON or YAML)">${esc(S.text)}</textarea>
            <div id="synth-download" class="synth-download">${downloadHtml()}</div>
            <div class="synth-hint">A <code>.synth</code> scenario, checked against the model as you type (JSON and YAML are read too). Populations: <code>Order count 1200</code>, <code>OrderLine per Order 1..5</code>. Outcomes: <code>curve</code>, <code>total</code>, <code>share</code>, <code>mix</code>, <code>rate</code>, <code>rollup</code> on domain dot-paths such as <code>Order.totalAmount.amount</code> or <code>Order.OrderLifecycle</code>, e.g. <code>share Payment.method { creditCard: 60%  paypal: 40% }</code>. Invariants of the model always hold; outcomes bend to them or synthy refuses with the arithmetic.</div>
          </div>
        </section>
        <section id="synth-check"></section>
      </div>
      <div id="synth-actions" class="synth-actions"></div>
      <div id="synth-cert"></div>
      <div id="synth-tables"></div>
    </div>`;
    renderCheck();
    renderActions();
    renderResults();
  }

  function formatChipHtml() {
    if (S.format === "synth") return "";
    return `<span class="chip warn" title="Names and figures are checked by synthy below; convert to .synth to see them resolved in the text">${FORMAT_LABEL[S.format]}</span>` +
      `<button class="synth-btn quiet" data-synth="tosynth"${S.scenario ? "" : " disabled"} title="Rewrite this scenario in the .synth language">Convert to .synth</button>`;
  }
  function downloadHtml() {
    const off = S.scenario ? "" : " disabled";
    return `<span class="synth-download-label">Download scenario</span>` +
      ["synth", "json", "yaml"].map(f => `<button class="synth-btn quiet" data-synth="download" data-format="${f}"${off} title="${esc(scenarioFile(f))}">${FORMAT_LABEL[f]}</button>`).join("");
  }
  function renderScenarioBar() {
    const chip = document.getElementById("synth-format");
    if (chip) chip.innerHTML = formatChipHtml();
    const dl = document.getElementById("synth-download");
    if (dl) dl.innerHTML = downloadHtml();
  }

  function renderDomainStatus(d) {
    if (!d) return "";
    if (d.parsing) return `<div class="synth-domain"><span class="chip">parsing the .domain in the page…</span></div>`;
    if (d.missing) return `<div class="synth-domain"><span class="chip warn">no .domain source for this model</span> ${esc(d.reason || "This organization comes from sample data; synthetic data needs the .domain file the server serves.")}</div>`;
    const errors = (d.diagnostics || []).filter(x => x.severity === "error");
    const warnings = (d.diagnostics || []).filter(x => x.severity === "warning");
    const idx = d.model ? new Synthy.DomainIndex(d.model) : null;
    let html = `<div class="synth-domain">`;
    html += errors.length ? `<span class="chip req">${errors.length} parse error${errors.length > 1 ? "s" : ""}</span>` : `<span class="chip ok">.domain parsed</span>`;
    if (idx) html += `<span>${fmt(idx.entities.size)} entities · ${fmt(idx.values.size)} value types · ${fmt(idx.enums.size)} enums</span>`;
    if (warnings.length) html += `<span class="chip warn">${warnings.length} warning${warnings.length > 1 ? "s" : ""}</span>`;
    html += `</div>`;
    if (errors.length) html += `<ul class="synth-diags">${errors.slice(0, 8).map(x => `<li>${x.line}:${x.column} — ${esc(x.message)}</li>`).join("")}${errors.length > 8 ? `<li>… ${errors.length - 8} more</li>` : ""}</ul>`;
    return html;
  }

  function renderCheck() {
    const el = document.getElementById("synth-check");
    if (!el) return;
    let html = `<div class="card">`;
    if (S.textError) {
      const items = Array.isArray(S.textError)
        ? S.textError.map(d => `<li><div class="msg"><span class="chip req">${esc(d.code || FORMAT_LABEL[S.format])}</span>${d.line ? `<span class="synth-pos">${d.line}:${d.column}</span> ` : ""}${esc(d.message)}</div></li>`).join("")
        : `<li><div class="msg"><span class="chip req">${FORMAT_LABEL[S.format] || ".synth"}</span>${esc(S.textError)}</div></li>`;
      const n = Array.isArray(S.textError) ? S.textError.length : 1;
      html += `<div class="synth-verdict bad">${Array.isArray(S.textError) ? `${n} error${n > 1 ? "s" : ""} in the scenario — the names and figures must resolve in the model first` : "Not a scenario yet"}</div><ul class="synth-conflicts">${items}</ul>`;
    } else if (!S.report) {
      html += `<div class="synth-verdict pending">${ready(S.orgId) ? "Waiting for a scenario…" : "Waiting for the domain model…"}</div>`;
    } else {
      const errors = S.report.conflicts.filter(c => c.severity === "error");
      const warnings = S.report.conflicts.filter(c => c.severity === "warning");
      const all = S.caps ? [S.caps, ...errors] : errors;
      html += all.length
        ? `<div class="synth-verdict bad">${all.length} conflict${all.length > 1 ? "s" : ""} — nothing is generated until the declarations agree</div>`
        : `<div class="synth-verdict ok">Feasible${warnings.length ? ` · ${warnings.length} warning${warnings.length > 1 ? "s" : ""}` : ""}</div>`;
      if (all.length) html += `<ul class="synth-conflicts">${all.map(conflictHtml).join("")}</ul>`;
      if (S.report.summary) html += planHtml(S.report.summary);
      if (warnings.length) html += `<div class="synth-section-head">Warnings</div><ul class="synth-conflicts">${warnings.map(conflictHtml).join("")}</ul>`;
    }
    html += `</div>`;
    el.innerHTML = html;
  }
  function conflictHtml(c) {
    return `<li><div class="msg"><span class="chip ${c.severity === "error" ? "req" : "warn"}">${esc(c.code)}</span><span>${esc(c.message)}</span></div>` +
      (c.declarations || []).map(x => `<div class="decl">${esc(x)}</div>`).join("") +
      (c.arithmetic ? `<div class="arith">${esc(c.arithmetic)}</div>` : "") +
      (c.remedy ? `<div class="remedy">${esc(c.remedy)}</div>` : "") + `</li>`;
  }
  function planHtml(summary) {
    const est = Synthy.estimateRows(summary);
    const rows = summary.entities.map(e => {
      const mode = e.mode === "count" ? `count ${fmt(e.count)}` : e.mode === "per" ? `per ${e.per.parent} ${e.per.exactly !== undefined ? "exactly " + e.per.exactly : e.per.min + "–" + e.per.max}` : "given";
      const periods = e.periods ? `${e.periods.period} by ${e.periods.by}` : "";
      return `<tr><td><b>${esc(e.name)}</b></td><td class="mono">${esc(mode)}</td><td class="num">${fmt(est.byEntity[e.name] || 0)}</td><td class="mono">${esc(e.clock || "—")}</td><td class="mono">${esc(e.machine ? e.machine + (e.stateField ? " → " + e.stateField : "") : "—")}</td><td class="mono">${esc(periods)}</td></tr>`;
    }).join("");
    const day = iso => String(iso || "").slice(0, 10);
    return `<div class="synth-section-head">Plan · ${summary.horizon ? esc(day(summary.horizon.from) + " → " + day(summary.horizon.to)) : "no horizon"} · as of ${esc(day(summary.asOf))} · seed ${esc(summary.seed)}</div>
      <table class="sm-table synth-plan"><thead><tr><th>Entity</th><th>Population</th><th style="text-align:right">Rows ≤</th><th>Clock</th><th>Machine</th><th>Curve periods</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${fmt(est.total)}</td><td colspan="3"></td></tr></tfoot></table>`;
  }

  function renderActions() {
    const el = document.getElementById("synth-actions");
    if (!el) return;
    const d = ready(S.orgId);
    el.innerHTML =
      `<button class="synth-btn primary" data-synth="generate"${canGenerate() && d ? "" : " disabled"}>${S.busy === "generate" ? "Generating…" : "Generate"}</button>` +
      `<button class="synth-btn" data-synth="verify"${!S.busy && S.report && S.report.ok && !S.caps && d ? "" : " disabled"} title="Load the tables in DuckDB-wasm and ask every question of the certificate">${S.busy === "verify" ? "Verifying…" : "Verify with DuckDB"}</button>` +
      `<button class="synth-btn" data-synth="zip"${S.dataset && !S.busy ? "" : " disabled"} title="CSV tables, manifest, questions and certificate — re-verify with: synthy verify <dir>">Download .zip</button>` +
      `<span id="synth-status" class="synth-status${S.statusBad ? " bad" : ""}">${esc(S.status)}</span>`;
  }

  function renderResults() {
    const cert = document.getElementById("synth-cert");
    const tables = document.getElementById("synth-tables");
    if (!cert || !tables) return;
    cert.innerHTML = S.certificate ? certificateHtml(S.certificate) : "";
    tables.innerHTML = S.dataset ? tablesHtml(S.dataset) : "";
  }
  function certificateHtml(c) {
    // a plausibility question outside its tolerance is a note, never a failure
    const list = (rows, title, soft) => {
      const sorted = [...rows].sort((a, b) => Number(a.passed) - Number(b.passed));
      return `<div class="synth-section-head">${title} · ${rows.filter(r => r.passed).length}/${rows.length}</div><ul class="synth-questions">` +
        sorted.map(r => `<li><button class="q" data-synth="question" data-id="${esc(r.id)}">` +
          `<span class="mark ${r.passed ? "pass" : soft ? "note" : "fail"}">${r.passed ? "✓" : soft ? "·" : "✗"}</span><span class="qid">${esc(r.id)}</span><span>${esc(r.description)}</span>` +
          `<span class="chip qtier">${esc(r.kind)}</span></button>` +
          (S.open.has(r.id) ? `<pre><b>expected</b> ${esc(JSON.stringify(r.expected))}   <b>observed</b> ${esc(JSON.stringify(r.observed))}${r.error ? `\n<b>error</b> ${esc(r.error)}` : ""}\n<b>source</b> ${esc(r.source)}\n${esc(r.sql)}</pre>` : "") +
          `</li>`).join("") + `</ul>`;
    };
    return `<div class="card">
      <div class="synth-banner ${c.passed ? "pass" : "fail"}"><span class="verdict">${c.passed ? "CERTIFICATE PASSED" : "CERTIFICATE FAILED"}</span>
        <span>hard ${c.summary.hard.passed}/${c.summary.hard.total}</span><span>advisory ${c.summary.advisory.passed}/${c.summary.advisory.total}</span>${c.summary.plausibility && c.summary.plausibility.total ? `<span title="How the data reads, against what was expected; never gating">plausibility ${c.summary.plausibility.passed}/${c.summary.plausibility.total}</span>` : ""}
        <a href="#" class="synth-link" data-synth="certjson" title="The certificate as JSON: engine, every question, its SQL, expected and observed">certificate.json</a>
        <span class="engine">${esc(c.engine)} · ${esc(c.verifiedAt)}</span></div>
      ${list(c.hard, "Hard — must hold")}${c.advisory.length ? list(c.advisory, "Advisory — soft bounds, alerts") : ""}${c.plausibility && c.plausibility.length ? list(c.plausibility, "Plausibility — how the data reads, never gating", true) : ""}
    </div>`;
  }
  function tablesHtml(ds) {
    const t = ds.tables.find(x => x.name === S.table) || ds.tables[0];
    if (!t) return "";
    const tabs = ds.tables.map(x => `<button class="synth-tab${x.name === t.name ? " active" : ""}${x.name.startsWith("synthy_") ? " log" : ""}" data-synth="table" data-name="${esc(x.name)}">${esc(x.name)}<span class="n">${fmt(x.rows.length)}</span></button>`).join("");
    const head = t.columns.map(c => `<th>${esc(c.name)}${c.role && c.role !== "field" ? `<span class="role ${esc(c.role)}">${esc(c.role)}</span>` : ""}<span class="type">${esc(c.type)}</span></th>`).join("");
    const isNum = c => c.type === "int" || c.type === "decimal";
    const body = t.rows.slice(0, PREVIEW_ROWS).map(r => `<tr>${t.columns.map(c => {
      const v = r[c.name];
      if (v === null || v === undefined || v === "") return `<td class="null">null</td>`;
      return `<td${isNum(c) ? ' class="num"' : ""}>${esc(Synthy.formatCell(v, c.type))}</td>`;
    }).join("")}</tr>`).join("");
    return `<div class="card">
      <div class="synth-tabs">${tabs}</div>
      <div class="synth-grid-wrap"><table class="synth-grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <div class="synth-grid-foot"><span>${fmt(Math.min(PREVIEW_ROWS, t.rows.length))} of ${fmt(t.rows.length)} rows · ${t.columns.length} columns${t.entity ? ` · entity ${esc(t.entity)}` : ""}</span>
        <a href="#" data-synth="csv" data-name="${esc(t.name)}">download ${esc(t.name)}.csv</a>
        <span>warnings: ${ds.warnings.length}</span></div>
    </div>`;
  }

  /* ---- events (document-level, so re-rendering never loses them) ---- */
  document.addEventListener("click", e => {
    if (typeof state === "undefined" || state.view !== "synth") return;
    const b = e.target.closest("[data-synth]");
    if (!b) return;
    const act = b.dataset.synth;
    if (act === "csv" || act === "certjson") e.preventDefault();
    switch (act) {
      case "open": openScenario(b.dataset.name); runCheck(); refresh(); renderContextSelectIfAny(); break;
      case "new": newScenario(); renderContextSelectIfAny(); break;
      case "starter": resetToStarter(); break;
      case "import": { const input = document.getElementById("synth-import"); if (input) { input.value = ""; input.click(); } break; }
      case "tosynth": convertToSynth(); break;
      case "download": downloadScenario(b.dataset.format); break;
      case "delete": deleteScenario(); renderContextSelectIfAny(); break;
      case "generate": doGenerate(); break;
      case "verify": doVerify(); break;
      case "zip": downloadZip(); break;
      case "csv": downloadCsv(b.dataset.name); break;
      case "certjson": downloadCertificate(); break;
      case "table": S.table = b.dataset.name; renderResults(); break;
      case "question": S.open.has(b.dataset.id) ? S.open.delete(b.dataset.id) : S.open.add(b.dataset.id); renderResults(); break;
      default: break;
    }
  });
  document.addEventListener("input", e => {
    if (e.target && e.target.id === "synth-editor") onEdit(e.target.value);
  });
  document.addEventListener("change", e => {
    if (e.target && e.target.id === "synth-name") { renameScenario(e.target.value); renderContextSelectIfAny(); renderTreeIfSynth(); }
    if (e.target && e.target.id === "synth-import") importFile(e.target.files && e.target.files[0]);
  });
  function renderContextSelectIfAny() { if (typeof renderContextSelect === "function" && typeof state !== "undefined" && state.view === "synth") renderContextSelect(); }

  return { renderTree, renderMain, selectOptions, onSelect, state: S };
})();

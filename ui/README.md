# Specy Navigator — HTML prototype

Five header tabs: **Domain Navigator** (browse `.domain` models),
**Domain Diagram** (per-module UML-like class diagram rendered by the Specy
Diagram Engine), **Architecture diagram** (a `.arch` software architecture as
a nested, foldable C4 diagram — or, for an `organization` file, the landscape
of its systems with a sheet per system — also rendered by the engine) and
**Requirements Navigator** (browse `.sysreq` requirement sets per
SYSTEM-REQ-METAMODEL.md) and **Synthetic data** (generate and certify data
from a `.domain` in the page, see below). Traceability is bidirectional: a domain element's
`satisfies REQ-…` chips link to the requirement, and each requirement computes
its **Satisfied by** table by scanning the `satisfies` lists of every loaded
domain model — with the satisfaction role derived from the element's kind
(entity → structured-by, invariant → enforced-by, error event → detected-by, …).
The set overview reports coverage (satisfied / unsatisfied) and lists the
unsatisfied requirements. `.sysreq` files come from the model manifest (see
"Loading real `.domain` files") and are parsed by `sysreq-parser.js`.

A static prototype for navigating a Specy domain model, structured by
`src/metamodels/DOMAIN-METAMODEL.md`:

- **Header** — specy.ai brand + organization picker (the `[ … ]` bracket construct).
- **Left panel** — bounded-context dropdown, name/kind filter, and the hierarchy
  tree (modules → aggregates, entities, values & enums, commands, queries, events,
  reactions, services, repositories, interfaces, properties). Selection is marked
  with coral brackets. Aggregate-contained entities nest under their root.
- **Main panel** — detail view of the selected element: ClassCard-style structure
  box (title · fields · operations), a Relations card using the metamodel's own
  relation vocabulary (`raised by`, `scoped to`, `maintained by`, …), state
  machines (see below), escalation chains, and `satisfies` traceability chips.
  Every reference is a link — cross-context links switch the context automatically.

## Diagrams: the Specy Diagram Engine

Both diagram kinds are drawn by the generic **Specy Diagram Engine**, a single
IIFE bundle vendored as `vendor/specy-diagram-engine.js`. It is built from the
sibling repository `../diagram-engine` with `npm run build` and copied into
`ui/vendor/` (the bundle is not generated here; if it is missing the diagram
hosts show a small inline notice instead of a canvas). The bundle exposes
`window.SpecyDiagramEngine.mount(container, diagramFile, opts) → { unmount(),
focus(target), exportSvg(opts), exportPdf(opts) }` and reads a **DiagramFile** (`{ version, model, diagram }`) whose shape is the
normative contract `diagram-engine/docs/DERIVED-DIAGRAMS.md`.

Every island carries the engine's top-right **SVG** and **PDF** buttons
(architecture diagrams also list *Export as SVG* and *Export as PDF…* in their
top-left diagram menu). SVG downloads a standalone, native SVG of what the
canvas shows — current fold levels, highlight and positions, no editing chrome
— as `<diagram id>.svg`. PDF opens the browser's print dialog on a page sized
to the diagram, where "Save as PDF" writes a vector PDF with the real fonts
embedded, suggested as `<diagram id>.pdf`. Hosts can do the same with
`handle.exportSvg({ filename })` / `handle.exportPdf({ filename })`.

The Navigator only produces those files: `domain-to-diagram.js` is a pure,
DOM-free converter (global `SpecyDomainDiagrams`) that turns the parsed domain
shape into DiagramFile JSON — the engine does the layout (dagre, from the
file's `layout` hint; nodes carry no positions), the node/edge components,
the routing, the minimap/legend and the per-diagram persisted positions
(`storagePrefix = model.id`, so hand-tuned layouts never bleed across
modules or machines).

- `SpecyDomainDiagrams.moduleClassDiagram(mod, context, show, orgId?)` —
  metamodel `domain-class`; `show` is the category toggle map
  (`{ interfaces, entities, values, services }`, default `DEFAULT_SHOW`).
- `SpecyDomainDiagrams.contextClassDiagram(context, show, orgId?)` — the
  same metamodel for a whole bounded context at once: every module's
  elements on one canvas, no ghosts (default `CONCEPTS_SHOW`: entities and
  aggregates only — the context's main concepts).
- `SpecyDomainDiagrams.stateMachineDiagram(el, sm, hit?)` — metamodel
  `state-machine`, one file per `machine` of an entity / aggregate.
- Also exported: `MAIN_KINDS`, `CATEGORY_OF`, `DEFAULT_SHOW`, `CONCEPTS_SHOW`,
  `countVisible`, `countVisibleIn`, `moduleModelId`, `contextModelId`,
  `machineModelId`, `compartmentsFor`, `KINDS_FALLBACK`.

Model ids are stable across re-parses: `<org>.<ctx>.<module>` for a class
diagram (derived from the parser's ids, e.g. `business-loan.BL.LoanServicing`),
`<org>.<ctx>` for a context's concept diagram (diagram id `…#concepts`) and
`<element id>.<machine>` for a statechart. Node ids equal the parser's
element ids; cross-module ghosts are `ghost:<id>`.

`app.js` mounts the engine (`mountDiagram`), keeps every mount handle in
`diagramMounts` and disposes them all before the detail panel re-renders.

## State machines (entity / aggregate detail)

Each `machine` of an entity or aggregate renders as a **UML state diagram**
(engine island embedded in the detail card, mounted read-only with
`interactive: false`, `wheel: 'page'` so the page keeps scrolling, and
`autoHeight` — the host's height follows the layout, clamped by
`.sm-flow-host { min-height: 180px; max-height: 520px }`): initial pseudo-state
bullet, rounded state boxes with state invariants as `{ constraint }`
compartments, final states double-bordered, and transitions labeled
`operation [guard]`. Layout is dagre top-to-bottom; self-transitions draw as
nested arcs on the right of their state, back-transitions arc around the left
side, and long transitions bow around any state their straight line would
cross. Below the diagram, the detail card keeps the state list (description +
`holds:` invariants) and the full transitions table — including the
`● → initialState` creation rows with their operation. The converter emits a
`[*]` element only when the machine has start transitions or an initial state.

## Domain Diagram tab

Pick a module in the left panel; the main panel becomes an engine canvas
showing a UML-like class diagram of the module. **Class cards** render
entities, aggregates (2px navy identity), services, values, enums and
interfaces (dashed border) with compartments precomputed by the converter:
attributes (identity first, then typed fields), operations, enum literals, and
invariants folded in as `{ constraint }` rows (capped at 12 / 10 / 8 rows with
a `+ N more…` row). **Relations are labeled edges**, each backed by a typed
`model.relations` entry: `CONTAINS` (`contains`, heavier), `CALLS`,
`DELEGATES TO`, `DESCRIBES`, `EXPOSES`, `PROJECTS`, `COMPOSES`, reference
names with cardinality (`reference`), and attribute-type links
(`attribute-type`, drawn quieter — they are numerous). Commands, queries,
events and reactions are deliberately excluded, as are repositories and
agreements. Header checkboxes toggle the four categories: interfaces,
entities / aggregates, values, services — the converter decides visibility,
so a hidden endpoint simply drops its edges. Cross-module endpoints appear as
dashed ghost cards naming their home module (their `modelRef` points at the
home module's model). Double-click any element to open it in the Domain
Navigator (`onNavigate`). The last header checkbox, **legend**
(`legendToggleHtml`), hides the legend: the engine's panel under the class
diagrams and the strip above the organization diagrams (the landscape, the
domain concepts by system). It applies to every diagram at once, redraws
nothing, and is kept per browser (`localStorage`
`specy-navigator:legend-hidden`). Still no build step on this side: only the vendored
engine bundle is a build product.

The left panel offers two wider scopes above the module rows
(`state.diagramScope`: `module` | `context` | `org`):

- **All concepts of a context** — the first row of the tree, above
  `Modules`: every entity and aggregate of the bounded context on one class
  diagram, whatever its module (`contextClassDiagram`). The same cards and
  labeled relations as the module diagram, now crossing modules, so there are
  no ghosts; the four category toggles (`data-conceptopt`) open on entities /
  aggregates alone and let values, services and interfaces in. `open context
  map ↗` goes to the context in the Domain Navigator.
- **Domain concepts by system** — the entry **above the "Bounded context"
  dropdown** (`#tree-top`, shown in this tab only): the whole organization,
  every concept grouped under the system that manipulates it, drawn by
  `SpecyArchDiagrams.conceptLandscapeDiagram` from the **level-0 `.arch`**
  (an `organization` file, see "Organization files" below) whose
  `domain-source` is this organization — `conceptArchFor(org)`, the first
  such file loaded (name order). Without one the entry is disabled and says so.
  Areas are groups as in the landscape; inside them **each system is a
  foldable group holding one card per concept it `masters`** (solid: its
  source of truth) **or `handles`** (dashed: owned by another system), the
  name resolved through `arch-concepts.js` as the Architecture diagram
  resolves it — the bounded context on the card, the kind as the colour of
  its left bar, `also mastered by …` when several systems claim it, a grey
  note card for a name a `// NOTE:` acknowledges. No card or group repeats
  its kind ("System", "Entity · masters"): the legend strip names each kind
  once, by its colour (`kindLegendHtml`), and the diagram bar carries the
  title alone. The **dependency edges are
  the landscape's**, between the system nodes: fold the systems (*Groups 1*
  or *2*) and the picture is the level-0 landscape again (the engine
  aggregates the edges). Toggles (`data-conceptlandopt`): external systems,
  handled concepts, edge labels, **flows** (off by default: one dashed edge
  per concept a flow carries, from the sender's card to the receiver's card
  of its `as` name — or to the system node when it lists no such card —
  labelled with the flow number) and **unplaced concepts** (off: a dashed
  group of the domain's entities and aggregates no system names, the audit
  view). Double-click a card, or use its `⋯` menu, to open the domain
  element; the Domain Navigator then shows a `← … — concepts by system` link
  and the browser's Back button returns to the diagram. `open landscape ↗`
  switches to the Architecture diagram. Model id `<file stem>-concepts`
  (also the storage prefix), diagram id `…#concepts`; the cards' styles are
  in `arch-landscape.css` (`.concept-card`).

Deep links: `#concepts:<org id>` (by system), `#concepts:ctx:<context id>`
(a context's concepts) and `#concepts:mod:<module id>` (a module); the hash
follows the selection. Changing the context in the dropdown while the
organization diagram is shown opens that context's concepts.

## Architecture diagram tab

Renders one `.arch` file (SOFTWARE-ARCHITECTURE-METAMODEL.md, grammar
`src/grammars/architecture.ebnf`) as a **nested, foldable C4 diagram**: the
system in focus is a group (`er-group`, kind `system`) holding its
containers; a container with components — or a broker hosting channels — is
a nested group, a black-box container (database, SPA, store…) a plain card.
Persons and external systems sit outside the system (dagre top-to-bottom:
persons above, external systems below). The engine's group **detail levels
are the C4 zoom levels**: *Groups 1* folds everything to the System Context
view, *2* shows containers, *3* opens the components; each group also has its
own `1 | 2 | 3` control and a header double-click cycle. Folded groups carry
aggregated edges (one line per direction; hovering it lists the connectors it stands for).

- **Picker** — the left-panel dropdown lists the loaded architectures
  (every `.arch` the model manifest names, in name order — locally the
  `.arch` files of `ui/`, such as the public `url-shortener.arch` and
  `retail-media.arch`, an `organization` file — see "Organization files"
  below); the
  tree shows the system, element counts keyed by the canvas colours, the fold
  hint and the containers (info rows; the filter box is hidden in this view).
- **Landscapes** — a file may hold several `system` blocks (a C4 system
  landscape). Each system is its own foldable group, so *Groups 1* shows the
  systems and the flows between them, *2* their containers, *3* the
  components; the tree lists the containers under their system.
  `ffm.arch` is such a landscape: `scripts/merge-arch.mjs` merges the 11
  single-system files generated for FFM (kept, git-ignored, in
  `ffm.arch-sources/`) — persons and external systems once, each type and
  interface declared once, a flow described by both of its systems fused into
  one connector, same-name containers suffixed with their system:

  ```bash
  node scripts/merge-arch.mjs -o ffm.arch --name PaysageApplicatifFfm \
    ffm.arch-sources/exalto.arch ffm.arch-sources/engage-sports.arch …   # order = type placement
  ```
- **Selection and details** — a system or container row in the tree selects
  it in the canvas and frames it (the groups folding it away open just
  enough: its system at level 2 at least), and a details panel opens beside
  the canvas: kind, where it lives, technology / bounded context,
  description, the realized domain module or context (button), contracts
  (provides / requires / publishes / subscribes / realizes), what is drawn
  inside it, deployment (containers), and every flow crossing its boundary,
  outgoing and incoming, with the element it goes through. Names in the
  panel are links (same behaviour); a click in the canvas selects too and
  the tree follows; an empty-canvas click or `×` closes the panel. Built on
  the engine's `handle.focus()` and `onSelect` (DERIVED-DIAGRAMS.md §1).
  The handle between the canvas and the panel resizes it (drag, or the arrow
  keys once it has the focus; double-click resets); the width is kept in
  `localStorage`, one for these details and one for the level-0 sheet.
- **Toggles** — persons, external systems, channels, edge labels. A hidden
  kind drops its cards and every edge touching them; with channels hidden a
  broker with no other member becomes a black-box card.
- **Edges** — one per connector (`<interface> · <protocol>`, protocol cut at
  its first ` (`, label capped at 32 characters; the full protocol and the
  connector description stay in `data.description`). Solid = `sync`, dashed
  `6 4` = `async`, dotted `2 3` = `streaming`; `publishes` / `subscribes`
  (component → channel) are dashed. Parallel connectors with the same
  source, target and style merge into one edge (`data.relationIds`, labels
  joined with ` / `); a connector from a component to its own container stays
  in the model but is not drawn. Edge sides are derived by the engine
  (`layout.handles: "auto"`).
- **Navigation** — a card whose `realizes module "…"` / `realizes context X`
  resolves in the `.domain` named by the file's `domain-source` (that
  `.domain` must be loaded too) carries `data.domainRef` and an
  `Open module "…"` action; double-click or the action opens it in the
  Domain Navigator. Deep link: `#arch:<file stem>` (e.g. `#arch:url-shortener`),
  followed by the selection when there is one: `#arch:url-shortener/container:EdgeApi`.
  The hash follows the selection (`replaceState`), and leaving the tab through
  a link pushes a history entry: the browser's Back button returns to the
  diagram with the same selection (see "Back from the Domain Navigator").
- Model id `<file stem>-architecture` (also the storage prefix: positions and
  fold levels persist per file), diagram id `<model id>#architecture`.

### Organization files: the landscape and the sheets

A file rooted at `organization` (SOFTWARE-ARCHITECTURE-METAMODEL.md, "Level 0
— Organization") describes several systems, the dependencies between them
and the numbered flows of domain concepts along each dependency. It opens on
its **landscape**, and keeps the C4 diagram one click away; a file rooted at
`architecture` only has the C4 view described above.

- **Landscape** — the systems grouped by area, each card showing its role
  name, its product, its hotspots and its main concepts (first, in bold and
  with no key, the ones it `masters`: what it is the source of truth for;
  then `handles`), and one edge per dependency,
  labelled with its flow numbers. **An arrow means "depends on"**, not "sends
  data to": `A → B` reads "A depends on B", the arrowhead is on the system
  depended upon, and two systems that depend on each other show two edges. A
  strip under the diagram bar says so and prints the converter's
  `LANDSCAPE_LEGEND` (how a critical dependency and a Partnership are drawn),
  after one swatch per kind drawn (area, system, external system, person)
  and what the bold names mean:
  the cards carry no "System" / "Area" eyebrow, only a system detailed in
  containers says "Detailed". The diagram bar holds the title, not the file
  name (the picker's) nor the counts (the tree's). Toggles: external systems, persons (off by default: the person cards, and a
  `used by` row on the system cards), edge labels, concepts.
- **Landscape | C4 switch** — in the diagram bar. The C4 view draws the
  systems detailed inline with their containers and components and the others
  as black-box cards; its tree and details are the C4 ones. A system detailed
  inline has an `Open C4 view` button on its sheet, which arrives on its
  containers; in the C4 view a system's details carry `Open system sheet`.
- **Tree** — the organization (its description, and a line only when its
  concept names cannot be linked: no `domain-source`, or one not loaded), a
  **Problems** block when the reader left `issues` or a name is ambiguous or
  unresolved, the areas with their systems, the external systems, the persons, the dependencies
  (`ERP → CRM`, `⇄` on a mutual pair, the flow numbers) and the phases in
  order. Rows select as in the C4 view. The selected system unfolds its main
  concepts (● mastered, ○ handled), the selected dependency its flows.
- **System sheet** — click a system (tree or card): the sheet opens beside
  the canvas, wider than the C4 details. It shows the role name and the
  product, the status, the area, whether it is a black box or detailed, the
  purpose, who uses it, contacts, documents (links, new tab), the bounded
  contexts it realizes, its **main entities** — source of truth, then merely
  handled, each with its kind and context, and "a read-only copy sourced
  from …" when the domain element says so — its **hotspots** (the flows a
  hotspot concerns are numbered chips that jump to the flow below), then its
  **inbound** and **outbound flows**, and the dependencies in both directions.
- **Flows** — classified by the direction of the data (`receiver` /
  `sender`), not of the dependency: the two are independent, so every group of
  flows names its peer system *and* the dependency it belongs to ("from CRM ·
  ERP depends on CRM", "to CRM · CRM depends on ERP"). A row gives the flow
  number, its label, the concepts carried (`X as Y`: X in the sender's model
  becomes Y in the receiver's) and the mechanism — one column per phase when
  the organization declares phases ("CSV file export/import · manual", then
  "automated"), a mechanism stated once spanning them, and an explicit
  *undecided* where a phase is open. In a sheet narrower than about 530px the
  table turns into labelled lines (a container query: it follows the sheet,
  not the window).
- **Dependency sheet** — click a dependency row or an edge: "A depends on
  B", which side each pattern qualifies and what it means, whether the pair is
  one-way, a mutual dependency or a Partnership (with a link to the opposite
  dependency), the criticality ("if B is down, A is down too" — or unstated),
  and the flows with the direction of each. The selected edge is highlighted.
  Persons, areas and external systems have a short sheet too.
- **Concept links** — every concept name (`masters`, `handles`, a hotspot's
  `concerns`, both sides of `carries X as Y`) is resolved by
  `arch-concepts.js` against the `.domain` files named by the organization's
  `domain-source`s (they must be loaded too): a qualified
  name (`Sales.Account`) in that context; a bare name first in the contexts
  the system realizes, then in the whole model, where a read-only copy never
  competes with the definition it copies. A resolved name is a link into the
  Domain Navigator — in the sheets, in the tree, and in the card's `⋯` menu
  (`Open <Concept>`; double-click opens the first context the system
  realizes). An ambiguous name unfolds its candidates. A name the model does
  not hold is plain text, with the `// NOTE:` that acknowledges it, or "no
  domain element". Without a loaded domain source every name is plain text.
- **Back from the Domain Navigator** — following a link out of the
  Architecture diagram pushes a history entry, so the browser's Back button
  returns to the same file, view and selection; the Domain Navigator also
  shows a `← ERP · RetailMediaCo — architecture` link until a tab is clicked.
  A `hashchange` listener routes Back / Forward, typed hashes and the plain
  `#<element id>` links of the card menus.
- **Deep links** — `#arch:retail-media` (landscape),
  `#arch:retail-media/system:ERP`, `#arch:retail-media/dependency:ERP->CRM`,
  `#arch:retail-media/c4` and `#arch:retail-media/c4/system:CampaignHub`.
- Model id `<file stem>-landscape` (`landscapeModelIdOf`, also the storage
  prefix), diagram id `<model id>#landscape`. If `landscapeDiagram` is missing
  or throws, the file is shown by the C4 view alone.

`arch-parser.js` (`parseArch(text, fileStem)`) is a tolerant structural
reader like `domain-parser.js`: comments stripped, multi-line headers and
operations joined into logical lines, quote-aware brace counting (one-line
`enum { … }` / `exception { … }` / `meta { … }` blocks stay statements).
Types (`struct`, `enum`, `union`, `exception`, `typedef`, `import`) are
skipped and interface operations only counted — none of them is drawn. `arch-to-diagram.js`
(global `SpecyArchDiagrams`) is the pure converter:
`architectureDiagram(arch, show, { domainOrg })`, plus `DEFAULT_SHOW`,
`modelIdOf`, `countVisible`, `KIND_LEGEND` (kind colours mirroring the
engine's `.er-node--kind-*` rules). For an `organization` file the parser
also returns the level-0 shape (areas, phases, dependencies, flows,
acknowledged names, `issues` — documented at the top of the file), and the
converter adds `landscapeDiagram(arch, show, { resolution })`,
`LANDSCAPE_DEFAULT_SHOW`, `landscapeModelIdOf`, `landscapeCountVisible` and
`LANDSCAPE_LEGEND`, plus the Domain Diagram tab's
`conceptLandscapeDiagram(arch, show, { resolution, domainOrgs, report })`,
`CONCEPT_LANDSCAPE_DEFAULT_SHOW`, `conceptLandscapeModelIdOf` and
`CONCEPT_LANDSCAPE_LEGEND` (the `report` collects counts: systems, groups,
cards, notes, flows, unplaced, the flows dropped); the node kinds they
introduce are styled by `arch-landscape.css`. `arch-concepts.js` (global `SpecyArchConcepts`, pure
and DOM-free like the converters) resolves the concept references:
`domainOrgsFor(arch, organizations)` picks the loaded domain models,
`resolveAll(arch, orgs)` returns the counts, the problems and `of(ref)` — the
resolution of one reference: `resolved` (with the element id `goto()` takes),
`ambiguous` (candidates), `acknowledged` (the NOTE), `unresolved` or `plain`.

Every `.arch` and `.domain` file in `ui/` is git-ignored (client models stay
local; the manifest lists whatever model files are in `ui/`).
For the public samples, link them from `examples/` once after cloning (the
server started by `./serve.sh` follows symlinks). Sniplink is a single-system
`architecture` file — double-click navigation then lands in the Sniplink
organization; RetailMediaCo is an `organization` file, whose concept links
need its `.domain` next to it:

```bash
ln -s ../examples/url-shortener/url-shortener.arch   ui/url-shortener.arch
ln -s ../examples/url-shortener/url-shortener.domain ui/url-shortener.domain
ln -s ../examples/retail-media/retail-media.arch     ui/retail-media.arch
ln -s ../examples/retail-media/retail-media.domain   ui/retail-media.domain
```

Then open `http://localhost:8347/#arch:retail-media`, or
`#concepts:retail-media` for its concepts by system. The FFM files are
symlinks too, to the mission's `specy/` folder (`ffm.domain`, `ffm.arch`,
`ffm-paysage.arch` — the level-0 file behind `#concepts:ffm`), so the
Navigator always shows the regenerated models.

## Synthetic data tab

[synthy](../../specy-synthy) in the browser: from the organization's `.domain`
and a **scenario** — what the data must add up to — it generates tables that
satisfy both the model (bounds, enums, references, state machines, invariants)
and the scenario (populations, curves, shares, mixes, rates, rollups), then
asks DuckDB-wasm every question of a **certificate**. Everything runs in the
page; nothing is sent anywhere.

- **Left panel** — the scenarios of the organization (kept in `localStorage`
  under `specy-synth:<org id>`, so they survive a reload and never leave the
  browser), `new scenario…`, and the plan outline once the scenario checks:
  each entity, its population and the rows it will produce.
- **Scenario dropdown** (in place of the bounded-context one) — the same list,
  plus `+ new scenario`.
- **Main panel** — the scenario editor: `.synth` text, parsed in the page against
  the organization's `.domain` by the Langium bundle, so an unknown entity, field,
  state or member is an error with its line and the closest name before synthy
  runs; the same scenario as JSON or YAML is read too (a `YAML` or `JSON` chip and
  `Convert to .synth` then show in the toolbar), `Import…` opens a `.synth`,
  `.synth.json` or `.synth.yaml` file as a new scenario (JSON and YAML arrive as
  `.synth`), and `Download scenario` writes it in any of the three; a `Reset to
  starter` that derives a feasible first scenario from
  the model (one population per entity, children `per` their parent when a
  collection reference or a lifecycle says so); the **check** card, updated as
  you type: conflicts as compiler errors (`SYN-E…` code, the declarations that
  cannot all hold, the arithmetic, a remedy) or `Feasible` with the plan table
  and the warnings (`SYN-W…`, what synthy reports but does not enforce);
  **Generate**, **Verify with DuckDB**, **Download .zip**; the certificate
  (hard questions that must hold, advisory ones for soft bounds, each
  expandable to its SQL, expected and observed, `certificate.json` to
  download); the table preview — one tab per table including the
  `synthy_events` / `synthy_commands` / `synthy_transitions` logs, column
  roles (identity, fk, state, clock, synthetic), first 50 rows, CSV per table.
- Deep link: `#synth:<org id>`.

A scenario above 50 000 rows is refused in the page (`SYN-E020`) and pointed
to the command line (`synthy generate`); the zip is the folder the CLI writes
(`<Table>.csv`, `manifest.json`, `questions.json`, `questions.sql`,
`certificate.json`, `scenario.json`), so `synthy verify <dir>` re-certifies a
download with nothing but the files.

Two vendored bundles do the work, both built elsewhere and copied into
`vendor/` like the diagram engine:

- `vendor/specy-domain-langium.js` — the Langium `.domain` parser of
  `src/langium/specy-domain` (`npm run build:browser` there), exposing
  `window.SpecyDomainLangium.parseDomain(text, name) → { model, diagnostics, ok }`,
  the same clean model `specy-domain parse` prints: strict where
  `domain-parser.js` is tolerant, so a model with parse errors shows them here
  and still browses in the other tabs. The source text of every `.domain` the
  server listed is kept at boot (`DOMAIN_TEXT`); the `data.js` samples have
  none and the tab says so.
- `vendor/synthy.js` — `specy-synthy` (`npm run build` there, from
  `dist/bundle/synthy.js`), exposing `window.Synthy`. DuckDB-wasm's worker and
  module (about 36 MB) are fetched from jsDelivr the first time a certificate
  is verified, not before, and kept for the session.

`synth-view.js` (`window.SpecySynth`) renders the tab; `app.js` only routes to
it (`renderTree`, `renderMain`, `selectOptions`, `onSelect`) when
`state.view === "synth"`. `synth.css` holds its styles. The end-to-end test
lives with synthy (`specy-synthy/test/app.test.ts`: serves this folder like
`serve.sh`, drives the tab in Chromium, answers the jsDelivr requests from
`node_modules`).

## Checking the converters

```bash
node scripts/check-diagram-export.mjs                 # examples/business-loan
node scripts/check-diagram-export.mjs path/to/x.domain
node scripts/check-arch-export.mjs                    # examples/url-shortener
node scripts/check-arch-export.mjs path/to/x.arch     # validate only
node scripts/check-arch-landscape.mjs                 # examples/retail-media (level 0)
node scripts/check-arch-landscape.mjs path/to/x.arch
```

The script needs only Node (no dependencies): it loads `domain-parser.js` and
`domain-to-diagram.js` in a bare `vm` context, converts every module (with
every category toggle), every context's concept diagram (every toggle on and
off: no ghost, every card naming its home module, a model id no module
shares) and every state machine of the model, validates the
DiagramFiles against the contract (required fields, edge endpoints among the
nodes, every `modelRef` resolving, no node positions, ghosts prefixed
`ghost:`, one relation per edge), checks that `KINDS_FALLBACK` has not drifted
from `KINDS` in `app.js`, prints counts, and writes the richest module,
machine and context to `../diagram-engine/examples/diagrams/navigator-domain-class.json`,
`navigator-statechart.json` and `navigator-context-concepts.json` as engine
fixtures. Examples that elide the `organization` / `context` containers
(business-loan) are wrapped in a synthetic one before parsing.

`check-arch-export.mjs` does the same for the architecture converter: it
parses the `.arch` (and its `domain-source`, for the `domainRef` links),
converts it with every toggle combination and checks the DiagramFiles —
`software-architecture` metamodel, dagre layout with `handles: "auto"`,
unique ids, no node position or height, parents before members with
`extent: "parent"`, `er-group` iff the node has members, every `modelRef`
resolving, dash pattern per connector style, no edge into an ancestor, every
relation drawn (except component → own-container connectors), no unresolved
connector endpoint. It prints counts, merged / dropped connectors and the
resolved `domainRef`s, and writes the default (url-shortener) conversion to
`../diagram-engine/examples/diagrams/navigator-architecture.json`. A file
passed on the command line is validated only, never written — client
models stay out of the engine repository.

`check-arch-landscape.mjs` checks an `organization` file as the Navigator
reads it: it parses the `.arch` and its `domain-source`s
(looked up next to it), applies the level-0 rules that need no judgment (flow
numbers unique, `to` naming an end of its dependency, declared areas, phases
and persons, one dependency per ordered pair, known patterns and criticality,
`Partnership` on both dependencies of a pair or on neither, no `as` received
by a Conformist downstream, a hotspot concerning flows of its own system, a
concept mastered by one system at most…), resolves every concept reference
with `arch-concepts.js` — each one resolves to exactly one domain element or
is acknowledged by a `// NOTE:` — then converts the organization into the
concept landscape with every toggle combination and checks the group
contract (parents before members, `er-group` iff members, every system drawn
once, every resolved `masters` / `handles` reference one card inside its
system, every dependency between drawn systems one edge between the system
nodes, flows and the unplaced group only when toggled on), prints the counts
and exits non-zero on a violation. For the default example it writes the
default conversion to `../diagram-engine/examples/diagrams/navigator-concept-landscape.json`;
a file passed on the command line is checked only.

## Run

```bash
./serve.sh          # http://localhost:8347
./serve.sh 9000     # custom port
```

Deep links work: `http://localhost:8347/#rh.rides.RideRequest`,
`#arch:url-shortener`, `#arch:retail-media/system:ERP`.

## Loading real `.domain` files

At boot the app asks the server for the model manifest (`GET api/models` →
`{ tenant, files: [{ org, name, kind }] }`) and fetches each file at
`api/models/<org>/<name>`. `serve.sh` builds the manifest from the `.domain`,
`.sysreq` and `.arch` files in `ui/` (one organization, `local`; cloud-sync
`*_Conflict.*` copies are skipped); the hosted Worker (`hosting/`) builds it
from the files published for the signed-in tenant, restricted to the
organizations that user may see. Files are loaded by kind — `.domain`, then
`.sysreq`, then `.arch` — in name order; each `.domain` is parsed by
`domain-parser.js` (a tolerant structural reader for the v3 DSL — comments
stripped, brace-scoped block tree, headers matched by pattern) and added as an
organization in the header picker, after the `data.js` samples. With nothing
listed at all the app shows an empty state; with `.arch` or `.sysreq` files but
no `.domain`, the two domain tabs are disabled. Client models are **not** in
this repo (they are gitignored); for a tracked model to browse, copy or link
one out of `examples/` (e.g. `business-loan.domain` + `business-loan.sysreq`)
into `ui/`.

The reader follows the grammar's elisions: a definition written on one line is
read like its multi-line form; definitions written directly under a `context`
are gathered in an implicit module named `(context)` (id
`<fileStem>:<ctxShortname>:(context)`, listed after the declared modules); a
file that starts at `context` gets an implicit organization named after the
file stem, and a file that starts at `module` or at bare definitions an
implicit context as well. Two definitions of the same name in one context
share an id; the first one is the one the app opens. Still not read: one-line
sub-blocks (`fields { … }`, `entities { … }`) inside a definition laid out
over several lines, so such an aggregate shows no contained entities.

To add another model, drop the file in `ui/` and reload: the manifest lists
it (a file that fails to load is skipped with a console warning).
Cross-references are resolved by name within the bounded
context; command→operation→event chains are back-linked automatically
(`"Label" on Command` gives the command its `targets`/`triggers`/`produces`,
and `emits` gives each event its `raised by`).

## Files

- `index.html` — shell (header / tree / main triptych); loads the engine
  bundle first, then `data.js`, the parsers, `domain-to-diagram.js`,
  `arch-parser.js`, `arch-to-diagram.js`, `arch-concepts.js`, `app.js`
- `ds-tokens.css` — design tokens imported from the specy.ai design system
  (claude.ai/design project `019e2b0b…`); fonts via Google Fonts instead of the
  project's self-hosted TTFs
- `app.css` — app styles (ClassCard reproduced from `ui_kits/specy-ai/ClassCard.jsx`);
  the diagram host rules (`.diagram-wrap`, `.diagram-bar`, `.flow-host`,
  `.sm-flow-host`) plus the `.specy-node` / `.cc-*` / `.specy-ghost` /
  `.specy-state` visual language the engine reproduces (the bundle ships its
  own copy of those), and the architecture view: details panel, organization
  tree, level-0 sheets, flow tables
- `arch-landscape.css` — canvas-only styles of the landscape: the `area`
  group, the system card, the handle offsets that keep the two edges of a
  mutual pair apart
- `data.js` — sample "Acme Mobility" + "Acme Retail" organizations exercising every
  metamodel concept
- `domain-parser.js` / `sysreq-parser.js` — tolerant readers for `.domain` / `.sysreq`
- `domain-to-diagram.js` — model → DiagramFile converters (`SpecyDomainDiagrams`)
- `arch-parser.js` — tolerant reader for `.arch` software architectures (`parseArch`)
- `arch-to-diagram.js` — architecture → nested C4 DiagramFile, organization →
  landscape DiagramFile (`SpecyArchDiagrams`)
- `arch-concepts.js` — level-0 concept references resolved against the domain
  models (`SpecyArchConcepts`)
- `url-shortener.arch`, `url-shortener.domain`, `retail-media.arch`,
  `retail-media.domain` — local symlinks to the public `examples/` samples
  (git-ignored, see above)
- `app.js` — vanilla JS rendering, no build step; mounts the engine islands
- `serve.sh` — local server: the static files plus the model manifest (`api/models`)
- `hosting/` — the Cloudflare Worker that serves this app to a client's
  readers behind Cloudflare Access (its own README; design in
  `proposals/navigator-hosting.md`)
- `vendor/specy-diagram-engine.js` — the Specy Diagram Engine bundle
  (built in `../diagram-engine` with `npm run build`, copied here)
- `vendor/specy-domain-langium.js` — the Langium `.domain` parser for the page
  (built in `src/langium/specy-domain` with `npm run build:browser`, copied here)
- `vendor/synthy.js` — specy-synthy for the page (built in `../../specy-synthy`
  with `npm run build`, `dist/bundle/synthy.js` copied here)
- `synth-view.js` / `synth.css` — the Synthetic data tab (`SpecySynth`)
- `scripts/check-diagram-export.mjs` — converter contract check + engine fixtures
- `scripts/merge-arch.mjs` — merges single-system `.arch` files into one landscape (`ffm.arch` from `ffm.arch-sources/`)
- `scripts/check-arch-export.mjs` — architecture converter contract check +
  `navigator-architecture.json` fixture
- `scripts/check-arch-landscape.mjs` — level-0 rules and concept resolution of
  an `organization` file

# Specy Navigator — HTML prototype

Three header tabs: **Domain Navigator** (browse `.domain` models),
**Domain Diagram** (per-module UML-like class diagram rendered by the Specy
Diagram Engine) and **Requirements Navigator** (browse `.sysreq` requirement
sets per SYSTEM-REQ-METAMODEL.md). Traceability is bidirectional: a domain element's
`satisfies REQ-…` chips link to the requirement, and each requirement computes
its **Satisfied by** table by scanning the `satisfies` lists of every loaded
domain model — with the satisfaction role derived from the element's kind
(entity → structured-by, invariant → enforced-by, error event → detected-by, …).
The set overview reports coverage (satisfied / unsatisfied) and lists the
unsatisfied requirements. `.sysreq` files are registered in `SYSREQ_FILES`
(top of `app.js`) and parsed by `sysreq-parser.js`.

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
`window.SpecyDiagramEngine.mount(container, diagramFile, opts) → { unmount() }`
and reads a **DiagramFile** (`{ version, model, diagram }`) whose shape is the
normative contract `diagram-engine/docs/DERIVED-DIAGRAMS.md`.

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
- `SpecyDomainDiagrams.stateMachineDiagram(el, sm, hit?)` — metamodel
  `state-machine`, one file per `machine` of an entity / aggregate.
- Also exported: `MAIN_KINDS`, `CATEGORY_OF`, `DEFAULT_SHOW`, `countVisible`,
  `moduleModelId`, `machineModelId`, `compartmentsFor`, `KINDS_FALLBACK`.

Model ids are stable across re-parses: `<org>.<ctx>.<module>` for a class
diagram (derived from the parser's ids, e.g. `business-loan.BL.LoanServicing`)
and `<element id>.<machine>` for a statechart. Node ids equal the parser's
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
Navigator (`onNavigate`). Still no build step on this side: only the vendored
engine bundle is a build product.

## Checking the converters

```bash
node scripts/check-diagram-export.mjs                 # examples/business-loan
node scripts/check-diagram-export.mjs path/to/x.domain
```

The script needs only Node (no dependencies): it loads `domain-parser.js` and
`domain-to-diagram.js` in a bare `vm` context, converts every module (with
every category toggle) and every state machine of the model, validates the
DiagramFiles against the contract (required fields, edge endpoints among the
nodes, every `modelRef` resolving, no node positions, ghosts prefixed
`ghost:`, one relation per edge), checks that `KINDS_FALLBACK` has not drifted
from `KINDS` in `app.js`, prints counts, and writes the richest module and
machine to `../diagram-engine/examples/diagrams/navigator-domain-class.json`
and `navigator-statechart.json` as engine fixtures. Examples that elide the
`organization` / `context` containers (business-loan) are wrapped in a
synthetic one before parsing.

## Run

```bash
./serve.sh          # http://localhost:8347
./serve.sh 9000     # custom port
```

Deep links work: `http://localhost:8347/#rh.rides.RideRequest`.

## Loading real `.domain` files

At boot the app fetches the files listed in `DOMAIN_FILES` (top of `app.js`),
parses them with `domain-parser.js` (a tolerant structural reader for the v3
DSL — comments stripped, brace-scoped block tree, headers matched by pattern),
and adds each as an organization in the header picker. Registered by default are
the `fipro.*` client models, which are **not** in this repo (they are gitignored)
— a missing file is skipped with a console warning, so the app boots on the
`data.js` samples alone. For a tracked model to browse, copy one out of
`examples/` (e.g. `business-loan.domain` + `business-loan.sysreq`) into `ui/`.

To add another model, drop the file in `ui/` and append its name to
`DOMAIN_FILES`. Cross-references are resolved by name within the bounded
context; command→operation→event chains are back-linked automatically
(`"Label" on Command` gives the command its `targets`/`triggers`/`produces`,
and `emits` gives each event its `raised by`).

## Files

- `index.html` — shell (header / tree / main triptych); loads the engine
  bundle first, then `data.js`, the parsers, `domain-to-diagram.js`, `app.js`
- `ds-tokens.css` — design tokens imported from the specy.ai design system
  (claude.ai/design project `019e2b0b…`); fonts via Google Fonts instead of the
  project's self-hosted TTFs
- `app.css` — app styles (ClassCard reproduced from `ui_kits/specy-ai/ClassCard.jsx`);
  the diagram host rules (`.diagram-wrap`, `.diagram-bar`, `.flow-host`,
  `.sm-flow-host`) plus the `.specy-node` / `.cc-*` / `.specy-ghost` /
  `.specy-state` visual language the engine reproduces (the bundle ships its
  own copy of those)
- `data.js` — sample "Acme Mobility" + "Acme Retail" organizations exercising every
  metamodel concept
- `domain-parser.js` / `sysreq-parser.js` — tolerant readers for `.domain` / `.sysreq`
- `domain-to-diagram.js` — model → DiagramFile converters (`SpecyDomainDiagrams`)
- `app.js` — vanilla JS rendering, no build step; mounts the engine islands
- `vendor/specy-diagram-engine.js` — the Specy Diagram Engine bundle
  (built in `../diagram-engine` with `npm run build`, copied here)
- `scripts/check-diagram-export.mjs` — converter contract check + engine fixtures

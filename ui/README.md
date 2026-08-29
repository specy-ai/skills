# Specy Navigator — HTML prototype

Two header tabs: **Domain Navigator** (browse `.domain` models) and
**Requirements Navigator** (browse `.sysreq` requirement sets per
SYSTEM-REQ-METAMODEL.md). Traceability is bidirectional: a domain element's
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
  relation vocabulary (`raised by`, `scoped to`, `maintained by`, …), state-machine
  tables, escalation chains, and `satisfies` traceability chips. Every reference is
  a link — cross-context links switch the context automatically.

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

- `index.html` — shell (header / tree / main triptych)
- `ds-tokens.css` — design tokens imported from the specy.ai design system
  (claude.ai/design project `019e2b0b…`); fonts via Google Fonts instead of the
  project's self-hosted TTFs
- `app.css` — app styles (ClassCard reproduced from `ui_kits/specy-ai/ClassCard.jsx`)
- `data.js` — sample "Acme Mobility" + "Acme Retail" organizations exercising every
  metamodel concept
- `app.js` — vanilla JS rendering, no build step

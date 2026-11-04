## Synthetic-data scenario (`.synth`)

A scenario is written against a `.domain`: the front matter names it (`domain: orders.domain`), and the converter reads that file next to the input before parsing, so every path (`Order.totalAmount.amount`), state and enum member is checked as the DSL checks it. Without `domain:` in the front matter or a `**Domain:**` line, the reader stops with `MD-DOMAIN`. JSON and YAML are described in SYNTH-METAMODEL.md, "Storage formats"; the Markdown below is the same document.

### Headings

| Heading | DSL |
|---|---|
| `# scenario OrdersH1_2025` | `scenario OrdersH1_2025 { … }` — tolerated: a plain title (`# Spring campaign` reads as `SpringCampaign`, with `MD-DEFAULT-KIND`) |
| `## Populations` (tolerated: `Rows`, `Row counts`, `Volumes`) | `populations { … }` |
| `## Outcomes` (`Facts`, `Figures`, `Targets`) | `outcomes { … }` |
| `### curve monthlyRevenue`, `### total revenue`, `### share paymentByStatus`, `### mix`, `### rate availability`, `### rollup` | one outcome; the name is optional, and the heading may carry the path instead (`### mix Order.OrderLifecycle`, `### Lifecycle mix Order.OrderLifecycle`) |
| `## Givens` (`Reference data`, `Master data`, `Catalogues`) | `givens { … }` |
| `### given Product` (tolerated: `### Product`) | one given |
| `## Vocabulary` (`Vocab`, `Words`) | `vocabulary { … }` |
| `## Distributions` (`Shapes`) | `distributions { … }` |
| `## Options` (`Settings`, `Knobs`) | `options { … }` |

The six blocks may come in any order; the reader writes them in the grammar's. An outcome heading written directly under the scenario (without `## Outcomes`) is read as well.

### Labels

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| scenario | `Satisfies`; `Seed`; `Horizon` as `2025-01-01 .. 2025-07-01` (tolerated: `→`, `to`); `As of` (`Observed at`, `Snapshot`); `Domain` and `Requirements source` when not in the front matter | `satisfies […]`; `seed 42` / `seed "name"`; `horizon a .. b`; `as-of …`; `domain-source "…"`; `requirements-source "…"` |
| curve | `Measure` (`Sum of`); `By` (`Over`, `Date`, `Clock`); `Period` (`Per`, `Granularity`: day, week, month, quarter, year); `Alpha`; `Satisfies` | `curve name measure by path per period alpha a { … }` |
| total | `Measure`; `Value` (`Total`, `Equals`); `Alpha`; `Satisfies` | `total name measure = value alpha a` |
| share | `Dimension` (`Field`, `Column`); `Given` (`Grouped by`); `Satisfies` | `share name dimension given path { … }` |
| mix | `Machine` (`State machine`, `Lifecycle`); `Satisfies` | `mix name machine { … }` |
| rate | `Predicate` (`Condition`, `Where`) as the DSL writes it (`Product.available = true`, `not (a or b)`); `Value` (`Rate`, `Fraction`) for a single figure, or `By` + `Period` with a table of periods; `Satisfies` | `rate name predicate : 90%` / `rate name predicate by path per period { … }` |
| rollup | `Total` (`Parent`, `Sum`); `Parts` (`From`, `Children`); `Satisfies` | `rollup name total from parts` |
| given | `Csv` (`File`, `Source`); `Json`; `Columns` + list `` `path` from `column` `` | `Entity csv "…" { path from "column" }` |
| vocabulary | `Locale` (`Language`); `Pack`; `Words` + list; `Bindings` + list | `locale fr`; `pack "…"`; `path words […]`; `path as kind` |
| options | `Alpha`; `Decimals`; `Null rate`; `Default dwell`; `Reaction latency`; `Rejections`; `Dwell` + list `from --> to: 4h` (tolerated: a table with from, to and dwell columns) | `alpha 2`; `decimals 2`; `null-rate 20%`; `default-dwell 1d`; `reaction-latency 1min`; `rejections 3`; `dwell { from --> to : 4h }` |

Labels may be written as a bullet list (`- Seed: 7`). The first paragraph under the scenario heading, an outcome heading or a given heading is its `::` description.

### Tables, lists and islands

- **Populations**: a table with `entity` (aliases `name`, `table`, `row source`), `count` (`rows`, `number`, `n`), `per` (`parent`), `range` (`1..5`, `exactly 1`; or `min` and `max` columns), `since`, `clock`, `description`. Tolerated: a list — `- Customer: 200`, `- OrderLine: 1..5 per Order`, `- Payment: exactly 1 per Order`, `- Customer: 300 since 2023-01-01 — description`.
- **Figures** of an outcome: a table — `| period | value | rows |` for a curve (the `rows` column is `over n rows`), `| period | value |` for a rate by period, `| state | share |` for a mix, `| member | share |` for a share, `| given | member | share |` for a share with `given`. Tolerated: a list `- delivered: 72%`, `- 2025-02: 12000 (over 45 rows)`, and for a split share a nested list (`- captured:` then `- creditCard: 70%`). A fraction is `72%`, `72 %` or `0.72`.
- **Rows of a given**: a table whose header is the row keys; a cell is a number, `true`/`false`, `null`, a text, or JSON for a nested value (`{"amount":49.9,"currency":"EUR"}`, `["wood","oak"]`) and for a text that would read as another type (`"007"`). An empty cell leaves the key out of that row.
- **Word lists**: `` - `Product.name`: "a", "b" `` or `` - `Product.name`: file `vocab/wines.txt` ``; bindings: `` - `Iban` as iban ``. A table with `field`, `words`/`file` and `kind` columns is read too.
- **Distributions**: a table `| field | shape | median | sigma | exponent | description |`, or a list `- Order.customer: zipf 0.8 — Regulars`.
- **Islands**: a fenced `specy` block under a group heading is a complete declaration of that block, pasted verbatim (`curve … { … }` under Outcomes, `Product csv "…" { … }` under Givens).

### Example

```markdown
---
specy: synth
domain: orders.domain
---

# scenario OrdersH1_2025

Six months of e-commerce orders with a declared monthly revenue curve, lifecycle mix and payment-method split.

**Seed:** 42
**Horizon:** 2025-01-01 .. 2025-07-01
**As of:** 2025-07-01T00:00:00Z

## Populations

| entity | count | per | range | since | clock | description |
|---|---|---|---|---|---|---|
| Customer | 200 |  |  |  |  |  |
| Order | 1200 |  |  |  |  |  |
| OrderLine |  | Order | 1..5 |  |  |  |
| Payment |  | Order | exactly 1 |  |  |  |

## Outcomes

### curve monthlyRevenue

**Measure:** `Order.totalAmount.amount`
**By:** `Order.placedAt`
**Period:** month

| period | value |
|---|---|
| 2025-01 | 180000 |
| 2025-02 | 195000 |

### mix

**Machine:** `Order.OrderLifecycle`

| state | share |
|---|---|
| delivered | 72% |
| cancelled | 28% |

### rate

**Predicate:** `Product.available = true`
**Value:** 90%

## Options

**Dwell:**
- draft --> confirmed: 4h
- confirmed --> shipped: 2d
```

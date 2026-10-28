---
name: synth-design
version: v1
description: "Input — a `.domain` model plus prose saying what the data should look like (\"a bad quarter\", \"six months of steady growth with 10% cancellations\", \"a demo dataset for the payments dashboard\"). Output — a `.synth` scenario that synthy checks as sound and feasible, and, when asked, a dataset generated and certified by synthy. Use this skill whenever the user wants synthetic data, test data, demo data, seed data or a dataset with given figures for a Specy domain model, or mentions synthy, a `.synth` file, a scenario, outcomes, curves, mixes, shares or rates. Also use it to make data read like a given market or business: a locale (French customers), word lists for domain text (wine names), a real catalogue or master data supplied as a given, skewed amounts, best sellers and regulars. The skill writes the scenario, and at most word lists of single values, and runs synthy in a check loop; it never writes rows itself. To place the data in a project's tests (dbt seeds, Spring test resources, NestJS or Clojure fixtures), continue with `domain-build-fixtures`. If no `.domain` exists yet, delegate to `domain-design` first."
user-invocable: true
---

# Skill: synth-design

## Role

You turn what a person says about data into a **scenario**: a `.synth` file that declares, against a
Specy `.domain` model, how many rows of each entity exist and which figures they must add up to (a
revenue curve, a lifecycle mix, a payment-method split, a rate). **synthy**, a deterministic program,
then generates rows that satisfy both the domain and the scenario, and proves it with a certificate
that DuckDB re-verifies.

The division of labour is strict. **You supply the vocabulary and the shape of the scenario; synthy
supplies every row.** A scenario is reviewable in a diff, re-runnable byte for byte, and checked
before any data exists. A row you typed is none of those things.

```
prose ("a bad quarter")  ──►  you: .synth scenario  ──►  synthy check (loop until sound)
                                                     ──►  synthy generate  ──►  tables + certificate
```

---

## Cardinal Rules

1. **Never write a row.** No CSV line, JSON record, INSERT, id or timestamp of generated data, not even
   "a few examples". When the user asks for data, write the scenario and run synthy. If synthy cannot
   express what they want, say so; do not fill the gap by hand. A **word list** is not a row: it
   holds values for one text field (wine names, street names of a city), never a tuple, an id, a
   number, a date or a pairing of values. A user's own data file (a catalogue) is referenced as a
   `given`, never copied into the scenario by you.
2. **Every name comes from the `.domain`.** Entities, fields, value-type members, machines, states
   and enum members are written exactly as the model declares them (case included). Read the model
   before writing; never guess a name.
3. **Check in a loop.** After every edit run `check`. Stop when it reports `ok`, or after six rounds,
   and then report what is still wrong and why. A scenario you have not checked is not delivered.
4. **The arithmetic is yours to get right.** Shares and mixes sum to exactly 100 %, curve figures fit
   the rows and the field bounds, period keys fit the horizon. When synthy refuses, it shows the
   arithmetic; change the declarations it names, guided by its remedy.
5. **Read every warning aloud.** A warning names a part of the domain the certificate will not
   cover (an invariant synthy cannot read, a reaction it does not carry out). Tell the user.
6. **Keep the user's intent visible.** Put their request in the scenario's `::` description, name
   outcomes after what they mean (`curve badQuarterRevenue …`), and comment every figure you chose
   for them.
7. **Trace when requirements exist.** If a `.sysreq` states a figure ("cancellations shall stay under
   10 %"), declare `requirements-source` and put `satisfies [REQ-…]` on the outcome that encodes it.

---

## Prerequisites — what to load

1. `references/SYNTH-METAMODEL.md`: the scenario language (populations, outcomes, givens, vocabulary,
   distributions, options), its rules, the conflict codes and what the certificate proves, including
   its plausibility section. Read it in full the first time.
2. `grammar/synth.ebnf`: the concrete syntax, when you need an exact form.
3. `references/DOMAIN-METAMODEL.md`: only if you need to understand a `.domain` construct (a state
   machine, a precondition, a reaction) that the model you read uses.
4. `examples/orders.domain` with `examples/orders.synth`: a complete, sound pair to imitate;
   `examples/catalogue.synth` with `examples/catalogue.csv`: a real catalogue as a given, a locale and
   distribution hints.
5. `references/synth-scenario.schema.json`: only when you write the scenario as JSON or YAML.

---

## Running synthy

Use whichever is available, in this order.

**MCP tools** (when a `synthy` MCP server is connected): `check`, `generate`, `certify`,
`explain_conflict`, `starter`, `convert`, `trace`, `export`. Pass absolute paths. `check` answers
`{ ok, conflicts, summary }`, or `{ ok: false, diagnostics }` when a `.synth` does not parse.

**The CLI**: find it once and reuse it.
- `synthy` on the PATH, or `$SYNTHY_CLI`;
- `npx -y specy-synthy` when the package is installed or published;
- `node <specy-synthy checkout>/dist/cli.js`.

| Step | Command |
|---|---|
| derive a first feasible scenario | `synthy starter <x.domain> --format synth > x.synth` |
| check (machine-readable) | `synthy check x.synth --json` |
| explain a code | `synthy explain SYN-E017` |
| generate and certify | `synthy generate x.synth --out <dir> --json` |
| re-certify a folder (the MCP `certify`) | `synthy verify <dir> --json` |
| requirement map | `synthy trace <dir>` |

With `--json`, stdout carries one document:
- `check`: `{ command, ok, conflicts, summary }`;
- `generate`: `{ command, ok, out, tables, warnings, certificate, traceability }`;
- a failure: `{ command, ok: false, error: { code, message, problems } }`. For a `.synth` that does
  not parse, `problems` lists one located diagnostic per line (`3:9 [error SYN-E001] 'Oder' is not
  an entity … Did you mean 'Order'?`).

`.synth` files are parsed by `specy-synth`, the Langium parser in specy-skill
(`src/langium/specy-domain`, built with `npm run build`); synthy finds it next to the domain parser,
or through `$SPECY_SYNTH_CLI`. If no parser is reachable, write the scenario as **YAML**
(`x.synth.yaml`, same document, see the schema) which synthy reads alone, and convert it later with
`synthy convert x.synth.yaml --to synth`.

Exit codes: `0` sound or certified · `1` the declarations cannot all hold · `2` an input problem (a
name that does not resolve, a malformed document) · `3` a synthy bug.

---

## Workflow

### Phase 1 — Read the model

Read the `.domain` and build an inventory before writing anything. Write it down for yourself:

| What | Why it matters |
|---|---|
| Entities and aggregates, their references and cardinalities | `count` for roots, `per Parent a..b` for children; the range must fit the cardinality (`lines : OrderLine 1..N` forbids `0..5`) |
| State machines: states, transitions, which are reachable from `[*]` | `mix` names reachable states only |
| Preconditions on transitions, reactions, temporal events | they bind entities together: a child's mix is limited by its parent's (`SYN-E017`) |
| Enums and boolean fields | `share` and `rate` values |
| Numeric fields with bounds (`min`, `max`, `range`, invariants) | what a `curve` or `total` can reach |
| Date and datetime fields | clocks and `by` axes of curves and rates |
| Value types | paths go down to a member: `Order.totalAmount.amount` |
| Invariants | the generator enforces them; figures must leave room for them |

### Phase 2 — Turn the request into figures

People speak in shapes ("a bad quarter", "busier at Christmas"); a scenario needs numbers. Decide
them, and say what you decided.

- Establish a **baseline**: volume per month, the usual lifecycle mix, the usual splits. Use figures
  the user gave, figures from requirements, or plausible ones you state as assumptions.
- Express the request as a **deviation** from the baseline: which figures move, by how much, over
  which periods.
- Ask **at most one question**, and only when a choice changes the result materially (which quarter
  is bad, the scale of the dataset). Offer defaults in the question. Otherwise proceed and list the
  assumptions in your report.
- **Default period.** When the request names a period ("a bad quarter", "a busy December"), make
  the horizon that period: the most recent complete one unless the user says which. Show the
  deterioration *within* it (month after month). A `mix` covers the whole horizon, so adding a
  normal period for contrast would dilute it; offer a second scenario for the normal period if the
  user wants a comparison.

### Phase 3 — Shape the scenario

Map each figure to a construct with the phrasebook below, then decide the header.

- `horizon from .. to` covers every period you declare (the end is exclusive); `as-of` defaults to
  the horizon end, the instant at which open lifecycles are observed.
- `seed` fixes the data: same seed, same bytes.
- Populations: every entity an outcome touches, every `per` parent and every mandatory reference
  target needs one. Size master data (customers, products) so references spread naturally.
- `options`: `dwell { a --> b : 2d }` sets how long rows stay in a state; `rejections n` sets how
  many refused commands are generated per precondition; `decimals` the money precision.
- **Real data the user has** (a product catalogue, a list of stores, master data owned by another
  system, often a `read-only entity`): a `given` that names the file, never a population. Map the
  file's headers to the model in the given's block (`price.amount from "price_eur"`); the columns
  the file leaves out are generated, and a field with a `default` takes it. Yes/no columns may read
  `oui`/`non`, `ja`/`nein`, `1`/`0`. Outcomes may set the generated columns, never the supplied
  ones. Rows of an entity with a state machine must supply the state. Never edit the user's file;
  say what it carries that the model cannot keep.
- **Customers who existed before the period**: `Customer count 300 since 2023-01-01` spreads their
  creation from that date, so the period does not start with an empty customer base. References
  always point at rows created earlier.
- **How the text reads**: `vocabulary { locale fr }` for the user's market (`intl`, the default, is a
  European mix; built-in: `en`, `fr`, `de`, `es`, `it`, `nl`, `"en-GB"`). A pack only changes text
  columns, so it never moves a figure.
- **How values spread** where no outcome fixes them: `distributions { … }`. They are hints, never
  facts: an outcome always wins, and the certificate reports them in its plausibility section.
- **Mixes on a parent and its children.** Declare the parent's mix first; add a child's mix only
  when the request says something about the child. A child state that a precondition or a reaction
  ties to a parent state must fit inside that parent state's share. In the orders model, a Payment
  is refunded only once its Order is cancelled, and a failed Payment cancels its Order, so
  `refunded + failed ≤ cancelled`. Read the preconditions and reactions to anticipate the bound;
  `check` computes it exactly and `SYN-E017` shows the arithmetic.

### Phase 3b — Words (optional)

When the model's text fields would read better with words of the business (a wine shop's product
names, a garage's service names, the street names of one city), write **word lists**, one file per
field, next to the scenario:

```
vocab/product-names.txt      one value per line; # starts a comment
```

- One field per list (a text field, or a list or set of text, whose elements it draws), each
  value plausible for that field alone. Size it like reality: a few for a short closed set,
  dozens to hundreds for names.
- Respect the field's constraints: `maxLength`, `pattern`. A `unique` field needs at least as many
  distinct words as rows. `check` refuses a list that breaks them (`SYN-E024`).
- Order matters only under a Zipf hint: the first word is the most frequent.
- Never put numbers, ids, dates or several fields on a line: that would be a row.

Then reference them: `vocabulary { locale fr  Product.name words "vocab/product-names.txt" }`.

### Phase 4 — Write the file

Start from `starter` when the model is large: it is feasible by construction. Then replace its
outcomes with yours, keep its populations where they make sense, rename the scenario after the
request, and add comments. Write `.synth` (or `.synth.yaml` without the parser). Save it next to the
`.domain` unless the user says otherwise; `domain-source` is resolved relative to the scenario file.

### Phase 5 — Check until sound

Run `check`. For each error:

1. Read its code, declarations, arithmetic and remedy.
2. If the cause is not obvious, run `explain_conflict` (or `synthy explain <code>`) for the rule and a
   before/after example.
3. Change the declarations it names. Prefer the smallest change that keeps the user's intent; when
   the intent itself is impossible (more refunds than cancelled orders), say so and propose the
   nearest feasible figure that synthy's arithmetic gives.

Typical fixes:

| Code | Usual fix |
|---|---|
| `SYN-E001`, `SYN-E005` | a name that is not in the model: use the one the message suggests |
| `SYN-E003` | add the missing parent or referenced population; fit the `per` range to the cardinality |
| `SYN-E006` | declare the outcome on the entity that owns the column, not through a reference |
| `SYN-E007`, `SYN-E008` | a member or state spelled wrong, or fractions not summing to 100 % |
| `SYN-E009` | a rate or share on a state column: use a `mix`; a predicate over two entities: split it |
| `SYN-E010` | a period key outside the horizon, or written for another period |
| `SYN-E011` | the figure is out of reach for the rows and bounds: change the figure or the count |
| `SYN-E012` | two outcomes on one column, or two periods on one time axis: keep one |
| `SYN-E017` | a child's mix asks more than its parents' histories allow: lower it to the arithmetic's bound |
| `SYN-E014` | an outcome on a column the given supplies, or a `per` population on given rows: drop one of the two |
| `SYN-E023` | a given's row does not fit the model: map the right header in the given's block; when the user's file is wrong and may not change, leave that column unmapped (synthy generates it) and report it |
| `SYN-E024` | an unknown locale, or a word list on a non-text field or with too-long values |
| `SYN-E025` | a shape the field cannot take: amounts take `lognormal`, bounded integers, enums, lists and references `zipf` |
| `SYN-W013` | a hint that never applies (an outcome or an invariant sets the column): drop it, or shape the column the value comes from |
| `SYN-W014` | a file column no field takes: nothing to do unless it holds a field under another name; report what the model cannot keep |

Warnings do not block. Keep them, and carry each into your report in plain words.

### Phase 6 — Generate, certify, look (when data is wanted)

When the user wants the data, not only the scenario: `generate --out <dir>`. The certificate must
pass. Report the tables and row counts, the certificate summary, the advisory questions that fail
(by design: alert-level rules, `exists`, agreements), and where the files are. To place the data in
a project, continue with `domain-build-fixtures`.

Read the certificate's **plausibility** section: it never gates, it says how the data reads. Each
note names a check and the gap between expected and observed: a row referenced before it existed
(two lifecycles neither of which can move), steps crowded before as-of, a distribution hint the
data drifts from. Report each note in plain words; change a hint when the gap is yours.

Then **look at the data**: reading rows to judge them is expected, writing them is not. Query a few
tables (DuckDB on the folder's `load.sql`, or the CSVs) for what neither the certificate nor the
plausibility section covers, such as values the model does not link (a line's price against the
product's price).

Fix through the scenario when a construct can; otherwise report it as a limit of the generated
data, never by editing rows.

### Phase 7 — Report

- The file written, and the command that regenerates the data.
- A table: the user's words → the outcome that encodes them → the figure.
- The assumptions you made.
- The warnings, in plain words: what the certificate does not cover.
- When the scenario cites requirements, the `trace` summary.

---

## Phrasebook — from prose to constructs

| The user says | Write |
|---|---|
| "1 200 orders", "about 50 customers" | `populations { Order count 1200 }` |
| "each order has 1 to 5 lines", "one payment per order" | `OrderLine per Order 1..5`, `Payment per Order exactly 1` |
| "revenue per month", "growth", "a dip", "a bad quarter", "a Christmas peak" | `curve name Entity.amount.path by Entity.dateField per month { 2025-01: 180000 … }` (exact sums per period; quarters: `per quarter { 2025-Q1: … }`) |
| "how many orders each month" | `curve … { 2025-01: 180000 over 400 rows … }` (the row counts per period sum to the population count) |
| "one exact grand total" | `total Entity.amount.path = 1250000` (needs a `count` population) |
| "the order total is the sum of its lines" | `rollup Order.totalAmount.amount from OrderLine.total.amount` |
| "10 % cancelled", "70 % delivered", "where orders end up", "a funnel" | `mix Order.OrderLifecycle { delivered: 70%  cancelled: 10% … }` (reachable states, sums to 100 %) |
| "60 % card, 30 % PayPal" | `share Payment.method { creditCard: 60%  paypal: 30%  bankTransfer: 10% }` |
| "card payments differ by status" | `share Payment.method given Payment.status { captured: { creditCard: 70%  paypal: 25%  bankTransfer: 5% }  failed: { … } … }` (one split per value) |
| "90 % of products available" | `rate Product.available = true : 90%` |
| "8 % of customers are suspended or closed" | `rate Customer.status = suspended or Customer.status = closed : 8%` (`and`, `or`, `not` over one entity's enum and boolean fields) |
| "suspensions climb from 5 % to 12 %" | `rate Customer.status = suspended by Customer.createdAt per month { 2025-01: 5%  2025-02: 8%  2025-03: 12% }` |
| "orders take two days to ship" | `options { dwell { confirmed --> shipped : 2d } }` |
| "with our real product catalogue" | `givens { Product csv "products.csv" { name from "title"  price.amount from "price_eur" } }` (headers mapped; ids generated) |
| "French customers", "a UK shop" | `vocabulary { locale fr }`, `vocabulary { locale "en-GB" }` |
| "real wine names", "our store names" | a word list: `vocabulary { Product.name words "vocab/wines.txt" }` (Phase 3b) |
| "a few best sellers" | `distributions { OrderLine.productId zipf 1.1 }` (a reference, or a key synthy infers); over a given, the file's first rows sell most, so say which ones they are, or ask for the file in best-seller order |
| "regulars order more often" | `distributions { Order.customer zipf 0.8 }` (the oldest customers are the regulars) |
| "most prices around 30 €, a few expensive items" | `distributions { Product.price.amount lognormal median 30 sigma 0.8 }` (a field the model stores; not a line price that an invariant computes) |
| "baskets around 60 €" | with the rollup and no curve: `distributions { Order.totalAmount.amount lognormal median 60 sigma 0.6 }` (the lines split each order's total) |
| "existing customers", "a customer base built over years" | `Customer count 300 since 2023-01-01` |
| "most lines have a single item" | `distributions { OrderLine.quantity zipf 2 }` (a bounded integer) |

Figures are in the field's own unit: `180000` on a Money amount is 180 000.00, not cents.

A distribution on a column an outcome sums (`curve`, `total`, `rollup` parts) only shapes how each
sum is split, a few large rows and many small ones; the sums stay exact. A column an invariant
computes (`total = price × quantity` solves a line's price from its total) takes no hint: shape what
it comes from. The model links only what it declares: an order line's price is not its product's
catalogue price unless an invariant says so; report that limit rather than working around it.

What a scenario cannot say, and what to do instead:

- **A mix per period.** A `mix` is over the whole population. A "bad quarter" in lifecycle terms is
  a mix over the horizon; to contrast periods, put the bad period's volume and revenue in curves and
  raise the overall mix, or generate two scenarios with two horizons.
- **A rate or share on a state column.** The state machine drives it: use a `mix`.
- **Figures on a referenced entity through the reference.** Declare them on that entity.
- **Rows.** Never.

---

## Worked example — "a holiday season" on the orders model

Request: *"Give me last year's Q4 with a holiday peak."* Model: `examples/orders.domain`.

Inventory (excerpt): `Order` has `placedAt : datetime`, `totalAmount : Money` (`amount ≥ 0`),
machine `OrderLifecycle` (`draft → confirmed → shipped → delivered`, cancellations from `draft` and
`confirmed`); `OrderLine` is a value type, `Order.lines : OrderLine 1..N`; `Payment.order : Order 1..1`
and confirming an order requires its payment captured.

Decisions: horizon 2024-10-01 .. 2025-01-01; baseline 150 000 per month, December at 2.4 times
October; more abandoned drafts in December (more cancellations overall); everything else from the
model.

```
// "Last year's Q4 with a holiday peak": volume and revenue climb into December,
// and more carts are abandoned at the peak.
scenario HolidayQ4_2024 :: "Q4 2024 with a December peak, as requested: revenue x2.4 from October to December, 14% cancelled" {
    domain-source "orders.domain"
    seed 2024
    horizon 2024-10-01 .. 2025-01-01

    populations {
        Customer  count 400
        Product   count 80
        Order     count 2000
        OrderLine per Order 1..5
        Payment   per Order exactly 1
    }

    outcomes {
        // the peak: exact monthly revenue in EUR (the amount's own unit, not cents)
        curve holidayRevenue Order.totalAmount.amount by Order.placedAt per month {
            2024-10: 150000
            2024-11: 220000
            2024-12: 360000
        }
        rollup Order.totalAmount.amount from OrderLine.total.amount

        // more abandoned carts at the peak (baseline 10%)
        mix Order.OrderLifecycle {
            delivered: 70%
            shipped:    8%
            confirmed:  5%
            draft:      3%
            cancelled: 14%
        }

        share Payment.method { creditCard: 65%  paypal: 30%  bankTransfer: 5% }
    }

    options {
        dwell { confirmed --> shipped : 3d }
    }
}
```

Then: `check` → `ok`; `generate` → certificate passed; report the table of intent → outcome →
figure, the assumptions (baseline, the 14 %), and the warnings.

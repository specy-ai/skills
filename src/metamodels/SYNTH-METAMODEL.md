<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
**Table of Contents**

- [Synthetic-data scenario metamodel](#synthetic-data-scenario-metamodel)
  - [Convention](#convention)
  - [Position in the Specy stack](#position-in-the-specy-stack)
  - [Scenario](#scenario)
  - [Population](#population)
    - [Count population](#count-population)
    - [Per population](#per-population)
    - [Clock](#clock)
  - [Outcome](#outcome)
    - [Curve](#curve)
    - [Total](#total)
    - [Share](#share)
    - [Mix](#mix)
    - [Rate](#rate)
    - [Rollup](#rollup)
  - [Dot-path](#dot-path)
  - [Given](#given)
  - [Vocabulary](#vocabulary)
  - [Distributions](#distributions)
  - [Options](#options)
  - [The domain's behaviour in the data](#the-domains-behaviour-in-the-data)
  - [Storage formats](#storage-formats)
    - [From clause to key](#from-clause-to-key)
    - [Rules of the document](#rules-of-the-document)
    - [YAML](#yaml)
    - [Editors](#editors)
    - [What conversion does not keep](#what-conversion-does-not-keep)
  - [Conflicts](#conflicts)
  - [Requirement Traceability](#requirement-traceability)
  - [What the certificate proves](#what-the-certificate-proves)
    - [Plausibility](#plausibility)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->




# Synthetic-data scenario metamodel

This file defines the metamodel of a **synthetic-data scenario**: a declaration of what a generated data set must *add up to* for a given domain model. A scenario is written in a `.synth` file against one `.domain` file. The `synthy` tool reads both, generates rows that satisfy both, and certifies the result with questions re-verified in SQL.

A domain model says what exists and which rules hold: an `Order` has a `totalAmount`, a `Payment` has a `method`, an order's lifecycle goes `draft → confirmed → shipped → delivered`. It never says how many orders there are, how revenue moves month to month, or what share pays by card. Those are **outcomes**, and they belong to the scenario. The split is deliberate: the model stays a statement about the business, the scenario a statement about one data set, and the same model serves many scenarios.

The vocabulary avoids the word *aggregate*, which the domain language reserves for the DDD construct. A scenario speaks of **populations**, **outcomes** (curve, total, share, mix, rate, rollup), **givens**, **vocabulary**, **distributions** and **options**.

## Convention

A scenario carries a name, a description, a **satisfies** list (zero or more system requirement identifiers), and the two provenance links `domain-source` (mandatory) and `requirements-source` (optional). Every outcome may carry a name, a description and a `satisfies` list of its own. These attributes follow the convention of the domain metamodel (see DOMAIN-METAMODEL.md, Convention) and are not repeated in each definition below.

Every domain element a scenario names is a **reference** into the `.domain` named by `domain-source`, written as a dot-path (`Order.totalAmount.amount`). A scenario never restates the model: it declares no field, no type, no state. A name that does not resolve in the model is an error at edit time, before any row exists.

Concrete syntax is given with each concept; the normative grammar is `src/grammars/synth.ebnf`, and its semantic rules are listed at the foot of that file with the conflict code each one raises.

## Position in the Specy stack

Specy verifies a domain model in three loops: the model parses, the model is consistent with its requirements, the code built from the model passes its tests. The scenario adds a **fourth loop**: data that conforms to the model and to a declared business picture exists, and a certificate proves it. The proof does not rest on the generator's word. The generator writes down, from the declarations, every fact the data must satisfy; a separate verifier turns each fact into a SQL question and runs it on an engine that shares no code with the generator.

The scenario is downstream of the domain model and reads its requirements through the `satisfies` lists: an outcome that states a business figure ("H1 revenue is 1.28 M") can name the requirement that states it, so a passing certificate is evidence for that requirement. A scenario never references architecture elements, and nothing upstream references a scenario.

Relations:
- 1..1 "written against" relation with a domain model (`domain-source`)
- 0..1 "traces to" relation with a requirement set (`requirements-source`)

## Scenario

The root concept: one scenario per `.synth` file. It names the model it is written against, fixes the three knobs that make a run reproducible, and holds the populations, outcomes, givens, vocabulary, distributions and options.

- **seed** — every random stream of the generator derives from it. Same seed, same files: same bytes, in the CLI and in the browser.
- **horizon** — the time window every clock falls in, `[from, to)`. Without it the generator uses the calendar year 2024 and says so (SYN-W004).
- **as-of** — the instant at which the snapshot tables are observed: a state machine's walk is cut there, so an order whose delivery would happen after `as-of` is still `shipped`. Defaults to the horizon's end.

```
scenario OrdersH1_2025 :: "Six months of e-commerce orders" {
    domain-source "orders.domain"
    requirements-source "orders.sysreq"
    seed 42
    horizon 2025-01-01 .. 2025-07-01
    as-of 2025-07-01T00:00:00Z

    populations { … }
    outcomes { … }
    givens { … }
    vocabulary { … }
    distributions { … }
    options { … }
}
```

The header clauses come in this fixed order, like the slots of a domain definition; `satisfies` comes first inside the braces, as in every Specy body.

Relations:
- 1..n "has" relation with populations
- 0..n "has" relation with outcomes
- 0..n "has" relation with givens
- 0..1 "has" relation with a vocabulary
- 0..n "has" relation with distributions
- 0..1 "has" relation with options

## Population

A population says how many rows of a **row source** exist. A row source is an entity, an aggregate (its root), a read-only entity or a value type used as a table of its own (an `OrderLine` with its own rows, say). Each row source has at most one population (SYN-E002); a row source with neither a population nor a given is not generated, and a reference pointing at it has nothing to point to (SYN-E003).

```
populations {
    Customer  count 200
    Product   count 60
    Order     count 1200
    OrderLine per Order 1..5
    Payment   per Order exactly 1
}
```

### Count population

A fixed number of rows: `Customer count 200`. Curves, totals and per-period rates need a count population: they distribute a declared figure over rows the scenario itself sizes (SYN-E011).

`since` widens the window the rows' clocks fall in: `Customer count 300 since 2023-01-01` places the customers from that date to the horizon's end, so most of them existed before the quarter the scenario describes. It is a date before the horizon's end, and it does not apply to a clock an outcome places in periods (SYN-E010).

### Per population

Rows per parent row: `OrderLine per Order 1..5` draws, for each order, a number of lines in `[1, 5]`; `Payment per Order exactly 1` makes exactly one. The parent must have a population or a given (SYN-E003), the range must be finite, and it must fit the cardinality the domain declares on the parent's reference — a `lines : OrderLine 1..N` reference cannot be served by `per Order 0..5` (SYN-E003). The child's foreign key to the parent is set by the generator; the child's clock, when it has one, follows the parent's.

### Clock

The date or datetime field that places a row in time, so that curves and per-period rates can bucket it. `Order count 1200 clock placedAt` names it; when omitted the generator infers it from the start transition of the state machine (the field set by the operation that leaves `[*]`), or from the first datetime field, and reports which. A clock must be a `date` or `datetime` field of the row source itself (SYN-E006). One time axis per row source: a curve `by` another field than the declared clock is refused (SYN-E006).

Relations:
- 1..1 "sizes" relation with a row source of the domain model
- 0..1 "per" relation with a parent row source
- 0..1 "placed in time by" relation with a date or datetime field of the row source

## Outcome

An outcome is a figure the generated data must reproduce exactly. There are six kinds. Each pins one column of one row source's own table, from a declaration the certificate re-verifies. Outcomes bend the data; the domain's invariants never bend: when both cannot hold — a monthly revenue that 200 orders of at most 100 cannot reach — the generator refuses with a conflict stating the arithmetic, instead of producing data that silently violates one of them.

An outcome may carry a camelCase **name** (used in the certificate), a description, and a `satisfies` list naming the requirements that state the figure.

```
outcomes {
    curve monthlyRevenue Order.totalAmount.amount by Order.placedAt per month { … }
    total Order.totalAmount.amount = 1280000 satisfies [REQ-FIN-002]
    share Payment.method { creditCard: 60%  paypal: 30%  bankTransfer: 10% }
    mix Order.OrderLifecycle { delivered: 72%  shipped: 6%  confirmed: 8%  draft: 4%  cancelled: 10% }
    rate Product.available = true : 90%
    rollup Order.totalAmount.amount from OrderLine.total.amount
}
```

Proportions are written as fractions or percentages; `0.72` and `72%` are the same number. One pin per column, one period axis per row source, one mix per row source (SYN-E012).

Relations:
- 1..1 "pins" relation with a column of a row source's table (through a dot-path)
- 0..n "satisfies" relation with system requirements

### Curve

`SUM(measure)` per period of a clock equals the declared value for each period, exactly, in the measure's own unit: `180000` on a decimal amount is 180 000.00, never cents. The certificate compares sums in integer units of the last decimal (`decimals`, 2 by default) so the comparison is exact.

```
curve monthlyRevenue Order.totalAmount.amount by Order.placedAt per month alpha 1.5 {
    2025-01: 180000
    2025-02: 195000 over 220 rows
    …
}
```

- **measure** — a numeric field of the row source's own table (`int`, `integer`, `long`, `decimal`).
- **by** — a date or datetime field of the same row source, or of its `per` parent.
  - **Own field.** The first outcome keyed by a field of the row source makes that field its clock, unless a population declares one.
  - **Second axis.** An outcome keyed by another date field opens a second time axis. That field must be one the walk does not set, and its values are placed in the declared periods (SYN-E006).
  - **Parent's field.** Keyed by the parent's field (`curve Payment.amount.amount by Order.placedAt per month`), each period holds the children of the parents placed in it, so a `per` population can carry a curve.
- **period** — `day`, `week`, `month`, `quarter` or `year`. Keys are written in the period's shape: `2025-01-15`, `2025-W03`, `2025-01`, `2025-Q1`, `2025` (SYN-E010); each key must intersect the horizon (SYN-E010).
- **over n rows** — pins the row count of a period; given for every period or for none, the counts summing to the population's count (SYN-E011). Without it, rows follow the values proportionally. A curve keyed by the parent's field declares no counts: its periods hold the rows the parents' periods give them (SYN-E011).
- **alpha** — the Dirichlet concentration of the split of a period's value over its rows: lower is more skewed. Defaults to the scenario's `alpha` option, then 2.

The generator splits each period's value over its rows in integer units, respects the measure's declared bounds (`min(0)`, `range(…)`) and refuses when the bounds and the value cannot meet: `n rows × min > value` or `n rows × max < value` (SYN-E011, with the arithmetic).

### Total

`SUM(measure)` over the whole population equals the declared value.

```
total Order.totalAmount.amount = 1280000 alpha 2 :: "H1 revenue" satisfies [REQ-FIN-002]
```

Same measure and bound rules as a curve, without a time axis. A total and a curve cannot pin the same measure (SYN-E012).

### Share

The fraction of rows carrying each member of an enum field, or each truth value of a boolean field. Counts are made exact by largest remainder; the fractions must sum to 1 (SYN-E007). A member left out has share 0.

```
share Payment.method {
    creditCard:   60%
    paypal:       30%
    bankTransfer: 10%
}
share Product.available { true: 90%  false: 10% }
```

The members are references into the enum behind the dimension: `visa` is red when `PaymentMethod` has no such member. A boolean dimension takes `true` and `false`. A column driven by a state machine (the `status` field whose members are the machine's states) is not shared; it is mixed (SYN-E009).

With **given**, the split depends on another column of the same rows: one split per value of that column, each exact over the rows that carry the value.

```
share Payment.method given Payment.status {
    captured: { creditCard: 70%  paypal: 30% }
    refunded: { bankTransfer: 100% }
}
```

- **What it may be given.** The given column is the state (set by the walk) or a column another share without `given` sets: it must be known before this split is drawn (SYN-E012). A share cannot be given its own dimension (SYN-E012).
- **Keys and splits.** Keys are values of the given column, and each split sums to 1 (SYN-E007).
- **Unlisted values.** Rows whose value is not listed are left to the generator.
- **Mixing forms.** With `given` every entry is a split; without it, none is (SYN-E007).

### Mix

The fraction of rows whose state-machine walk ends in each state, observed at `as-of`. `Order` names the entity's first machine; `Order.OrderLifecycle` names one.

```
mix Order.OrderLifecycle {
    delivered: 72%
    shipped:    6%
    confirmed:  8%
    draft:      4%
    cancelled: 10%
}
```

The states are references into that machine; each must be reachable from `[*]` through the declared transitions (SYN-E008), and the fractions sum to 1 (SYN-E008). The generator walks each row from `[*]` to its final state along declared transitions, with the dwell per transition taken from `options.dwell`, and writes the timestamps the operations set (`confirmedAt`, `shippedAt`, …) along the way. The state column is the enum field whose members match the states (by name, or case-insensitively); when no field covers them, a synthetic `_state` column carries the final state and the generator says so (SYN-W006).

### Rate

The fraction of rows satisfying a predicate, over the population or per period.

A predicate is made of atoms over enum and boolean columns of one row source (SYN-E009):
- `Entity.booleanField`, or `Entity.booleanField = false`;
- `Entity.enumField = member` or `!= member`.

Atoms combine with `and`, `or`, `not` and parentheses. `or` binds loosest, then `and`, then `not`.

```
rate Product.available = true : 90%
rate expressPaid Invoice.express and Invoice.status = paid : 25%
rate Customer.status != closed and not (Customer.vip or Customer.channel = web) : 40%
rate Order.channel = web by Order.placedAt per month {
    2025-01: 12%
    2025-02:  9%
}
```

- **Atoms.** On a boolean field the comparison is optional and defaults to `true`. On an enum field it is mandatory and names a member of that enum (SYN-E009).
- **Fractions** lie in `[0, 1]` (SYN-E009).
- **The split.** The rate is split exactly: the declared share of rows takes a combination of the columns' values that makes the predicate true, and the rest a combination that makes it false. Each draw is uniform among the combinations the row's fixed values allow: its state, and a value a walked precondition pinned.
- **State columns.** A column a state machine drives may be read by a compound predicate, never set. A rate on that column alone is a mix (SYN-E009).
- **Per period.** A per-period rate is keyed like a curve: by a date field of the row source (a count population then), or by its `per` parent's. Outcomes on one axis agree on the period (SYN-E011, SYN-E012).

`.synth` writes the predicate as an expression; JSON and YAML write it as a string in one spelling: single spaces, parentheses only where an `or` sits under an `and` or a `not`.

### Rollup

A parent measure equals the sum of a child measure over the child's rows: `Order.totalAmount.amount = Σ OrderLine.total.amount` for each order.

```
rollup Order.totalAmount.amount from OrderLine.total.amount
```

Both measures are numeric fields of their own tables; the child must be declared `per` the parent (SYN-E013). When the parent measure is also pinned by a curve or a total, the generator splits each parent's amount over its children; otherwise the parent's amount is derived from the children. A rollup that the domain already states as an invariant (`totalAmount.amount = sum(lines.total.amount)`) is applied whether or not the scenario declares it.

## Dot-path

A dot-path names a column of the domain model, starting from a row source and descending member by member: `Order.totalAmount.amount`.

- The **root** resolves to a row source: an entity, an aggregate, a read-only entity or a value type.
- A step after a row source resolves to its identity, one of its fields, one of its references, or one of its state machines (the last only in a mix).
- A step after a value-typed field resolves to a field of the value type: `totalAmount : Money` opens `amount` and `currency`. The column stays on the root's table, flattened as `totalAmount_amount`.
- A step after a reference, or after an entity-typed field, resolves to a member of the target — but the path then **leaves the root's table**, and an outcome must pin a column of its own table (SYN-E006). `Order.customer.status` is a valid name of a column of `Customer`; it is not a column of `Order`. Declare the outcome on `Customer`, or use a rollup.
- Enum members and states are named where they belong — in share and rate entries, in mix entries — and resolve against the enum or machine the path led to.

The editor computes the candidates of each step from the previous one, so completion after `Order.totalAmount.` offers `amount` and `currency`, and an unknown name says what it was checked against and the closest match.

## Given

Reference data supplied rather than generated: a product catalogue, a country list, master data owned elsewhere (a **read-only entity** is the usual candidate), or the instances of an `enum X of ValueType`. A given names what it supplies and one source of rows: inline, a CSV file or a JSON file next to the scenario. A row source has at most one given (SYN-E014); when it also has a count population, the count must equal the number of rows given, and a given entity is never `per` a parent: the rows carry their parent's key instead (SYN-E014).

```
givens {
    Product csv "catalogue.csv" :: "the back office's export" {
        name          from "title"
        price.amount  from "price_eur"
        stockQuantity from "stock"
    }
    Country rows [
        { code: "FR", name: "France" }
        { code: "DE", name: "Germany" }
    ]
}
```

- **Popularity.** A Zipf hint on a reference to given rows ranks them in the file's order: put the best sellers first.
- **Columns.** A given is read against the table the row source would have if it were generated. Each column takes its values from the file column the block after the source maps to it (`<path> from "<header>"`), else from a file column spelled like its path (`price.amount`) or its table column (`price_amount`), else from nested objects in JSON rows. A reference reads its key from a column named after it (`customer`, `customerId`, `customer_id`). A file column nothing reads is a warning (SYN-W014).
- **Give and generate.** The columns a given does not supply are generated as for any row: the identity, a clock, a reference, the fields a word list or a distribution shapes. A field with a declared `default` takes it. Outcomes may set those columns; an outcome that would set a supplied column is refused (SYN-E014). Rows of an entity with a state machine are not walked: the given must supply the state (SYN-E023), and a mix cannot apply to them.
- **Checked like generated rows.** Each cell is coerced to its column's type (yes and no as back offices export them: `true`/`false`, `1`/`0`, `oui`/`non`, `ja`/`nein`, `sí`/`no`…) and checked against the model: type, bound, length, pattern, enum member, temporal constraint, required, unique, the identity, the row's own invariants, a state of the machine. A problem is SYN-E023 with the file and the row (a CSV's line numbers count the header as line 1). An empty cell is a null. A list in a CSV cell is JSON (`["a","b"]`) or values joined by `|`.
- **Unchanged.** What a given supplies is never changed, and the certificate asks so: a hard question compares every supplied column of every row with the table.
- **Enum instances.** A given for `enum Currencies of Currency` supplies the values of the value type; each row's code field (the field marked `code`) names the member it is. A field typed by the value type then holds one of those instances. Without a given, the instances are one per member, the code being the member and the other fields generated once. A member without a given instance is a warning (SYN-W015); a value type without a code field cannot be given (SYN-E023).

Relations:
- 1..1 "supplies" relation with a row source of the domain model, or with an enum of a value type

## Vocabulary

Where text columns take their words: names, emails, addresses, phones, product and company names, descriptions. A **pack** holds them for one locale: first and last names, places (a city with its postal-code shape and region), streets and how an address is written, phone shapes, company and product words, filler words. synthy ships built-in packs as data files; a scenario names one, or a pack file of its own that may extend a built-in one. A **word list** gives one text field its values.

```
vocabulary {
    locale fr                                   // intl (the default), en, fr, de, es, it, nl, "en-GB", …
    pack "vocab/fr-ch.json"                     // a pack file, next to the scenario
    Product.name words "vocab/wines.txt"        // one value per line, or a JSON list of strings
    Customer.segment words [ "retail", "pro" ]
}
```

- **One person, one place.** A row's name, email, address and phone come from one person living in one place of the pack, so they agree. The default pack, `intl`, mixes the European ones: each row draws a locale, and product words come from one language.
- **Text only.** Swapping packs changes text columns only: every number, date, enum, boolean and identity stays byte-identical, because each text value draws from a stream of its own.
- **Word lists** apply to text fields of a generated or given row source, and to lists and sets of text, whose elements they draw (SYN-E024 otherwise). Their values must fit the field's length and pattern, and a unique field needs at least as many distinct words as rows (SYN-E024). Word lists hold values for one field each: never rows, never numbers or identifiers.
- **Packs.** An unknown locale or a malformed pack file is SYN-E024. A pack file is a JSON object with `locale`, and optionally `extends` (a built-in pack), `country`, `currency`, `people { firstNames, lastNames }`, `places [ { city, postalCode, region } ]` (largest first), `streets { format, names }`, `phones`, `companies { format, names, suffixes }`, `products { format, nouns, lines }`, `words`. In a shape, `#` is a digit and `?` an uppercase letter.

Relations:
- 0..1 "draws from" relation with a vocabulary pack
- 0..n "lists the words of" relation with text fields of the domain model

## Distributions

How one field's values spread: an **advisory** shape, never a fact. An outcome always wins: on a column whose sum a curve, a total or a rollup fixes, the shape only decides how each sum is split; on a column a share, a rate or a mix sets, a shape never applies (SYN-W013).

```
distributions {
    Product.price.amount  lognormal median 25 sigma 0.9
    OrderLine.quantity    zipf 1.6              // whole numbers within the field's bounds
    OrderLine.productId   zipf 1.1              // best sellers: a reference, or a key synthy infers
    Order.customer        zipf 0.8              // regulars: the oldest customers order most
    Customer.createdAt    uniform
}
```

| Shape | Fits | Means |
|---|---|---|
| `uniform` | numbers, dates, enums, word-listed text, references | every value equally likely |
| `lognormal median m sigma s` | numbers | a skewed amount: half below `m`; `s` from 0.25 (tight) to 1.5 (wide) |
| `zipf e` | bounded whole numbers, enums (declared order), word-listed text (list order), references | the first value is the most frequent, the k-th about k^-e as often |

A shape that does not fit its field, a parameter out of range (sigma and exponents in (0, 5]), a median outside the field's bounds, or text without a word list is SYN-E025. The certificate's plausibility section compares each shape with the data.

Relations:
- 0..n "shapes" relation with fields and references of the domain model

## Options

Knobs of the generator — never facts about the data, so the certificate does not mention them.

```
options {
    alpha 2
    decimals 2
    null-rate 20%
    default-dwell 1d
    dwell {
        draft     --> confirmed : 4h
        confirmed --> shipped   : 2d
        shipped   --> delivered : 3d
    }
    reaction-latency 30s
    rejections 3
}
```

- **alpha** — default Dirichlet concentration for exact splits (curves, totals, rollups). Positive; default 2.
- **decimals** — money-like measures are split in units of `10^-decimals`. An integer from 0 to 9; default 2.
- **null-rate** — the probability that an optional field nothing else decides is left null. In `[0, 1]`; default 0.2.
- **dwell** — the mean time a row spends in a state before a given transition fires, written with the machine's own arrow. Durations are `4h`, `2d`, `45min`, `30s`, `1w`, or a quoted ISO duration such as `"PT2H"` (SYN-E015). A dwell naming a transition no machine declares is a warning: it will never apply.
- **default-dwell** — the dwell of transitions `dwell` does not name. Default `1d`.
- **reaction-latency** — the longest delay between an event and the command a reaction issues in response: the window in which a forced transition follows its trigger, and the bound the certificate checks. A duration of at least one second (SYN-E015); default `1min`.
- **rejections** — how many rejected commands to generate per precondition (see [The domain's behaviour in the data](#the-domains-behaviour-in-the-data)). A non-negative integer (SYN-E015); default 3, `0` for none.

## The domain's behaviour in the data

A scenario declares figures; the behaviour comes from the `.domain`, and the generator follows it. Every row with a state machine reaches its state through declared transitions from `[*]`, and every step of that walk honours the model.

- **Preconditions.** A transition fires only when its preconditions hold at that instant.
  - A condition on the row's own state, or on fields its walk sets, removes the paths that would break it.
  - A condition on fields generated after the walk is met by the values the rows that take the transition receive.
  - A condition on the row it is generated `per` places the child's steps where the parent's history allows them: a payment is captured while its order is a draft.
  - A condition on the rows generated `per` this one has every one of them in the required state when the step fires: an order is confirmed only once its payment is captured.
  - A condition on a row behind a plain reference restricts which row is referenced: an order is placed by an active customer.
  - A declared state no walk can reach once preconditions are read is a conflict (SYN-E017). So is a child mix its parents' histories cannot carry (`refunded 15%` of payments when only `10%` of orders end cancelled).
- **Reactions.** When a walked transition emits an event, every reaction listening to it issues its command within the reaction latency.
  - When that command drives a transition the reached row can take (the same row, the row it belongs to, the rows generated per it), the row takes it then.
  - An operation outside the machine is logged with the events it emits, and those may trigger further reactions.
  - An error or external event that no walk emits is recorded as the cause of the transition its reaction drives. Its other reactions follow from it: a payment that fails records `PaymentFailed`, which also cancels the order.
- **Temporal events.**
  - **Relative or absolute.** An event at a fixed offset after an event, or at an instant a walk sets, is a deadline on the row. If the row still stands where the reaction's transition applies when the deadline passes, it takes that transition then; any other exit comes first. A ride whose rider has not boarded five minutes after the driver arrived is cancelled for no-show.
  - **Recurring.** A recurring event is logged on its schedule, with the commands its reactions issue.
- **Invariants.**
  - **Repaired.** Row invariants over the row's own fields and the rows it references are repaired after generation: fields nothing else pinned take values that make them true. A state's invariants apply to the rows that end in that state.
  - **Per child.** `every x in children { body }` holds on every child.
  - **Checked.** `exists`, aggregates over children, alert-level invariants and agreements are questions only: the data may break them, by design for an alert.
- **Rejected commands.** Each precondition synthy can read also gets commands that must be refused. Each one is sent to an existing row at an instant where the condition is false, and that row stands in a source state of the transition, so only the precondition stops it. A precondition that restates the row's state (`status = authorized` on a transition from `authorized`) is also sent from other states, where the state machine refuses it just as well; the table says which (`in_source_state`). Any other precondition that holds wherever its operation applies gets none. Each names the reason the domain declares and the error event it fails with. A condition on the command's arguments gets a payload that breaks it. They are written in a table of their own, as fixtures for the implementation's tests, never as part of the history.

What synthy cannot do it reports, never approximates silently:
- **SYN-W007:** a precondition the walk cannot decide.
- **SYN-W011:** a reaction or a temporal event it does not carry out, such as an offset computed from a field, or a target reached through neither a `per` nor a reference.
- **SYN-W012:** a rejection-level invariant it only checks.
- **SYN-W001:** an invariant or an agreement it cannot read.

The engine's README tabulates, construct by construct, what is enforced, what the certificate checks and what is reported: the **invertible subset** of this metamodel's companion, the domain metamodel.

## Storage formats

A scenario is one document with three encodings. `.synth` is the text people edit: the editor resolves every name against the `.domain` as it is typed. **JSON** and **YAML** hold the same document for programs, tools and language models, which write a data format more reliably than a language. The document is described by a JSON Schema, [`src/schemas/synth-scenario.schema.json`](../schemas/synth-scenario.schema.json), as the text is by `synth.ebnf`. YAML is not a second language: it has no construct JSON lacks, outcomes stay a list told apart by `kind`, and dot-paths stay strings that `synthy check` resolves.

`specy-synth parse -f json|yaml` writes the document from a `.synth` file. `synthy convert` goes in any direction, and the Specy app imports and downloads all three.

```yaml
$schema: https://specy.ai/schemas/synth-scenario/1.json
name: OrdersH1_2025
domain: orders.domain
seed: 42
horizon:
  from: "2025-01-01"
  to: "2025-07-01"
populations:
  - entity: Customer
    count: 200
  - entity: Product
    count: 60
  - entity: Order
    count: 1200
  - entity: OrderLine
    per: Order
    min: 1
    max: 5
outcomes:
  - kind: mix
    machine: Order.OrderLifecycle
    values:
      delivered: 0.72
      cancelled: 0.28
  - kind: rollup
    total: Order.totalAmount.amount
    parts: OrderLine.total.amount
    satisfies:
      - REQ-FIN-002
options:
  dwell:
    draft->confirmed: 4h
```

### From clause to key

| `.synth` | JSON / YAML |
|---|---|
| `scenario OrdersH1_2025 :: "…"` | `name`, `description` |
| `domain-source "orders.domain"` | `domain` |
| `requirements-source "orders.sysreq"` | `requirementsSource` |
| `seed 42` · `horizon 2025-01-01 .. 2025-07-01` · `as-of …` | `seed` · `horizon: { from, to }` · `asOf` |
| `Order count 1200 clock placedAt` | `{ entity: Order, count: 1200, clock: placedAt }` |
| `Customer count 300 since 2023-01-01` | `{ entity: Customer, count: 300, since: "2023-01-01" }` |
| `OrderLine per Order 1..5` | `{ entity: OrderLine, per: Order, min: 1, max: 5 }` |
| `Payment per Order exactly 1` | `{ entity: Payment, per: Order, exactly: 1 }` |
| `curve revenue M by C per month alpha 3 { 2025-01: 9000 over 40 rows }` | `{ kind: curve, name: revenue, measure: M, by: C, period: month, alpha: 3, values: { 2025-01: 9000 }, counts: { 2025-01: 40 } }` |
| `total M = 1280000` | `{ kind: total, measure: M, value: 1280000 }` |
| `share Payment.method { creditCard: 60% … }` | `{ kind: share, dimension: Payment.method, values: { creditCard: 0.6 } }` |
| `share D given G { paid: { web: 60% … } … }` | `{ kind: share, dimension: D, given: G, values: { paid: { web: 0.6 } } }` |
| `mix Order.OrderLifecycle { delivered: 72% … }` | `{ kind: mix, machine: Order.OrderLifecycle, values: { delivered: 0.72 } }` |
| `rate Product.available = true : 90%` | `{ kind: rate, predicate: "Product.available = true", values: 0.9 }` |
| `rate P by C per month { 2025-01: 90% }` | `{ kind: rate, predicate: P, by: C, period: month, values: { 2025-01: 0.9 } }` |
| `rate A.x = y and not (A.z or A.w != v) : 20%` | `{ kind: rate, predicate: "A.x = y and not (A.z or A.w != v)", values: 0.2 }` |
| `rollup T from P` | `{ kind: rollup, total: T, parts: P }` |
| `:: "…"` and `satisfies [REQ-…]` on an outcome | `description`, `satisfies` |
| `Product csv "products.csv"` · `json "…"` · `rows [ { … } ]` | `{ entity: Product, csv: products.csv }` · `json` · `rows` |
| `Product csv "c.csv" { price.amount from "price_eur" }` | `{ entity: Product, csv: c.csv, columns: { "price.amount": price_eur } }` |
| `vocabulary { locale fr  pack "p.json" }` | `vocabulary: { locale: fr, pack: p.json }` |
| `Product.name words "w.txt"` · `words [ "a", "b" ]` | `vocabulary: { words: [ { field: Product.name, file: w.txt } ] }` · `values: [a, b]` |
| `P lognormal median 25 sigma 0.9` · `P zipf 1.6` · `P uniform` | `distributions: [ { field: P, shape: lognormal, median: 25, sigma: 0.9 } ]` · `{ shape: zipf, exponent: 1.6 }` |
| `alpha 2` · `decimals 2` · `null-rate 5%` · `default-dwell 1d` | `options: { alpha, decimals, nullRate: 0.05, defaultDwell: 1d }` |
| `dwell { draft --> confirmed : 4h }` | `options: { dwell: { "draft->confirmed": 4h } }` |
| `reaction-latency 30s` · `rejections 3` | `options: { reactionLatency: 30s, rejections: 3 }` |

### Rules of the document

- **`$schema`** comes first and names the schema, `https://specy.ai/schemas/synth-scenario/1.json`. Its last number is the format version. synthy reads version 1 and warns about any other (SYN-W010). A relative path to a copy of the schema file counts as version 1.
- **`parser`** is provenance: `{ name, version }`, written by `specy-synth parse` only. Every other writer leaves it out.
- **Every key is known.** An unknown key is refused by name, with the closest known key: `unknown key "cout". Did you mean "count"?` (SYN-E022, and an error in a schema-aware editor).
- **Fractions** are a number in `[0, 1]` or a percentage string such as `"72%"`. Readers turn percentages into numbers.
- **Only what `.synth` can write.** Names are identifiers. `satisfies` ids are `REQ-…` identifiers. `per` takes `exactly`, or `min` and `max`. A dwell key joins two state names, `draft->confirmed`. Dates are ISO dates or date-times, and a date-time without an offset is UTC. This is what keeps conversion lossless.
- **Canonical writing.** Keys come in the order of the table above, with `kind` and `name` first in an outcome and `description` and `satisfies` last. Indentation is two spaces. Empty `outcomes`, `givens`, `vocabulary`, `distributions` and `options` are left out. The parser and synthy write the same bytes for the same scenario, apart from the `parser` header.

A JSON Schema cannot state that `horizon.from` precedes `horizon.to`, that `min` does not exceed `max`, or that `2025-02-30` is not a date. synthy refuses those when it reads the document. Whether names resolve and figures add up is `synthy check`, in every encoding.

### YAML

YAML is read with the **YAML 1.2 core schema**, so `2025-01-01`, `yes` and `on` are strings, and `true:` as a key of a boolean share is the member `true`. A YAML file is refused when it could mean different things to different readers:

- a key repeated in one mapping;
- several documents in one file;
- a tag outside the core schema, such as `!!timestamp`, `!!binary` or a custom `!tag`;
- a YAML 1.1 merge key, `<<`.

Anchors and aliases are accepted and expanded. Comments are allowed and dropped. Writers put double quotes on every scalar a YAML 1.1 reader such as PyYAML would read as something else: dates, `yes`/`no`, `on`/`off`, `1:20`.

### Editors

The schema gives JSON and YAML files completion, hover text from the metamodel, and errors on unknown keys and wrong types, in any editor that reads JSON Schema. Name resolution against the `.domain` stays with `.synth` in the editor and with `synthy check` everywhere.

- **YAML** (VS Code's YAML extension, or any editor running `yaml-language-server`): a first-line modeline pointing at the schema file, which works offline.

  ```yaml
  # yaml-language-server: $schema=../schema/synth-scenario.schema.json
  ```

- **JSON**: the `$schema` key, or a `json.schemas` setting mapping `*.synth.json` to the schema file. An editor fetches an `https` `$schema` from the network, so a file can point at a local copy instead (`synthy convert --schema ../schema/synth-scenario.schema.json`).

synthy ships a copy of the schema as `specy-synthy/schema`.

### What conversion does not keep

Conversion keeps the document, not the text around it:

- comments and layout of a `.synth` or YAML file;
- the spelling of a fraction: `72%` and `0.72` are the same number, and `.synth` prints a percentage only when it is exact;
- a double quote inside a string, which a `.synth` string cannot hold (the printer writes `'` instead);
- YAML anchors, which are expanded.

## Conflicts

The generator refuses only on arithmetic impossibility and dangling references, never on "unusual". Everything it cannot enforce it reports as a warning, so the author knows exactly which declarations the certificate will and will not cover. Each refusal is a **conflict** in the style of a compiler error: a code, the declarations involved, the arithmetic when there is one, and a remedy.

| Code | Refuses when |
|---|---|
| `SYN-E001`, `SYN-E005` | a name does not resolve in the domain model |
| `SYN-E002` | a row source has two populations |
| `SYN-E003` | a `per` parent or a referenced row source has no rows; a range does not fit the declared cardinality |
| `SYN-E006` | a path crosses a reference, or its leaf has the wrong type for its role |
| `SYN-E007` | a share names a non-member or does not sum to 1 |
| `SYN-E008` | a mix names no machine, an unknown or unreachable state, or does not sum to 1 |
| `SYN-E009` | a rate predicate is unreadable, reads two row sources, or is out of `[0, 1]`; a share or a single-atom rate pins a state-driven column |
| `SYN-E010` | a period key does not match its period or the horizon; the timeline is inconsistent; a `since` after the horizon's end, or on a clock an outcome places in periods |
| `SYN-E011` | a figure cannot be reached within the declared bounds and counts; a total, or a curve or per-period rate by the row's own field, sits on a `per` population |
| `SYN-E012` | two outcomes set the same column (a rollup sets its parts); outcomes on one time axis disagree on the period; two mixes on one machine; a share is given a column nothing sets before it |
| `SYN-E013` | a rollup's child is not `per` its parent |
| `SYN-E014` | a row source has two givens, a given disagrees with its count, a given entity is `per` a parent, or an outcome sets a column a given supplies |
| `SYN-E015` | an option is out of range or a duration is unreadable |
| `SYN-E016` | row sources reference each other through mandatory references only: no generation order exists |
| `SYN-E017` | the domain's behaviour and the declared figures cannot meet: a mix names a state no walk reaches once preconditions and reactions are read, a child's mix asks for more than its parents' histories allow, an outcome pins a field of the same row that a walked precondition requires (a precondition reading another row only restricts which row is referenced) |
| `SYN-E020` | the in-browser build would produce more than 50 000 rows (the CLI has no such cap) |
| `SYN-E021` | the parsed domain model comes from a `specy-domain` older than 1.1.0, or from an unknown tool |
| `SYN-E022` | a JSON or YAML document is malformed: an unknown key, a wrong type, a form `.synth` cannot write, YAML outside the core schema |
| `SYN-E023` | a given does not fit the model: a cell of the wrong type, out of a bound, length or pattern, not a member, empty where required, repeated where unique, breaking an invariant, a state the machine lacks; a mapped column or file column that does not exist; an enum given whose value type has no code field |
| `SYN-E024` | the vocabulary names an unknown locale or a malformed pack, or a word list does not fit its field (not text, too long, against the pattern, too few words for a unique field) |
| `SYN-E025` | a distribution does not fit its field, has a parameter out of range or a median outside the bounds, or shapes text that has no word list |

Warnings (`SYN-Wxxx`) report what the generator decided for the author:

| Code | Reports |
|---|---|
| `SYN-W001` | an invariant or agreement it cannot read: neither enforced nor checked |
| `SYN-W002` | a state machine on an entity without a datetime field: a synthetic `_at` column carries the start instant |
| `SYN-W003` | a curve that may put some rows above an alert-level upper bound |
| `SYN-W004` | a defaulted horizon (the calendar year 2024) |
| `SYN-W005` | an optional reference to an entity that is not generated: the column stays null |
| `SYN-W006` | a machine without an enum field covering its states: a synthetic `_state` column carries the final state |
| `SYN-W007` | a transition precondition the walk cannot decide |
| `SYN-W008` | a cycle broken through an optional reference, filled once both tables exist |
| `SYN-W009` | a scenario without any population |
| `SYN-W010` | a `$schema` naming a format version it does not read |
| `SYN-W011` | a reaction or temporal event it does not carry out |
| `SYN-W012` | a rejection-level invariant it only checks |
| `SYN-W013` | a declaration that never applies: a distribution or a word list on a column an outcome sets, a given supplies or an invariant computes; a median on a summed column; `since` on an entity without a clock |
| `SYN-W014` | a column of a given file that matches no field: it is ignored |
| `SYN-W015` | an enum of a value type with no given instance for some members |

The Langium language server raises the same codes at edit time, including for a name that does not resolve: `SYN-E001` for an entity, `SYN-E005` for a path segment, `SYN-E007`, `SYN-E008` and `SYN-E009` for a member, a machine or a state, `SYN-E023` for a given's column. A `.synth` that is clean in the editor is one the generator accepts. `synthy explain <code>`, and the `explain_conflict` tool of synthy's MCP server, give each code's rule, its usual causes, what to change and a before/after written against the orders example.

## Requirement Traceability

An outcome states a business figure; when that figure comes from a requirement — "the system shall support 1 200 orders a month", "cancellations shall not exceed 10 %" — the outcome names it in its `satisfies` list, and the scenario declares the requirement file with `requirements-source`. The generator copies the identifiers onto the facts it writes, and the certificate's questions carry them: a passing question is evidence that data satisfying the requirement exists under the model.

```
scenario OrdersH1_2025 {
    domain-source "orders.domain"
    requirements-source "orders.sysreq"
    …
    outcomes {
        mix Order.OrderLifecycle satisfies [REQ-ORD-014] { … cancelled: 10% }
    }
}
```

A scenario traces to requirements only through its outcomes and its own `satisfies` list. It never traces to domain elements by identifier: it references them by name, and the reference is resolved, not declared.

The domain traces on its own side. A question that checks a precondition, a rejected command, an invariant, a reaction or a temporal event carries the `satisfies` of the element it checks (for a precondition, those of its operation and of the clause itself). The generator writes both into a **traceability map** next to the data. For each requirement, the map lists the declarations that cite it, the tables holding the evidence, the questions and what the certificate answered. When `requirements-source` is declared, the map also names each requirement, lists those no question covers, and lists the identifiers the requirements file does not declare.

## What the certificate proves

Every outcome becomes one or more **facts**, written from the declaration before or while rows are generated and never measured from the data: a row count, a sum per period, a category count, a foreign-key integrity, a cardinality range, a rollup equality, a bound, an allowed-value set, a temporal order.

The domain contributes its own facts:
- cardinalities of references, bounds of fields, enum members;
- the state column's allowed values and the consistency of a walk's timestamps;
- each enforced precondition, held at every transition it guards: the state a joined row was in at that instant is read from the transition log;
- each forced transition, which happened within the reaction latency of its trigger;
- each deadline, which fired on time whenever it was due;
- each command a reaction issued, linked to its trigger;
- each repaired or per-child invariant, which holds;
- each rejected command, which breaks its condition.

A verifier turns each fact into a SQL question with an expected answer and runs it on a database engine that shares no code with the generator. The certificate lists every question, its answer and its tier. **Hard** questions follow from declarations and must all pass. **Advisory** ones concern what the data may break by design: alert-level bounds and invariants, `exists`, aggregates over children, agreements. For an invariant, a comparison with a null value does not break it, as in a SQL CHECK; a precondition must positively hold. The questions and the tables are written next to each other, so anyone can re-run the verification without the generator.

Given rows add their own hard question: every supplied value of every row, unchanged.

### Plausibility

Conformance is not the whole picture: data can satisfy every declaration and still read oddly. A third section of the certificate, **plausibility**, reports what a reader would notice, each check with an expected value and a tolerance. It never gates the certificate.

- **Referenced rows exist first.** A row reached through a plain reference was created before the row that names it: a customer before the orders that name it. synthy picks among the rows that exist at the referencing row's start, moves a referenced row's free clock back, or the referencing row's free clock forward, when none does. An optional reference whose target points back (a loan's escalation) names a follow-up, created after. Rows whose clocks a walk or an outcome fixes cannot always be ordered; the check counts them.
- **No crowding before as-of.** A machine's transitions in the reaction latency before as-of, against what an even spread would put there. A walk that needs an effect still in flight at the snapshot is used only when the mix cannot be met without it.
- **Shapes, observed.** For each distribution: a lognormal field's median, or the spread of its 10th and 90th percentiles; the share of a Zipf field's most frequent value.

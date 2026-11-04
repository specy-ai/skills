# Model formats: DSL, JSON, YAML, Markdown

Every Specy model is one document with four encodings. The **DSL** (`.domain`, `.prd`, `.sysreq`, `.arch`, `.synth`) is the text people write and the only place the language's semantics live: grammar, validation rules, cross-references. **JSON** and **YAML** hold the same document for programs, tools and language models, which write a data format more reliably than a language; each is described by a JSON Schema in `src/schemas/`. **Markdown** is the document people read and the one they, or a language model, write first: a heading hierarchy, a few labelled lines, tables and lists, with the formal fragments kept in fenced `specy` islands.

```
                 print                    toMarkdown
   JSON / YAML ◄──────── model ────────────────────► Markdown
        │                  ▲                            │
        │  schema check    │ parse (the DSL parser)     │ reader (conventions)
        └──► DSL text ─────┴──────────── DSL text ◄─────┘
```

Reading any encoding ends in the DSL parser. A JSON or YAML document is validated against its schema, printed to DSL, then parsed; a Markdown document is transpiled to DSL by the conventions below, then parsed, and each diagnostic is mapped back to the Markdown line it came from. One grammar, one validator and one set of cross-reference rules therefore judge a model whatever it was written in, and what comes out is the canonical model.

## Files and tools

| Encoding | File name | Read by | Written by |
|---|---|---|---|
| DSL | `<name>.<language>` (`orders.domain`, `sniplink.prd`, `sniplink.sysreq`, `sniplink.arch`, `orders.synth`) | the Langium parser | `specy convert --to dsl` |
| JSON | `<name>.<language>.json` | schema + printer + parser | `specy convert --to json`, `specy-domain parse`, `specy-synth parse` |
| YAML | `<name>.<language>.yaml` | schema + printer + parser | `specy convert --to yaml`, `specy-synth parse -f yaml` |
| Markdown | `<name>.<language>.md` | the Markdown reader + parser | `specy convert --to markdown`, `specy-domain parse -f markdown` |

```bash
specy convert orders.domain --to markdown -o            # orders.domain.md next to the input
specy convert orders.domain.md --to dsl                 # back to the DSL, on stdout
specy convert sniplink.prd.yaml --to json --pretty
specy validate catalogue.synth.yaml                     # schema, grammar, references into the domain
specy detect some-file.md                               # which language, which encoding
```

The language is read from the file name, else from the `$schema` of a JSON/YAML document, the `specy:` key of a Markdown front matter, or the DSL's root keyword; `--language` overrides. A scenario names its `.domain` (`domain-source` in the DSL, `domain` in the document, `domain:` in the Markdown front matter) and the converter reads it next to the input.

A document's `$schema` names its JSON Schema: `https://specy.ai/schemas/<name>/<major>.json` — `domain-model`, `prd`, `sysreq`, `architecture`, `synth-scenario`. The trailing number is the format's major version; the `parser: { name, version }` header says which parser wrote it.

The CLI, the browser bundle and the Specy app share the converters (`src/langium/specy-domain/src/formats/`); the `specy:model-formats` skill drives them from an agent and handles the Markdown that the conventions cannot.

## What converts losslessly, and what does not

- **DSL → JSON/YAML → DSL** keeps every construct and every expression. It drops comments (`//`, `#`) and reorders definitions into the normalizer's groups (enums, values, entities, …): the model is the same, the text is canonical.
- **DSL → Markdown → DSL** is the same round trip, pinned by tests on every example file: the canonical Markdown the writer emits reads back into the same model with no diagnostic.
- A double quote inside a DSL string cannot exist (the lexers accept no escape); a JSON or Markdown text that contains one is printed with a single quote instead.
- Line breaks inside a DSL string (a paragraph wrapped over several lines) collapse to one space in the document.
- Markdown written by hand follows the conventions loosely; the reader is tolerant, and what it cannot place is reported as `MD-UNMAPPED` on its line and kept in the generated DSL as a `// unmapped (markdown line N): …` comment, so nothing disappears silently.

## Markdown conventions — the general rules

The rules below hold for every language; the per-language sections give the headings, labels and islands of each. **Canonical** is what `specy convert --to markdown` writes; the reader accepts the canonical form and the variants listed under *Tolerated*.

### 1. Front matter names the language

```markdown
---
specy: domain
---
```

Canonical: a YAML front matter with `specy: <domain | prd | sysreq | architecture | synth>`. A scenario adds `domain: orders.domain`. Tolerated: no front matter when the file is named `<name>.<language>.md`, or when the first heading opens with the root keyword (`# product …`, `# requirements …`, `# organization …`).

### 2. Headings carry the kind and the name

```markdown
# organization Acme
## context Sales (SLS)
### module Quoting
#### entity Quote
#### api interface QuoteApi
#### repository QuoteRepository for Quote
```

Canonical: `<kind words> <Name>[ <head suffix>]` — the DSL's own keyword(s), then the name as the DSL writes it, then what the DSL puts on the head line (`of ValueType`, `for Entity`, `(shortname)`). Heading levels follow containment: a definition sits under the module, context or organization that owns it; the absolute level does not matter, only the nesting.

Tolerated:

- `Entity: Quote`, `Entity — Quote`, `Quote (entity)`;
- a **group heading** — the plural of a kind (`## Entities`, `## Value Types`, `## Personas`, `## Features`) — under which bare-name headings (`### Quote`) take that kind; the reader says so with `MD-DEFAULT-KIND`;
- a heading that is neither a kind nor a group (`## Overview`) is transparent: its sub-headings are read in place, its own content is unmapped;
- sub-headings inside a definition that name no kind (`##### Operations`) are absorbed into the definition.

### 3. The first paragraph is the description

The first plain paragraph (or blockquote) under a heading, before any labelled line, becomes the element's `:: "description"` (or the field the language calls its description). Further paragraphs are unmapped. Emphasis is stripped: `_An order_` and `An order` are the same description.

### 4. Labelled lines are the simple clauses

```markdown
**Identity:** `quoteId : uuid`
**Satisfies:** REQ-SLS-001, REQ-SLS-002
**Metadata:** owner = "sales", tier = 1
**Priority:** must
```

Canonical: `**Label:** value`, one clause per line, the label being the DSL keyword in words (`Reads from`, `Triggered by`, `Value proposition`). Labels are matched case-insensitively, with spaces, hyphens and underscores alike (`Reads from` = `reads-from` = `READS_FROM`). Values that are a type, an expression or a dot path are written in inline code and read back unwrapped.

Tolerated: `**Label**: value`, `__Label__: value`, `- Label: value` (a bullet list of labels), several labels on one line separated by ` · ` (`**Priority:** must · **Status:** accepted`), and the per-language aliases (`**Id:**` for `**Identity:**`, `**Rationale:**` for `::`).

A label whose value is empty takes the list that follows it:

```markdown
**References:**
- `lines : OrderLine 1..N` — The line items
- `customer : Customer 1..1`
```

List items are `head — description`; the description after the dash (`—`, `–` or ` - `) becomes the item's `::`. Comma lists stay inline: `**Models:** Sales, Billing`.

`**Satisfies:**` and `**Metadata:**` are understood on every element that accepts them in the DSL. `**Metadata:**` holds `key = value` pairs, strings quoted.

### 5. Tables are the field-like rows

```markdown
| field | type | constraints | description |
|---|---|---|---|
| amount | `decimal` | min(0) | The amount in minor units |
| currency | `Currency` | required | |
```

Canonical: a pipe table whose header names the columns; the reader recognizes a table by its columns (a `field` or `name` column plus `type` is a fields block). A type ending in `?` is optional. Constraints are written as the DSL spells them, space-separated (`required unique min(0) range(1, 5)`), and pass through. An optional `satisfies` column holds requirement ids. Tolerated: column aliases (`name`, `attribute`, `property`; `meaning`, `notes`; an `optional` or `required` column instead of the `?`).

### 6. Islands hold the formal fragments

````markdown
```specy
operations {
  "Place the order" on PlaceOrder {
    precondition hasLines { isNotEmpty(lines) }
      rejects "An order must contain at least one line"
    emits OrderPlaced { orderId = id }
  }
}
```
````

Operation bodies, state machines, invariant blocks, reconciliations, Thrift-typed interfaces: Markdown has no shape that beats the DSL for them, so they travel as fenced code blocks in DSL syntax, written by the DSL printer and pasted verbatim by the reader at the place the grammar expects them. The language tag is `specy` (tolerated: `domain`, `dsl`, none). When a definition takes several islands (`operations`, `states`, `invariants`), the reader orders them as the grammar does, whatever their order in the document.

### 7. What the reader does with the rest

- An unrecognized paragraph, list, table or code block: `MD-UNMAPPED` warning on its line, and a `// unmapped (markdown line N): …` comment in the DSL at that place.
- A heading that is neither a kind nor a group: `MD-HEADING`, read as transparent.
- A required clause that is missing (`**Reads from:**` on a query, `**Triggered by:**` on a reaction): an error naming the label to add.
- A value guessed from context (an identity without a type, an interface without a role): a warning saying what was assumed.

Then the generated DSL is parsed; every parser diagnostic is reported on the Markdown line the DSL line came from, with the DSL line in the message.

## Domain (`.domain`)

### Headings

| Heading | DSL |
|---|---|
| `# organization Acme` | `organization Acme { … }` |
| `## context Sales (SLS)` | `context Sales (SLS) { … }` — `(SLS)` is the shortname, optional |
| `### module Quoting` | `module Quoting { … }` |
| `#### enum Status`, `#### enum Currency of CurrencyCode` | `enum Status { … }`, `enum Currency of CurrencyCode { … }` |
| `#### value Money` (tolerated: `value type`, `value object`) | `value Money { … }` |
| `#### entity Quote`, `#### aggregate Order` | `entity Quote { … }`, `aggregate Order { … }` |
| `#### read-only entity Product` (tolerated: `master data`) | `read-only entity Product { … }` |
| `#### command PlaceOrder`, `#### query GetOrder` | `command …`, `query …` |
| `#### event OrderPlaced`, `#### external event PaymentSettled`, `#### error event PaymentFailed`, `#### temporal event DeadlineElapsed` | the four event kinds |
| `#### domain service Pricing` (tolerated: `service`), `#### application service Checkout`, `#### infrastructure service Mailer` | the three service kinds |
| `#### repository OrderRepository for Order`, `#### read-only repository ProductRepository for Product` | `repository … for …` |
| `#### api interface OrderApi`, `#### spi interface PaymentGateway` (tolerated: `api`, `spi`, `driving port`, `driven port`) | `api interface …`, `spi interface …` |
| `#### reaction NotifyOnOrderPlaced` (tolerated: `policy`) | `reaction … { … }` |
| `#### invariant OrderTotalPositive`, `#### agreement StockMatchesOrders` | `invariant …`, `agreement …` |

Group headings: `Enums`, `Value Types`/`Values`, `Entities`, `Aggregates`, `Commands`, `Queries`, `Events`, `External Events`, `Error Events`, `Temporal Events`, `Services`/`Domain Services`, `Application Services`, `Infrastructure Services`, `Repositories`, `Interfaces`/`Ports`, `Reactions`/`Policies`, `Invariants`, `Agreements`.

### Labels

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| every element | `Satisfies`; `Metadata` (`Meta`) | `satisfies [...]`; `meta { … }` on the head line |
| organization | `Requirements source`; `Subdomains` + list `Name \`core\` — description` | `requirements-source "…"`; `subdomain Name core :: "…"` |
| context | `Requirements source`; `Models`; `Context map` (`Map`) + list `downstream Billing : ACL` | `models …`; `map { downstream Billing : ACL }` |
| module | `Exposes`; `Requires`; `Depends on` (`Dependencies`) | `exposes { … }`; `requires { … }`; `depends on { … }` |
| enum | `Of` (`Value type`), or in the heading; values as a bare list `name = value — description` | `enum X of VT { name = value :: "…" }` |
| entity, aggregate, command | `Identity` (`Id`, `Identifier`, `Key`) as `` `name : type` ``; `Duplicate detection` as an expression | `identity name : type`; `duplicate detection { … }` |
| aggregate | `Entities` (`Children`) | `entities { … }` |
| read-only entity | `Sourced from` (`Source`, `Owner`); `Synced via`; `Projected by` | `sourced-from …`; `synced-via …`; `projected-by …` |
| entity-like | `References` + list `` `name : Target 1..N` — description `` | `references { name : Target 1..N :: "…" }` |
| query | `Reads from` (`Repository`); `Returns` | `reads-from …`; `returns …` |
| event, error event | `About`; `Caused by` | `about …`; `caused-by …` |
| external event | `From` (`Source`, `Origin`); `About` | `from …`; `about …` |
| temporal event | `About`; `Anchor` (`reference Ev offset 3 days` / `instant a.b` / `schedule "…"`); `Guard` | the anchor clause; `guard { … }` |
| domain service | `Calls` (`Uses`) | `calls { … }` |
| application service | `Exposed by` | `exposed-by …` |
| infrastructure service, repository | `Described by` (`Contract`) | `described-by …` |
| interface | `Role` (api / spi) when not in the heading; `Exposes` + list of dot paths; `Describes` (`Provider`) | `exposes a.b`; `describes X` |
| reaction | `Triggered by` (`On`, `Events`); `Guard` (`Condition`); `Effects` (`Command`, `Then`) | `triggered-by …`; `guard { … }`; `effects …` |
| invariant | `On` (`Scope`); `Must` (`Rule`); `Enforcement` (`Strategy`, assumed `rejection`) | `on …`; `must { … }`; `enforcement …` |
| agreement | `Participants` (`Between`); `Predicate` (`Rule`) | `participants { … }`; `predicate { … }` |

### Tables and islands

- Fields: a table with `field` (or `name`) and `type` columns, then `constraints`, `description`, optionally `satisfies`. An entity, aggregate, value, command, query or event with no table gets an empty `fields { }`.
- Islands: `operations { … }` (entity, aggregate, value, services), `states { … }`, `invariants { … }`, `reconciliation … { … }` (agreement); for a repository or an interface the island holds the bare signatures. A bare island under a service (signatures without the `operations` wrapper) is wrapped by the reader.

### Example

```markdown
---
specy: domain
---

# context Orders

Orders placed by customers.

**Satisfies:** REQ-ORD-001

## module Ordering

### enum Currency

- eur — Euro
- usd

### value Money

| field | type | constraints | description |
|---|---|---|---|
| amount | `decimal` | min(0) | |
| currency | `Currency` | required | |

### aggregate Order

A customer order.

**Identity:** `orderId : uuid`

| field | type | constraints | description |
|---|---|---|---|
| total | `Money` | | |
| placedAt | `datetime?` | | |

**Entities:** OrderLine

**References:**
- `lines : OrderLine 1..N` — The line items

```specy
operations {
  "Place the order" on PlaceOrder {
    precondition hasLines { isNotEmpty(lines) }
      rejects "An order must contain at least one line"
    emits OrderPlaced { orderId = orderId }
  }
}
```
```

## Product requirements (`.prd`)

A PRD is the model Markdown fits best: the canonical document reads like the PRD a product team would write, and the reader accepts the way people and language models actually write one. The document is one `# product` heading, the four product-level sections, then one section per element.

### Headings

| Heading | DSL |
|---|---|
| `# product Sniplink` | `product "Sniplink" { … }` |
| `## Vision` + a paragraph | `vision "…"` (tolerated: `**Vision:**`, or the first paragraph under the product when no vision is given, reported as `MD-VISION`) |
| `## Scope` + a bullet list | `scope { "…" "…" }` (tolerated: `In scope`, `**Scope:**` + list) |
| `## Non-goals` + a bullet list | `non-goals { … }` (tolerated: `Out of scope`, `**Non-goals:**` + list) |
| `## Problem` + `**Situation:**`, `**Complication:**`, `**Question:**` | `problem { situation … complication … question … }` (tolerated: `Problem statement`, the three as `###` sub-headings with a paragraph each) |
| `## evidence Application abandonment rate` | `evidence "…" { … }` |
| `## persona Publisher` (tolerated: `user persona`, `actor`) | `persona "Publisher" { … }` |
| `## job Share a clean link quickly` (tolerated: `job to be done`, `jtbd`) | `job "…" { … }` |
| `## goal Drive weekly active publishers` (tolerated: `objective`) | `goal "…" { … }` |
| `## hypothesis Auto-channel detection drives adoption` | `hypothesis "…" { … }` |
| `## feature FEAT-001 Link shortening` (tolerated: `capability`; `## FEAT-001 Link shortening` with no kind word) | `feature FEAT-001 "Link shortening" { … }` — the id is optional and recognized by its pattern |
| `### story US-001 As a publisher, I want …` under a feature (tolerated: `user story`; `### US-001 …`) | `stories { US-001 "…" { acceptance-criteria { … } } }` |
| `## assumption …`, `## risk …`, `## constraint …` | `assumption "…" { … }`, `risk …`, `constraint …` |
| `## open-question Auto-approval threshold` (tolerated: `open question`, `question`) | `open-question "…" { … }` |
| `## release R1 — Core shortener` (tolerated: `milestone`) | `release "R1 — Core shortener" { … }` |
| `## journey Publisher shortens and shares a link` (tolerated: `user journey`) | `journey "…" for "<persona>" { … }` — the persona comes from the `**Persona:**` line |

Group headings, under which a bare-name heading takes the group's kind (`MD-DEFAULT-KIND`): `Evidence`, `Personas` / `Users` / `Actors`, `Jobs` / `Jobs to be done`, `Goals` / `Objectives`, `Hypotheses`, `Features` / `Capabilities`, `Stories` / `User stories` (inside a feature), `Assumptions`, `Risks`, `Constraints`, `Open questions` / `Questions`, `Releases` / `Roadmap` / `Milestones`, `Journeys` / `User journeys`.

The first plain paragraph under an element's heading is its main text when that clause has no label: the `summary` of a feature, the `statement` of a job, goal, assumption, risk or constraint, the `role` of a persona, the `intervention` of a hypothesis, the `question` of an open question, the `theme` of a release, the `summary` of a piece of evidence.

### Labels

Each clause is a `**Label:** value` line (or a `- Label: value` bullet; several labels on one line separated by ` · `). Enumerated values are written as the DSL spells them or in words (`Nice to have` reads as `nice-to-have`, `In progress` as `in-progress`). A required clause that is missing is an `MD-MISSING` error naming the label; a placeholder keeps the model readable.

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| evidence | `Type`; `Summary`; `Source reference` (`Source`, `Reference`); `Date` (YYYY-MM-DD); `Confidence`; `Supports` | `type …`, `summary "…"`, `source-reference "…"`, `date …`, `confidence …`, `supports "…"` |
| persona | `Role` (`Who`); `Goals` + list (`Wants`, `Needs`); `Frustrations` + list (`Pain points`); `Context` (`Environment`); `Weight` (`Priority`) | `role "…"`, `goals { … }`, `frustrations { … }`, `context "…"`, `weight primary` |
| job | `Persona` (`For`, `Actor`); `Statement`; `Type`; `Importance`; `Satisfaction` (`Current satisfaction`); `Related to` (`Related jobs`); `Desired outcomes` + table or list | `persona "…"`, `statement "…"`, `type functional`, `importance critical`, `satisfaction underserved`, `related-to "…", "…"`, `desired-outcomes { … }` |
| goal | `Statement` (`Objective`); `Horizon` (`Term`, `Timeframe`); `Owner`; `Metrics` + table or list (`KPIs`, `Success metrics`) | `statement "…"`, `horizon short-term`, `owner "…"`, `metric { … }` per row |
| hypothesis | `Intervention` (`If`, `We believe`); `Expected outcome` (`Then`, `We expect`); `Mechanism` (`Because`, `Why`); `Validation method` (`How we test`); `Status`; `Proposes` (`Feature`); `Predicts` (`Goal`); `Supported by` (`Evidence`) | the clauses in that order |
| feature | `Summary` (`Description`); `Persona` (`For`, `Target persona`); `Value proposition` (`Value`, `Benefit`); `Priority` (`MoSCoW`); `Status`; `Addresses` (`Jobs`); `Advances` (`Goals`); `Tested by` (`Hypothesis`); `Design references` + list; `Non-goals` + list (`Out of scope`); `Stories` + nested list, or `### story` sub-sections | `summary "…"`, `persona "…"`, `value-proposition "…"`, `priority must`, `status accepted`, `addresses "…"`, `advances "…"`, `tested-by "…"`, `design-references { … }`, `non-goals { … }`, `stories { … }` |
| story | `Acceptance criteria` + list (`Criteria`, `AC`): each item `AC-001-01 text` or plain text (a leading `[ ]` checkbox is ignored) | `US-001 "title" { acceptance-criteria { AC-001-01 "text" } }` |
| assumption | `Statement` (`We assume`); `Impact if wrong` (`Impact`, `Consequence`); `Validation plan` (`How we validate`); `Status`; `Underpins` (`Supports`) | `statement "…"`, `impact-if-wrong "…"`, `validation-plan "…"`, `status unvalidated`, `underpins "…"` |
| risk | `Statement`; `Likelihood` (`Probability`); `Impact` (`Severity`); `Mitigation` (`Strategy`, `Response`); `Owner`; `Threatens` (`Affects`) | `statement "…"`, `likelihood medium`, `impact high`, `mitigation mitigate`, `owner "…"`, `threatens "…"` |
| constraint | `Statement`; `Source` (`Origin`, `Type`); `Constrains` (`Applies to`) | `statement "…"`, `source regulatory`, `constrains "…"` |
| open question | `Question`; `Context` (`Background`); `Owner`; `Deadline` (`Due`, `By`); `Status`; `Blocks`; `Resolution` (`Answer`, `Decision`) | `question "…"`, `context "…"`, `owner "…"`, `deadline 2026-06-01`, `status open`, `blocks "…"`, `resolution "…"` |
| release | `Target date` (`Target`, `When`); `Theme` (`Focus`); `Status`; `Depends on` (`Dependencies`, `After`); `Includes` + list (`Features`, `Ships`); `Entry criteria` + list; `Exit criteria` + list (`Definition of done`) | `target-date "…"`, `theme "…"`, `status planned`, `depends-on "…"`, `includes { … }`, `entry-criteria { … }`, `exit-criteria { … }` |
| journey | `Persona` (`For`, `Actor`, `Who`); `Trigger` (`Starts when`); `Outcome` (`Ends with`, `Result`); `Design references` + list; `Steps` + table or list (`Flow`) | `journey "…" for "…" { trigger "…" outcome "…" design-references { … } steps { … } }` |

A name list (`Addresses`, `Advances`, `Related to`, `Supported by`, `Underpins`, `Threatens`, `Constrains`, `Blocks`, `Depends on`) is written inline, comma-separated, unless a name holds a comma — then one bullet per name; the reader accepts both. A text list (`Scope`, `Non-goals`, `Goals`, `Frustrations`, `Includes`, the criteria) is one bullet per text; inline, texts are separated by `;` or ` · ` so their commas survive.

### Tables, lists and islands

- **Desired outcomes** (job): a table `| outcome | importance | current satisfaction |`; tolerated: a list whose items read `statement — importance: high, current satisfaction: medium` or `statement (importance medium, satisfaction low)`.
- **Metrics** (goal): a table `| indicator | target | baseline | measurement |`; tolerated: a nested list, `- Indicator: …` with `- Target:`, `- Baseline:`, `- Measurement:` beneath it, or `indicator — target: … · baseline: … · measurement: …`.
- **Design references**: a list of `name → url` (also `name -> url`, `[name](url)`).
- **Steps** (journey): a table `| step | action | system response | channel | emotional tone | order |` — the `step` cell is the step's number (`step 1 { … }`) or its name (`"what the persona does" { … }`); tolerated: a list whose items are `step 1` or the step's name, with `- Action:`, `- System response:`, `- Channel:`, `- Emotional tone:`, `- Order:` beneath.
- **Stories**: `### story US-001 Title` sub-sections with their `**Acceptance criteria:**` list; tolerated: a `**Stories:**` nested list, one item per story (`US-001 Title`) whose children are the criteria.
- A sub-heading inside an element named like one of its labels (`#### Acceptance criteria`, `### Non-goals`, `### Steps`) is that label; any other sub-heading is read as part of the element with an `MD-HEADING` warning.
- The PRD has no formal fragments: no `specy` islands.

### Example

```markdown
---
specy: prd
---

# product Sniplink

## Vision

A URL shortener that unifies link sharing, click analytics and bookmark management.

## Scope

- Shorten a URL into a short, memorable link
- Per-channel click analytics without manual tagging

## Problem

**Situation:** Marketers share links across dozens of channels every day.
**Complication:** Existing shorteners treat analytics and bookmarks as separate concerns.
**Question:** How can we give publishers one workspace for every link they share?

## persona Publisher

**Role:** A marketer or developer who shares links professionally
**Goals:**
- Share clean, short, memorable URLs
- Know which channel drives the most clicks
**Frustrations:**
- Manual UTM tagging is tedious and error-prone
**Context:** Desktop browser; shares on Twitter/X, LinkedIn, Slack and newsletters
**Weight:** primary

## goal Drive weekly active publishers

**Statement:** Grow the number of publishers who shorten at least one link a week
**Horizon:** short-term
**Owner:** Head of Product

**Metrics:**

| indicator | target | baseline | measurement |
|---|---|---|---|
| Weekly active publishers | 500 within 6 months | 0 | Product analytics, weekly cohort |

## feature FEAT-001 Link shortening

**Summary:** Publisher pastes a long URL and instantly gets a short, shareable link
**Persona:** Publisher
**Value proposition:** Core utility — the action that brings publishers to the product
**Priority:** must
**Status:** accepted
**Addresses:** Share a clean link quickly
**Advances:** Drive weekly active publishers

### story US-001 As a publisher, I want to paste a URL and get a short link in one click

**Acceptance criteria:**
- AC-001-01 Short link is generated within 1 second of pasting the URL
- AC-001-02 Short link is copied to the clipboard automatically

## journey Publisher shortens and shares a link

**Persona:** Publisher
**Trigger:** Publisher has a blog post URL they want to share
**Outcome:** The link is shared and clicks are tracked per channel

**Steps:**

| step | action | system response | channel | emotional tone | order |
|---|---|---|---|---|---|
| 1 | Publisher pastes the long URL | Displays a short link with the page title | web | confident | |
| 2 | Publisher copies the short link | Link copied to the clipboard | web | delighted | |
```

## System requirements (`.sysreq`)

A requirements file is one or more requirement sets, each scoped to a bounded context or an organization; a set holds requirements directly or in modules. The document (`$schema: https://specy.ai/schemas/sysreq/1.json`) is `{ requirementSets: [ { name, scope, prdSources[], requirements[], modules: [ { name, requirements[] } ] } ] }`; a requirement is `{ id, name, pattern, rationale, statement, priority, source, dependsOn[], conflictsWith[], decomposedInto[], satisfiedBy: [ { role, target } ] }`, where `target` is the domain element as the DSL names it (`Order`, `Order.status`, `Order."Place order"`) and `role` is `satisfied-by-infrastructure` when no element carries the obligation. Clauses written on either side of the EARS statement land in the same place; the printer writes them in one order (rationale, source, statement, priority, then the traceability clauses) and loose requirements before modules.

### Headings

| Heading | DSL |
|---|---|
| `# requirements "Link Shortening" scoped-to UrlShortenerContext` | `requirements "Link Shortening" scoped-to UrlShortenerContext { … }` |
| `## module Link Shortening` | `module "Link Shortening" { … }` |
| `### REQ-LNK-001 Short link generation` | `REQ-LNK-001 "Short link generation" : <pattern> …` — the id identifies a requirement, at any level |

Tolerated: `# Requirements: Link Shortening` with a `**Scope:** UrlShortenerContext` line (alias `Scoped to`, `Context`); `### REQ-LNK-001 — Short link generation`, `### REQ-LNK-001: …`, `### requirement REQ-LNK-001 …`; a `## Requirements` group heading whose bare-name children (`### Clipboard copy`) carry their id on an `**Id:**` line; a `## Modules` group heading whose children are modules; a plain heading that holds requirement headings is read as a module (`MD-DEFAULT-KIND`); a heading that holds neither is transparent (`MD-HEADING`). A requirement heading outside any set is an error (`MD-NO-SET`).

### Labels

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| requirement set | `PRD source` (`PRD`, `Product requirements`), one line per file or a comma list; `Scope` when not in the heading; `Name` when the heading is bare | `prd-source "…"`; `scoped-to X` |
| requirement | `Pattern` (`EARS pattern`, `Type`): ubiquitous, state-driven, event-driven, unwanted, optional, complex | `: pattern` on the id line |
| | `Priority` (`MoSCoW`): must, should, could, wont (`won't` accepted) | `priority …` |
| | `Source` (`Traces to`, `PRD element`, `Origin`) | `source "…"` |
| | `Rationale` (`Why`, `Justification`, `Reason`) | `:: "…"` |
| | the EARS statement as a blockquote `> When …, the system shall …`; or `Statement` (`EARS statement`, `Requirement`, `Shall`); a bare paragraph is accepted with `MD-STATEMENT-PARAGRAPH` | `"…"` |
| | `Depends on` (`Dependencies`, `Prerequisites`); `Conflicts with` (`Conflicts`, `In tension with`); `Decomposed into` (`Decomposes into`, `Children`, `Derived`) — comma lists or bullet lists of ids | `depends-on …`; `conflicts-with …`; `decomposed-into { … }` |
| | `Satisfied by` (`Satisfaction`, `Realized by`, `Traceability`) + list of `<role> Element` items: `implemented-by`, `structured-by`, `enforced-by`, `detected-by`, `quality-constrained-by` (also `implemented by`), and `satisfied-by-infrastructure` (also `Infrastructure`) | `satisfied-by { implemented-by Order."Place order" … }` |
| | `Id` (`Identifier`) when the heading carries no id; `Name` (`Title`) when it carries only the id | the id line |

Several labels may share a line: `**Pattern:** event-driven · **Priority:** must`. Labels may be a bullet list (`- Priority: must`). A missing pattern, statement or priority is an error naming the label (`MD-PATTERN`, `MD-STATEMENT`, `MD-PRIORITY`); a value outside the EARS patterns or MoSCoW levels is an error naming the allowed values; a requirement without a name after its id takes the id as its name (`MD-NAME`).

### Tables, lists and islands

- A **table of requirements** is read anywhere in a set or a module when it has an `id` column and a `statement` column (`| id | name | pattern | priority | statement | source |`; optional `rationale`, `depends on`, `conflicts with`, `decomposed into`, `satisfied by` with ` · `-separated entries). One requirement per row, in order, on the row's line for diagnostics. The writer never emits this form; it exists for short lists and for documents that start as a review table.
- `Satisfied by` is a bullet list (one link per item, the element in inline code). `Depends on`, `Conflicts with` and `Decomposed into` are comma lists.
- The language has no formal fragments, so no `specy` island is needed; a fenced code block under a requirement is reported as unmapped.

### Example

```markdown
---
specy: sysreq
---

# requirements "Link Shortening" scoped-to UrlShortenerContext

**PRD source:** url-shortener.prd

## module Link Shortening

### REQ-LNK-001 Short link generation

**Pattern:** event-driven
**Priority:** must
**Source:** AC-001-01
**Rationale:** Core utility — the fundamental action that brings publishers to the product

> When a publisher submits a URL, the system shall generate a unique short link and return it within 1 second.

**Depends on:** REQ-SAF-001
**Satisfied by:**
- implemented-by `ShortLink."Shorten a URL"`
- structured-by `ShortLink.slug`
```

reads as

```
requirements "Link Shortening" scoped-to UrlShortenerContext {
  prd-source "url-shortener.prd"

  module "Link Shortening" {

    REQ-LNK-001 "Short link generation" : event-driven
      :: "Core utility — the fundamental action that brings publishers to the product"
      source "AC-001-01"
      "When a publisher submits a URL, the system shall generate a unique short link and return it within 1 second."
      priority must
      depends-on REQ-SAF-001
      satisfied-by {
        implemented-by ShortLink."Shorten a URL"
        structured-by ShortLink.slug
      }
  }
}
```

## Software architecture (`.arch`)

A `.arch` document has one root: `# architecture Name` (one system in focus, C4 levels 1–3) or `# organization Name` (level 0, the system landscape). Headings follow containment; one level deeper at each step. The things an architecture has many of and says little about (persons, phases, areas, bounded contexts, imports, connectors) are lists; the things with a body (external systems, systems, containers, components, interfaces, types, channels, environments, hotspots, dependencies, flows) are headings.

### Headings

| Heading | DSL |
|---|---|
| `# architecture Sniplink` | `architecture Sniplink { … }` |
| `# organization RetailMediaCo` (tolerated: `organisation`, `landscape`) | `organization RetailMediaCo { … }` |
| `## external system GoogleSafeBrowsing` (tolerated: `externalSystem`, `external`) | `externalSystem GoogleSafeBrowsing … { provides … }` |
| `## system Sniplink` | `system Sniplink { … }` — in an organization, a level-0 system, detailed inline when it has member sub-headings |
| `### hotspot MonthEndClose` (under a level-0 system) | `hotspot MonthEndClose :: "…" concerns …` |
| `### struct ShortLinkDTO`, `### exception SlugTaken`, `### union Payload`, `### enum Disposition` | the Thrift-typed declarations |
| `### typedef Url` + `**Type:**` (tolerated: `### typedef Url = string`) | `typedef Url = string` |
| `### interface LinkCommands` (tolerated: `contract`, `api`) | `interface LinkCommands { … }` |
| `### container EdgeApi` → `#### component LinkController` | `container EdgeApi { … component LinkController { … } }` |
| `### channel linkEvents on EventBus` (tolerated: `### channel linkEvents` + `**Broker:**`) | `channel linkEvents on EventBus { carries … }` |
| `### Connectors` + a list | one `connect … -> … over "…" sync` per item |
| `### environment production` | `environment production { … }` |
| `## dependency ERP -> CRM` (tolerated: `## ERP → CRM` under `## Dependencies`) → `### flow 1 "Ad products"` | `dependency ERP -> CRM : … { flow 1 "Ad products" carries … }` |
| `## person Visitor`, `## area Finance`, `## phase Phase1`, `### bounded context Shortening`, `### import value type Slug` | tolerated as headings; the canonical form is the list of the same name |

Group headings: `Persons`/`People`, `External systems`, `Systems`, `Dependencies`, `Flows`, `Hotspots`, `Types`/`Structs`, `Exceptions`, `Unions`, `Enums`, `Typedefs`, `Imports`, `Interfaces`/`Contracts`, `Containers`, `Components`, `Channels`/`Topics`, `Environments`/`Deployment`. A bare name under one of them takes its kind (`### EdgeApi` under `### Containers`); `Name (kind)` works anywhere.

### Labels

| Element | Labels (canonical, then aliases) | DSL |
|---|---|---|
| every element | `Metadata` (`Meta`) | `meta { … }` on the head line |
| architecture, organization | `Domain sources` (`Domain source`); `Requirements source`; `Persons` + list `Name — description` | `domain-source "…"`; `requirements-source "…"`; `person Name :: "…"` |
| organization | `Phases` + list; `Areas` + list | `phase Name :: "…"`; `area Name :: "…"` |
| external system | `Realizes`; `Provides`; `Consumes`; `Masters` (level 0) | `realizes …`; `provides X`; `consumes X`; `masters A, B` |
| system (both) | `Satisfies`; `Realizes` (`module "X", context Y, interface Z, event E, value type V`); `Bounded contexts` + list; `Imports` + list `value type X` / `event X` | `satisfies [...]`; `realizes …`; `boundedContext X :: "…"`; `import value type X from domain` |
| system (level 0) | `Technology` (`Product`); `Area`; `Used by` (`Users`); `Masters`; `Handles`; `Detailed in` | `technology "…"`; `area X`; `used-by A, B`; `masters A, B`; `handles A, B`; `detailed-in "…"` |
| hotspot | the description paragraph (required); `Concerns` (`Affects`) — flow numbers and concepts | `hotspot X :: "…" concerns 1, 2, Invoice` |
| struct | `Satisfies`; fields table | `struct X satisfies [...] { 1: required T f }` |
| typedef | `Type` (`Alias of`) | `typedef X = T` |
| interface | `Satisfies`; `Realizes`; a `specy` island of signatures (tolerated: an `Operations` list) | `interface X { op(…) returns T }` |
| container | `Technology` (`Tech`, `Stack`); `Satisfies`; `Realizes`; `Provides`; `Requires` | `container X technology "…" { provides I requires J … }` |
| component | `Satisfies`; `Realizes`; `Bounded context` (`Context`); `Provides`; `Requires`; `Publishes` + list `Message to channel`; `Subscribes` | `component X { boundedContext B provides I publishes M to c subscribes c }` |
| channel | `Carries` (`Messages`, `Events`); `Broker` (`On`) when not in the heading | `channel x on Broker { carries A, B }` |
| environment | a `specy` island with the body (`deploy …`, `node … { … }`, `resource …`); tolerated: `Deploys` + list | `environment x { … }` |
| dependency | `Patterns` (`Pattern`); `Criticality` | `dependency A -> B : ACL, OHS criticality degraded` |
| flow | `Carries` (`AdProduct as Item, X`); `To` (`Receiver`); `Mechanism` (`over "…" manual`); `Phases` + list `Phase1 over "…" manual` | `flow 1 "…" carries … to X over "…" manual`, or `{ phase P1 … }` |

### Tables and islands

- Struct and exception fields: `| # | requiredness | type | field | default | description |`. Tolerated: no `#` column (rows are numbered in order), a `required` yes/no column instead of `requiredness`, `name` for `field`.
- Union: `| # | type | member |`. Enum: `| member | value |`, or a bullet list `- name = 3` (a bare `- name` takes its position).
- Interface operations and environment bodies are `specy` islands in DSL syntax, written by the printer and pasted verbatim.
- Connectors: a list under `### Connectors`, one `` `A -> B over "protocol" sync|async|streaming` `` per item, ` — description` after it; an island of `connect …` lines is also read.
- A list item's ` · meta: key = value` carries the element's metadata (persons, phases, areas, bounded contexts, connectors).

### Example

```markdown
---
specy: architecture
---

# architecture Sniplink

**Domain sources:** sniplink.domain

**Persons:**
- Visitor — Follows a short link

## external system SafeBrowsing

**Provides:** ThreatLookup

## system Sniplink

**Bounded contexts:**
- Shortening — Links and slugs

**Imports:**
- value type Slug

### struct ShortLinkDTO

| # | requiredness | type | field | default | description |
|---|---|---|---|---|---|
| 1 | required | `Slug` | slug | | |
| 2 | optional | `datetime` | expiresAt | | |

### interface LinkCommands

```specy
createShortLink(1: required string target, 2: optional Slug customSlug) returns ShortLinkDTO throws (SlugTaken)
```

### container EdgeApi

**Technology:** Clojure/Ring
**Provides:** LinkCommands

#### component LinkController

**Bounded context:** Shortening
**Provides:** LinkCommands
**Requires:** ThreatLookup

### Connectors

- `Visitor -> EdgeApi.LinkCommands over "HTTPS" sync`
- `LinkController -> SafeBrowsing.ThreatLookup over "HTTPS/REST" async` — circuit-broken
```

A level-0 landscape: `# organization Acme`, `**Phases:**` and `**Areas:**` lists, `## system ERP` with `**Technology:**`, `**Area:**`, `**Used by:**`, `**Masters:**`, `**Handles:**` and `### hotspot …` sub-headings, then `## dependency ERP -> CRM` with `**Patterns:**`, `**Criticality:**` and `### flow 1 "…"` sub-headings carrying `**Carries:**`, `**To:**`, `**Mechanism:**` or `**Phases:**`.

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

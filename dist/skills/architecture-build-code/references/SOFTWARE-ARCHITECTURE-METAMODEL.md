# Software Architecture metamodel

This file defines a **software architecture** metamodel for describing how a software system is structured. It is inspired by the **C4 model** (Context, Containers, Components, Code) but is more detailed in three deliberate ways:

1. **Typed contracts.** Component interfaces are first-class contracts with a Thrift-inspired type system (`struct`, `enum`, `typedef`, `union`, `exception`) carrying field ordinals and `optional`/`required` markers for wire-safety.
2. **Ports and connectors.** Components declare both the interfaces they **provide** and the interfaces they **require**, and connectors wire them with an explicit protocol and interaction style — so the dependency graph, cycles, and layering are machine-checkable.
3. **First-class async.** Asynchronous messaging is modeled as named **channels** with their own message contracts, not as anonymous arrows.

It also adds a level **above** C4's system context. [Level 0](#level-0--organization) describes an organization's system landscape: the systems it runs, the domain concepts each one is the source of truth for, and the dependencies between them. A dependency points from the downstream system to the upstream one, as in the context map of Domain-Driven Design's strategic design, and is detailed by numbered flows that name the domain concepts they carry.

C4's level 4 (Code) is intentionally **out of scope**: code is generated per stack from the logical level-3 description through a separate stack-binding artifact (see [Stack binding](#stack-binding-the-c4-level-4-replacement)).

## Pipeline position

The architecture model sits between the domain model and code generation:

```
prd → sysreq → domain → architecture → code
```

It **satisfies** system requirements (`.sysreq`, including NFRs) and **realizes** domain elements (`.domain` bounded contexts, modules, interfaces, events, value types). It is a standalone model linked to — never derived from — the domain model. A domain module may be realized by several components, and a component may realize several modules (many-to-many). At level 0, a system realizes bounded contexts and names the entities and aggregates it masters, and each flow names the concepts it carries.

Level 0 is often written first, ahead of the rest of the pipeline: a landscape of bought software can be mapped before any domain model exists. Its concept names then stay plain names until a `.domain` is written, and resolve against it from then on (see [Concept reference](#concept-reference)).

## What this metamodel is NOT

- It is **not** the DDD bounded context boundary. C4 *System Context* (a system as a box surrounded by people and external systems) is a different boundary than a DDD *bounded context* (a model/language boundary). This metamodel keeps both: level 1 is the C4 system-context, and bounded context is an optional grouping **below** it (see [Bounded Context](#bounded-context)). At level 0 a system realizes bounded contexts and its dependencies must agree with their context map, but a system is still not a context: one system may realize several contexts, and one context may be realized by several systems.
- It is **not** an enterprise architecture model. Level 0 records which systems an organization runs, what they master and how they depend on each other. Goals, capabilities, team ownership, governance rules and the plateaus of a transformation belong to the enterprise layer (`ENTERPRISE-ARCHITECTURE-METAMODEL.md`), which refers to level-0 elements by name.
- It is **not** a data-lineage model. A level-0 flow names the concepts it carries between two systems; lineage between schemas, field by field, is out of scope.
- It is **not** an infrastructure model or a CMDB. The [deployment view](#deployment-view) records environments, the nodes containers run on and the resources where data lives — the placement and residency facts that architecture rules test. Capacity, networking and the inventory of every running instance are out of scope.
- It does **not** carry interface versioning or compatibility machinery. Field ordinals and `optional`/`required` give wire-safety; version negotiation and compatibility policy are left to the team.

## Convention

Every concept in this metamodel carries a **name**, a **description**, a **metadata** map (arbitrary key/value pairs), a **satisfies** list (zero or more system requirement identifiers), and a **realizes** list (zero or more domain element references). These attributes are implicit and not repeated in each definition below.

- **satisfies** is the traceability bridge to the system requirement layer (`SYSTEM-REQ-METAMODEL.md`). When system requirements are provided and carry identifiers (e.g. `NFR-PERF-001`), every architecture element that realizes a requirement MUST list the corresponding identifier(s). NFRs in particular drive architecture and should appear on the elements that address them.
- **realizes** is the traceability bridge to the domain layer (`DOMAIN-METAMODEL.md`). A system realizes domain bounded contexts; a component realizes domain `module`(s); an interface may realize a domain `interface`; a channel's message types may import domain `event`s; struct fields may import domain `value type`s.

When the inputs are loaded from files, the model declares the provenance at the top level:
- **requirements-source** — relative path to the `.sysreq` file the `satisfies` identifiers refer to.
- **domain-source** — relative path to the `.domain` file the `realizes` references, `import … from domain` statements and level-0 concept references resolve against. It may be repeated: an organization often keeps one `.domain` file per bounded context, and references then resolve against all of them.

This makes both bridges explicit and machine-resolvable — any tool can follow the paths to check coverage or detect drift.

## Architecture (root)

A `.arch` file has one of two roots:

- **`architecture`** — one software system in focus and its neighbors: levels 1 to 3. Described in this section.
- **`organization`** — several systems of one organization and the dependencies between them: level 0. Described in [Organization](#organization).

The `architecture` root scopes **one software system in focus** plus its neighbors (the people and external systems it interacts with). Multiple systems are modeled in multiple files, or together in one organization file. `organization` is an alternative root, not a wrapper around `architecture`: an `architecture` file never contains level-0 clauses, dependencies or phases. It details a system of an organization only when that system's `detailed-in` names the file (see [Detailing a system](#detailing-a-system)).

```
architecture ShortLinkPlatform :: "URL shortening platform — architecture" {
  domain-source "specy/urlshortener.domain"
  requirements-source "specy/urlshortener.sysreq"

  // level 1: persons + external systems + the one system in focus
  // …
}
```

Relations:
- 1..1 "focuses on" relation with a system (the system in focus)
- 0..n "has" relation with persons
- 0..n "has" relation with external systems
- 0..1 "details" relation with a system of an organization (when that system's `detailed-in` names this file)

---

## Level 0 — Organization

Level 0 describes an organization's **system landscape**: the systems it runs, grouped as the business sees them, what each one is for and is the source of truth for, and how they depend on each other. It corresponds to C4's *System Landscape* diagram, with two differences that come from Domain-Driven Design:

- **An arrow means "depends on", not "sends data to".** A dependency points from the downstream system to the upstream one, as in the context map of strategic design. Read backwards it answers the impact question: *if I change this system, which systems are affected?* Data may travel either way along a dependency; each flow states its own direction.
- **Flows name domain concepts.** A flow does not say "integration #4"; it says which entities, aggregates or events it carries, and when a `domain-source` is present each name resolves to one element of the domain model.

A system declared at level 0 may stay a black box — typically a bought product whose inside nobody will model — or be detailed in levels 1 to 3, in the same file or in its own. Level 0 exists only under an `organization` root: an `architecture` file never contains level-0 clauses, dependencies or phases.

### Organization

The root of a level-0 `.arch` file: the organization whose systems are described. It is the same thing as the `organization` of the domain metamodel, under the same name, seen from its systems instead of its bounded contexts. It is an alternative root, not a wrapper around `architecture` files. Its members, in any order, are the domain sources its concept references resolve against, the phases of its integration roadmap, its areas, persons and external systems, its systems, and the dependencies between them.

```
organization RetailMediaCo :: "A retail-media network selling on-site and off-site advertising" {
  domain-source "retail-media.domain"

  phase Phase1 :: "Go-live of the finance stack; flows without a ready-made connector run on manual files"
  phase Phase2 :: "Most manual steps automated, mostly through APIs"

  area FinanceOffice   :: "Accounting, treasury, supplier spend and group reporting"
  person FinanceStaff  :: "Accountants, treasurers and the group controller"
  externalSystem Banks :: "The company's banks" { masters BankStatement }

  system ERP :: "Financial accounting, reporting, analysis and tax" technology "NetSuite" { … }
  system CRM :: "Advertisers, sales pipeline and signed sales orders" technology "Salesforce Sales Cloud" { … }

  dependency ERP -> CRM : ACL, OHS { … }
  dependency CRM -> ERP : Conformist { … }
}
```

Relations:
- 0..n "resolves against" relation with domain sources (`.domain` files)
- 0..1 "resolves against" relation with a requirements source
- 0..n "has" relation with phases (in declaration order)
- 0..n "has" relation with areas
- 0..n "has" relation with persons
- 0..n "has" relation with external systems (outside the organization)
- 1..n "has" relation with systems
- 0..n "has" relation with dependencies
- 0..1 "corresponds to" relation with the domain `organization` of the same name

### Area

An optional grouping of systems as the business sees its landscape — usually a department and the people working in it. An area is declared once at organization scope and referenced by each system it groups; a system sits in at most one area. Like the [bounded context](#bounded-context) grouping of components, an area carries no runtime meaning: it records where a system sits in the landscape.

An area is not the set of a system's users. A spend platform sits in the finance office's area while every employee uses it to approve invoices; users are stated per system, with `used-by`. Nor is an area a bounded context: it groups systems the way the organization chart does, while a context is a model boundary. The two rarely coincide, and distinct names keep one from being read as the other.

```
area FinanceOffice :: "Accounting, treasury, supplier spend and group reporting"

system SpendPlatform :: "Captures, approves and archives supplier invoices" technology "Basware" {
  area FinanceOffice
  used-by FinanceStaff, AllEmployees
}
```

Relations:
- 0..n "groups" relation with systems (a system references at most one area)
- 1..1 "belongs to" relation with the organization

### Phase

A named stage of the organization's integration roadmap — "Phase 1: integrations by file", "Phase 2: integrations by API" — during which a flow's mechanism holds. Phases are declared at organization scope, and their declaration order is their chronological order.

A phase changes **how** a flow is carried, never **whether** it exists. Which systems and flows exist in which state of the landscape is the enterprise layer's concern: there, a phase corresponds by name to a plateau.

```
phase Phase1 :: "Go-live of the finance stack; flows without a ready-made connector run on manual files"
phase Phase2 :: "Most manual steps automated, mostly through APIs"
```

Relations:
- 1..1 "belongs to" relation with the organization
- 0..n "times" relation with flow mechanisms (see [Flow](#flow))
- 0..1 "corresponds to" relation with an enterprise plateau of the same name

### System at level 0

At level 0 a [system](#system) is described from the outside, by what the business needs to know about it:

- **Name** — its role in the organization (`ERP`, `CashManagement`, `CampaignHub`), not the product that implements it. The name outlives a change of product.
- **Purpose** — its `::` description, which at level 0 states the system's responsibilities. Every system of an organization states one; this is a validation rule, not a grammar rule.
- **Technology** — for a bought system, the product that implements it as a whole (`technology "NetSuite"`), with the same meaning as a container's technology. A system built in-house usually leaves it out: its technologies are on its containers.
- **Area** — the [area](#area) it sits in.
- **Used by** — the [persons](#person-actor) who work with it.
- **Masters / handles** — the main domain concepts it holds, and among them those it is the source of truth for (see [Handled and mastered concepts](#handled-and-mastered-concepts)).
- **Hotspots** — where operating it is fragile or costly (see [Hotspot](#hotspot)).
- **Realizes** — the bounded contexts it realizes (`realizes context Finance`). They scope its concept references and tie its dependencies to the context map.
- **Detail** — optionally, its containers and components, inline or in its own file (see [Detailing a system](#detailing-a-system)).

The body is optional: a system with no clause at all is a name, a purpose and a product. Level-0 clauses come first in the body, before any member of levels 2–3. They may be repeated: repeated `used-by`, `masters` and `handles` lists merge, while `area` and `detailed-in` appear at most once.

Three metadata keys are conventional, so that tools can show them without the language giving them a meaning:

- `status` — the status of the system's target definition: `"candidate"` while the target is discussed, `"target finalized"` once it is agreed;
- `contacts` — a `;`-separated list of contacts, by role;
- `documents` — a `;`-separated list of documents, each written `Label <url>`.

Accountability for a system is the enterprise layer's ownership, not a contact list.

```
system ERP :: "Financial accounting, reporting, analysis and tax under local and group accounting standards"
    meta { status    = "target finalized"
           contacts  = "ERP product owner (Finance); integration partner lead"
           documents = "ERP online help <https://wiki.example.com/finance/erp-help>; Integration design <https://wiki.example.com/finance/erp-integrations>" }
    technology "NetSuite"
    realizes context Finance {
  area FinanceOffice
  used-by FinanceStaff
  masters Customer, Vendor, Item, Invoice, JournalEntry, Payment
  handles BankStatement
  hotspot MonthEndClose :: "Until phase 2 the monthly close waits on six manual file imports" concerns 1, 2, 3, 6, 16, 18
}
```

Relations (in addition to those of [System](#system)):
- 0..1 "sits in" relation with an area
- 0..n "used by" relation with persons
- 0..n "masters" relation with domain concepts (entities and aggregates)
- 0..n "handles" relation with domain concepts
- 0..n "has" relation with hotspots
- 0..n "realizes" relation with bounded contexts
- 0..1 "detailed in" relation with a single-system `.arch` file
- 0..n "depends on" relation with systems and external systems (through dependencies)

#### Handled and mastered concepts

`masters` lists the concepts the system is the **system of record** for: where an instance is created and where its truth lives; every copy of that concept elsewhere derives from it. A system may master a concept it creates from another system's data: the ERP masters its `Customer` even though each customer starts as a CRM `Account` (`carries Account as Customer`). What it masters is its own concept, not the one it was made from. `handles` lists the other main concepts the system holds: copies, projections, documents it receives and works on. A mastered concept is handled too, and is not listed twice.

Both lists name the system's **main** concepts, chosen to explain it; they are not an inventory. What a system receives and sends is known from its flows.

Only a concept with identity has a system of record, so `masters` names entities and aggregates. In the domain model, a mastered concept is either an entity or aggregate of a bounded context the system realizes, or a read-only entity whose `sourced-from` names this system — which is how a domain model records a master it does not own. An external system may master concepts as well: a bank masters its account statements, which the treasury context holds as a read-only entity sourced from the bank.

A concept is mastered by at most one system, counting the organization's systems and its external systems. Two masters for one concept is the classic landscape defect — two places where the truth can be changed — and is reported.

### Hotspot

A known point of fragility or effort in operating a system: a manual step the monthly close waits on, a double entry that drifts, a file format that breaks every time a bank upgrades it. Hotspots are where an architecture change pays off first, and what an operations team needs to know before touching the system.

A hotspot has a name and a description, both required, and may name what it concerns: flows, by number, and domain concepts. The flows it names have the system at one end.

```
hotspot MonthEndClose
    :: "Until phase 2 the monthly close waits on six manual file imports; one late export delays it"
    concerns 1, 2, 3, 6, 16, 18
```

A hotspot is not a decision. An impactful decision — "the CRM conforms to the ERP's chart of products" — is an architecture decision record of the enterprise layer, which names the systems it affects; a hotspot may cite its identifier in its description.

Relations:
- 1..1 "belongs to" relation with a system
- 0..n "concerns" relation with flows (by number) and domain concepts

### Dependency

A directed relation between two systems: the **downstream** system depends on the **upstream** one. It reads *A depends on B* and is written `A -> B`. Read backwards, it is an impact: changing B may break A.

The direction is that of the **need**, as in strategic design: A is downstream because it cannot do its job without what B holds or does. It is not the direction of the call. Most often the two coincide — the downstream system calls the upstream one, as a [connector](#connector) goes from consumer to provider — but when the upstream system pushes what it holds into the downstream system's API, the connector points the other way and the dependency does not change: the receiver still depends on the source.

Direction and patterns follow the context map of the domain metamodel. A dependency carries context-map patterns — at most one per row of the table below — and each pattern belongs to one row, so their order does not matter:

| Side | Patterns | On this dependency |
|---|---|---|
| downstream (left of `->`) | `CS`, `Conformist`, `ACL` | how the downstream system takes what it depends on |
| upstream (right of `->`) | `OHS` | the upstream system offers one protocol for all its consumers |
| both | `SharedKernel`, `PublishedLanguage` | what the two systems share |
| both, on a mutual pair | `Partnership` | the two systems' teams adapt to each other and succeed or fail together |

`SeparateWays` is never written on a dependency: separate ways is the absence of a dependency. `Partnership` is written explicitly. When A depends on B and B depends on A, the two dependencies either both carry `Partnership` or neither does; it never stands on a one-way dependency, and it excludes `CS`, `Conformist`, `ACL` and `OHS` on the same dependency, since partners neither conform nor translate on one side only. It may stand next to `SharedKernel` or `PublishedLanguage`: partners often share one. Two opposite dependencies without it are a **mutual dependency**: two independent directional relations, each with its own patterns. Either way the pair stays two dependencies, each with its own patterns and flows — a single two-headed edge would lose which side translates what.

```
dependency ERP -> CRM : ACL, OHS :: "Billing needs the CRM's products, accounts and billing schedule" { … }
dependency CRM -> ERP : Conformist :: "Sales sees invoice status and master data as the ERP defines them" { … }
// two opposite dependencies without Partnership: ERP and CRM are a mutual dependency

dependency CampaignHub -> CRM : Partnership :: "Campaigns are booked from signed sales orders" { … }
dependency CRM -> CampaignHub : Partnership :: "Account managers show advertisers the hub's delivery" { … }
// Partnership written on both: CampaignHub and CRM are partners
```

Either end may be an external system (`CashManagement -> Banks : PublishedLanguage`); at least one end is a system of the organization. Patterns are optional — a landscape is often mapped before anyone has decided who translates — and a dependency between two systems that realize the same bounded context has none, since no context boundary is crossed.

**Criticality.** A dependency may state what happens to the downstream system when the upstream one is unavailable. It is written after the patterns:

| Criticality | If B is down |
|---|---|
| `critical` | A is down |
| `degraded` | A keeps running with reduced service |
| `tolerant` | no user-visible impact |

Without the clause, criticality is unstated, which is not the same as `tolerant`: nobody has said yet. Read backwards along the `critical` dependencies, the graph answers the outage question — *if this system goes down, which systems go down with it?* — that is, the system's blast radius (see [Checks enabled by level 0](#checks-enabled-by-level-0)).

```
dependency CRM -> ESignature : ACL, OHS criticality degraded
    :: "Contracts wait for signature while the e-signature service is down; selling goes on" { … }
```

**Agreement with the context map.** When both systems realize bounded contexts and a domain source declares their context map, the dependency agrees with it. In a context map, each entry is written by a context about itself: the keyword is the declaring context's **own** position, and the pattern is its own. Inside context `X`, `downstream Y : ACL` says that `X` is downstream of `Y` and protects itself with an Anti-Corruption Layer; `upstream Y : OHS` says that `X` is upstream of `Y` and offers it an Open Host Service; a `symmetric Y : …` entry relates the two without a position. So `dependency ERP -> CRM : ACL, OHS`, with the ERP realizing `Finance` and the CRM realizing `Sales`, agrees with `downstream Sales : ACL` written in `Finance` and with `upstream Finance : OHS` written in `Sales`. An entry that makes `Finance` upstream of `Sales` contradicts it, unless the reverse dependency also exists: a mutual dependency agrees with directional entries for each of its two directions, and a Partnership pair with `symmetric … : Partnership` written in both contexts' maps.

The check decides the cases below. "The pair" is a context of the downstream system and a context of the upstream system.

| Case | Decision |
|---|---|
| Both contexts write the pair, consistently | Direction and every written pattern must match the dependency's |
| Only one of the two contexts writes the pair | Checked against that entry alone; the dependency's pattern for the silent side is neither confirmed nor contradicted |
| The upstream side has no `OHS` | It cannot write an entry (`OHS` is the only upstream pattern), so the pair is known from the downstream's entry alone — the previous case |
| The two contexts contradict each other (both claim the same position) while no system of one context depends on a system of the other in the opposite direction | Reported as a defect of the domain model; the dependency is not checked against them. When dependencies run both ways between the systems of the two contexts, the same entries are legitimate — each context is downstream in one direction — and each dependency is checked against the entry of its own direction |
| The dependency states no pattern for a side the map writes | Agrees, if the direction matches; a tool may propose the map's pattern |
| The dependency states a pattern the map contradicts for the same side | Reported |
| `symmetric Y : SharedKernel` or `PublishedLanguage` | Agrees with a dependency in either direction that carries the same shared pattern, or none |
| `symmetric Y : SeparateWays` | Any dependency between the two contradicts it |
| A Partnership pair (both dependencies carry `Partnership`) | Agrees with `symmetric … : Partnership` written in both contexts' maps; `Partnership` in one map only, or a directional pattern entry for the pair, is reported |
| A mutual dependency (opposite dependencies without `Partnership`) | Each direction is checked against the directional entries, like a one-way dependency; a `symmetric … : Partnership` in the maps is reported, since the landscape does not declare it |
| A context realized by two systems (`Spend`: the spend platform and the expense tool) | Every dependency between a system of one context and a system of the other is checked against the map relation of its own direction; two such dependencies with different patterns for the same side are reported, since a map writes one |
| A system realizing several contexts | The dependency is checked against every pair the maps write; it agrees if at least one pair agrees and none contradicts. If the maps write none of its pairs, the dependency is reported as missing from the context map |
| Both systems realize the same context | No map relation exists or is needed; a pattern on the dependency is reported |

Relations:
- 1..1 "from" relation with the downstream system (system or external system)
- 1..1 "to" relation with the upstream system (system or external system)
- 0..1 downstream pattern (`CS` | `Conformist` | `ACL`)
- 0..1 upstream pattern (`OHS`)
- 0..1 shared pattern (`SharedKernel` | `PublishedLanguage`)
- 0..1 `Partnership` (both sides; only on a mutual pair, written on both of its dependencies; excludes the downstream and upstream patterns)
- 0..1 criticality (`critical` | `degraded` | `tolerant`); unstated when absent
- 0..n "detailed by" relation with flows
- 0..n "agrees with" relation with context-map relations (between the bounded contexts the two systems realize)

Constraints: at most one dependency per ordered pair of systems; no dependency from a system to itself.

### Flow

One exchange along a dependency: a numbered, named movement of domain concepts between the two systems. A flow has:

- a **number**, unique within the organization, so that diagrams, tables and conversations can cite it ("flows 1, 2 and 3"). By convention a number is never reused once its flow is retired;
- a **label**, in business language;
- the **concepts it carries**, each optionally followed by `as` and the concept it becomes in the receiving system (see below);
- a **direction**: data goes from the upstream system to the downstream one unless the flow names the receiving end with `to`. The direction of the data is independent of the direction of the dependency: a CRM that depends on an e-signature service still sends it the contracts to sign;
- a **mechanism** — how the concepts travel: the medium (`over`, as on a connector) and whether a person performs the transfer (`manual`) or not (`automated`). A mechanism states at least one of the two. The mechanism is stated once, and then holds in every phase, or per phase. A flow may also state no mechanism at all: how it is carried is then undecided, and tools show it as open.

The interaction style and the interface that carries the data belong to the connectors that realize the flow at levels 2–3, not to the flow.

```
dependency ERP -> CRM : ACL, OHS {
  flow 2 "Accounts" carries Account as Customer {
    phase Phase1 over "CSV file export/import" manual
    phase Phase2 automated
  }
}
dependency ERP -> Payroll : ACL {
  flow 18 "Payroll journal" carries PayrollRun as JournalEntry over "file export/import" manual
}
dependency CRM -> ESignature : ACL, OHS {
  flow 32 "Contracts sent for signature" carries Contract as Envelope to ESignature
    over "eSignature REST API" automated
  flow 33 "Signed contracts" carries Envelope as Contract over "Connect webhook" automated
}
```

**Translation.** `carries X as Y` says that `X`, in the sender's model, **becomes** `Y` in the receiver's model. It covers a renaming — `Account as Customer` — and a transformation — `SalesOrder as Invoice`, where the ERP makes an invoice out of a billing line — alike. The receiver may master `Y`: the ERP is the system of record for the customers and invoices it creates from what the CRM sends. Without `as`, the receiver takes the sender's concept as it is. A `Conformist` downstream never translates, so the flows it receives carry no `as`.

**Phases.** With the per-phase form, a phase the flow does not list is undecided for that flow, and tools show it as open. A flow that exists in some phases only cannot be expressed here: existence over time is a plateau concern of the enterprise layer.

**Manual flows.** A manual flow — a file exported and imported by hand, a double entry — has no connector at levels 2–3. It is still a flow: it carries concepts and creates a dependency — the system that receives the concepts depends on the one they come from — and it is usually a hotspot.

Relations:
- 1..1 "belongs to" relation with a dependency
- 1..n "carries" relation with domain concepts, each with an optional concept it becomes in the receiver (`as`)
- 1..1 "goes to" relation with one end of its dependency (default: the downstream system)
- 0..1 mechanism, or 1..n per-phase mechanisms (at most one per phase); a mechanism has 0..1 medium (`over`) and 0..1 `manual` | `automated`, at least one of the two

### Concept reference

Level-0 clauses name domain concepts: `masters` and `handles`, the `carries` of a flow, and the `concerns` of a hotspot. A concept reference is a domain type name — `Invoice` — or a name qualified by its bounded context — `Finance.Invoice`.

Without a `domain-source`, references are plain names: a landscape of bought software often has no domain model, and level 0 is useful before one exists. When the organization declares one or more domain sources, each reference resolves to **exactly one** element of the domain model, so that any tool can link it, or it is reported.

**Referable kinds.** A reference designates an entity, an aggregate, a read-only entity, a value type, an enum or an event of any kind. Read-only entities and external events are **copies**: they stand for something owned elsewhere. The other kinds are **owning** definitions. A name that designates any other kind of definition (a command, a service) is an error.

**One name, one resolution.** Every reference is attached to one system and resolves once, for that system. A name in `masters`, `handles` or a hotspot is attached to the system that declares the clause. In `carries X as Y`, `X` is attached to the sender and `Y` to the receiver; without `as`, the flow holds a single reference, attached to the sender.

1. **Qualified** — `Finance.Invoice` designates the definitions named `Invoice` in the bounded context `Finance`.
2. **Bare, in the system's own contexts** — the name is first looked up in the contexts the system realizes. A local definition wins, whether it is a copy or not: the CRM's `handles Invoice` designates `Sales.Invoice`, its read-only copy.
3. **Bare, organization-wide** — otherwise the name is looked up in every context of every domain source, and a copy is ignored when an owning definition of the same name exists: a bare `Invoice` attached to a system that realizes no context designates `Finance.Invoice`, not the CRM's copy.

At every step, one match resolves the reference; several matches — in different contexts, or inside one context — make it ambiguous; none leaves it unresolved. An ambiguous reference is reported; it is fixed by qualifying it or, when the duplicates are in one context, in the domain model.

Two situations defeat resolution and are reported as such: a context name declared in two domain sources, which makes every reference qualified by it ambiguous; and a domain source that elides its context (it starts at a module or a bare definition), which leaves its definitions nothing to be qualified with.

So `carries Invoice` from the ERP to the CRM is one reference, attached to the ERP, designating `Finance.Invoice`. That the CRM keeps its own copy, `Sales.Invoice`, is not a second resolution but a fact the checks verify: the copy must be sourced from the ERP or from a context the ERP realizes.

**Unresolved names.** An unresolved name is accepted only when acknowledged by a `// NOTE:` comment. Any occurrence of the name may carry it, on the same line or on the comment-only lines directly above (a note may run over several consecutive comment lines; a blank line ends it). It covers every unresolved name of the line it annotates, and every other use of those names in the file.

An organization with one `.domain` file per bounded context declares them all:

```
organization RideNow {
  domain-source "ride-management.domain"
  domain-source "payment.domain"
  domain-source "driver-management.domain"
  // …
  system Reporting :: "Operational dashboards" {
    // the qualified form is always accepted; it is required only when a bare name is ambiguous
    handles Payment.RefundRequest, RideManagement.Ride
  }
}
```

Relations:
- 1..1 "attached to" relation with a system
- 0..1 "qualified by" relation with a bounded context
- 0..1 "resolves to" relation with a domain element (entity, aggregate, read-only entity, value type, enum, event or external event); none when unresolved and acknowledged

### Detailing a system

A system of an organization is detailed in one of two ways, or not at all:

- **Inline** — its body holds, after its level-0 clauses, whatever the system of a single-system file may contain: types, interfaces, bounded-context groupings, containers, components, channels, connectors and environments.
- **In its own file** — `detailed-in "partner-portal.arch"` names a single-system `.arch` file whose system in focus has the same name. The path is relative to the organization file. A tool follows it; it never searches for the file.

A system is detailed at most once. A system that is not detailed is a **black box**: it has no containers, and everything known about it is at level 0. The 1..n containers of [System](#system) apply to the system in focus of an `architecture` file; a system of an organization has 0..n.

```
system PartnerPortal :: "Lets advertisers follow their campaigns and download their invoices" {
  area Commercial
  handles Campaign, Invoice
  detailed-in "partner-portal.arch"   // architecture PartnerPortal { system PartnerPortal { container … } }
}
```

When the detail is in its own file, the organization file is authoritative for the system's description, technology, `realizes` and metadata. The detail file's `system` has the same name; it need not repeat the description, `realizes` or metadata, and one that states them differently is reported (a single-system file's `system` has no `technology`). The detail file holds levels 1 to 3 only: it sees the organization's other systems as it would in any single-system file, as external systems of the same name, addressed as black boxes or through the interfaces they provide.

**Names and connectors in an inline detail.** The names a system body declares — types, interfaces, containers, components, channels — are local to that system: two systems may each have a `Console`. The organization's names — systems, external systems, persons, areas, phases — are visible everywhere. A connector is written in the system that owns its consumer end; when the consumer is a person, an external system or a black-box system, it is written in the system that owns its provider end, as in a single-system file. An endpoint in another system detailed inline is written `System.Container[.Interface]`; a bare system name targets that system as a black box, which is the only way to address a system that is not detailed inline.

```
system CampaignHub … {
  …
  container SyncWorker technology "Kotlin"
  connect SyncWorker -> CRM over "Salesforce Pub/Sub API" async           // CRM as a black box
  connect CRM -> DeliveryReporting.DeliveryQueries over "REST/JSON" sync  // black-box consumer: written here
}
```

**External system or peer.** In an organization file, `externalSystem` means outside the organization: a bank, a tax authority, a partner's platform. Another system of the same organization is a `system`, even as a black box. In a single-system file, `externalSystem` keeps its meaning — outside the system in focus — and covers both cases: when an organization's `detailed-in` names the file, an external system whose name matches a system of that organization is that peer; any other is outside the organization.

### Level 0 syntax

The concrete syntax of level 0, in the EBNF style of the grammar files. `String` is a string literal, `TypeName` a `PascalCase` name, `Integer` a positive integer; `description`, `meta`, `satisfies` and `realizes` are the productions every `.arch` construct already uses.

```
organization  = "organization" TypeName [description] [meta] "{" { member } "}"
member        = "domain-source" String                          (* 0..n *)
              | "requirements-source" String                    (* 0..1 *)
              | phase | area | person | externalSystem | system | dependency
phase         = "phase" TypeName [description] [meta]
area          = "area" TypeName [description] [meta]
externalSystem= "externalSystem" TypeName [description] [meta] [realizes]
                [ "{" { "provides" TypeName | "consumes" TypeName | masters } "}" ]
system        = "system" TypeName [description] [meta] ["technology" String] [satisfies] [realizes]
                [ "{" { level0Clause } { systemMember } "}" ]   (* the body is optional *)
level0Clause  = "area" TypeName                                 (* at most once *)
              | "used-by" TypeName { "," TypeName }
              | masters
              | "handles" conceptRef { "," conceptRef }
              | hotspot
              | "detailed-in" String                            (* at most once *)
masters       = "masters" conceptRef { "," conceptRef }
hotspot       = "hotspot" TypeName description [meta] ["concerns" concernRef { "," concernRef }]
concernRef    = Integer | conceptRef                            (* Integer: a flow number *)
dependency    = "dependency" TypeName "->" TypeName [":" pattern { "," pattern }]
                ["criticality" criticality] [description] [meta] [ "{" { flow } "}" ]
pattern       = "CS" | "Conformist" | "ACL" | "OHS" | "SharedKernel" | "PublishedLanguage" | "Partnership"
criticality   = "critical" | "degraded" | "tolerant"            (* absent: unstated *)
flow          = "flow" Integer String [description] [meta]
                "carries" carried { "," carried } ["to" TypeName]
                ( [mechanism] | "{" phased { phased } "}" )
phased        = "phase" TypeName mechanism
carried       = conceptRef ["as" conceptRef]
mechanism     = "over" String ["manual" | "automated"] | "manual" | "automated"
conceptRef    = [TypeName "."] TypeName                          (* [Context.]Concept *)
connectorEnd  = … | TypeName                                    (* another system, as a black box *)
              | TypeName "." TypeName ["." TypeName]            (* System.Container[.Interface] *)
```

`systemMember` is everything a system of a single-system file may contain. Comments are legal wherever a member or a clause is, including last in a block. The words of level 0 — `organization`, `phase`, `area`, `used-by`, `masters`, `handles`, `hotspot`, `concerns`, `detailed-in`, `dependency`, `criticality`, `critical`, `degraded`, `tolerant`, `flow`, `as`, `manual`, `automated` and the pattern names, as well as `to`, `carries` and `over`, which levels 1–3 already use — are contextual, not reserved: they remain usable as names elsewhere. A flow number is a positive integer, written without a sign.

### Checks enabled by level 0

Each check is a query over the organization file, the files that detail its systems and its domain sources. Those marked *informational report* list facts for a reader to weigh; the others are rules a model either satisfies or violates.

| Check | Needs |
|---|---|
| A concept is mastered by at most one system, counting the organization's systems and its external systems. Concepts are compared as resolved domain elements when a domain source is declared — two homonyms in different contexts are two concepts — and by name otherwise | — |
| `masters` names an entity or aggregate of a context the system realizes, or a read-only entity whose `sourced-from` names the system | domain source |
| When the receiver's own contexts hold a copy of a carried concept — a different definition of the same name, or the `as` target when it is a read-only entity — that copy is `sourced-from` the sending system or a context the sender realizes | domain source |
| The sender of a flow holds what it sends: it masters or handles it, receives it through another flow, or finds it in a context it realizes (an external system is not checked: what it holds is outside the organization). The receiver holds it by receiving it — so both ends of every flow handle its concepts | — |
| *Informational report:* every entity or aggregate a system holds without mastering it traces back through flows (following `as`) to the system that masters it | — |
| On a dependency whose downstream side is `Conformist`, the flows the downstream receives carry no `as` | — |
| A dependency's direction and patterns agree with the context map of the contexts its two systems realize (see the cases under [Dependency](#dependency)) | domain source, `realizes context` |
| `Partnership` is written on both dependencies of a pair or on neither, never on a one-way dependency, and never with `CS`, `Conformist`, `ACL` or `OHS` | — |
| *Informational report:* cycles of more than two dependencies | — |
| *Informational report:* the blast radius of each system — the transitive closure of the `critical` dependencies pointing at it, that is, every system that goes down when it does | — |
| When either system of a dependency is detailed: every connector between the two systems is covered by a dependency on that pair, in either direction, and every automated flow between them is realized by at least one such connector | detail |
| The persons connected to a detailed system are among its `used-by`, and conversely | detail |
| Flow numbers are unique; there is one dependency per ordered pair; `to` names an end of the dependency; referenced phases are declared; a flow lists a phase at most once; a hotspot concerns flows of its own system; `area` and `detailed-in` appear at most once per system; every system states its purpose; a `detailed-in` file's system has the same name, and does not contradict the organization's description, `realizes` or metadata for it | — |
| Every unresolved concept reference is acknowledged by a `// NOTE:` | domain source |
| *Informational report:* flows that state no mechanism, and flows that leave a phase undecided, are listed as open | — |

---

## Level 1 — System Context

Level 1 describes the system in focus as a single box, surrounded by the people who use it and the external systems it talks to. This is the C4 *System Context* view. In an organization file, the level-1 view of any system follows from level 0: the system, the persons that use it, and the systems at the other end of its dependencies.

### System

A software system: what an organization funds, runs and replaces as one unit. In a single-system file it is the software system being designed, the single subject of the file, and it contains the structural decomposition (containers, components), the shared contracts (interfaces and types), the channels, the connectors, and the deployment view. In an organization file there are several systems, each described at level 0 (see [System at level 0](#system-at-level-0)) and detailed or not (see [Detailing a system](#detailing-a-system)).

Relations:
- 1..n "contains" relation with containers for the system in focus of an `architecture` file; 0..n for a system of an organization (none for a black box)
- 0..n "declares" relation with interfaces and types (shared contracts visible system-wide)
- 0..n "declares" relation with bounded contexts (optional groupings over components)
- 0..n "declares" relation with channels
- 0..n "declares" relation with connectors
- 0..n "declares" relation with environments

### Person (Actor)

A human role that interacts with the system — an end user, an operator, an administrator. A person is a source or sink of interactions, never a container. In an organization file, persons are the populations that use the organization's systems (a department, all employees, customers), and systems name them with `used-by`.

```
person Visitor   :: "An anonymous end-user who follows short links"
person Registrar :: "A registered user who creates and manages short links"
```

Relations:
- 0..n "uses" relation with the system, a container, or a provided interface (expressed as connectors, or at level 0 as the system's `used-by`)

### External System

A software system **outside** the boundary of the system in focus that it integrates with — a third-party API, a partner platform, an upstream service, a SaaS. An external system is opaque: it is not decomposed into containers or components. It may **provide** interfaces (that our system requires) and **consume** interfaces (that our system provides), and it participates in connectors and channels exactly like an internal element — so the dependency graph includes external edges.

Which boundary it is outside of depends on the file. In a single-system file it is outside the system in focus, and may be another system of the same organization. In an organization file it is outside the organization; the organization's own systems are `system`s there, even as black boxes (see [Detailing a system](#detailing-a-system)). At level 0 an external system may be an end of a dependency and may master concepts: a bank masters its account statements.

```
externalSystem Analytics :: "Segment click-analytics platform" {
  provides AnalyticsIngest      // an interface our system can call
  consumes ClickExport          // an interface of ours it reads
}
```

An external system may be linked to the domain layer: it often corresponds to the upstream context that sources a read-only entity (master data) or emits the external events the domain consumes.

Relations:
- 0..n "provides" relation with interfaces
- 0..n "consumes" relation with interfaces
- 0..1 "corresponds to" relation with a domain upstream bounded context or external-event source (via `realizes`)
- 0..n "masters" relation with domain concepts (level 0)

---

## Bounded Context

A bounded context is an **optional** grouping over components — the DDD model/language boundary projected onto the architecture. It is declared at system scope and referenced by components through an optional tag. Because the link is optional and lives at the component level, a single container may host components belonging to several bounded contexts (a modular monolith), and a single bounded context may span components across several containers (microservices). The grouping carries no runtime meaning; it records which model boundary a component belongs to.

```
boundedContext LinkManagement :: "Creation and lifecycle of short links"
boundedContext ClickAnalytics :: "Click capture and reporting"
```

At level 0 a whole system names the domain bounded contexts it realizes (`realizes context Finance`); the grouping here is finer, component by component, and uses the same names.

Relations:
- 0..n "groups" relation with components (a component references at most one bounded context)
- 1..1 "belongs to" relation with the system

---

## Level 2 — Container

A container is a separately runnable or deployable unit — an application, a service, a single-page app, a mobile app, a database, a message broker, a cache, a scheduled job. There is **no closed taxonomy**: a container is identified by a free-form **technology** string. A database and a broker are ordinary containers whose technology happens to be `"PostgreSQL"` or `"Kafka"`.

A container declares the interfaces it **provides** and **requires** directly (when the container is treated as a black box), and/or contains components that declare them at finer grain. A container with no behavioural surface (e.g. a database) simply names its technology.

```
container Api :: "Edge API service" technology "Clojure/Ring" {
  // components …
}
container EventBus  technology "Kafka"
container LinkDb    technology "PostgreSQL"
```

Relations:
- 1..1 "belongs to" relation with the system
- 0..n "contains" relation with components
- 0..n "provides" relation with interfaces (container-level ports)
- 0..n "requires" relation with interfaces (container-level ports)

---

## Level 3 — Component

A component is a grouping of related functionality inside a container, with a well-defined responsibility. It is the finest logical unit in this metamodel (level 4 / code is out of scope). A component:

- **realizes** zero or more domain modules (many-to-many, optional);
- optionally references one **bounded context**;
- **provides** the interfaces it implements and **requires** the interfaces it depends on (ports);
- **publishes** message types to channels and **subscribes** to channels (async).

```
component LinkController :: "HTTP edge for link lifecycle"
    realizes module LinkManagement {     // header clause; cites the .domain module by name (the quoted form "Link Management" is accepted too)
  boundedContext LinkManagement
  provides LinkCommands
  provides LinkQueries
  requires SlugAllocation
  publishes LinkCreated to events
}
```

Relations:
- 1..1 "belongs to" relation with a container
- 0..n "realizes" relation with domain modules
- 0..1 "tagged with" relation with a bounded context
- 0..n "provides" relation with interfaces (provided ports)
- 0..n "requires" relation with interfaces (required ports)
- 0..n "publishes to" relation with channels
- 0..n "subscribes to" relation with channels

---

## Interfaces and Contracts

### Interface

A **first-class named contract**: an ordered set of operations that a component (or container, or external system) provides, and that others require. Unlike the domain `interface` — which merely *selects* a subset of operations owned by entities and services — an architecture interface **owns** its operations and their signatures. It is the unit of the provided/required port model.

An interface is declared at system scope (so it can be shared) and is owned by whichever element `provides` it. It may optionally `realizes` a domain interface.

```
interface LinkCommands {
  createLink(1: required Url target, 2: optional datetime expiresAt)
    returns ShortLinkDTO throws (SlugTaken)        // request-response (unsafe)

  safe resolve(1: required string slug) returns ShortLinkDTO   // request-response (safe → query)

  oneway recordClick(1: required string slug, 2: required datetime at)
    returns void                                   // one-way (→ event)
}
```

Relations:
- 1..n "declares" relation with operations
- 0..1 "realizes" relation with a domain interface
- 0..n "provided by" relation with components, containers, or external systems
- 0..n "required by" relation with components, containers, or external systems

### Operation

A named technical operation with an ordered list of typed arguments, exactly one return type, and an optional set of declared exceptions. Each operation declares an **interaction style**:

| Style | Keyword | Semantics | Domain analogue |
|---|---|---|---|
| Request-response | *(default)* | Caller blocks for a typed result or exception | Command (unsafe) or Query (safe) |
| Safe request-response | `safe` | Request-response with no state mutation, idempotent | Query |
| One-way | `oneway` | Fire-and-forget; no return value (must return `void`) | Event emission |
| Streaming | `streaming` | A stream of results over one call | — |

Operation names are **technical identifiers** in `camelCase` (e.g. `createLink`) — not the business-language string labels the domain metamodel uses for operations.

Relations:
- 1..1 "belongs to" relation with an interface
- 1..n "has" relation with arguments
- 1..1 "returns" relation with a type (or `void`)
- 0..n "throws" relation with exceptions

### Argument

A positional, typed input to an operation, carrying a Thrift-style **ordinal**, an `optional`/`required` marker, a type, and an optional default.

```
2: optional datetime expiresAt = null
```

Relations:
- 1..1 "belongs to" relation with an operation
- 1..1 "typed by" relation with a type

---

## Type System (Thrift-inspired)

The type system gives interfaces wire-grade contracts. **Field ordinals** and **`optional`/`required`** markers make the schema explicit and safe to evolve; there is deliberately **no** version/compatibility construct.

**Primitive types** (lowercase, shared with `.domain` plus the wire-oriented `double`/`instant`/`binary`): `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. (`void` is a return type only.)

**Container types:** `list<T>`, `set<T>`, `map<K, V>`.

Named types are declared at system scope and referenced by interfaces and other types.

### Struct

An aggregate of named, ordinaled, optionality-marked fields. Structs are the payloads of operations and messages.

```
struct ShortLinkDTO {
  1: required string   slug
  2: required Url      target
  3: optional datetime expiresAt
  4: required LinkStatus status
}
```

### Field

A member of a struct or exception: ordinal, `optional`/`required`, type, name, optional default. Field types may be primitives, container types, named types, or imported domain value types.

### Enum

A closed set of named members with explicit integer ordinals.

```
enum LinkStatus {
  active = 1
  disabled = 2
  expired = 3
}
```

### Typedef

A named alias for an existing type, used for readability and to give domain meaning to a primitive.

```
typedef Url = string
```

### Union

A tagged union: exactly one of its ordinaled members is set at a time.

```
union Target {
  1: Url url
  2: string rawText
}
```

### Exception

A struct-shaped error type that operations may declare in their `throws` clause. Exceptions are the architecture-level realization of domain **error events**.

```
exception SlugTaken { 1: required string slug }
```

### Importing domain types

Architecture types may reference the domain model rather than re-declaring concepts:

```
import value type Slug from domain      // a domain value type as a field type
import event LinkCreated from domain    // a domain event as a channel message type
```

An imported domain value type behaves as a named type; an imported domain event behaves as a message contract carried by channels.

Relations (type system):
- A struct/exception 1..n "has" relation with fields
- A field 1..1 "typed by" relation with a type (primitive, container, named, or imported domain type)
- A union 1..n "has" relation with members
- An enum 1..n "has" relation with members
- A typedef 1..1 "aliases" relation with a type

---

## Ports and Connectors

The provided/required interfaces are **ports**; **connectors** wire a required port to the matching provided port and carry the transport. Keeping transport on a separate connector (rather than inline on the requirement) puts the topology in one explicit place — ideal for diagram generation and for global dependency-graph, cycle, and layering analysis.

### Provided and Required ports

- A **provided port** is an interface listed under `provides` on a component, container, or external system.
- A **required port** is an interface listed under `requires`. A required port is unsatisfied until a connector binds it to a provided port of the same interface.

### Connector

A directed wire from a consumer (or its required port) to a provider (or its provided port), carrying a **protocol** (free string) and an interaction **style** (`sync` | `async` | `streaming`).

```
connect LinkController.SlugAllocation -> SlugAllocator over "gRPC" sync
connect WebApp -> LinkController.LinkCommands over "REST/JSON" sync
connect ClickCollector -> Analytics.AnalyticsIngest over "HTTPS" async
```

The left side may name a `Component.RequiredInterface`, a `Container`, a `Person`, or an `ExternalSystem` that calls in. The right side may name a `Component[.ProvidedInterface]`, a `Container`, or an `ExternalSystem[.ProvidedInterface]`. Because external systems participate, the connector graph is the full dependency graph. Inside an organization file, either side may also name another system of the organization: `System` as a black box, or `System.Container[.Interface]` (see [Detailing a system](#detailing-a-system)).

A connector enables these machine checks: every required port is wired; no two providers satisfy the same required port ambiguously; the directed graph is acyclic where layering demands it; sync edges do not cross a boundary that requires async. A connector that crosses the boundary between two systems of an organization is also checked against the level-0 dependencies and flows (see [Checks enabled by level 0](#checks-enabled-by-level-0)).

Relations:
- 1..1 "from" relation with a consumer (component/required-port, container, person, or external system)
- 1..1 "to" relation with a provider (component/provided-port, container, or external system)
- 1..1 "over" relation with a protocol
- 1..1 "with" relation with an interaction style

---

## Channels (first-class async)

A channel is a named topic or queue hosted on a broker container. It **carries** one or more message types — which are usually imported domain events. Components publish messages to channels and subscribe to them; the channel decouples producers from consumers (one-to-many fan-out) and is itself the message contract, independent of any single endpoint.

```
channel events on EventBus {
  carries LinkCreated, ClickRecorded
}
```

A component participates via `publishes <MessageType> to <channel>` and `subscribes <channel>`. Delivery semantics (ordering, at-least-once, retention) are out of scope for v1 and, if needed, recorded in the channel's `metadata`.

Relations:
- 1..1 "hosted on" relation with a broker container
- 1..n "carries" relation with message types (often imported domain events)
- 0..n "published to by" relation with components
- 0..n "subscribed to by" relation with components

---

## Deployment view

A mapping of containers to environments, with the places they run and the infrastructure their data lives in. It records **where** containers run, a replica hint, and the facts that placement and residency rules test: the provider, region and zone of a node, which resource holds which data, and whether that resource is shared. It is not a CMDB: capacity, networking and the inventory of every running instance are out of scope.

```
environment production :: "Live traffic" {
  node euWest :: "Primary region" provider "AWS" region "eu-west-1" {
    node k8sProd :: "Workload cluster" zone "eu-west-1a" {
      deploy Api replicas 3
      deploy SlugService replicas 2
    }
    resource linkDb :: "Managed Postgres" instantiates LinkDb technology "RDS Postgres 16" tenancy dedicated {
      stores Link, Click
    }
  }
  deploy EventBus            // still legal directly under an environment: placement unknown
}
```

Nodes and resources are optional. An environment that only lists `deploy` clauses is still valid, and a `deploy` written directly under an environment places the container in that environment without saying on which node.

The words `node`, `resource`, `provider`, `region`, `zone`, `instantiates`, `tenancy`, `shared`, `dedicated` and `stores` are contextual, not reserved: they remain usable as names elsewhere.

### Environment

A named stage in which containers are deployed: `production`, `staging`. It contains nodes, and deploys directly the containers whose node is not stated.

Relations:
- 0..n "contains" relation with nodes
- 0..n "deploys" relation with containers (each with an optional replica count), on no stated node

### Node

A place where containers run inside an environment: a region, a cluster, a virtual machine, a serverless runtime. Nodes nest — a cluster in a region — and a node belongs to exactly one environment, directly or through the node it is nested in.

A node carries the facts that placement and residency rules test: `provider`, `region` and `zone`, free-form strings, each stated at most once and in any order. A fact a node does not state is read from the node that contains it: in the example above, the cluster `k8sProd` runs on AWS in `eu-west-1`.

Relations:
- 1..1 "belongs to" relation with an environment (directly, or through the node it is nested in)
- 0..1 "nested in" relation with a node
- 0..n "hosts" relation with containers (each with an optional replica count, through `deploy`)
- 0..n "provides" relation with resources

### Resource

A provisioned unit of infrastructure on a node: a database instance, a topic, a bucket, a cache, a secret store. It is where data physically lives, and so the element that residency, retention and tenancy rules are checked against. A resource may:

- **instantiate** a container of this system whose technology is a data store or a broker. The container is the logical element; the resource is its provisioned instance in this environment, and the container needs no `deploy` clause there;
- name its **technology** as precisely as the provisioned product (`"RDS Postgres 16"`), with the same free-form meaning as a container's;
- state its **tenancy**: `dedicated` to this system, or `shared` with other systems — the tenant boundary a platform offers;
- list the structs it **stores**: structs of this `.arch` file, or of a `.dataop` model of the same system, resolved by name.

```
resource linkDb :: "Managed Postgres" instantiates LinkDb technology "RDS Postgres 16" tenancy dedicated {
  stores Link, Click
}
resource auditExports :: "Object storage for audit exports" technology "S3" tenancy shared
```

Relations:
- 1..1 "provided by" relation with a node
- 0..1 "instantiates" relation with a container (a data store or broker)
- 0..n "stores" relation with structs

---

## Stack binding (the C4 level-4 replacement)

The architecture model is **logical and tech-agnostic except for coarse container technology**. The C4 level-4 (code) concern is replaced by a **separate stack-binding artifact** that maps the level-3 description to a concrete stack:

- type → language type mappings (e.g. `struct → Java record`, `string → java.lang.String`);
- protocol → framework choices (e.g. `"REST/JSON" → Spring WebMVC`);
- code-generation targets and conventions.

This split keeps a single `.arch` model reusable across stacks. The binding artifact is consumed by the `architecture-build-code` skill (see [Skill roadmap](#skill-roadmap)).

---

## Naming conventions

- `organization`, `area`, `phase`, `system`, `person`, `externalSystem`, `hotspot`, `container`, `component`, `interface`, and all named types (`struct`, `enum`, `typedef`, `union`, `exception`) — `PascalCase`. Acronyms are acceptable as system names (`ERP`, `CRM`, `IAM`).
- A system is named after its role in the organization (`ERP`, `CashManagement`), not after the product that implements it: the product is its `technology`, and the name survives a change of product.
- operations, struct/union fields, enum members, channels, environments, nodes and resources — `camelCase`.
- Operation names are **technical identifiers**, not the business-language string labels used for domain operations.
- Every named type carries explicit field/member ordinals.
- Flows are identified by a positive integer, unique within the organization and, by convention, never reused; their labels are business-language strings.
- Area names differ from bounded-context names, and person names read as user populations (`FinanceStaff`, `AllEmployees`), not as owning teams.
- Concept references use the domain's `PascalCase` type names, qualified by their bounded context (`Finance.Invoice`) when a bare name would be ambiguous.

---

## Mapping to the C4 model

| C4 | This metamodel | Notes |
|---|---|---|
| System Landscape (supplementary diagram) | `organization` + `area` + `system` (level 0) + `dependency` + `flow` | Level 0. An arrow means *depends on* (downstream → upstream); each flow states its own data direction; two opposite dependencies are two arrows, whether a Partnership or a mutual dependency |
| L1 System Context | `system` + `person` + `externalSystem` | Kept as the system-in-focus view; NOT equated with bounded context |
| L2 Containers | `container` | Free-form technology; no closed kind taxonomy |
| L3 Components | `component` | Plus first-class typed interfaces, ports, channels |
| L4 Code | *out of scope* | Generated per stack via the separate stack-binding artifact |
| Relationships (arrows) | `connector` + `channel`; at level 0, `dependency` + `flow` | Typed with protocol + interaction style; async is first-class |
| Deployment diagram | `environment` + `node` + `resource` | Placement, replicas and residency facts (provider, region, zone, tenancy, stored structs); no capacity, networking or instance inventory |

## Relationship to the domain metamodel

| Architecture concept | Domain concept | Link |
|---|---|---|
| `organization` | `organization` | same element, by name |
| `system` (level 0) | `bounded context` | `realizes context` (many-to-many) |
| `dependency` | context-map relation (upstream / downstream patterns) | direction and patterns must agree |
| two opposite `dependency`s both marked `Partnership` | Partnership | `symmetric … : Partnership` in both contexts' maps |
| two opposite `dependency`s without `Partnership` (mutual dependency) | two directional relations | each agrees with its directional entries |
| `masters` | `entity` / `aggregate`; `read-only entity` whose `sourced-from` names the system | system of record |
| `handles`, flow `carries`, hotspot `concerns` | `entity`, `aggregate`, `read-only entity`, `value type`, `enum`, `event`, `external event` | concept reference, resolved per [Concept reference](#concept-reference) |
| flow `carries X as Y` | `X` becomes `Y` in the receiver's model (renaming or transformation) | a `Conformist` downstream never translates |
| `component` | `module` | `realizes` (many-to-many) |
| `interface` | domain `interface` | optional `realizes` |
| operation `request-response` (unsafe) | `command` / entity operation | conceptual |
| operation `safe` | `query` | conceptual |
| operation `oneway`, channel message | `event` / `external event` | `import event … from domain` |
| `exception` | `error event` | conceptual |
| struct field type | `value type` | `import value type … from domain` |
| `externalSystem` | upstream bounded context / external-event source; the `sourced-from` of read-only entities | `realizes`; at level 0, `masters` |
| `boundedContext` (grouping) | `bounded context` | name correspondence (optional) |

## Skill roadmap

Three skills will operate on `.arch` files, mirroring the domain skill set:

1. **`architecture-design`** — produce a `.arch` model from a `.sysreq` (incl. NFRs) and a `.domain`. At level 0 it also maps an organization's landscape from interviews, landscape diagrams and integration inventories, with or without a domain model, then details the systems that will be built.
2. **`architecture-extract-from-code`** — reverse-engineer a `.arch` model from an existing codebase. From one codebase it recovers levels 1 to 3 of one system. From several systems it also writes the level-0 organization file: the dependencies and flows that integration code reveals (API clients, file jobs, connectors), and — only where the sources evidence them — `masters`, patterns and criticality, which are business statements it lists for confirmation.
3. **`architecture-build-code`** — generate stack-specific code from a `.arch` model plus a stack-binding artifact. Level 0 generates nothing by itself: black-box systems have no code of ours, and the flows of a detailed system reach code through the connectors that realize them.

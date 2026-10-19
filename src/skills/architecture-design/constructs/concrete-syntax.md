## Concrete syntax

A `.arch` file has one of two roots: `architecture` (levels 1–3, shown first) or `organization` (level 0, shown after it). An `architecture` file describes **one software system in focus**, surrounded by the persons and external systems it interacts with (the C4 *System Context* view). The provenance declarations sit at the top of the `architecture` block; `satisfies` and `realizes` decorate the elements they trace.

```
architecture ShortLinkPlatform :: "URL shortening platform — architecture" {

  // Provenance — the satisfies / realizes / import references below resolve
  // against these two sibling files.
  domain-source       "specy/urlshortener.domain"
  requirements-source "specy/urlshortener.sysreq"

  // LEVEL 1 — persons + external systems + the one system in focus.
  person Visitor   :: "An anonymous end-user who follows short links"
  person Registrar :: "A registered user who creates and manages short links"

  externalSystem Analytics :: "Segment click-analytics platform"
      realizes module "Click Analytics" {
    provides AnalyticsIngest   // an interface our system calls
    consumes ClickExport       // an interface of ours it reads
  }

  system ShortLink :: "The link-shortening platform"
      satisfies [REQ-NFR-001] {

    // BOUNDED CONTEXTS — optional groupings projected onto components.
    boundedContext LinkManagement :: "Creation and lifecycle of short links"

    // IMPORTED DOMAIN TYPES — reference the .domain rather than re-declaring.
    import value type Slug          from domain
    import event      LinkCreated   from domain

    // SHARED THRIFT TYPES — wire-grade payloads of interfaces & channels.
    typedef Url = string

    enum LinkStatus { active = 1  disabled = 2  expired = 3 }

    struct ShortLinkDTO :: "Wire view of a short link" {
      1: required Slug       slug
      2: required Url        target
      3: optional datetime   expiresAt
      4: required LinkStatus  status
    }

    union Target { 1: Url url  2: string rawText }

    // Exceptions — the architecture realization of domain error events.
    exception SlugTaken { 1: required string slug }

    // SHARED INTERFACES — first-class contracts owned by whoever `provides`.
    interface LinkCommands :: "Write side of link lifecycle"
        satisfies [REQ-LNK-001] {
      createLink(1: required Url target, 2: optional datetime expiresAt)
        returns ShortLinkDTO throws (SlugTaken)
        :: "request-response / command (default style)"

      safe resolve(1: required string slug) returns ShortLinkDTO
        :: "safe = no mutation → query"

      oneway recordClick(1: required string slug, 2: required datetime at) returns void
        :: "oneway = fire-and-forget → event emission (must return void)"
    }

    // LEVEL 2 / LEVEL 3 — containers and the components inside them.
    container Api :: "Edge API service" technology "Clojure/Ring"
        satisfies [REQ-NFR-002] {
      provides LinkCommands                 // container-level port (black box)

      component LinkController :: "HTTP edge for link lifecycle"
          realizes module LinkManagement {   // the module's .domain name; a quoted "Link Management" is accepted too
        boundedContext LinkManagement
        provides LinkCommands
        requires SlugAllocation
        publishes LinkCreated to events         // async publish
      }
    }

    container EventBus technology "Kafka"
    container LinkDb   technology "PostgreSQL"

    // CHANNELS — first-class async. Hosted on a broker, CARRIES message types
    // (usually imported domain events).
    channel events on EventBus :: "Link lifecycle fan-out" {
      carries LinkCreated
    }

    // CONNECTORS — wire required ports to provided ports + protocol + style.
    // The left side: Component.RequiredInterface | Container | Person.
    // The right side: Component[.ProvidedInterface] | Container | ExternalSystem[.ProvidedInterface].
    connect Registrar -> Api.LinkCommands over "REST/JSON" sync
    connect LinkController.SlugAllocation -> SlugAllocator over "gRPC" sync
    connect LinkController -> LinkDb over "JDBC" sync
    connect LinkController -> Analytics.AnalyticsIngest over "HTTPS" async

    // DEPLOYMENT VIEW — placement + residency facts: environments, the nodes
    // containers run on, the resources where data lives, replica hints.
    environment production :: "Live traffic" {
      node euWest :: "Primary region" provider "AWS" region "eu-west-1" {
        node k8sProd :: "Workload cluster" zone "eu-west-1a" {   // nodes nest
          deploy Api replicas 3
        }
        // a provisioned instance of the LinkDb container: where link data lives
        resource linkDb :: "Managed Postgres" instantiates LinkDb technology "RDS Postgres 16" tenancy dedicated {
          stores ShortLinkDTO                  // structs of this file or of the system's .dataop
        }
      }
      deploy EventBus                          // directly under the environment: node unstated
    }
  }
}
```

### Level 0 — the `organization` root

An `organization` file describes a **landscape**: the systems of one organization, what each one masters, the dependencies between them (`A -> B` reads *A depends on B*) and the numbered flows of domain concepts along each dependency. A system is a black box, or is detailed in levels 1–3 — inline, or in its own file.

```
organization SnowPeak :: "A ski-resort operator — lift passes, access gates, equipment rental" {

  // PROVENANCE — concept names resolve against the domain sources (one line
  // per .domain file); `satisfies` identifiers against the requirements source.
  domain-source       "specy/ticketing.domain"
  domain-source       "specy/equipment-rental.domain"
  requirements-source "specy/snowpeak.sysreq"

  // PHASES — the integration roadmap, in chronological order. A phase changes
  // how a flow is carried, never whether it exists.
  phase Opening    :: "First season — flows without a ready-made connector run on files"
  phase NextSeason :: "File exchanges replaced by APIs"

  // AREAS place systems as the business sees them; PERSONS are user populations.
  area GuestServices  :: "Ticket offices, rental shops and the guest hotline"
  area LiftOperations :: "Lifts, gates and slope safety"
  area BackOffice     :: "Accounting and controlling"

  person Guests      :: "Skiers who buy passes and rent equipment"
  person Cashiers    :: "Ticket-office and rental-shop staff"
  person Accountants :: "The finance team"

  // EXTERNAL SYSTEMS — outside the organization. They may master concepts.
  externalSystem PaymentProvider :: "Card acquiring and payouts" {
    masters Settlement                // NOTE: the provider's own concept — no domain element
  }

  // SYSTEMS — named for their role; a bought product goes in `technology`.
  // Level-0 clauses come first in the body.
  system PassSales :: "Sells lift passes online and at the ticket offices, and refunds them"
      meta { status = "target finalized"  contacts = "Pass-sales product owner; tech lead" }
      realizes context Ticketing {
    area GuestServices
    used-by Guests, Cashiers
    masters LiftPass, Payment         // system of record
    handles Passage                   // a copy — the gates master it
    hotspot ClosedLiftRefunds
        :: "Refunds for closed lifts are checked by hand against a nightly passage file (ADR-012)"
        concerns 2, Passage           // flow numbers and concepts
    detailed-in "pass-sales.arch"     // architecture PassSales { system PassSales { … } }
  }

  // A bought product stays a black box: everything known about it is level 0.
  system AccessControl :: "Opens the lift gates to valid passes and records every passage"
      technology "Skidata" {
    area LiftOperations
    masters Passage                   // a read-only entity of Ticketing, sourced-from AccessControl
    handles LiftPass
  }

  system Accounting :: "General ledger, VAT and annual accounts" technology "Sage 100" {
    area BackOffice
    used-by Accountants
    masters JournalEntry              // NOTE: no Finance context in the domain model yet
    hotspot DailyCashUp :: "Until NextSeason each day's takings are exported and keyed in by hand"
        concerns 5, Ticketing.Payment // qualified: EquipmentRental has a Payment too
  }

  // Built in-house and detailed INLINE: levels 2–3 follow the level-0 clauses.
  system Rental :: "Hands out and takes back rental equipment at the shops"
      satisfies [REQ-NFR-004]
      realizes context EquipmentRental {
    area GuestServices
    used-by Cashiers
    masters RentalBooking, RentalOffer
    handles LiftPass

    container RentalDesk :: "Shop-counter application" technology "TypeScript/React SPA"
    container RentalApi  :: "Bookings and equipment stock" technology "Kotlin/Spring Boot"
    connect Cashiers -> RentalDesk over "HTTPS" sync
    connect RentalDesk -> RentalApi over "REST/JSON" sync
    connect RentalApi -> PassSales over "REST/JSON" sync   // a bare peer name: PassSales as a black box
  }

  // DEPENDENCIES — `A -> B` reads "A depends on B": A downstream, B upstream.
  // Data goes from B to A unless a flow names its receiver with `to`.

  // Conformist: the gates take passes as PassSales defines them — no `as`.
  dependency AccessControl -> PassSales : Conformist criticality critical
      :: "A gate only opens to a pass PassSales has sold" {
    flow 1 "Valid passes" :: "Every pass sold or refunded" carries LiftPass
      over "gate vendor's sales connector" automated
  }

  // The opposite dependency, without Partnership: a MUTUAL DEPENDENCY — two
  // edges, each with its own patterns and flows.
  dependency PassSales -> AccessControl : ACL, OHS criticality tolerant {
    flow 2 "Gate passages" carries Passage {               // one mechanism per phase
      phase Opening    over "nightly CSV export" manual
      phase NextSeason over "gate vendor's REST API" automated
    }
  }

  // PARTNERSHIP — on both dependencies of the pair, never with CS / Conformist / ACL / OHS.
  dependency Rental -> PassSales : Partnership {
    flow 3 "Passes of a renting guest" carries LiftPass over "REST/JSON" automated
  }
  dependency PassSales -> Rental : Partnership {
    flow 4 "Rental offers shown in the pass shop" carries RentalOffer automated   // medium not known yet
  }

  dependency Accounting -> PassSales : ACL :: "Revenue is booked from the passes sold" {
    // `as`: PassSales' Payment becomes a JournalEntry in Accounting's model.
    flow 5 "Daily takings" carries Payment as JournalEntry {
      phase Opening    manual
      phase NextSeason over "accounting import API" automated
    }
  }

  // PassSales depends on the provider, yet sends it the payments: flow 6 goes against the default direction.
  dependency PassSales -> PaymentProvider : Conformist criticality degraded
      :: "Ticket offices still take cash while card payments are down" {
    flow 6 "Card payments" carries Payment to PaymentProvider over "payments API" automated
    flow 7 "Settlements"   carries Settlement over "payments API" automated
  }
}
```

### Syntax rules that bite

- **Descriptions** use `::` then a string literal. **Metadata** uses `meta { key = value }`. Comments use `//`.
- **Names**: `organization`, `area`, `phase`, `person`, `externalSystem`, `hotspot`, `system`, `container`, `component`, `interface`, and every named type (`struct`, `enum`, `typedef`, `union`, `exception`) are `PascalCase`. Operations, struct/union fields, enum members, channels, environments, nodes, and resources are `camelCase`. Primitives are lowercase.
- **Primitives** (lowercase): `string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`. `void` is a return type only. Containers: `list<T>`, `set<T>`, `map<K, V>`.
- **Thrift fields & args** always carry an `<ordinal>: required|optional <type> <name> [= default]`. Ordinals start at 1 and never repeat within a struct/exception/operation.
- **Operation styles** prefix the name: bare = request-response (command), `safe` = query (no mutation), `oneway` = event emission (must `returns void`), `streaming` = result stream.
- **`realizes module Foo` / `realizes context Foo`** cite a domain module or context by its **declared PascalCase name** (`module LinkShortening` in the `.domain` → `realizes module LinkShortening`; `realizes context Ticketing` on a system at level 0 — the name concept references qualify by, as in `Ticketing.Payment`). The quoted form (`realizes module "Link Shortening"`) is accepted for readability and matched ignoring case and spaces; prefer the bare name. **`realizes interface Foo` / `realizes event Foo` / `realizes value type Foo`** take **bare PascalCase** names only. `realizes` is a header clause: it comes after `satisfies`, before the `{` of the element — never inside the body.
- **`satisfies [ID, …]`** takes a bracketed list of requirement identifiers (`REQ-…`, `NFR-…`). NFRs in particular belong on the elements that address them.
- **Ports vs connectors**: `provides` / `requires` declare ports; a separate `connect A.Port -> B over "<protocol>" <sync|async|streaming>` wires a required port to a provided port. A required port is unsatisfied until a connector binds it.
- **Async** is modeled with `channel <name> on <BrokerContainer> { carries <MsgTypes> }` plus component `publishes <Msg> to <chan>` / `subscribes <chan>` — never as an anonymous arrow.
- **Deployment view**: an `environment` holds `deploy` clauses and `node`s; a `node <name> [provider "…"] [region "…"] [zone "…"] { … }` holds nested nodes, `deploy` clauses and `resource`s; a `resource <name> [instantiates <Container>] [technology "…"] [tenancy shared|dedicated] [{ stores <Struct>, … }]` sits on a node. Description and `meta` come right after the name; a node's attributes come in any order, each at most once; a resource's clauses come in the order shown. Nodes and resources are optional.
- **Provenance is mandatory** when inputs come from files: `domain-source` and `requirements-source` at the top of the `architecture` block make both traceability bridges machine-resolvable. Under `organization`, `domain-source` may repeat — one per `.domain` file — and level-0 concept names resolve against all of them.

Level 0 adds its own:

- **Level 0 lives under `organization` only.** Its members come in any order: `domain-source`, `requirements-source` (at most one), `phase`, `area`, `person`, `externalSystem`, `system` (at least one), `dependency`. An `architecture` file never contains `area`, `used-by`, `masters`, `handles`, `hotspot`, `detailed-in`, `dependency`, `flow` or `phase`.
- **Level-0 clauses before other system members.** Header order: `system <Name> [:: "…"] [meta { … }] [technology "…"] [satisfies […]] [realizes …]`. In the body, `area`, `used-by`, `masters`, `handles`, `hotspot` and `detailed-in` come **before** any type, interface, bounded-context grouping, container, channel, connector or environment. `used-by`, `masters` and `handles` may repeat (their lists merge); `area` and `detailed-in` appear at most once. A system with no body is legal: a name, a purpose and a product.
- **`A -> B` reads "A depends on B"** — A downstream, B upstream. `dependency <A> -> <B> [: <pattern>, …] [criticality critical|degraded|tolerant] [:: "…"] [meta { … }] [{ <flows> }]`, clauses in that order: the description comes *after* the patterns and the criticality. One dependency per ordered pair, none from a system to itself; one end may be an `externalSystem`, never both.
- **Pattern sides.** Each pattern belongs to a side, so their order is free: at most one of `CS` | `Conformist` | `ACL` for the downstream system (left of `->`), `OHS` for the upstream one (right of `->`), at most one of `SharedKernel` | `PublishedLanguage` for both. `Partnership` goes on **both** dependencies of a mutual pair or on neither — never on a one-way dependency, never with `CS`, `Conformist`, `ACL` or `OHS`. `SeparateWays` is never written: it is the absence of a dependency. Patterns are optional, and a dependency between two systems that realize the same context has none.
- **Flow numbers are unique in the organization**, not per dependency: unsigned integers, never reused once a flow is retired. `flow <n> "<label>" [:: "…"] [meta { … }] carries <Concept> [as <Concept>], … [to <System>] [<mechanism>]` — the label is a business-language string, and the description sits between the label and `carries`.
- **Data direction.** A flow's data goes from the upstream system to the downstream one — right to left of the `->` — unless `to <System>` names the receiver. `to` names one of the two ends of the flow's own dependency. Data in both directions is two flows.
- **`carries X as Y`.** `X` is the sender's concept, `Y` what it becomes in the receiver's model; each carried concept has its own optional `as`. A flow that a `Conformist` downstream receives carries no `as`.
- **One mechanism, or a per-phase block.** Either a single mechanism after `carries … [to …]` — `over "<medium>"`, `manual` | `automated`, or both with `over` first — which holds in every phase; or a block `{ phase <Phase> <mechanism> … }` in which every line states a mechanism and names a declared `phase`, each phase at most once. Never both. A phase the block leaves out is undecided for that flow; a flow that states no mechanism at all is undecided throughout.
- **Concept references** are `Concept` or `Context.Concept`, in the domain's `PascalCase`. In `concerns`, an integer is a flow number and a name is a concept. A name with no domain element needs a `// NOTE:` on its line or on the comment-only line directly above.
- **Hotspot.** `hotspot <Name> :: "…" [meta { … }] [concerns <n | Concept>, …]` — the description is required, and the flows it names have the system at one end.
- **Inline detail.** The names a system body declares — types, interfaces, containers, components, channels — are local to that system; the organization's names (systems, external systems, persons, areas, phases) are visible everywhere. A connector is written in the system that owns its consumer end, or its provider end when the consumer is a person, an external system or a black-box system. Another system is a connector end as `System` (a black box) or `System.Container[.Interface]`.
- **`detailed-in "<file>.arch"`** names a single-system file whose `system` has the same name; the organization file is authoritative for the description, `technology`, `realizes` and metadata, which the detail file need not repeat and must not contradict; a system is detailed inline or through `detailed-in`, not both. That file holds levels 1–3 only, and the organization's other systems appear in it as `externalSystem`s under the same names. In an `organization` file, `externalSystem` means outside the organization.
- **Contextual keywords.** The words of level 0 — `organization`, `phase`, `area`, `used-by`, `masters`, `handles`, `hotspot`, `concerns`, `detailed-in`, `dependency`, `criticality`, `critical`, `degraded`, `tolerant`, `flow`, `as`, `manual`, `automated` and the pattern names — are keywords only in these positions, like `to`, `carries` and `over`; elsewhere they remain usable as names.

When in doubt about syntax, re-read `grammar/architecture.ebnf` and the `examples/url-shortener/url-shortener.arch` model — it exercises every construct of levels 1–3. For level 0, re-read the grammar's *Level 0 — Organization* section and the `examples/retail-media/retail-media.arch` landscape.

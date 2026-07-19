# Software Architecture metamodel

This file defines a **software architecture** metamodel for describing how a software system is structured. It is inspired by the **C4 model** (Context, Containers, Components, Code) but is more detailed in three deliberate ways:

1. **Typed contracts.** Component interfaces are first-class contracts with a Thrift-inspired type system (`struct`, `enum`, `typedef`, `union`, `exception`) carrying field ordinals and `optional`/`required` markers for wire-safety.
2. **Ports and connectors.** Components declare both the interfaces they **provide** and the interfaces they **require**, and connectors wire them with an explicit protocol and interaction style — so the dependency graph, cycles, and layering are machine-checkable.
3. **First-class async.** Asynchronous messaging is modeled as named **channels** with their own message contracts, not as anonymous arrows.

C4's level 4 (Code) is intentionally **out of scope**: code is generated per stack from the logical level-3 description through a separate stack-binding artifact (see [Stack binding](#stack-binding-the-c4-level-4-replacement)).

## Pipeline position

The architecture model sits between the domain model and code generation:

```
prd → sysreq → domain → architecture → code
```

It **satisfies** system requirements (`.sysreq`, including NFRs) and **realizes** domain elements (`.domain` modules, interfaces, events, value types). It is a standalone model linked to — never derived from — the domain model. A domain module may be realized by several components, and a component may realize several modules (many-to-many).

## What this metamodel is NOT

- It is **not** the DDD bounded context boundary. C4 *System Context* (a system as a box surrounded by people and external systems) is a different boundary than a DDD *bounded context* (a model/language boundary). This metamodel keeps both: level 1 is the C4 system-context, and bounded context is an optional grouping **below** it (see [Bounded Context](#bounded-context)).
- It is **not** a deployment/infrastructure model. A lightweight [deployment view](#deployment-view) records environments and container placement, but infra nodes, networking, and capacity are out of scope.
- It does **not** carry interface versioning or compatibility machinery. Field ordinals and `optional`/`required` give wire-safety; version negotiation and compatibility policy are left to the team.

## Convention

Every concept in this metamodel carries a **name**, a **description**, a **metadata** map (arbitrary key/value pairs), a **satisfies** list (zero or more system requirement identifiers), and a **realizes** list (zero or more domain element references). These attributes are implicit and not repeated in each definition below.

- **satisfies** is the traceability bridge to the system requirement layer (`SYSTEM-REQ-METAMODEL.md`). When system requirements are provided and carry identifiers (e.g. `NFR-PERF-001`), every architecture element that realizes a requirement MUST list the corresponding identifier(s). NFRs in particular drive architecture and should appear on the elements that address them.
- **realizes** is the traceability bridge to the domain layer (`DOMAIN-METAMODEL.md`). A component realizes domain `module`(s); an interface may realize a domain `interface`; a channel's message types may import domain `event`s; struct fields may import domain `value type`s.

When the inputs are loaded from files, the model declares the provenance at the top level:
- **requirements-source** — relative path to the `.sysreq` file the `satisfies` identifiers refer to.
- **domain-source** — relative path to the `.domain` file the `realizes` references and `import … from domain` statements resolve against.

This makes both bridges explicit and machine-resolvable — any tool can follow the paths to check coverage or detect drift.

## Architecture (root)

The root of a `.arch` file. It scopes **one software system in focus** plus its neighbors (the people and external systems it interacts with). Multiple systems are modeled in multiple files.

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

---

## Level 1 — System Context

Level 1 describes the system in focus as a single box, surrounded by the people who use it and the external systems it talks to. This is the C4 *System Context* view.

### System

The software system being designed. It is the single subject of the file. A system contains the structural decomposition (containers, components), the shared contracts (interfaces and types), the channels, the connectors, and the deployment view.

Relations:
- 1..n "contains" relation with containers
- 0..n "declares" relation with interfaces and types (shared contracts visible system-wide)
- 0..n "declares" relation with bounded contexts (optional groupings over components)
- 0..n "declares" relation with channels
- 0..n "declares" relation with connectors
- 0..n "declares" relation with environments

### Person (Actor)

A human role that interacts with the system — an end user, an operator, an administrator. A person is a source or sink of interactions, never a container.

```
person Visitor   :: "An anonymous end-user who follows short links"
person Registrar :: "A registered user who creates and manages short links"
```

Relations:
- 0..n "uses" relation with the system, a container, or a provided interface (expressed as connectors)

### External System

A software system **outside** the boundary of the system in focus that it integrates with — a third-party API, a partner platform, an upstream service, a SaaS. An external system is opaque: it is not decomposed into containers or components. It may **provide** interfaces (that our system requires) and **consume** interfaces (that our system provides), and it participates in connectors and channels exactly like an internal element — so the dependency graph includes external edges.

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

---

## Bounded Context

A bounded context is an **optional** grouping over components — the DDD model/language boundary projected onto the architecture. It is declared at system scope and referenced by components through an optional tag. Because the link is optional and lives at the component level, a single container may host components belonging to several bounded contexts (a modular monolith), and a single bounded context may span components across several containers (microservices). The grouping carries no runtime meaning; it records which model boundary a component belongs to.

```
boundedContext LinkManagement :: "Creation and lifecycle of short links"
boundedContext ClickAnalytics :: "Click capture and reporting"
```

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
component LinkController :: "HTTP edge for link lifecycle" {
  boundedContext LinkManagement
  realizes module "Link Management"      // domain modules are quoted multi-word names
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

The left side may name a `Component.RequiredInterface`, a `Container`, or a `Person`. The right side may name a `Component[.ProvidedInterface]`, a `Container`, or an `ExternalSystem[.ProvidedInterface]`. Because external systems participate, the connector graph is the full dependency graph.

A connector enables these machine checks: every required port is wired; no two providers satisfy the same required port ambiguously; the directed graph is acyclic where layering demands it; sync edges do not cross a boundary that requires async.

Relations:
- 1..1 "from" relation with a consumer (component/required-port, container, or person)
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

A lightweight mapping of containers to environments. It records **where** containers run and a replica hint — nothing more. Infra nodes, networking, regions, and capacity are out of scope.

```
environment production {
  deploy Api replicas 3
  deploy SlugService replicas 2
  deploy EventBus, LinkDb
}
```

Relations:
- An environment 0..n "deploys" relation with containers (each with an optional replica count)

---

## Stack binding (the C4 level-4 replacement)

The architecture model is **logical and tech-agnostic except for coarse container technology**. The C4 level-4 (code) concern is replaced by a **separate stack-binding artifact** that maps the level-3 description to a concrete stack:

- type → language type mappings (e.g. `struct → Java record`, `string → java.lang.String`);
- protocol → framework choices (e.g. `"REST/JSON" → Spring WebMVC`);
- code-generation targets and conventions.

This split keeps a single `.arch` model reusable across stacks. The binding artifact is consumed by the `architecture-build-code` skill (see [Skill roadmap](#skill-roadmap)).

---

## Naming conventions

- `system`, `container`, `component`, `interface`, and all named types (`struct`, `enum`, `typedef`, `union`, `exception`) — `PascalCase`.
- operations, struct/union fields, enum members, channels, environments — `camelCase`.
- Operation names are **technical identifiers**, not the business-language string labels used for domain operations.
- Every named type carries explicit field/member ordinals.

---

## Mapping to the C4 model

| C4 | This metamodel | Notes |
|---|---|---|
| L1 System Context | `system` + `person` + `externalSystem` | Kept as the system-in-focus view; NOT equated with bounded context |
| L2 Containers | `container` | Free-form technology; no closed kind taxonomy |
| L3 Components | `component` | Plus first-class typed interfaces, ports, channels |
| L4 Code | *out of scope* | Generated per stack via the separate stack-binding artifact |
| Relationships (arrows) | `connector` + `channel` | Typed with protocol + interaction style; async is first-class |
| Deployment diagram | `environment` (lightweight) | Placement + replicas only |

## Relationship to the domain metamodel

| Architecture concept | Domain concept | Link |
|---|---|---|
| `component` | `module` | `realizes` (many-to-many) |
| `interface` | domain `interface` | optional `realizes` |
| operation `request-response` (unsafe) | `command` / entity operation | conceptual |
| operation `safe` | `query` | conceptual |
| operation `oneway`, channel message | `event` / `external event` | `import event … from domain` |
| `exception` | `error event` | conceptual |
| struct field type | `value type` | `import value type … from domain` |
| `externalSystem` | upstream bounded context / external-event source | `realizes` |
| `boundedContext` (grouping) | `bounded context` | name correspondence (optional) |

## Skill roadmap

Three skills will operate on `.arch` files, mirroring the domain skill set:

1. **`architecture-design`** — produce a `.arch` model from a `.sysreq` (incl. NFRs) and a `.domain`.
2. **`architecture-extract-from-code`** — reverse-engineer a `.arch` model from an existing codebase.
3. **`architecture-build-code`** — generate stack-specific code from a `.arch` model plus a stack-binding artifact.

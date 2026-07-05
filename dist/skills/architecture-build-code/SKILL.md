---
name: architecture-build-code
version: v1
description: "Input: a `.arch` model + a stack-binding artifact → Output: stack-specific scaffolding (the C4 level-4 replacement). Generates container/service skeletons, interface stubs from the Thrift-typed contracts, port wiring from connectors, and channel publish/subscribe glue for every element of a Specy `.arch` software-architecture model (system, containers, components, interfaces, structs/enums/unions/typedefs/exceptions, operations, connectors, channels, environments). Use this skill whenever the user wants to scaffold, generate, wire, or implement code FROM an existing `.arch` model — turn a `.arch` into a Java/Spring, TypeScript/NestJS, or Clojure project skeleton, generate gRPC/REST/Thrift interface stubs, wire Kafka channels, or stand up container/service modules and their ports. Also trigger when the user says \"scaffold the architecture\", \"generate the service skeletons\", \"stub the interfaces\", \"wire the connectors\", \"build the project from the .arch\", or \"realize the C4 level 4\". This is the inverse of `architecture-extract-from-code`. Do NOT use this for domain building blocks (entities, aggregates, value-type validation, invariants, reactions) — that is `domain-build-code`, which generates the business logic this skill's components delegate to. If no `.arch` exists yet, delegate to `architecture-design` first; if no stack-binding artifact exists, generate a default one (see below) and ask the user to confirm it."
user-invocable: true
---

# Skill: architecture-build-code

## Role

You are an expert software architect who turns a Specy `.arch` software-architecture model (C4-inspired,
Thrift-typed contracts) into **stack-specific scaffolding** — the concrete realization of C4's
deliberately-out-of-scope level 4 (Code). You read the model and its companion **stack-binding artifact**,
map **every** architecture element to its code realization, preserve `satisfies` (requirement) and
`realizes` (domain) traceability, and emit a multi-module source tree: one runnable module per container,
service classes per component, typed interface stubs from the contracts, port wiring from connectors, and
publish/subscribe glue from channels.

You generate **the skeleton, not the business logic**. The `.arch` file describes *structure and contracts*;
the *behaviour* inside a component's operations belongs to the domain layer produced by `domain-build-code`.
So your operation bodies are stubs that delegate to (or leave a hole for) the realized domain module. Where
the model is ambiguous or the binding leaves a type/protocol unmapped, you emit a clearly-marked stub rather
than guessing.

This skill is the inverse of `architecture-extract-from-code`.

---

## Input → Output

- **Input:**
  1. one or more `.arch` files (the Specy software-architecture model). The grammar is available at
     `grammar/architecture.ebnf` and the concept reference at
     `references/SOFTWARE-ARCHITECTURE-METAMODEL.md` (load them when you need to resolve a construct).
  2. a **stack-binding artifact** — the C4-level-4 replacement. It maps the logical, tech-agnostic
     `.arch` to a concrete stack: **type → language type** (e.g. `struct → Java record`,
     `string → java.lang.String`, `list<T> → List<T>`) and **protocol → framework** (e.g.
     `"REST/JSON" → Spring WebMVC`, `"gRPC" → grpc-java`, channel broker `"Kafka" → spring-kafka`). Its
     shape and a worked example are in `constructs/stack-binding.md`. If the user supplies one, use it; if
     not, synthesize a default for the chosen stack from `constructs/stack-binding.md` and ask the user to
     confirm before generating.
  3. optionally, the linked `.domain` (resolved via `domain-source`) and `.sysreq` (via
     `requirements-source`) so `realizes`/`satisfies`/`import … from domain` references resolve to real
     types and requirement ids.
- **Output:** a per-container source tree of scaffolding — runnable module per container, component
  service skeletons, interface stubs generated from the typed contracts, generated/derived type models
  (struct/enum/union/typedef/exception), connector adapters (clients + endpoints) and channel
  producers/consumers. Plus a short `build-code.report` summarizing what was generated, the binding used,
  unsatisfied required ports, and any `// UNCLEAR` / `// NOTE` markers needing human attention.

---

## Workflow

### Phase 1 — Read & plan

1. Locate the `.arch` file(s). If none exist, stop and delegate to `architecture-design`.
2. Locate or synthesize the **stack-binding artifact** (see Input). Confirm the target stack with the user;
   then load the matching heuristic file:
   - `heuristics/java-spring.md` — Java 21 / Spring Boot 3
   - `heuristics/typescript-nestjs.md` — TypeScript / NestJS
   - `heuristics/clojure.md` — Clojure
3. Parse the `architecture → system → container → component` hierarchy and build an inventory:
   - **types** (`struct`, `enum`, `typedef`, `union`, `exception`) and `import … from domain` references;
   - **interfaces** and their `operation`s (style, args with ordinals/requiredness/defaults, return,
     `throws`);
   - **components**, their `boundedContext`, `realizes` modules, and **ports** (`provides` / `requires`);
   - **containers** and their `technology`, container-level ports, and contained components;
   - **connectors** (`connect A.Port -> B over "<protocol>" <style>`) — build the dependency graph;
   - **channels** (`channel c on <Broker> { carries … }`) and each component's `publishes`/`subscribes`;
   - **environments** and their `deploy … replicas …` placements.
4. **Resolve the topology before emitting code.** For every `requires` (required port), find the connector
   that binds it to a `provides` of the same interface. Flag any unwired required port. Use the connector's
   protocol + style to pick the adapter shape from the binding (see Phase 2). Decide one runnable module per
   container; map `technology` strings (databases, brokers, caches) onto infrastructure rather than service
   code.

### Phase 2 — Generate per element

Walk the model and emit scaffolding for every element using the **Element → code contract** below,
specialized by the chosen stack's heuristic and the bindings. Generate in dependency order: **types first**
(typedefs, enums, structs, unions, exceptions, and imported domain types), then **interfaces** (the
contracts), then **components** (service skeletons that `provides`/`requires` those interfaces), then
**connectors** (clients for required ports + transport endpoints for provided ports, per protocol/style),
then **channels** (producers/consumers per broker), then **containers** (module/project descriptor +
wiring/composition root), then **environments** (deployment manifests).

### Phase 3 — Traceability & gaps

5. Carry every `satisfies [REQ-…, NFR-…]` declaration into the generated code as a comment/annotation on
   the corresponding type/interface/component/container (see **Traceability**). NFRs in particular should
   annotate the element that addresses them.
6. Carry every `realizes` link as a `// realizes:` comment and, for a component that `realizes module
   "…"`, leave the delegation seam to that domain module's code (the `domain-build-code` output) rather
   than inlining logic.
7. For anything the model or the binding leaves unspecified (an operation with no domain backing, an
   unmapped type or protocol, an unwired required port, an `// UNCLEAR` marker), emit a compiling stub
   annotated with `// UNCLEAR: <reason>` and list it in `build-code.report`.
8. Write `build-code.report`: stack + binding used, files generated (count per element kind), every
   unwired required port, every unmapped type/protocol, and every `// UNCLEAR` / `// NOTE` marker.

---

## Element → code contract (stack-agnostic)

This is the contract every stack heuristic specializes. Read it as "an `.arch` *X* becomes code *Y*". The
exact language type for each Thrift type and the framework for each protocol come from the **stack-binding
artifact**; this table fixes the *shape*.

| `.arch` element | Code artefact |
|---|---|
| **`architecture` (root)** | The workspace/repository root. `domain-source` / `requirements-source` are recorded as provenance comments and used to resolve `realizes`/`satisfies`/imports. |
| **`system`** | The project/solution that aggregates all container modules; shared contracts (system-scope interfaces and types) live in a shared/contracts module. |
| **`person`** | No code — a documented actor. May appear as the left side of a connector (an inbound client/UI), generated only if that connector targets one of our provided ports. |
| **`externalSystem`** | An **outbound client** for each interface it `provides` (we call it) and an **inbound endpoint/handler** for each interface it `consumes` (it calls us). Opaque: no internal decomposition. `realizes` records the upstream domain context. |
| **`boundedContext`** | A grouping tag (package/namespace segment or module marker) applied to the components tagged with it. No runtime artefact. |
| **`container`** | A separately runnable/deployable **module/project**: its own build descriptor, dependency set, and composition root. A container whose `technology` is a datastore/broker/cache (e.g. `"PostgreSQL"`, `"Kafka"`) becomes **infrastructure config**, not service code. Container-level `provides`/`requires` become module-level ports (a black-box surface). |
| **`component`** | A **service skeleton** (class/module) inside its container. It implements every interface it `provides`, holds a typed client field for every interface it `requires`, and exposes publish/subscribe hooks for its channels. `realizes module "…"` ⇒ a delegation seam to that domain module's code (do not inline business logic). `boundedContext` ⇒ its grouping tag. |
| **`interface`** | A **typed contract type** (interface / protocol / port type) owning its operations' signatures. `realizes` a domain interface ⇒ a provenance comment. It is the unit of the provided/required port model. |
| **`operation`** | A **method on the interface**. The interaction `style` fixes its shape: *default* ⇒ request-response method returning the type (a command); `safe` ⇒ idempotent read method (a query, no mutation); `oneway` ⇒ fire-and-forget returning `void` (event emission); `streaming` ⇒ a stream/iterator/reactive return. Operation names are technical `camelCase` identifiers, kept verbatim. The body is a stub that delegates to the realized domain module or throws "not implemented". |
| **`argument`** | A typed method parameter. The Thrift **ordinal** and **`required`/`optional`** marker drive the wire mapping (proto/thrift field number, nullable vs non-null); a `= default` becomes the parameter/field default. |
| **`struct`** | An immutable **data-transfer/message type** — a record/class/map whose fields carry ordinals + requiredness. `required` ⇒ non-nullable; `optional` ⇒ nullable/absent. No behaviour. The payload of operations and channel messages. |
| **`field`** | A typed member with ordinal, requiredness, optional default; type may be primitive, container (`list/set/map`), named, or an imported domain value type. |
| **`enum`** | A language `enum` whose members carry their explicit integer ordinals (wire values). |
| **`typedef`** | A type alias / newtype giving domain meaning to a primitive (e.g. `typedef Url = string`). |
| **`union`** | A **tagged union / sealed type** — exactly one ordinaled member set at a time (sealed interface, discriminated union, oneof). |
| **`exception`** | A **struct-shaped error type** (an exception/error class) that operations declare in `throws`; it is the architecture realization of a domain error event. Maps onto the protocol's error channel (HTTP status, gRPC status, Thrift exception). |
| **`import value type … from domain`** | Reference the domain value type generated by `domain-build-code` (do not re-declare it); use it as a field/arg type. |
| **`import event … from domain`** | Reference the domain event type as a channel message contract (do not re-declare it). |
| **provided port** (`provides I`) | The component/container/external-system **implements** interface `I` and is registered so connectors can route to it. |
| **required port** (`requires I`) | The component/container holds a **typed client** for interface `I`, injected; unsatisfied until a connector binds it. An unwired required port ⇒ `// UNCLEAR` stub client + report entry. |
| **`connector`** (`connect A.Port -> B over "<protocol>" <sync\|async\|streaming>`) | Two halves resolved via the binding's *protocol → framework* map: on the **consumer** side, a transport **client** implementing the required interface over `<protocol>`; on the **provider** side, the transport **endpoint/controller** exposing the provided interface over `<protocol>`. `sync` ⇒ blocking call; `async` ⇒ non-blocking/message; `streaming` ⇒ stream. External systems at either end ⇒ generate the half that crosses our boundary. |
| **`channel`** (`channel c on <Broker> { carries M… }`) | A named topic/queue on the broker container. Generate, via the binding's broker framework: a **producer** for each `publishes M to c` and a **consumer/listener** for each `subscribes c`, typed by the carried message types (often imported domain events). The channel is the contract; producers/consumers are decoupled. |
| **`environment`** (`environment e { deploy C replicas n … }`) | A **deployment manifest** (compose/k8s/Helm-style per binding) placing each container with its replica hint. Placement + replicas only — no infra/networking detail. |
| **`satisfies [REQ-…, NFR-…]`** | A traceability comment/annotation on the generated artefact (see below). |
| **`realizes …`** | A `// realizes:` comment; for `module` it also marks the domain-delegation seam. |

---

## Output layout

Default to a **module-per-container** layout, with shared contracts factored out, mirroring the model:

```
<root>/                          # the architecture root (workspace)
  contracts/                     # system-scope shared types + interfaces (the .arch contracts)
    types/                       # struct, enum, union, typedef, exception (generated)
    interfaces/                  # interface contract types (one per `interface`)
  <Container>/                   # one runnable module per `container` (service containers only)
    components/                  # one service skeleton per `component`
    adapters/
      inbound/                   # transport endpoints for provided ports (per connector protocol)
      outbound/                  # transport clients for required ports (per connector protocol)
    messaging/                   # channel producers (publishes) + consumers (subscribes)
    composition/                 # the container's wiring / composition root
    <build-descriptor>          # module manifest, deps from the binding
  deploy/
    <environment>/               # deployment manifest per `environment` (placement + replicas)
```

Datastore/broker/cache containers (a `technology` with no components) contribute **infrastructure config**
(connection settings, topic declarations) under the relevant consumer modules and under `deploy/`, not a
service module. The exact folder/package conventions come from the chosen stack's heuristic file.

---

## Traceability

Every element with a `satisfies [REQ-…, NFR-…]` declaration must carry those ids into the code so the
scaffolding stays navigable back to its requirements — a doc comment or annotation on the
type/interface/component/container, e.g. `// satisfies: NFR-PERF-001`. Carry `realizes` links the same way:
`// realizes: module "Link Management"`, `// realizes: event LinkCreated`. Annotate each generated artefact
with the `.arch` construct it came from (`// from: component LinkController`), mirroring the `// source:`
provenance convention in reverse. When the linked `.domain` is available, the domain references resolve to
real types from the `domain-build-code` output; when it is not, leave the reference as a comment and flag it
in the report.

---

## Conventions

- **`// UNCLEAR:`** — the model or the binding under-specifies this artefact (operation with no domain
  backing, unmapped type/protocol, unwired required port, ambiguous connector target). Emit a compiling
  stub and flag it; never invent contracts or business logic.
- **`// NOTE:`** — an infrastructure/wiring decision you made that isn't in the model or binding (e.g. a
  default serialization, a chosen client library), so the human can review it.
- Names: keep the model's `PascalCase` type/interface/container/component names and its `camelCase`
  operation/field/channel/environment names verbatim — operation names are technical identifiers, not
  business-language labels.
- Primitives are lowercase in `.arch` (`string`, `int`/`integer`, `long`, `double`, `decimal`, `boolean`,
  `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`; `void` is return-only) — map each
  via the binding's *type → language type* table.
- Respect Thrift **ordinals** and **`required`/`optional`**: they are wire-load-bearing. Preserve ordinals
  in any generated IDL/proto/thrift and honour requiredness as nullability.
- Do not generate business logic, validation rules, invariants, or reactions — those are the domain
  layer's job (`domain-build-code`). This skill stops at the structural seam and delegates.
- Do not generate tests unless asked; when you do, derive them from interface signatures and connector
  topology (every required port is reachable, every channel round-trips its message types).

---

## Stack heuristics

The per-stack realization of the contract lives in a heuristic file you load on demand for the chosen
stack. Each maps every element above — plus each Thrift type and interaction style — to concrete, idiomatic
scaffolding for that stack, and pairs with the *type → language* / *protocol → framework* tables of the
stack-binding artifact:

- **Java / Spring Boot** → `heuristics/java-spring.md`
- **TypeScript / NestJS** → `heuristics/typescript-nestjs.md`
- **Clojure** → `heuristics/clojure.md`

Load the one matching the target stack and apply its patterns. If the user asks for a stack not listed,
fall back to the stack-agnostic contract above plus the stack-binding artifact and produce idiomatic
scaffolding for that language, flagging choices with `// NOTE:`.

---

## The stack-binding artifact

The `.arch` model is **logical and tech-agnostic except for coarse container technology**; the stack-binding
artifact is what makes code generation concrete and keeps a single `.arch` reusable across stacks. Its
schema, the two mapping tables it must carry (*type → language type*, *protocol → framework*), and a worked
default for each supported stack are documented in:

### Stack-binding artifact (the C4 level-4 replacement)

The `.arch` model never names a language or framework beyond a container's coarse `technology` string. The
**stack-binding artifact** is the separate, swappable input that maps the logical model to one concrete
stack. It carries two mapping tables plus generation conventions. Represent it as a small YAML/EDN/JSON
file (`stack-binding.<ext>`) alongside the `.arch`; if the user has none, synthesize a default for the
chosen stack from the worked examples below and ask them to confirm it before generating.

**Required contents:**

1. **`stack`** — the target identifier (`java-spring` | `typescript-nestjs` | `clojure` | other).
2. **`type → language type`** — every Thrift primitive, container type, and structural kind mapped to a
   concrete language type / shape. Must cover all `.arch` primitives (`string`, `int`/`integer`, `long`,
   `double`, `decimal`, `boolean`, `date`, `datetime`, `time`, `instant`, `duration`, `uuid`, `binary`,
   `void`), the container types (`list<T>`, `set<T>`, `map<K,V>`), and the structural kinds (`struct`,
   `enum`, `union`, `typedef`, `exception`).
3. **`protocol → framework`** — every connector `over "<protocol>"` string mapped to the client +
   endpoint framework (and serializer) used to realize that transport; plus each broker `technology` (the
   container hosting a channel) mapped to its messaging framework.
4. **conventions** — root package/namespace, build tool, module/folder naming, deployment-manifest target
   (compose / k8s / Helm).

Any `.arch` type or protocol with no entry in these tables is **unmapped**: emit an `// UNCLEAR:` stub and
list it in `build-code.report` rather than guessing.

#### Worked default — `java-spring`

```yaml
stack: java-spring
conventions:
  rootPackage: com.example.shortlink
  build: gradle-multi-module      # one module per container
  deploy: kubernetes              # environment → k8s manifests
types:
  string:   java.lang.String
  int:      int            # integer → int
  integer:  int
  long:     long
  double:   double
  decimal:  java.math.BigDecimal
  boolean:  boolean
  date:     java.time.LocalDate
  datetime: java.time.LocalDateTime
  time:     java.time.LocalTime
  instant:  java.time.Instant
  duration: java.time.Duration
  uuid:     java.util.UUID
  binary:   byte[]
  void:     void
  list<T>:  java.util.List<T>
  set<T>:   java.util.Set<T>
  map<K,V>: java.util.Map<K,V>
  struct:   record                # immutable record, fields by ordinal order
  enum:     enum                  # constants carry their ordinal
  union:    sealed-interface      # one record per member (oneof)
  typedef:  record-newtype        # single-field wrapper record
  exception: RuntimeException-subclass
protocols:
  "REST/JSON":  { client: spring-webclient, endpoint: spring-webmvc-controller, codec: jackson }
  "gRPC":       { client: grpc-java-stub,    endpoint: grpc-java-service,        codec: protobuf }
  "Thrift":     { client: thrift-client,     endpoint: thrift-processor,         codec: thrift }
  "HTTPS":      { client: spring-webclient,  endpoint: spring-webmvc-controller, codec: jackson }
brokers:
  Kafka:   spring-kafka            # @KafkaListener consumers, KafkaTemplate producers
  RabbitMQ: spring-amqp
```

#### Worked default — `typescript-nestjs`

```yaml
stack: typescript-nestjs
conventions:
  rootNamespace: "@shortlink"
  build: nx-monorepo               # one app/lib per container
  deploy: docker-compose
types:
  string: string
  int: number            # integer → number
  integer: number
  long: bigint
  double: number
  decimal: string        # decimal.js / string to avoid float loss; NOTE the choice
  boolean: boolean
  date: string           # ISO date
  datetime: Date
  time: string
  instant: Date
  duration: string       # ISO-8601 duration
  uuid: string
  binary: Buffer
  void: void
  list<T>: "T[]"
  set<T>: "Set<T>"
  map<K,V>: "Map<K,V>"
  struct: interface       # or class with class-validator decorators on the DTO edge
  enum: enum
  union: discriminated-union
  typedef: branded-type   # `type Url = string & { __brand: 'Url' }`
  exception: Error-subclass   # maps to a Nest HttpException at the edge
protocols:
  "REST/JSON": { client: nest-httpservice-axios, endpoint: nest-controller, codec: json }
  "gRPC":      { client: nest-grpc-client,        endpoint: nest-grpc-controller, codec: protobuf }
  "HTTPS":     { client: nest-httpservice-axios,  endpoint: nest-controller,      codec: json }
brokers:
  Kafka:    nest-microservice-kafka
  RabbitMQ: nest-microservice-rmq
```

#### Worked default — `clojure`

```yaml
stack: clojure
conventions:
  rootNamespace: shortlink
  build: deps-edn-monorepo
  deploy: docker-compose
types:
  string: string
  int: long              # integer → long
  integer: long
  long: long
  double: double
  decimal: java.math.BigDecimal
  boolean: boolean
  date: java.time.LocalDate
  datetime: java.time.LocalDateTime
  time: java.time.LocalTime
  instant: java.time.Instant
  duration: java.time.Duration
  uuid: java.util.UUID
  binary: bytes
  void: nil
  list<T>: vector
  set<T>: set
  map<K,V>: map
  struct: malli-schema        # a map schema; field requiredness via :optional
  enum: keyword-enum          # [:enum :active :disabled :expired]
  union: malli-multi          # :multi / :or schema
  typedef: malli-alias
  exception: ex-info          # {:type ::slug-taken ...}
protocols:
  "REST/JSON": { client: hato, endpoint: reitit-ring, codec: jsonista }
  "gRPC":      { client: grpc-clj, endpoint: grpc-clj, codec: protobuf }
  "HTTPS":     { client: hato,   endpoint: reitit-ring, codec: jsonista }
brokers:
  Kafka:    jackdaw
  RabbitMQ: langohr
```

---

## Reference material (load on demand)

- **Grammar** — the authoritative `.arch` syntax, for resolving any construct:

  `grammar/architecture.ebnf`

- **Metamodel** — the concepts, relations, C4 mapping, and domain-mapping tables:

  `references/SOFTWARE-ARCHITECTURE-METAMODEL.md`
